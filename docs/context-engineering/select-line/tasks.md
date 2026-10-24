# Select Line SDD Task Record

Run started 2026-10-24. Native TaskList/Create/Update/Get/Clear and Agent package tools are not available in this session. Tasks are tracked here and delegated using the available collaboration tools. No pre-existing task record was present; unrelated session tasks cannot be inspected with the unavailable tools.

## Current outcome — complete

The user approved the cursor compatibility exception. The seven-line fix is applied. All feature work and the cursor repair passed verification and consolidated independent Initial review with no actionable findings. No correction batch was needed. Historical pending/blocked entries below describe earlier states and are superseded by this outcome.

| Task | Role | Final status | Assignment/outcome | Verification/review |
| --- | --- | --- | --- | --- |
| W1 | Worker | completed | Pure x/X core, normalization and upstream fixtures | Required upstream inventory and pure replay pass; R1 PASS |
| W2 | Worker | completed | Counts, VS Code adapter/bindings/host tests, approved cursor listener | 379 unit tests; full VS Code 1.85.0 and 1.142.0 exit 0; R1 PASS |
| W3 | Worker | completed | Independent pinned Helix oracle and compatibility documentation | Exact deterministic 298 cases/457 snapshots, wrong-revision rejection, replay pass; R1 PASS |
| R1 | Reviewer | completed | Consolidated Initial review of all 22 attributable worker files and every requirement | No actionable findings, accepted IDs, missing checks, scope issues or correction batch |

Review: [initial-review.md](initial-review.md). Exact x/X host parity requires `editor.multiCursorMergeOverlapping=false`; default EOF merging remains the documented accepted limitation. One initial 1.85.0 keyboard guard run failed, then the unchanged full rerun passed; its cause is unconfirmed and recorded in the review.

## Frozen contract and baseline

Original invocation: `/sdd`, continuing the validated select-line specification and implementation plan.

- Spec: `spec.md`, SHA-256 `4b10a2b64dad662f9db856522faa9013e267e1f044e358508e9872ec7cd128e5`.
- Plan: `plan.md`, SHA-256 `7e880f4fed3bcba6ffcb5f30c842e8c648580dbe383215c1006da46ef61c0b03`.
- Git baseline: `0b2f3aea685204fc48b509392664ad08e4996106`; no tracked edits. Pre-existing untracked files: only spec.md and plan.md. Preserve both.
- No applicable AGENTS.md found in checkout or ancestors.
- Requirements: all FR-1–FR-7 and NFR-1–NFR-3 in spec; eight plan tasks. Exact pinned Helix x/X behavior, count lifecycle, whole-set normalization/primary, upstream tests, independent Rust oracle, compatible and default host settings, immutable selection commands, regression checks.
- Exclusions: SELECT mode, Alt-x, unused hjkl activation, logical-selection subsystem, runtime dependencies, automatic user configuration changes, unrelated repairs, commits/push/branches/PRs.
- Verification: `npm test`; oracle generator `--helix-root ... --check` and wrong-revision rejection; `npm run test:integration` on VS Code 1.85.0 and acceptance 1.142.0 with compatible/default configuration evidence. Do not claim unexecuted checks or substitute hosts silently.
- Baseline evidence copies: `/tmp/select-line-sdd-baseline/`.

## Assignments

### W1 — Pure selection core and upstream fixtures
Status: completed. Role: Worker. Dependencies: installed Node dependencies for checks.
Scope: `src/core/lineSelection.ts`, `test/unit/upstreamHelix.ts`, `test/unit/upstreamHelix.test.ts`, `test/unit/lineSelection.test.ts`, `test/fixtures/helix-selection-upstream.md` (new).
Assignment: plan tasks 3–6, FR-1/2/4/6, NFR-1/3. Exact upstream normalization, line ranges, x/X, fixture parsing, attribution and exhaustive required upstream test inventory. API coordinated with W2/W3 before dependent code.
Verification: focused Node tests then npm test when shared compilation ready. Preserve all unrelated changes.
Outcome: W1 added exactly the five owned new files; focused strict compilation, 17 direct/importer tests and 300 independent oracle replay/validation tests passed. Inventory: 31 overlap and 18 line-range assertions, both normalization assertions, adjacent points, and both command fixtures. No core mismatch or scope issue. Review: consolidated R1 PASS, no actionable findings. Automatic correction allowance: unused.

### W2 — Count lifecycle and VS Code integration
Status: completed. Role: Worker. Dependencies: resolved; user approved the cursor exception, both full host suites and unit checks passed. See approved-resume evidence below.
Scope: `src/extension.ts`, `src/core/count.ts`, `src/core/registerMotion.ts`, `src/motions/line.ts`, `scripts/keybindings.cjs`, generated `package.json`, `test/unit/count.test.ts`, `test/unit/keybindings.test.ts`, `test/integration/**`, `test/runIntegration.ts`. Other existing host modules only if required count lifecycle changes are reported before editing.
Assignment: plan tasks 1/2/7 and host portions of 8; FR-1–5, NFR-2/3. Counts, queued line adapter, keyboard contexts, host parity/regressions.
Verification: baseline compile diagnostics, generated bindings, npm test and host suite (serialized with orchestrator). Preserve unrelated changes.
Outcome: feature implementation plus the explicitly approved seven-line cursor compatibility fix pass all checks: npm test 379/379, full VS Code 1.85.0 exit 0, full VS Code 1.142.0 exit 0. Review: consolidated R1 PASS, no actionable findings. Automatic correction allowance: unused; no correction batch has run.

### W3 — Independent pinned Helix oracle and compatibility documentation
Status: completed. Role: Worker. Dependencies: Rust/source availability; W1 API for replay test.
Scope: `scripts/helix-line-oracle.cjs`, `test/fixtures/line-selection-oracle.json`, `test/fixtures/line-selection-oracle.md`, `test/unit/lineOracle.test.ts`, `README.md`.
Assignment: plan task 8 oracle generation/replay/documentation; FR-1–4/6/7, NFR-1–3. Generate actual results with pinned Helix; deterministic regeneration, schema/coordinate validation, source rejection, full matrix, provenance. No expected values derived from TS.
Verification: generator --check, wrong-revision rejection, replay test, npm test. Preserve unrelated changes.
Outcome: W3 added exactly the five assigned oracle/docs files. Real pinned Helix generated 298 cases/457 command snapshots. Deterministic --check passed exact (Rust test 1/1); wrong revision rejected exit 1. Focused replay/validation 300/300 passed, full npm test at that snapshot 378/378. No source checkout edits, runtime dependencies, settings writes, or scope issue. Review: consolidated R1 PASS, no actionable findings. Automatic correction allowance: unused.

### R1 — Consolidated Initial review
Status: completed. Role: Reviewer. Dependencies: resolved; W1/W2/W3 completed checks. Complete consolidated Initial review PASS with no actionable findings.
Scope: complete attributable worker delta in the scopes above; baseline excludes pre-existing spec/plan. Read other files only as context. Cover every acceptance criterion/check, and report all actionable findings together with location, trigger, evidence, and frozen requirement/rule/regression basis. Reject preference/new scope/speculative hardening. State coverage/checks/limits. No fixes during review.
Outcome/review: PASS. Complete report in `initial-review.md`; independently ran 379 unit tests and wrong-revision rejection, inspected both full host passes and deterministic oracle evidence. All 22 files/every requirement covered; no actionable findings or correction needed.

## Execution evidence (before Initial review)

- Dependencies installed with `npm ci --no-audit --no-fund`; package-lock unchanged.
- Baseline compiler reproduced exactly four TS2554 errors: extension motion/edit/history Count arguments and integration motion-runner Count.
- Host versions verified from installed metadata: acceptance `/usr/share/code/code` 1.142.0; minimum `/tmp/select-line-vscode-test/vscode-linux-x64-1.85.0/code` 1.85.0. Existing DISPLAY=:0; minimum executable has no missing shared libraries.
- Real Rust oracle initial run: 298 cases; pure replay plus validation: 300 passing tests. Generator wrong-revision rejection passed (ba5b022c1000a0ce28d4ce1d09acdd062a83a020 refused). Final deterministic --check in progress.
- Initial W2 self-verification host run 1.142.0: failed editor-switch lifecycle assertion (old editor offsets 0..0 vs expected 0..4), source test/integration/lineSelection.ts near 134. Evidence `/tmp/select-line-host-1.142.0.log`. W2 remains active investigating editor object identity/focus; this is initial implementation verification, before Worker completion or Initial review.

- W2 self-verification resolved stale TextEditor test identity by retaining showTextDocument return and settling renderer context; new user-override test also needed the same established settle boundary. These were test-harness defects; exact selection assertions unchanged. Read-only ignored-input count resets were implemented with separate reset-only bindings while preserving writable-only editing blockers. Existing block-caret representation is mapped only after non-line oracle steps; x/X raw ranges remain exact.
- Complete acceptance host suite 1.142.0 passed exit 0 on the preceding snapshot, log `/tmp/select-line-host-1.142.0-final.log`: all line/28 oracle cases and default EOF experiment, existing wordjump/motions/edits/history, 48 history cases (27 identical selections), native undo, guards. Worker is adding remaining frozen rapid queued xc/undo checks before final host replay and Initial review. Latest full unit suite 379/379, zero skips (W2 run).
- Deterministic oracle --check passed exact 298 cases/457 snapshots, log `/tmp/select-line-oracle-check.log`; final generation used an isolated archived pinned source and real command event loop. No source mismatches.

- Final rapid queue checks added for concurrent xc, xdu, and xc<esc>u in addition to dx/xd/count snapshots. Full acceptance host 1.142.0 passed exit 0 again: `/tmp/select-line-host-1.142.0-queue-final.log`.
- Minimum 1.85.0: all new x/X/count/lifecycle/queue/read-only tests, 28 oracle cases, and default-setting EOF experiment passed; the subsequent existing word-jump display test failed its unchanged 16-glyph assertion. Diagnostic found no `.monaco-editor .view-line span` elements at all; W2 investigating host DOM/evaluation-context difference before any fix. Log `/tmp/select-line-host-1.85.0-final.log` and targeted diagnostic logs. No excluded production module has been changed.
- W2 has exclusive serialized host execution/compilation ownership during this initial verification investigation. Root runs no concurrent host or compiler checks. Remaining read-only ignored editing-input boundaries are being audited against FR-3 while preserving native navigation.

## Historical scope decision: pre-existing minimum-host cursor defect (now approved)

The baseline HEAD extension reproduced the same VS Code 1.85.0 ordering bug: configuration event arrives while cached cursorStyle is Block (2), reapplying the same value sends no update, then a native options event changes it to LineThin (4), remaining there for at least 5 seconds in NORMAL. Active and retained TextEditor identity are the same. Evidence: `/tmp/select-line-cursor-1.85.0-baseline-diagnostic.log` and current-source diagnostic. This is not introduced by attributable worker changes.

The specification excludes repairs unrelated to counts/line selection. A narrowly proposed compatibility listener is recorded in `cursor-compatibility.proposed.patch` for review but is NOT applied. It would observe native editor-option changes and reapply Block only while enabled in NORMAL and the incoming style is not Block. It would not change settings, INSERT or suspension. This expansion requires user approval under the frozen SDD basis; no approval has yet been received. W2 remains active for remaining authorized checks; full minimum-host acceptance and R1 remain pending.

## Historical handoff before approval (superseded by approved resume below)

- W1: completed implementation checks; consolidated review still required.
- W2: pending. All approved feature work is implemented, but mandatory full 1.85.0 acceptance is blocked by the baseline cursor defect. User approval was requested for the exact seven-line listener. No answer has been received; no cursor fix has been applied.
- W3: completed implementation checks; consolidated review still required.
- R1: pending. The consolidated Initial review has not been dispatched because W2 has a required-check blocker. There are no formal review findings or accepted IDs yet. All automatic correction allowances remain unused.
- Latest complete unit run: `npm test`, 379 passed, zero skipped, log `/tmp/select-line-w2-current-unit.log`.
- Latest full acceptance host: VS Code 1.142.0, exit 0, log `/tmp/select-line-w2-current-host-1.142.0.log`.
- Minimum host: VS Code 1.85.0 full suite fails the unchanged cursor-style requirement. A separate targeted diagnostic of remaining groups passed line/count/queue/read-only/28 oracle cases, the default EOF experiment, word jumps, word motions, edits, 48 history cases and native undo/outside edits; log `/tmp/select-line-minimum-remaining-groups.log`. It is not substituted for full acceptance.
- Host profile: `editor.multiCursorMergeOverlapping=false`; test-only default-setting experiment uses true and restores false. Both hosts demonstrate the documented EOF limitation. No production settings writes or added runtime dependencies.
- Test harness portability: `--disable-gpu` restores old Electron painting in this environment; exact condition-based label-paint checks preserve 16 visible zero-width glyphs and real keyboard gw. Cursor configuration tests observe delivery and exact options rather than hiding the baseline failure. Unsupported viewport-race hypothesis was removed.
- Read-only ignored Backspace/Delete/Enter (and corresponding generated shift entries) clear count state; native Tab focus navigation remains intact and is explicitly checked. Tab demonstrably acts as navigation rather than ignored input.
- Attributable final candidate: `/tmp/select-line-review-candidate/files.json`, `attributable.patch`, and `tree/`, covering 22 worker files (W2 additionally modifies its already allowed integration word-jump test). No outside-scope implementation changes, deletions, pre-existing-edit ambiguity or unrelated user changes.
- Root administrative files: this task record and `cursor-compatibility.proposed.patch`; pre-existing spec/plan preserved unchanged. Proposed patch is a review artifact, not an applied implementation.
- Last diff whitespace check passed; no commits, branches, pushes or PRs created. No running host process or worker mutation remains outstanding.
- Native task tools remain unavailable. This unfinished record is retained; nothing is cleared or archived as a completed run.
- Resume after explicit approval: record narrow scope amendment; apply only the proposed cursor compatibility listener through a Worker; run exact full minimum and acceptance host suites plus units; then dispatch one consolidated Initial review over the complete agreed attributable worker delta and every requirement/check. Follow the single correction-batch limit and stable finding ledger if Initial review accepts findings. Do not infer approval from elapsed time.

## Approved cursor scope amendment — 2026-10-24

User explicitly approved: “Go ahead and apply this fix as well.” This authorizes the exact seven-line `onDidChangeTextEditorOptions` listener in `cursor-compatibility.proposed.patch`, limited to enabled NORMAL mode, and the full host rechecks and consolidated Initial review already pending. The spec/plan are preserved; their unrelated-repair exclusion now has this one approved exception.

W2 status: active. Dependencies: approval resolved. Resume Worker owns only `src/extension.ts` for the proposed listener, and serialized verification (`npm test`, full host suites on 1.85.0 and 1.142.0). Baseline before this resume saved under `/tmp/select-line-approved-cursor-baseline/`; pre-existing feature edits are preserved. No formal review correction allowance consumed.

R1 status: pending; awaiting W2 checks. Native task tools remain unavailable after discovery; this record and collaboration tools remain the coordination fallback.

## W2 approved resume outcome

Status: completed implementation verification; review pending. Worker applied exactly the seven approved lines in `src/extension.ts`; all other 21 worker-file hashes still match the preceding candidate. Frozen spec/plan hashes unchanged. `git diff --check` passed.

- `npm test`: exit 0; 379 passed, no skips. `/tmp/select-line-approved-cursor-unit.log`.
- First full 1.85.0 attempt: failed early NORMAL punctuation/input guard before the cursor regression; unchanged rerun did not reproduce. Preserved `/tmp/select-line-approved-cursor-1.85.0.log`. No assertion/test/source change for this transient.
- Full VS Code 1.85.0 unchanged rerun: exit 0; `/tmp/select-line-approved-cursor-1.85.0-rerun.log`.
- Full VS Code 1.142.0: exit 0; `/tmp/select-line-approved-cursor-1.142.0.log`.
- Both full passes explicitly include cursor-setting NORMAL/INSERT styling, INSERT native typing, suspension, multiple visible editors, runtime enable/disable, complete x/X/count/lifecycle/queue/read-only/28 oracle replays, default-setting EOF experiment, existing word jumps/motions/edits/history, 48 history cases/native undo.

R1 status: active. Mode: consolidated Initial review. The entire attributable 22-file worker change set is frozen at `/tmp/select-line-approved-review/files.json`, `attributable.patch`, and `tree/`. Resume-only delta: `approved-cursor-only.patch` in the same directory. Review covers all FR-1–7/NFR-1–3 and the approved cursor exception against original baseline `0b2f3aea685204fc48b509392664ad08e4996106`. Pre-existing spec/plan and root administrative artifacts are not worker review targets. No accepted findings or correction batch yet.

## Final completion and review gate

R1 complete Initial review was read and assessed by the orchestrator. It covers the entire agreed 22-file attributable delta, all FR-1–7/NFR-1–3, all required checks, and the approved cursor exception. Its report contains no actionable findings; the initial failed keyboard attempt is retained as an unconfirmed reliability limitation with a passing unchanged full rerun, not silently discarded. No accepted finding IDs or correction batch exist. All W1/W2/W3/R1 statuses are completed, with no remaining scope decision, acceptance blocker, or missing review evidence.

Final worker snapshot hashes match `/tmp/select-line-approved-review/files.json`; spec/plan hashes remain frozen. `git diff --check` passed after the review. No commits, branches, pushes, or PRs were created. The task record is saved in the specification folder and read back after finalization. Native task-list/clear tools are unavailable, so no nonexistent task API was called or session list claimed cleared.
