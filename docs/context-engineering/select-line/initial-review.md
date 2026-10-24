# Select Line — Consolidated Initial review

Date: 2026-10-24. Reviewer: independent R1 agent. Mode: **Initial review**.

**Verdict: PASS. No actionable findings.** No correction batch or Verification review is needed from this report.

## Frozen basis and attribution

Reviewed all 22 attributable worker files listed in `/tmp/select-line-approved-review/files.json`, using the complete `attributable.patch`, snapshot `tree/`, current files, and baseline `0b2f3aea685204fc48b509392664ad08e4996106`. All 22 current SHA-256 hashes match that snapshot. Baseline evidence records no tracked edits and only pre-existing untracked spec/plan. No unrelated-edit ambiguity was found.

The frozen [specification](spec.md) SHA-256 remains `4b10a2b64dad662f9db856522faa9013e267e1f044e358508e9872ec7cd128e5`; the [plan](plan.md) remains `7e880f4fed3bcba6ffcb5f30c842e8c648580dbe383215c1006da46ef61c0b03`. Review includes FR-1–FR-7, NFR-1–NFR-3, all eight implementation tasks, and the user-approved seven-line cursor compatibility exception. The exception is exactly the listener in `approved-cursor-only.patch`; it was not generalized into unrelated repairs.

Excluded requirements remain excluded: SELECT mode, Alt-x, activation of unused hjkl modules, a logical-selection subsystem, new runtime dependencies, automatic user-setting writes, and unrelated repairs beyond the approved listener. No commits, branches, pushes, or pull requests were part of this work. Pre-existing spec/plan and administrative task/review/proposed-patch artifacts are not worker review targets. Other source files and pinned upstream files were read only as necessary context.

## Complete file coverage

| Attributable files | Review coverage |
| --- | --- |
| `src/core/lineSelection.ts` | Direct comparison of x/X arithmetic, LF boundaries, grapheme invariants, range overlaps/merge, whole-set normalization and primary tracking with pinned command/selection source; immutable input behavior and EOF/count saturation. |
| `test/unit/upstreamHelix.ts`, `test/unit/upstreamHelix.test.ts` | Separate upstream display parser, directed UTF-16 ranges, primary identity, LF/CRLF display-newline skipping, malformed input, Unicode, unchanged existing round-trip parser. |
| `test/unit/lineSelection.test.ts`, `test/fixtures/helix-selection-upstream.md` | Both original command cases; all 31 overlap and 18 line-range assertions; both normalization inputs and complete adjacent-point case; source mapping and attribution; additional invariants, primary, direction, EOF, Unicode and count tests. Compared named inventory with the local pinned-source archive. |
| `src/extension.ts`, `src/core/count.ts` | One shared Count supplied to existing consumers; validated digit dispatch; resets on extension commands/mode/editor/ignored-input boundaries; queued mode actions; exact approved cursor listener. |
| `src/motions/line.ts` | Synchronous count capture followed by shared-queue execution; no-editor/INSERT/disabled guards; read-only eligibility; document/UTF-16 conversion; whole-set transform and primary-first assignment/reveal. |
| `scripts/keybindings.cjs`, `package.json`, `test/unit/keybindings.test.ts` | Generated manifest agreement, command contribution/registration, top-row/keypad count args, read-only resets, motion contexts and binding order, word-jump precedence, native INSERT/suspension/Quick Input behavior. Manifest changes are confined to `contributes`; dependencies are unchanged. |
| `test/integration/index.ts`, `test/integration/keyboard.ts`, `test/integration/lineSelection.ts` | Real renderer key dispatch, digit support, exact directed-range/primary/text assertions, count boundaries and existing consumers, user override and contexts, read-only and ineligible direct calls, queue sequences, undo/text/dirty-state invariants, 28 independent oracle replays and both cursor-merging settings. |
| `test/integration/wordJump.ts`, `test/runIntegration.ts` | Condition-based delayed-paint checks preserve the existing 16-glyph/visible-zero-width assertions; isolated profile and test-only user binding; compatibility setting only in test profile; software-rendering launch flag. No word-jump production behavior was changed. |
| `scripts/helix-line-oracle.cjs` | Exact Git revision guard, immutable commit archive and isolated temporary harness/config, actual pinned Helix application/key-event execution, UTF-16/scalar conversions, deterministic serialization/check, corpus validation and cleanup. Expected outputs are not calculated by the TypeScript port. |
| `test/fixtures/line-selection-oracle.json`, `test/fixtures/line-selection-oracle.md`, `test/unit/lineOracle.test.ts` | Validated/replayed all 298 cases and 457 command snapshots, matrix/input-source correspondence, revision/coordinates/primary/step checks, documented provenance/regeneration and host limitation. Non-line edit-caret mapping is confined to existing edit representation; x/X outputs use exact ranges. |
| `README.md` | Compatibility prerequisite before setup; default EOF limitation; commands/count lifecycle and read-only behavior; pinned provenance; updated registration example and retained exclusions. |

## Acceptance coverage

| Requirement/check | Result and evidence |
| --- | --- |
| FR-1: counted/repeated x | PASS. Direct pinned-source comparison, both upstream fixtures, full pure oracle replay, keyboard cases and saturated arithmetic. |
| FR-2: direction-preserving X | PASS. Source comparison, forward/reverse/idempotence/count-consumption tests, oracle and raw host-range assertions. |
| FR-3: counts and lifecycle | PASS. Shared count wiring, integer validation, leading-zero/overflow/default/take/reset unit checks, top-row/keypad/12x tests, 2Xx/cancellation/ignored-input/editor/mode/word-jump boundaries, existing 2w/2u/2U and queued count snapshots. |
| FR-4: normalization and primary | PASS. Full upstream selection inventory plus unsorted/overlap/nested/duplicate/touching/transitive/primary/EOF oracle coverage and host primary-first checks. |
| FR-5: binding/host contexts | PASS. Generated ordering and exact host checks cover writable/read-only, INSERT, suspension, Quick Input, jump labels/cancellation and user binding precedence. |
| FR-6: required upstream imports | PASS. Inventory compared with local pinned-source files. Both test_extend_line cases, all 31 overlaps, all 18 line_range assertions, both create_normalizes_and_merges inputs and complete create_merges_adjacent_points input/result execute without skips or altered expectations. |
| FR-7: independent additional expectations | PASS. Rust harness uses actual Helix key commands and captures document/selection/primary after each command. Recorded deterministic regeneration matches all 298 cases; pure tests replay every snapshot; real host suite replays 28 representative/follow-on cases. Wrong-revision rejection independently executed. |
| NFR-1: pure architecture/dependencies | PASS. Core imports no vscode, executes in Node, host adapter is separate and small, manifest dependency fields and lockfile are unchanged. No runtime Helix/Rust dependency. |
| NFR-2: explicit compatibility/settings | PASS. README states prerequisite before setup. Isolated host profiles use false; both host logs demonstrate default true merges the EOF point; tests restore false. Production changes contain no configuration writes. Cursor listener changes temporary editor options only. |
| NFR-3: regressions/immutability | PASS. Independent 379-test run, inspected full supported-host passes, exact text/version/dirty/undo checks and existing word-jump/motion/edit/history groups. |
| Approved cursor exception | PASS. Listener checks enabled NORMAL and incoming non-Block style; Block events do not rerender. INSERT/suspended modes are left to native restoration. Both full host logs explicitly pass setting-change NORMAL/INSERT, native INSERT, suspension, visible-editor and runtime-enabled checks. |
| Scope/freshness/whitespace | PASS. All 22 file hashes and frozen references match; `git diff --check` passes; no excluded implementation or unrelated attribution found. |

## Verification performed by reviewer

- Executed `npm test`: exit 0; **379 passed, zero skipped**, including all oracle/import/unit tests and generated-binding/TypeScript checks. Log: `/tmp/select-line-independent-review-unit.log`.
- Executed `node scripts/helix-line-oracle.cjs --helix-root . --check` against this deliberately wrong Git revision. It rejected `0b2f3aea685204fc48b509392664ad08e4996106` before generation with the expected pinned-revision error and exit 1. Log: `/tmp/select-line-independent-review-wrong-revision.log`.
- Executed `git diff --check`: passed.
- Independently checked target/reference hashes and manifest field changes. Parsed corpus metadata confirms 298 cases/457 snapshots; existing validation/replay executes in npm test.
- Inspected pinned archived `helix-term/src/commands.rs`, `helix-core/src/selection.rs`, `helix-core/src/test.rs`, and `helix-term/tests/test/commands.rs` for the named algorithms/parser/inventory. These are review context, not change targets.

## Existing execution evidence independently inspected

- Full VS Code **1.85.0** suite: `/tmp/select-line-approved-cursor-1.85.0-rerun.log`, explicitly reports host version/compatible setting, default-setting EOF experiment, complete feature group, cursor NORMAL/INSERT regression and existing word-jump/motion/edit/history/multi-selection groups; final `Exit code: 0`.
- Full VS Code **1.142.0** suite: `/tmp/select-line-approved-cursor-1.142.0.log`, same complete coverage and final `Exit code: 0`.
- Deterministic pinned Rust oracle `--check`: `/tmp/select-line-oracle-check.log`, real integration test passed and reports exact 298-case match. Generator/corpus hashes remain unchanged since this execution.
- Original baseline/feature verification and cursor-reproduction evidence in `tasks.md` distinguish the pre-existing 1.85.0 cursor event-order defect from the feature delta.

## Findings, non-findings and limits

There are **no actionable findings**, accepted IDs, unresolved required checks, scope violations, or missing acceptance evidence in this consolidated review.

The first approved-fix 1.85.0 attempt failed an early ignored-key assertion before reaching the cursor-setting test (`/tmp/select-line-approved-cursor-1.85.0.log`). The unchanged full rerun passed. Its root cause remains unconfirmed; this report does not attribute it to startup timing or claim that the cursor listener fixes it. It is retained as a test-run reliability limitation, with no demonstrated regression attributable to the seven-line fix. No source/test/assertion change was made to obtain the passing rerun.

The older-host test adjustments wait for observable configuration/paint state while retaining exact expected cursor values and 16 visible zero-width label glyphs. They are not weakened parity assertions and do not warrant unrelated production repairs. Default EOF cursor merging remains an explicitly accepted configuration limitation, not an open implementation defect. Adding parity under default settings, other commands/modes, status/count UI changes, or a general conformance framework would be new scope and was not treated as a finding.

This reviewer did not rerun the expensive Electron suites or Rust regeneration; their complete existing logs, unchanged snapshot identity, test implementations and generation source were inspected. Automated tests cover the specified matrix rather than every possible document/input sequence. There is no new automated scope/attribution validator; those comparisons were review checks. No validators or source/test fixes were created during review.
