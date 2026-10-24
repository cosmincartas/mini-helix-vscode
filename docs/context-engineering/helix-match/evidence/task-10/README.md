# Task 10 evidence: match change hunks against HEAD (`mig`, `mag`)

Plan Task 10 (FR-1, FR-2, FR-10, NFR-2, NFR-4; F-7, F-10). Host: linux-x64, `cargo +1.90.0`. Raw outputs in `logs/*.txt`; hashes in `file-hashes.txt`.

## Result

| Check | Result | Log |
|---|---|---|
| `cargo test --locked -p mini-helix-match-helper --test textobjects_git` | 13 passed (34 oracle git cases replayed step by step through the helper process, settled hunks of 32 compared) | `final-green-textobjects_git.txt` |
| full crate tests, without / with `--features test-support` | all pass (rc=0 both) | `final-crate-plain.txt`, `final-crate-test-support.txt` |
| `npm run test:match:oracle` | OK (674 cases + self-test) after the fixture identity refresh below | `final-oracle.txt` |
| `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` | 166 pass, 0 fail | `final-npm-compile-test.txt` |
| `npm run check:keybindings` | rc=0 | `final-check-keybindings.txt` |
| `node native/runtime/compare-cargo-lock.cjs` | 0 deviations (337 upstream pairs, 288 used, 50 pruned, 1 added: path package) | `final-compare-cargo-lock.txt` |
| `npm run check:helix-runtime` | OK, runtimeHash `fd5ee12cf7562458cc18a3c419f829aa100abafd3c685bc5b4680206dffbea2b` (unchanged) | `final-check-helix-runtime.txt` |
| 24 baseline files | 23 identical; `package.json` differs (pre-existing: earlier tasks' two scripts; not touched here) | `baseline-hashes.txt` |
| mutation: `trust_full = true` regardless of trust | 3 tests fail (`settled_hunks_equal_the_oracle_diff`, `untrusted_workspaces_never_run_repository_local_filter_programs`, `every_git_oracle_case_...`); source restored, SHA-256 `a1f4136e...ac54cf` identical | `mutation-ignore-trust.txt` |

RED: `logs/red-1-g-not-implemented.txt` (the `g` arm temporarily returning the pre-task `object_not_implemented`: 10 process-level tests fail). Honest note: the module was written before the test file, so the 3 library-level tests (`scope_accounting`, identity, settled hunks) passed in the RED run.

## Dependency and lock impact

`native/match-helper/Cargo.toml` gains `helix-vcs` (path, feature `git` = gix), `helix-view` (path; only `document::from_reader` is called, the decode `Document::set_diff_base` performs) and `tokio` (rt, rt-multi-thread, time; the runtime the pinned diff worker runs on).
`native/Cargo.lock` was re-resolved starting from the pinned upstream lock (so every version/checksum equals upstream): 245 -> 288 pairs, 0 deviations.
Seeding with the previous pruned lock instead let cargo choose newer versions (32 deviations, discarded). `helix-lock.json`: only `cargoLockSha256` changed (`diff` in `logs/update-lock-build-match.txt` flow); inventory and runtime hashes unchanged.
Size: release helper 3.6 MB (Task 2) -> 10.8 MB unstripped, 8.55 MB stripped (gix, helix-view, helix-lsp/dap are linked; stripping measured with `strip`). This is a packaging concern for Task 21; not reduced here.

## Oracle extension (additive, reported)

`native/oracle/src/main.rs`, struct `Git` gained two optional fields (`#[serde(default)]`): `attributes` (content of `.gitattributes`, written at the repository root and staged before the baseline commit) and `config` (text appended to the repository-local `.git/config` right after `git init`). `init_git_repo` uses them only when present. No other oracle code changed. Cases without the fields behave as before; the oracle self-test and the regenerated outputs prove it (below). The JSON schema/README of the fixtures were NOT updated (outside scope): `schema/case-file.schema.json` `git.additionalProperties:false` does not list the two fields (the runner does not validate against the schema).

New fixture: `test/fixtures/helix-match/cases/git-hunks-2.json` (22 cases, inputs from `oracle-case-input-generator.cjs.txt`, `expected` produced only by `npm run test:match:oracle -- --update --filter git-hunks-2`).

### Proof that existing outputs are unchanged
The 12 pre-existing case files were byte-identical after the filtered `--update` (hashes in `logs/fixtures-before-sha256.txt`). Then the required `cargoLockSha256` change made the oracle gate reject 652 stored results because each embeds `reference.cargoLockSha256` (the reference identity; by design "expected results cannot silently outlive the reference"). I regenerated all fixtures. `logs/oracle-update-diff-proof.txt` (structural JSON comparison of pre- and post-files): 652 differences, every one `/reference/cargoLockSha256` 01b15f23... -> f9ca4e5d..., 0 other differences. So all existing expected behaviour values are identical; the files are not byte-identical because of that identity field. Needs supervisor ratification.

## Design

### Modules
* `native/match-helper/src/git/mod.rs`: `GitBaselines` (one per session, in `Session`, reset by `initialize`, released on `close`). Baseline metadata is isolated from `documents` (which only gained read-only `local_path`/`trust` on `ReplicaView`).
* `evaluate/textobjects.rs`: `Environment.diff` and the `g` row; `evaluate/mod.rs`: `wants_hunks` (only `mi`/`ma` + key `g` touches Git).

### Baseline identity and refresh
Every `mig`/`mag` first calls pinned `DiffProviderRegistry::get_diff_base(path, trust_full)` again (no read before the lookup), decodes with `from_reader(.., UTF-8)`, and builds the identity:

| Part | Source |
|---|---|
| path | canonical local path (symlinks resolved; as given if the file is missing): separates linked worktrees and symlinked checkouts |
| trust | replica trust state (`open`/`snapshot`/`configure`) |
| head | `get_current_head_name` (branch, or short commit) |
| baseline_sha256 | SHA-256 of the converted baseline bytes: new HEAD blob and every conversion (`core.autocrlf`, `.gitattributes`, filter drivers) |

Same identity and generation: the `DiffHandle` is reused (`update_document` when only the text changed). Otherwise a new `DiffHandle` replaces it. Lookup unavailable (or undecodable): the entry is dropped and `g` returns the reference `info` status `Diff is not available in current buffer` with the normalized selection unchanged (upstream `doc.diff_handle().is_none()`); no empty baseline is ever invented (a tracked EMPTY file is available, oracle case `tracked-empty-baseline`). The wait for the asynchronous worker is bounded (15 s, stable `internal_error/diff_timeout`) and succeeds when the published diff carries exactly the replica text and the decoded baseline (the oracle's settle condition). Repository identity beyond the resolved path is not separately exposed by helix-vcs; HEAD movement that leaves branch name and baseline bytes unchanged cannot change the result.
Guards added in front of the pinned lookup: a relative path or a path that exists and is not a file is unavailable (the pinned `git::get_diff_base` has `debug_assert!`s that would abort debug builds).

### Adapter inventory (pinned revision ba40e547426b0f9896c8bdc699a4ab11f2b37dbc, patched tree `native/upstream/helix`)
| Symbol | Location | Where adapted |
|---|---|---|
| `select_textobject` `ch == 'g' && doc.diff_handle().is_none()` -> `set_status` | helix-term/src/commands.rs:6282-6285 | `textobjects::select_textobject` early return |
| `textobject_change` closure | helix-term/src/commands.rs:6287-6301 | closure in `select_textobject` (lock taken once per request instead of per range) |
| object table row `'g'` | helix-term/src/commands.rs:6322 | `(None, 'g')` arm |
| `Editor::open` baseline lookup | helix-view/src/editor.rs:2125-2127 | `GitBaselines::refresh` (runs before every evaluation) |
| `Document::reload` baseline refresh | helix-view/src/document.rs:1313-1316 | `refresh`: unavailable => no handle |
| `Document::set_diff_base` | helix-view/src/document.rs:1993-2002 | `refresh` (`from_reader` + `DiffHandle::new`) |
| `Document::apply` -> `update_document` | helix-view/src/document.rs:1529-1531 | `refresh` (text-only change) |
| `helix_view::document::from_reader` | helix-view/src/document.rs:467 | called unchanged |
| `DiffProviderRegistry::get_diff_base`, `get_current_head_name` | helix-vcs/src/lib.rs:33, :47 | called unchanged |
| `git::get_diff_base`, `open_repo` (trust forces `Trust::Reduced`) | helix-vcs/src/git.rs:30, :96 | reached through the registry |
| `DiffHandle::new/load/update_document`, `Diff::hunk_at/nth_hunk/diff_base/doc` | helix-vcs/src/diff.rs:47, :75, :85, :247, :159, :136, :145 | called unchanged |
| `Range::cursor_line/with_direction`, `Selection::transform` | helix-core/src/selection.rs | called unchanged |

## Scenario coverage (oracle-backed vs code-reading-backed)

| Scenario | Backing | Test |
|---|---|---|
| modified line, `mig`/`mag`, multiple cursors, outside hunk, added/pure-deletion (neighbour, line end), BOM | ORACLE (git-hunks, 12 cases) | `every_git_oracle_case_...`, `settled_hunks_equal_the_oracle_diff` |
| pure removals at first line, EOF, whole file, cursor before removal | ORACLE (git-hunks-2) | same |
| added block, backward direction, count ignored, two cursors, multi-line range, tracked empty baseline, astral chars, non-ASCII path with space | ORACLE | same |
| CRLF: `core.autocrlf` (trusted and untrusted), `.gitattributes eol=crlf` (both trust states), CRLF text vs LF baseline, BOM+CRLF | ORACLE (new additive input) | same |
| repository-local smudge filter trusted vs untrusted (smudge upper-cases: observable baseline difference) | ORACLE | same |
| HEAD change (two oracle states H1/H2) | ORACLE states; the mid-session move is CODE-READING (oracle cannot move HEAD) | `head_changes_refresh_the_baseline_before_each_evaluation`, identity test |
| untracked file; scratch buffer without path | ORACLE (reference unavailable status) | same |
| unsaved edits via `change` events | ORACLE selections (text of an oracle case) | `unsaved_edits_in_the_session_are_diffed_against_head` |
| staged change | CODE-READING (HEAD commit blob only; equals oracle `mig-modified-line`) - pending oracle coverage | `staged_changes_do_not_move_the_baseline` |
| deleted working file | CODE-READING (`realpath` accepts missing files; equals `mig-modified-line`) - pending | `deleted_working_file_still_uses_the_head_baseline` |
| symlinked checkout directory and symlink file in the repo | CODE-READING (`gix::path::realpath`; equals `mig-modified-line`) - pending | `symlinked_checkouts_and_files_...` |
| linked worktree with its own HEAD (main = H1, worktree = H2) | ORACLE states, CODE-READING topology - pending | `linked_worktrees_use_their_own_head` |
| untitled, virtual (`vscode-vfs:`, `git:`) URIs; relative path; directory path | CODE-READING (no local path => no lookup; equals oracle `mig-no-repository`) - pending | `untitled_virtual_relative_and_directory_paths_...` |
| missing repository / non-existent directory | CODE-READING (repository discovery fails) - pending | `a_document_outside_any_repository_is_unavailable` |
| identity parts and cache validity | library seam, behaviour test (no oracle equivalent) | `baseline_identity_is_refreshed_...` |
| no filter program runs when untrusted (marker file) | CODE-READING/behaviour (oracle cannot observe side effects) plus the oracle smudge cases above | `untrusted_workspaces_never_run_...` |
Not covered: invalid-UTF-8 and UTF-16-BOM baselines (oracle `head` is a JSON string), submodules, sparse checkouts, `core.fsmonitor`/hooks, Windows/macOS path forms. Pending, not passing.

## Trust and filter evidence
Test `untrusted_workspaces_never_run_repository_local_filter_programs`: repository-local `filter.up.smudge = touch <marker> && tr a-z A-Z` plus `.gitattributes`. Building the repository (git CLI add/commit) never runs smudge (marker absent, asserted). Untrusted: marker stays absent and the baseline is the unfiltered blob (oracle `filter-smudge-untrusted`: whole file differs). Trusted: the marker is created and the baseline is upper-cased (oracle `filter-smudge-trusted`); recorded as observed upstream behaviour. Built-in conversions (`core.autocrlf`, `eol=crlf`) apply in both trust states (oracle cases). Mutation `trust_full = true` fails the test.

## Compatibility edits (tests asserting `g` not implemented)
* `native/match-helper/tests/textobjects_plain.rs`: `g` on an untitled replica now asserts the unavailable proposal (info status) instead of `object_not_implemented`.
* `test/unit/matchEvaluate.test.ts`: same assertion for the TS client.
* `src/native/protocol.ts`: doc comment of `EvaluateParams` only.
* `native/match-helper/tests/common/oracle.rs`: new `Scope::Git`; `common/mod.rs`: `Helper::start_env`/`start_with_env`.

## Deviations and pending
1. All 674 fixtures regenerated (identity field only); see above. Needs ratification.
2. Helper binary size growth (+5.7 MB stripped).
3. Fixture schema/README not updated for `git.attributes`/`git.config`. (Resolved in the Correction section below, P10R-2.)
4. In-process library tests set `HOME`/`GIT_CONFIG_*` for the test process once; helper-process tests pass them explicitly.
5. Code-reading-backed scenarios above are pending oracle coverage, not parity claims.

## Correction (task #50: initial-review findings P10R-1, P10R-2, P10R-3)
Evidence: `correction/*.txt`. No contract change, no new dependency (`native/Cargo.lock` hash unchanged), no existing oracle expected value changed (`correction/precorrection-diff.txt`: no `cases/*.json` differs from `precorrection.tar`; `npm run test:match:oracle` OK).

### P10R-1 diff settle timeout declared once and tested
* `protocol::POLICY.diff_settle_timeout` (15 s, `native/match-helper/src/protocol/mod.rs`) is now the single declaration; `git/mod.rs` reads it (the local `SETTLE_TIMEOUT` constant is gone). `tests/fixtures/protocol/constants.json` has `diffSettleTimeoutMs: 15000`, checked against `POLICY` by `constants_fixtures_and_implementation_agree_on_one_compatibility_check` (`tests/protocol.rs`). The TypeScript mirror (`src/native/protocol.ts`) needs no constant: the client never uses the value and its compatibility check (`test/unit/matchClient.test.ts`) lists the client-relevant constants only; `REQUEST_TIMEOUT_MS` (30 s) stays above it, which the `Policy` doc comment records.
* Failure path: test-only method `test_set_diff_settle {timeoutMs?, withholdPublication?}` (cargo feature `test-support`, test binary only; not in production capabilities; typed in `TestMethods`). `withholdPublication` makes the settle wait never observe a published diff, so the timeout is deterministic. Test `a_diff_that_is_not_published_in_time_fails_with_diff_timeout_and_the_session_continues`: `mig` answers `internal_error/diff_timeout` after at least the configured wait, the response contains neither the document text nor the baseline text, the error does not end the session (`terminates_session` is false), and after clearing the injection the same document replays its oracle case.

### P10R-2 fixture schema
`test/fixtures/helix-match/schema/case-file.schema.json`: the `git` object gains optional string properties `attributes` (`.gitattributes` content written and staged before the baseline commit) and `config` (text appended to `.git/config` after init); `test/fixtures/helix-match/README.md` documents both in the `git` row. `correction/schema-validation.txt`: ajv 8.20 (repository `node_modules`, scratch validator `/tmp/hm-p10cr-schema/validate.cjs`, not committed) validates all 13 case files; `git-hunks-2.json` (8 occurrences) and the other 11 files are valid. `selection-identity.json` (Task 7, 28 cases) does NOT validate: its tag `selection-identity` is not in the schema's `tags` enum and its `steps` arrays are empty (`minItems: 1`). That is independent of Git and of this finding; it is left unchanged and reported for a decision (schema or fixture).

### P10R-3 baseline identity on `evaluate`
Design (no contract change; the field is optional, so existing clients and fixtures are unchanged):
* Request: optional `baselineIdentity: {localPath: string|null, trust: 'trusted'|'untrusted', token?: string}` (`evaluate/mod.rs` `BaselineIdentityParams`, `deny_unknown_fields`). It is accepted for Git-object evaluations (`mi`/`ma` with `g`) only; on any other request the answer is `invalid_request/baseline_identity_not_applicable`.
* Validation against the replica: `localPath` (absent/null = untitled or virtual) and `trust` must equal what `open`/`snapshot`/`configure` last set; a difference is `resync_required/baseline_identity_mismatch` with `data: {field}` and no text. The client's values are never used for the lookup.
* The helper still refreshes HEAD and the converted baseline before every Git-object evaluation (`GitBaselines::refresh`), so the cache is used only while its identity (path, trust, HEAD, baseline bytes) holds (spec L523).
* The helper-derived identity is returned in every Git-object proposal as `baselineIdentity` (opaque: SHA-256 over path, trust, HEAD name, baseline SHA-256; reveals no path or text; `null` when no baseline is available). A client carries it in the next request's `token`; when it differs from the freshly refreshed identity the answer is `resync_required/baseline_identity_stale` with `data: {baselineIdentity: <current token or null>}`, so a client learns the current identity without a second round trip.
* Spec L419 ("baseline identity when required"): the client states its identity inputs (path, trust, optional token) in the evaluate request for exactly the requests that need a baseline; a spec-following client no longer gets `invalid_request`. Spec L515-530: repository/HEAD/path/conversion/trust remain helper-derived; the client contributes the inputs it knows and detects drift.
* Tests: `evaluate_accepts_and_validates_the_baseline_identity_and_returns_the_helper_derived_token` (plain, mismatch of path/null/trust, HEAD move with a stale token and the current token carried forward, refresh without token, non-Git request, unknown member, untitled null token). TypeScript typing: `EvaluateParams.baselineIdentity`, `EvaluateProposal.baselineIdentity` in `src/native/protocol.ts` (typing only; the extension does not send it yet).

### Scope note
`native/match-helper/src/protocol/session.rs` and `tests/common/mod.rs` (`start_test_support_env`) changed only to register the test-only method and start the test helper with the hermetic Git environment. The packaged helper binary under `native/runtime/out` was not rebuilt or written.
