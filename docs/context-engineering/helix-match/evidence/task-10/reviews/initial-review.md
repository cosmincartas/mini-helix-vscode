# Task 10 Initial Review (Claude Code reviewer, task #49)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #15 (plan Task 10); snapshot `pre-task10` → delta list `post-task10/delta-files.txt`. The reviewer reached its turn limit once and was continued in the same context.
Orchestrator filter: P10R-1 (spec L405), P10R-2 (Task 3 published fixture schema/README now misdescribe a committed fixture), P10R-3 (spec L419) accepted. Non-findings not accepted.

## Verdict

Accept with three P3 follow-ups; no P0-P2; `g` matches pinned upstream; all checks pass.

## Findings

| ID | Sev | Location | Title |
|---|---|---|---|
| P10R-1 | P3 | `native/match-helper/src/git/mod.rs:63-64, 105-107, 213-226` | Diff settle timeout declared outside the single timeout policy; failure path untested |
| P10R-2 | P3 | `test/fixtures/helix-match/schema/case-file.schema.json:66-75`; `test/fixtures/helix-match/README.md:38` | Committed `git-hunks-2.json` breaks the published case-file schema |
| P10R-3 | P3 | `native/match-helper/src/evaluate/mod.rs:86-101`; `evidence/task-10/README.md:103-108` | Spec `evaluate` field "baseline identity when required" neither implemented nor recorded as a deviation |

P10R-1: a `mig`/`mag` whose diff worker does not publish within 15 s returns `internal_error/diff_timeout`. `SETTLE_TIMEOUT` is local to `git/mod.rs`; `protocol/mod.rs:5` claims the single timeout-policy declaration; `POLICY` (`protocol/mod.rs:35-54`) and `tests/fixtures/protocol/constants.json` omit it; no test covers `diff_timeout`. Basis: spec L405. Suggested fix: move to `protocol::POLICY` and constants fixture; deterministic failure-path test (e.g. test-support override) asserting the stable error and continued session.

P10R-2: schema `git` object is `additionalProperties: false` with `head`/`path`/`trust`; 8 `config`/`attributes` occurrences in `git-hunks-2.json` are invalid; README L17 names the schema as the format and L38 documents `git` as `{head, path, trust}`. No automated schema check exists (runner checks `schemaVersion`/`group`/`cases`), so nothing breaks today; documentation drift disclosed by the worker. Suggested fix: add optional `attributes`/`config` strings to the schema and README (outside the worker's scope; orchestrator grant needed).

P10R-3: spec L419 lists "baseline identity when required" as an `evaluate` field; `EvaluateParams` is `deny_unknown_fields` without it, so a spec-following client gets `invalid_request`. The helper derives identity per evaluation (possibly intended) but the evidence never mentions L419 or the choice. Basis: spec L419; user rule against quietly altering contracts. Suggested fix: accept an optional field, or record an explicit deviation for review; do not change the spec.

## Ratified item: fixture regeneration

Per-file `jq` leaf comparison of the 12 existing case files vs pre-task snapshot: 652 differences, all `…/reference/cargoLockSha256`, new value `f9ca4e5d…5b21` (= `sha256(native/Cargo.lock)` and new lock value); 0 other differences (no inputs, behavioural expectations, cases added or removed). Ratification holds.

## Oracle extension assessment

Two optional `#[serde(default)]` fields on `Git` (`deny_unknown_fields`), used only when present; existing outputs unchanged apart from the identity field; self-test reproduces `git-hunks/mig-modified-line`; oracle lock 0 deviations; repo setup still `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`; filters harmless (`clean = cat`). Only issue: schema drift (P10R-2).

## Coverage by acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED temp-repo cases | Met | RED 10/13 failing; 3 library tests pre-existing (disclosed) |
| HEAD baseline with conversions and trust | Met | `DiffProviderRegistry::get_diff_base(path, trust_full)`, `get_current_head_name`; upstream sources identical to pristine extraction |
| Decoding like `set_diff_base` | Met (UTF-8 only) | `from_reader(.., Some(UTF_8))`; non-UTF-8 labelled pending |
| Pinned hunks and selection conversion | Met | `textobjects.rs:86-102` = `commands.rs:6287-6301`; early return/info = 6282-6285 |
| Refresh per evaluation; cache while identity valid | Met | lookup every `mi`/`ma`+`g`; identity path/trust/head/baseline SHA-256 + generation |
| Unavailable only when lookup unavailable; no invented baseline | Met | `tracked-empty-baseline` oracle case |
| Deleted working file | Met (code-reading) | `deleted_working_file_still_uses_the_head_baseline` |
| Diff settle; stable timeout | Met; P10R-1 | waits for published doc and base |
| Reuse diff workers; metadata isolated | Met | helper-owned tokio runtime; read-only `local_path`/`trust` on `ReplicaView` |
| No SCM decorations | Met | TS: comment + one assertion |
| Trust/filter marker | Met | untrusted not run, trusted run (positive control); trust mutation fails 3 tests |
| Lock rules | Met | 0 deviations (288 pairs); `helix-lock.json` only `cargoLockSha256`; inventory unchanged; runtime hash unchanged |
| Protocol L415/L419 | L415 met; L419 P10R-3 | |
| Baseline / escalated items | Untouched | |
| Compatibility edits | Necessary, minimal | |

Scenario backing: oracle-backed — modified/added/outside/multi-cursor/BOM/direction/count/astral/path with space, pure removals, CRLF (`autocrlf`, `eol=crlf`, mixed), smudge filter trusted/untrusted, untracked, scratch, unsaved edits, HEAD states; code-reading and labelled pending — HEAD moving mid-session, staged, deleted, symlinks, linked worktree, untitled/virtual, missing repository; marker test is behaviour, not parity.

## Checks run (each once)

`--test textobjects_git` 13 passed; crate tests 11 suites/77 passed; with `test-support` 12 suites/84 passed; `test:match:oracle` OK; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `check:keybindings` exit 0; `compare-cargo-lock` no deviations; `check:helix-runtime` OK (`fd5ee12c…ffbea2b`). Spec/plan frozen; `native/runtime/out` tree hash unchanged; baseline only `package.json` (pre-existing); tree diff equals delta list.

## Coverage limits

Linux only; UTF-16/invalid-UTF-8 baselines untested (pending); mutation from worker log; large-file `MAX_DIFF_*` not tested; settle timing not stress-tested.

## Non-findings (not accepted)

Binary size growth (Task 21); `helix-view` pulling `helix-lsp`/`helix-dap` (lock 0 deviations, NFR-2 reuse); debug-assert guards; hunk lock once per request; trusted filters run (upstream); identity without separate repository ID.
