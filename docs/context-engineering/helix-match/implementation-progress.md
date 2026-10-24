> **SUPERSEDED (2026-10-24), historical only.** The user switched to a TypeScript-only implementation; see [../helix-match-typescript/spec.md](../helix-match-typescript/spec.md). Native code archived at /home/cosmincartas/work/archives/vscode-extension-helix-match-native-20261024.

# Helix Match Implementation Progress

This note tracks execution of [plan.md](plan.md) against [spec.md](spec.md).
It records evidence and gate status; it does not claim production parity or plan completion.

## Session 1833127f-56be-437d-bb5d-d7643ab1afbe (2026-10-24)

- **Orchestrator:** Claude Code `/sdd-cc`; worktree `vscode-extension-helix-match`, branch `feat/helix-match`, HEAD `0b2f3ae`.
- **Session scope:** Plan Task 1 (native feasibility gate) only. Tasks 2–22 are not started.
- **Frozen basis:** spec SHA-256 `ca7f9e8365d069cffddab142f0b48d02d42fc2238db85a8497406d12e83a9776` (verified);
  plan SHA-256 `3ee44343d1010d8ac4572f9de8e8d99dc261b2467390022d3d2f37ce07e2da28`;
  Helix `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`, archive SHA-256 `c5e35c68897a0f3793937095d8d9c13340fa18e727a3696ae16fa0edd1d08d23` (re-downloaded and verified).
- **Run records:** `/tmp/helix-match-implementation-khd3bwgf/` (`frozen-basis.md`, `baseline.json`, `baseline-checks/`).

### Baseline attribution

The worktree starts with 24 baseline files copied from the source worktree (12 tracked modifications, 12 untracked files).
All 24 match `baseline.json` hashes and the saved `baseline/` bytes; `git diff` equals `baseline.patch` byte-for-byte.
These files are concurrent work, not match implementation, and are preserved.
Worker changes are attributed by comparison against these hashes and a pre-review snapshot.

### Baseline checks (before any worker change)

| Command | Result |
|---|---|
| `npm ci` | OK (worktree-local `node_modules`). |
| `npm test` | Exit 0; 77 tests, 77 pass. |
| `npm run test:integration` | Exit 0; 22 `PASS` checks on VS Code 1.143.1. |
| `npx vsce ls` | Baseline package list recorded; `docs/**` is already packaged at baseline. |

### Task ledger

| Task ID | Assignment | Role | Status |
|---|---|---|---|
| 1 | T1-A native feasibility helper and native probes | worker | completed |
| 2 | T1-C real VS Code editor probes | worker | completed |
| 3 | T1-B2 target build probes | worker | completed |
| 4 | T1-B1 current-host package, offline proof, projection round trip | worker | completed |
| 5 | T1-D go/no-go report | worker | completed |
| 6 | T1-R Initial and Verification review | reviewer | completed (Verification pass) |
| 28 | T1-CR correction batch for IR-1..IR-5 | worker | completed (allowance consumed) |

Plan Tasks 2–22 are tracked as task IDs 7–27 (P2–P22), blocked behind the Task 1 gate per plan dependencies.

### Resume 1 (same session ID, 2026-10-24)

The user expanded the objective to all 22 plan tasks, gated by Task 1.
The first dispatches of tasks 1 and 2 stopped when the orchestrator process exited; they returned no report.
Inspection found no artifacts: no `native/`, no `test/feasibility/`, no feasibility evidence, no scratch directories.
Baseline hashes and `baseline.patch` still match; spec, plan, and pinned archive hashes re-verified.
This was an interruption, not a failed check; no correction allowance was consumed.

### Task 1 gate result

Report: [feasibility/report.md](feasibility/report.md). Evidence index: [feasibility/README.md](feasibility/README.md).
Reviews: [Initial](feasibility/reviews/task1-initial-review.md) (fail, IR-1..IR-5 evidence-hygiene findings, no gate impact);
one correction batch (task 28); [Verification](feasibility/reviews/task1-verification-review.md) (pass, all IDs resolved).

| Gate criterion | Decision | Open points |
|---|---|---|
| Build viability | GO on confirmed targets: linux-x64 glibc, alpine-x64 dynamic musl with grammar load | win32-x64 partial (gnu + Wine); arm cross-link only; macOS, win32-arm64 type-check only; alpine-arm64 not attempted. Not promised; Task 21. |
| Unicode input | GO for the session-scoped `type`/composition mechanism (1.143.1, 1.85.2) | Real non-US layouts, AltGr, OS IME pending (Task 19). |
| Selection semantics | Conditional GO | Raw projection merges a zero-width EOF cursor touching a range end; retained semantic metadata closed it in the experiment; Task 7 must implement it. |
| Stale-edit protection | GO | `TextEditor.edit` rejects stale bases; 0 stale edits applied. |

No gate criterion failed; dependent work may proceed under these conditions. Task 1 verification is not fully complete: Windows partial, macOS pending, replay partial.

### Blocker requiring user decision

Replay after a failed `mr` lookup (spec L596, L601) cannot be met for native, user, or other-extension keybindings: VS Code has no key-injection or keybinding-resolution API.
See [replay-gap-oracle.md](feasibility/analysis/replay-gap-oracle.md). Options: (1) replay through the extension's generated NORMAL keymap and stop, discarding and reporting, at the first native/user-bound key; (2) option 1 plus a closed native-command table for navigation keys.
Plan Task 16 (task 21) is held until the user approves an amendment; Tasks 17–22 depend on it. Tasks 2–15 are unaffected.

### Plan Task 2 (task 7, review task 29)

Worker result (independent review pending): `npm run build:match` + `npm run check:helix-runtime` build and verify a linux-x64 runtime of 1,799 assets (301 grammars) with runtime hash `fd5ee12c…ffbea2b`, reproduced over three builds.
Tamper and ambient-override cases fail the check; 342 languages, 303 grammar definitions, 158 text-object files inventoried; 0 pinned query failures.
Upstream patches: `0001-packaged-runtime-root` (`helix_loader::prioritize_runtime_dirs`), `0002-grammar-builder-builtin-languages` (`helix_loader::grammar::get_grammar_configs`).
Open: 10 grammars without license files and GPL-family/unknown licenses (release decision, Task 21); Rust dependency notices pending; feasibility crate removed from the native workspace (review evaluates impact).
Evidence: [evidence/task-02/README.md](evidence/task-02/README.md).

### Task 2 review outcome

[Initial review](evidence/task-02/reviews/initial-review.md): all Task 2 criteria verified; one accepted finding, P2R-1 (Task 1 feasibility rebuild broke when the crate left the native workspace).
Correction task 30 added a standalone `native/feasibility` workspace; [Verification review](evidence/task-02/reviews/verification-review.md): P2R-1 resolved.
Escalated (no automatic correction left): VR2-1 [P3], a correction-caused defect — Task 1 scripts `stage-helper.sh`/`build-grammars.sh` ignore a `CARGO_TARGET_DIR` override that `feasibility/native/README.md:56` advertises. The default command works.
Review task 29 stays pending on that escalation; it affects only Task 1 experimental scripts, not Task 2 production deliverables.
Tasks 3 and 4 were re-created as tasks 31 and 32 (depending on task 7) because task 29's serialization guard no longer applies.

### Plan Tasks 3 and 4 (tasks 31 and 32)

Task 3: separate `native/oracle` workspace drives real `helix-term` dispatch on the packaged runtime; adapter-independent.
[Initial review](evidence/task-03/reviews/initial-review.md): P3R-1 (P2, diff settle failed for converted baselines), P3R-2, P3R-3 (P3) accepted.
Correction task 36 fixed all three; `npm run test:match:oracle` passes 113 cases plus self-test. Verification review (task 35) running.

Task 4: `mini-helix-match-helper serve` JSON Lines protocol.
[Initial review](evidence/task-04/reviews/initial-review.md): P4R-1, P4R-2 (P3) accepted; correction task 34; [Verification review](evidence/task-04/reviews/verification-review.md): both resolved, 25 protocol tests pass.
Escalated (no automatic correction left): VR4-1 [P3], correction-caused — a version-2 frame with a duplicated `helperEpoch` key is no longer fatal (spec L407); duplicated `requestId`/`protocolVersion` with an unknown version were already non-fatal (missed by Initial review). Review task 33 stays pending on this escalation.
Impact judgment: confined to malformed duplicate-key frames that a conforming client never sends, so Task 5 proceeds (re-created as task 37 without the serialization guard).

### Plan Task 5 (task 37, review task 38, correction task 39)

Worker: `src/native/` `MatchClient` (spawn without shell, epochs, typed requests, bounded framing and stderr, recovery, disposal); 38 tests incl. real helper.
[Initial review](evidence/task-05/reviews/initial-review.md): P5R-1 (P2, reverse DNS during host detection), P5R-2 (P2, first startup failure latched recovery), P5R-3, P5R-4 (P3) accepted.
Correction task 39 (single batch) first reported 41/41 tests. Before its Verification review ran, supervisor evidence ([supervisor-context](evidence/task-05/supervisor-context/README.md), supervisor-authored) showed the P5R-1 fix relies on `process.report.excludeNetwork`, which Node v18.15.0 in the minimum VS Code 1.85.2 does not implement.
Task 39 was reopened within the same batch; detection now calls `getReport` only when `excludeNetwork` is really supported and otherwise uses `/proc/self/maps` and the musl loader path (Node 18.15: 0 `getReport` calls).
[Verification review](evidence/task-05/reviews/verification-review.md): P5R-1..P5R-4 resolved; 42 match-client tests, `npm test` 119/119.
Escalated (no automatic correction left): VR5-1 [P3], correction-caused — `shutdown()` during the handshake leaves `MatchClient.state` at `starting`. Review task 38 stays pending on it; Task 6 proceeds (re-created as task 40) without changing that behaviour.

Supervisor-authored, unapplied proposals for the escalated VR2-1 and VR4-1 exist under `evidence/task-02/proposed-correction/` and `evidence/task-04/proposed-correction/` (attribution: `/tmp/helix-match-resume-20261024/supervisor-artifacts.json`). They are not worker changes and are not applied; applying them needs the pending user approval of additional correction batches.

### Plan Task 6 (task 40, review task 41)

Worker: helper `open`/`change`/`snapshot`/`configure`/`close` with base-snapshot changesets, pinned `Syntax::update`, sticky syntax-failure states, gated test observation (`test-support` feature, absent from production binary); client `DocumentSync` with resync and retained syntax state.
Worker-reported checks: `matchSync` 18/18 strict (3 runs), cargo tests incl. 6 document tests, lock unchanged, `npm test` 137/137. Evidence: [evidence/task-06/README.md](evidence/task-06/README.md).
Scope exception (needs user decision): two lines in Task 5's `test/unit/matchClient.test.ts` changed from `open` to `evaluate` because `open` is now implemented. Supervisor index: [supervisor-proposals/README.md](evidence/supervisor-proposals/README.md) (supervisor-authored).

### Task 6 review outcome

[Initial review](evidence/task-06/reviews/initial-review.md): P6R-1 (P2, rejected change left the replica stale; `ensureSynced()` skipped it) accepted; correction task 42.
[Verification review](evidence/task-06/reviews/verification-review.md): P6R-1 resolved (`matchSync` 19/19, `npm test` 138/138).
Escalated (origin: missed by Initial review, no automatic correction allowed): VR6-1 [P2] — `ensureSynced()` filters documents before an in-flight rejected change settles, so a match action can report synchronized while the replica is stale (`src/native/documents.ts:279-292`). Must be resolved before ordering (Task 17) and parity (Task 22) claims.
Review task 41 stays pending on VR6-1 and the scope-exception decision. Task 7 proceeds as task 43 (it does not depend on this timing path).

### Supervisor clarification and proposal index

Supervisor-authored: [approval summary](evidence/supervisor-proposals/README.md) now includes unapplied tested proposals for VR2-1, VR4-1, VR5-1 and VR6-1. The latter has a RED process-backed concurrent-change regression and 20/20 GREEN synchronization tests in an isolated copy; no production patch is applied. Attribution: `/tmp/helix-match-resume-20261024/supervisor-artifacts.json`.

The supervisor determined the two-line Task 6 compatibility-test update (`open` to `evaluate`) is routine work already covered by the user's full-plan implementation request and its passing-tests requirement. Retain and attribute it; do not claim a new user approval or a product/specification change. This applies the supervising developer instruction to resolve routine implementation choices within existing authorization instead of automatically escalating local skill exceptions. The explicit correction-batch limit remains in force; VR2-1/VR4-1/VR5-1/VR6-1 still await user approval. The replay contract is also unchanged and pending.

### Plan Task 7 (task 43, review task 44)

Worker: Rust `documents/selection.rs` imports UTF-16 ranges and normalizes through pinned `Selection::ensure_invariants` (as `Document::set_selection`); TS `selectionCodec.ts` converts offsets, projects primary-first, and keeps `RetainedSelection` metadata (invalidated by version/identity change or any external selection event).
Worker-reported checks: `matchSelections` 23/23 strict; 28 new oracle cases (oracle total 153 PASS); 266 consecutive oracle states preserved through projection (3 lossy-class states only via retained metadata); `npm test` 161/161. Real `evaluate` and real-VS Code consecutive commands remain for Task 8. Evidence: [evidence/task-07/README.md](evidence/task-07/README.md).

[Initial review](evidence/task-07/reviews/initial-review.md) (task 44): accept, no findings. The plan line "consecutive match commands preserve semantic state after projection" is only snapshot-level so far; it is carried into Task 8 (real `evaluate` chains) and Task 17 (real VS Code event wiring). Task 7 review gate passed.

### Plan Task 8 (task 13, review task 45)

Worker: native `evaluate` for `inside`/`around` on documents without a language (`native/match-helper/src/evaluate/`), adapting `select_textobject` and calling pinned helix-core text objects; adapter inventory in [evidence/task-08/README.md](evidence/task-08/README.md).
Worker-reported checks: `textobjects_plain` 6 tests over 156 in-scope oracle cases (178 evaluate requests, 17 chains); 114 new oracle cases; carried Task 7 chain criterion via `matchEvaluate.test.ts` (real `evaluate` + projection + retained state); oracle 267 PASS; `npm test` 166/166.
Compatibility edits (routine, attributed): example "unsupported" method lines in `matchClient.test.ts`, `matchSelections.test.ts`, `matchSync.test.ts` updated because `evaluate` is now implemented.

[Initial review](evidence/task-08/reviews/initial-review.md) (task 45): accept, no findings; compatibility edits judged necessary, minimal, and non-weakening; carried Task 7 chain criterion met (VS Code simulated). Task 8 review gate passed.

### Plan Task 9 (task 14, review task 46)

Worker: capture objects `f t a c T e x` through pinned `textobject_treesitter` via one capture table; language mapping completed (26-row alias table, then pinned name, glob/extension, shebang detection; untitled buffers get no shebang detection, as upstream requires a path).
Worker-reported checks: `textobjects_syntax` 9 tests with `test-support` (315 oracle cases, 722 evaluates, 24 mirrored edits); capture inventory equals Task 2 for all 342 languages and 2,156 language×capture pairs; failure injection equals the oracle for textobjects, root, injected-layer, initial-parse, and update failures; oracle 552 PASS; `npm test` 166/166.
Incident (worker-reported, orchestrator-verified): a test overlay briefly overwrote the runtime `manifest.json`; restored, SHA-256 equals the lock's `manifestSha256`. Evidence: [evidence/task-09/README.md](evidence/task-09/README.md).

[Initial review](evidence/task-09/reviews/initial-review.md) (task 46): P9R-1 [P2] (`plaintext` documents with a path skipped pinned file detection, spec L487-489) and P9R-2 [P3] (exact unavailable syntax state not asserted) accepted; manifest incident verified clean.
Correction task 47 removed the `plaintext` short-circuit and asserts exact syntax states; [Verification review](evidence/task-09/reviews/verification-review.md): both resolved (revert and mutation probes), no later findings. Task 9 review gate passed.

### Plan Task 12 (task 17, review task 48)

Worker: `evaluate` action `add` adapts pinned `surround_add` (`evaluate/surround_add.rs`), exports one sorted UTF-16 changeset (`evaluate/edits.rs`), applies `ensure_invariants` on a cloned post-edit rope, Enter uses the configured document EOL, and the replica is never mutated.
Worker-reported checks: `surround_add` 6/6 (127 in-scope oracle cases with `test-support`), 112 new oracle cases; mutation (Enter ignoring EOL) caught; oracle OK; `npm test` 166/166. Evidence: [evidence/task-12/README.md](evidence/task-12/README.md).

[Initial review](evidence/task-12/reviews/initial-review.md) (task 48): accept, no findings. Task 12 review gate passed.

### Plan Task 10 (task 15, review task 49)

Worker: `src/git/mod.rs` loads HEAD baselines through pinned `helix-vcs` (decoded with `from_reader`, trust passed through), reuses the pinned `DiffHandle` while the baseline identity holds, and answers `g` like upstream `textobject_change`; untrusted repositories never run filter programs (marker absent), trusted ones do as upstream.
Worker-reported checks: `textobjects_git` 13/13 (34 oracle Git cases); crate tests, oracle (674 cases), `npm test` 166/166 pass; lock 0 deviations; runtime hash unchanged.
Lock: `native/Cargo.lock` re-resolved for `helix-vcs`/`helix-view`/`tokio`; `helix-lock.json` changed only in `cargoLockSha256` via the documented update path.
Ratified by the orchestrator as routine under existing plan authorization: every stored oracle result embeds `reference.cargoLockSha256`, so all fixtures were regenerated; an independent structural diff shows 652 differences, all in that field, 0 behavioural changes.
Oracle-backed scenarios: modified/unsaved, pure removals, empty baseline, autocrlf and `eol=crlf`, filter drivers trusted/untrusted, untracked, no path, HEAD states. Code-reading-backed and pending oracle coverage: staged, deleted working file, symlinks, linked worktrees, HEAD moving mid-session, untitled/virtual, missing repository. Evidence: [evidence/task-10/README.md](evidence/task-10/README.md).

[Initial review](evidence/task-10/reviews/initial-review.md) (task 49): accept with P10R-1 (settle timeout outside the single timeout policy, untested), P10R-2 (fixture schema/README not updated for the oracle `git.attributes`/`git.config` inputs), P10R-3 (spec L419 "baseline identity when required" evaluate field missing) — all P3, accepted; ratified fixture refresh independently confirmed. Correction task 50 (single batch) is running.

Correction task 50 moved the settle timeout into `POLICY` with a tested `diff_timeout` path, updated the fixture schema/README, and added an optional evaluate `baselineIdentity` (validated, helper-refreshed, token returned). Its schema validation surfaced a separate pre-existing issue: Task 7's `selection-identity.json` does not validate against the case schema (unknown tag, empty steps). It was missed by the Task 7 review and is escalated (no automatic correction).

[Verification review](evidence/task-10/reviews/verification-review.md): P10R-1..P10R-3 resolved, no later findings. Task 10 review gate passed.

### Supervisor fixture-schema compatibility cleanup

Supervisor-authored and separate from the task workers: [schema compatibility evidence](evidence/supervisor-schema-compatibility/README.md). The published schema now supports the already-reviewed Task 7 `selection-identity` tag and empty initial-state command lists; README updated. All 14 current case files / 940 cases validate; five malformed-input controls remain rejected; no fixture bytes or outcomes changed. Before/after hashes and attribution are in `/tmp/helix-match-resume-20261024/supervisor-artifacts.json`.

This small verification-metadata alignment is covered by the user's existing full-plan implementation request, without a new user approval or a reset of any correction allowance. The separately reported legacy schema observation is resolved by this cleanup, subject to a focused independent metadata check. The actual behavioral escalations VR2-1/VR4-1/VR5-1/VR6-1 remain pending; the replay contract is unchanged.

### Plan Task 11 (task 16, review task 51)

Worker: `evaluate` action `brackets` (`mm`) adapts pinned `match_brackets` (syntax-aware branch when a tree exists, plaintext otherwise; `put_cursor`; normalization) in `evaluate/brackets.rs`.
Worker-reported checks: `brackets` 7/7 (267 oracle cases with `test-support`), 266 new oracle cases; oracle 940 cases; `npm test` 166/166; mutation (forced plaintext branch) caught. Upstream quirk: pinned `match_brackets.rs:154` overflows in debug builds for a whitespace-only syntax document; the helper guards that call and returns no match (not oracle-backed). Evidence: [evidence/task-11/README.md](evidence/task-11/README.md).
Supervisor-authored change during this task (attributed, not a worker change): the fixture schema/README now allow the `selection-identity` tag and empty `steps` used by Task 7, resolving the escalated schema mismatch pending independent review ([provenance](evidence/supervisor-schema-compatibility/README.md)). It is reviewed as a separate item in task 51.

[Initial review](evidence/task-11/reviews/initial-review.md) (task 51): worker change set and supervisor schema item both pass with no findings (all 14 case files validate; negative controls rejected). Task 11 review gate passed; the Task 7 schema mismatch is resolved.

### Plan Task 13 (task 18, review task 52)

Worker: `evaluate` action `replace` returns the pinned first-phase preview (`evaluate/surround_replace.rs`) with an opaque continuation token bound to document, generation, version, session, original selection, delimiters, and count (`continuation.rs`); `cancel` releases; `continue` with a non-character key restores; the character-key replacement is left for Task 14. Tokens are released on change, snapshot, configure, close, initialize, and supersession.
Worker-reported checks: `surround_preview` 8/8 (219 cases with `test-support`; 168 previews equal to the oracle's intermediate state, 48 exact lookup-failure messages, 25 restores); oracle OK; `npm test` 166/166; mutation (no release on change) caught. RED was produced after implementation by reverting (disclosed). Evidence: [evidence/task-13/README.md](evidence/task-13/README.md).

[Initial review](evidence/task-13/reviews/initial-review.md) (task 52): accept, no findings. Task 13 review gate passed.

### Plan Task 14 (task 19, review task 53)

Worker: `continue` with a character key adapts the pinned second replacement phase (`surround_replace::second_phase`), shares the proposal export with `ms`, and consumes the token only on success.
Worker-reported checks: `surround_replace` 9 tests with `test-support` (433 cases, 201 replacements equal to the oracle); RED before implementation; mutation (no release on success) caught; `npm test` 166/166. Handover to Tasks 17/18: same-character replacements (`mr((`) produce text-identical edits that VS Code may not report as a change. Evidence: [evidence/task-14/README.md](evidence/task-14/README.md).

[Initial review](evidence/task-14/reviews/initial-review.md) (task 53): accept, no findings (201/201 replacements equal the oracle). Task 14 review gate passed.

### Plan Task 15 (task 20, review task 54)

Worker: `evaluate` action `delete` adapts pinned `surround_delete` (`evaluate/surround_delete.rs`) with the lookup shared with `mr` (`evaluate/surround_lookup.rs`); any failed selection fails the whole request with the reference error and no edits.
Worker-reported checks: `surround_delete` 7/7 (248 oracle cases with `test-support`); mutation (partial deletion) caught; `npm test` 166/166. Evidence: [evidence/task-15/README.md](evidence/task-15/README.md).

### Current work

Task 54 (Task 15 Initial review) is running. After it, every remaining plan task (16-22) depends on Task 16, which awaits the replay-contract decision.

### Pending user decisions

1. Replay-contract amendment before Task 16 (task 21): strict parity versus the documented stop-and-discard limitation.
2. Additional correction batches for escalated findings VR2-1 (P3), VR4-1 (P3), VR5-1 (P3), and VR6-1 (P2). (The Task 7 fixture-schema mismatch found during Task 10 was addressed by a supervisor-authored schema alignment, under review in task 51.) Supervisor-authored proposals exist for VR2-1, VR4-1, VR5-1, VR6-1; none applied.
(The Task 6 two-line compatibility-test update was resolved under existing full-plan authorization per the supervisor determination; recorded on task 41.)

### Next action

Review Task 9; then Task 12, Tasks 10/11/13/15 (each depends on Task 9), serialized. Tasks 16+ remain held.
