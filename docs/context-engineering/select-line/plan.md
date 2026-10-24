---
schema_version: 1
artifact: implementation-plan
status: validated
subject: select-line
spec: spec.md
spec_sha256: 4b10a2b64dad662f9db856522faa9013e267e1f044e358508e9872ec7cd128e5
repository_baseline: 0b2f3aea685204fc48b509392664ad08e4996106
working_tree: clean before planning; only select-line documentation added during planning
created: 2026-10-24
updated: 2026-10-24
---

# Select Line Implementation Plan

## Source and Execution Boundaries

Implement only the included requirements in [spec.md](spec.md).
Verify its exact SHA-256 before execution and after corrections.
Resolve `spec` against this folder. The specification records conversation intent; no intent file exists.
Its `intent_sha256: not applicable` is intentional.

Compare the repository with the recorded baseline, including relevant uncommitted changes.
Review affected tasks before proceeding when evidence changes.
Keep execution state outside this planning artifact.

This run created documentation only. It did not execute these tasks, change settings, or run feature tests.
All build, test, and generation commands below are proposed implementation checks.

## Supporting Sources

No separate local design source exists. The specification contains the UI reference and all binding design decisions.
Its immutable upstream links identify the approved algorithms, tests, parser, and host limitation.
The specification hash covers those references.

## Implementation Discretion

Preserve the approved behavior, contracts, invariants, and direct-port architecture.
Choose private helpers, exact signatures, and incidental wiring within those constraints.
Trace downstream from each task entry point; file references do not freeze the complete change list.
Reuse existing core types, the command queue, and installed dependencies.
Do not add a runtime dependency, logical-selection subsystem, new SELECT mode, or unrelated motion activation.
Do not change the existing round-trip fixture parser to accept upstream display notation.

Exact parity requires `editor.multiCursorMergeOverlapping=false`.
Keep this explicit in implementation documentation and acceptance results.
Do not change users' settings automatically or claim parity under unsupported settings.

## Correction Rules

Stop dependent work when scope, acceptance, UI, contracts, or architecture changes.
Request specification review through the original quickie workflow or `design-specs`.
For changed intent, review intent before dependent design.
Review changed source content before updating a saved hash.
Revise task order or verification through `implementation-plan` when approved design remains unchanged.
Private structural changes require verification, not another design approval.

## Approval Record

- **Decision:** Delegated approval after complete plan validation on 2026-10-24.
- **Evidence:** User said, “use quickie to generate specs and implementation plan on autopilot”.
- **Scope:** All eight tasks, their dependencies, and requirement coverage below.
- **Limits:** Routine planning only. No direct user review or implementation is claimed.
- **Validation:** Source hash, repository facts, task dependencies, verification facilities, requirements, and exclusions were checked.

## Repository Findings

| Area | Finding and evidence |
|---|---|
| Activation | `src/extension.ts:activate` registers word motions, selection edits, history, and modes |
| Count prerequisite | Required `Count` arguments are missing from three activation calls and one integration call |
| Existing count behavior | `Count` implements accumulation, leading-zero handling, overflow rejection, consumption, and reset |
| Count consumers | `registerMotion`, `SelectionEdits.register`, and `UndoHistory.register` already accept `Count` |
| Selection conversion | `OffsetRange`, `WordMotionText`, and `blockRange` already support UTF-16 and grapheme boundaries |
| Line access | `Lines` and `textLines` exist; document line adaptation also exists in `src/motions/hjkl.ts` |
| Ordering | `CommandQueue` serializes existing edits, history, and mode commands |
| Binding ownership | Change `scripts/keybindings.cjs`; regenerate `package.json` instead of hand-editing generated entries |
| Fixtures | `test/unit/helix.ts` supplies current notation and edit sessions; preserve their existing semantics |
| Keyboard harness | `Keyboard.press` supports explicit digits; `Keyboard.keys` currently supports letters and selected named keys |
| Integration setup | `test/runIntegration.ts` creates a temporary profile/workspace and accepts `VSCODE_EXECUTABLE_PATH` |
| Host compatibility | Manifest declares VS Code `^1.85.0`; the conversation reports the EOF reproduction on 1.142.0 |
| Build | `npm run compile` invokes `tsc -p .`; `tsconfig.json` includes `src` and `test` |
| Unit checks | `npm test` checks generated bindings, compiles, then runs `out/test/unit/*.test.js` |
| Host checks | `npm run test:integration` compiles and launches the isolated Electron keyboard suite |

Existing production changes: none at planning start.
Only this plan and its specification were added during planning.

Baseline execution: not performed during planning.
The supplied conversation reports four TypeScript errors and 56 unit tests passing when run separately.
Static inspection confirms the four missing count arguments; it does not establish current test results.
Task 1 addresses that prerequisite. Do not include unrelated repairs without specification review.

Node dependencies must be installed before implementation checks.
Integration tests require an Electron executable and a display, or `xvfb-run -a` on headless Linux.
An existing executable must be the Electron binary, not VS Code's CLI wrapper.

## Tasks

### Task 1: Restore One Shared Count Instance Across Existing Consumers

- **Requirements:** FR-3, NFR-3; prerequisite for upstream count cases.
- **Design references:** Specification, Functions; Architecture Decisions; Evidence and Provenance.
- **Entry point:** `src/extension.ts:activate`.
- **Depends on:** none.
- **RED:** Add `test/unit/count.test.ts` through the exported `Count` API.
  Cover default consumption, accumulation, leading zero, overflow rejection, callback updates, and reset.
  Run `npm test`; the baseline must expose missing required count arguments before new behavior can execute.
  Record actual diagnostics instead of assuming the historical four-error report remains exact.
- **GREEN:** Create one `Count` during activation and pass it to existing motion, edit, and history registrations.
  Supply a count in the existing integration motion-runner caller.
  Preserve existing count-consuming semantics; do not activate unused motion modules.
- **REFACTOR:** Remove duplicated count ownership if introduced. Keep the current `MiniHelixApi` shape.
- **Verification:** `npm test` must compile and pass all current and new unit checks.
- **Prerequisites:** Installed Node dependencies. No digit bindings or line commands are required yet.

### Task 2: Make Count Prefixes Reach Commands and Clear At Boundaries

- **Requirements:** FR-3, FR-5, NFR-3.
- **Design references:** Specification, UI-1; Count integration responsibility; Counts and Ordered Commands.
- **Entry point:** `scripts/keybindings.cjs:createKeybindings`.
- **Depends on:** Task 1.
- **RED:** Extend generated-binding tests and real keyboard tests for `2w`, multi-digit counts, leading zero, and overflow.
  Cover NORMAL Escape, blocked input, INSERT entry, suspension, word jumps, and editor switches.
  Run `npm test` and `npm run test:integration`; digit prefixes currently fail to reach commands.
- **GREEN:** Register guarded `miniHelix.countDigit` input with validated integer arguments.
  Generate top-row and keypad digit bindings for idle NORMAL editors, including read-only editors.
  Keep shifted symbols and word-jump cancellation behavior unchanged.
  Clear pending counts at the specification's lifecycle boundaries.
  Preserve existing count-aware word motions, edits, and history behavior.
  Add digit support to `Keyboard.keys` for subsequent upstream sequence replay.
- **REFACTOR:** Consolidate reset ownership where useful without creating a new keyboard parser or count context key.
- **Verification:** Run `npm run generate:keybindings`, then `npm test` and `npm run test:integration`.
  Counts must apply once, never insert text in NORMAL, and never affect the next command after a reset.
  Invalid programmatic digit arguments must leave pending state unchanged.
- **Prerequisites:** Task 1; isolated Electron profile and display for keyboard checks.

### Task 3: Import Upstream Selection Notation Without Changing Existing Fixtures

- **Requirements:** FR-6, FR-7, NFR-3.
- **Design references:** Specification, Fixture and Oracle Contract; Models.
- **Entry point:** New `test/unit/upstreamHelix.ts`.
- **Depends on:** Task 1.
- **RED:** Add `test/unit/upstreamHelix.test.ts` against the new importer's supported API.
  Assert exact text, UTF-16 endpoints, direction, and primary identity from pinned upstream examples.
  Include LF and CRLF display-newline skipping and malformed notation.
  Run `npm test`; the new importer is initially unavailable.
- **GREEN:** Port `helix_core::test::print` notation rules into a dedicated importer.
  Retain the current `test/unit/helix.ts:parse` and `print` behavior.
  Inventory both `test_extend_line` cases and the four supporting test groups named in FR-6.
  Record source revision, names, paths, and required attribution beside imported fixtures.
- **REFACTOR:** Share neutral test types where useful. Do not merge parsers with different notation contracts.
- **Verification:** `npm test` must pass new importer cases and all existing fixture-based edit/history tests.
  Review the inventory against the pinned source; each required upstream case must have a destination.
- **Prerequisites:** Task 1. Use the immutable source references in the specification.

### Task 4: Normalize Complete Selection Sets Like Helix

- **Requirements:** FR-4, FR-6, NFR-1.
- **Design references:** Specification, Models; Selection Contract; pure core component.
- **Entry point:** New `src/core/lineSelection.ts` selection-set normalization API.
- **Depends on:** Task 3.
- **RED:** Add `test/unit/lineSelection.test.ts` through the core's exported normalization contract.
  Port `test_overlaps`, `test_create_normalizes_and_merges`, and `test_create_merges_adjacent_points`.
  Assert sorted directed ranges and primary identity, including a transitive merge containing the primary.
  Run `npm test`; the new normalization behavior is absent.
- **GREEN:** Sort ranges and apply Helix's overlap and merge rules.
  Preserve end-touching points and adjacent nonempty ranges. Merge same-start points and actual overlaps.
  Keep a merged range reversed only when both inputs are reversed.
  Return primary identity after normalization; convert to primary-first order only at the adapter boundary.
- **REFACTOR:** Keep normalization pure and independent of VS Code. Reuse `OffsetRange` rather than introducing duplicate position types.
- **Verification:** `npm test` must pass all imported normalization assertions without skips or changed expectations.
  The core test process must require no `vscode` module.
- **Prerequisites:** Task 3 importer and inventory.

### Task 5: Port Counted `x` Line Expansion Into The Pure Core

- **Requirements:** FR-1, FR-3, FR-4, FR-6, NFR-1.
- **Design references:** Specification, `x` behavior; Selection Contract; pure transform responsibility.
- **Entry point:** `src/core/lineSelection.ts` line-expansion API.
- **Depends on:** Task 2, Task 4.
- **RED:** Extend `test/unit/lineSelection.test.ts` with both unchanged `test_extend_line` cases: `x2x` and `2x`.
  Port all `test_line_range` cases through the supported line-range contract shared by both transforms.
  Add direct expected assertions for blank lines, reversed input, whole lines, empty text, and EOF saturation.
  Run `npm test`; line expansion is initially absent.
- **GREEN:** Port `extend_line_impl` with `Extend::Below` and reuse existing line and grapheme access.
  Establish block-selection invariants before testing whether a range already covers whole lines.
  Include initial expansion in the count, clamp at EOF, and return normalized forward selections.
  Preserve document text and input objects.
- **REFACTOR:** Share line-boundary operations required by `X`. Avoid loops proportional to a saturated count.
- **Verification:** `npm test` must match both upstream text-and-selection results exactly.
  CRLF, astral characters, combining sequences, and missing final newlines must preserve valid UTF-16 endpoints.
  The maximum count must clamp by line arithmetic instead of executing that many repeated commands.
- **Prerequisites:** Tasks 2 and 4. New tests use the dedicated upstream importer from Task 3.

### Task 6: Port Direction-Preserving `X` Line Expansion

- **Requirements:** FR-2, FR-4, NFR-1.
- **Design references:** Specification, `X` behavior; Selection Contract.
- **Entry point:** `src/core/lineSelection.ts` line-boundary expansion API.
- **Depends on:** Task 5.
- **RED:** Add observable core tests for forward and reversed partial ranges, whole-line ranges, blank lines, and EOF points.
  Assert repeated `X` is idempotent and supplied counts do not change expansion.
  Include overlapping mixed-direction inputs and primary preservation.
  Run `npm test`; the `X` transform is initially absent.
- **GREEN:** Port `extend_to_line_bounds`, preserve each range's direction, and normalize the complete set.
  Reuse the same line-range and input-invariant rules as `x`.
- **REFACTOR:** Share required boundary calculations while retaining the commands' distinct behavior.
- **Verification:** `npm test` must pass all `X` assertions and unchanged `x` tests.
  `X(X(selection))` must equal `X(selection)`, including primary identity.
- **Prerequisites:** Task 5. Task 8 independently verifies these expectations with real Helix.

### Task 7: Expose Both Commands Through Ordered VS Code Keyboard Actions

- **Requirements:** FR-1, FR-2, FR-3, FR-4, FR-5, NFR-2, NFR-3.
- **Design references:** Specification, UI-1; Command and Binding Contract; Architectural Flow.
- **Entry point:** New `src/motions/line.ts` command adapter.
- **Depends on:** Task 2, Task 6.
- **RED:** Add `test/integration/lineSelection.ts` and call it from the existing integration runner.
  Assert `x`, `Shift+x`, `x2x`, `2x`, `2Xx`, reset boundaries, and primary-first output with real keys.
  Update the current assertion that `x` is unbound; retain its document-immutability check.
  Extend binding precedence and command contribution tests.
  Run `npm test` and `npm run test:integration`; commands and bindings are initially missing.
- **GREEN:** Register and contribute `miniHelix.extendLineBelow` and `miniHelix.extendToLineBounds`.
  Add `x` and `shift+x` to the generator using idle motion contexts.
  Capture counts synchronously, then run selection work on the existing shared command queue.
  Check editor eligibility inside queued execution, convert selections, transform the whole set, assign, and reveal.
  Reuse document line access. Preserve text, dirty state, and undo history.
  Allow read-only documents. Preserve INSERT typing, suspension, Quick Input, labels, and user overrides.
  Set compatibility values only in the isolated test profile when the parity suite requires them.
- **REFACTOR:** Share host conversion with existing modules if useful; retain existing motion and editing contracts.
- **Verification:** Run `npm run generate:keybindings`, `npm test`, and `npm run test:integration`.
  Observe exact ranges and primary identity after each key, including rapid queued `dx`, `xd`, `xc`, and undo sequences.
  Direct command calls without an editor or eligible mode must leave text unchanged and must not throw.
- **Prerequisites:** Tasks 2 and 6; Electron and display; compatible isolated profile for full parity assertions.

### Task 8: Establish Independent Helix Parity And Document Compatibility

- **Requirements:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, NFR-1, NFR-2, NFR-3.
- **Design references:** Specification, Fixture and Oracle Contract; Failure Model; Traceability.
- **Entry point:** New `scripts/helix-line-oracle.cjs`, with a checked-in line-selection oracle corpus.
- **Depends on:** Task 7.
- **RED:** Generate expected results from the pinned Helix integration harness, then replay them through exported core APIs.
  Add representative real-keyboard replays and an isolated host-normalization experiment under both configuration values.
  Run `npm test` and `npm run test:integration`; any port or adapter mismatch must fail with its case identifier.
- **GREEN:** Fix only differences within the approved line-selection and count scope.
  Create a deterministic generator accepting `--helix-root` and `--check`.
  Verify the exact Helix revision and use a temporary generation environment.
  Drive real Helix commands through `test_key_sequence_with_input_text` or the equivalent pinned harness entry.
  Capture actual text, directed ranges, and primary identity. Never compute expected selections with the TypeScript implementation.
  Validate corpus coordinates and convert character indices to UTF-16 explicitly.
  Keep ordinary extension tests independent of Rust, network access, and Helix installation.
  Record regeneration instructions, revision, attribution, and source-case mapping beside the corpus.
  Update README bindings, commands, count support, and the currently outdated motion registration example.
  State the compatibility prerequisite and default-setting EOF limitation prominently.
- **REFACTOR:** Remove temporary diagnostics; retain reproducible provenance and independently generated expected values.
  Do not broaden this into a general upstream synchronization framework.
- **Verification:** After creating the generator, run `node scripts/helix-line-oracle.cjs --helix-root "$HELIX_SOURCE" --check`.
  It must report an exact match with checked-in results and reject another revision.
  Run `npm test` and `npm run test:integration`; all compatible-profile cases must pass without skips.
  Replay the host suite on the manifest minimum version and the acceptance host version.
  Record exact versions and settings. Do not substitute a current-main source inspection for host execution.
  Review configuration snapshots and dependency changes; user settings and runtime dependencies must remain unchanged.
- **Prerequisites:** Task 7; scratch Helix checkout at the exact pinned revision; Rust toolchain and upstream build prerequisites.
  Set `HELIX_SOURCE` to that checkout. Generator and corpus paths are created by this task.
  Supply Electron binaries for VS Code 1.85.0 and the acceptance host, with a display or Xvfb.
  The earlier reported acceptance host is 1.142.0; record and review any unavailable or replacement version before claiming compatibility.

### Oracle Matrix For Task 8

Include all applicable combinations needed to distinguish the algorithms, rather than only happy-path examples:

| Dimension | Required cases |
|---|---|
| Text shape | Empty, single line, multiple lines, blank and consecutive blank lines, leading indentation |
| Line endings | LF, CRLF, CR; with and without final newline; final empty line |
| Unicode | Astral characters, combining sequences, emoji graphemes, and cursor positions beside line endings |
| Input range | Caret, one grapheme, partial line, full line, multiple full lines, ending at a following line start |
| Direction | Forward and reversed; mixed directions across selections |
| Repetition | `x`, `xx`, `X`, `XX`, `xX`, `Xx`, `2x`, `x2x`, `2Xx`, multi-digit and saturated counts |
| Selection set | Unsorted, overlapping, nested, duplicate, touching, and transitive overlaps |
| Primary identity | Each possible primary position across the selected normalization cases |
| EOF | Nonempty range ending at EOF beside a distinct EOF point; repeated commands at EOF |
| Follow-on actions | `xd`, `xc<esc>`, `xdu`, `xc<esc>u`, `Xd`, `Xc<esc>u`, and queued `dx` |
| Host state | Read-only, no editor, INSERT, suspended, word jump, Quick Input, and user override |

Use Helix for semantic expected values and VS Code for binding and host-state behavior.
Existing differences in unrelated INSERT rendering do not permit weakened `x` or `X` selection assertions.
Investigate any follow-on mismatch before claiming delivery; route an architectural conflict through specification review.

## Requirement Coverage

| Requirement | Tasks | Verification |
|---|---|---|
| FR-1 | Task 5, Task 7, Task 8 | Upstream `x` fixtures, oracle replay, real keys |
| FR-2 | Task 6, Task 7, Task 8 | Direction, idempotence, consumed counts, real keys |
| FR-3 | Task 1, Task 2, Task 5, Task 7, Task 8 | Count API, keyboard lifecycle, upstream sequences |
| FR-4 | Task 4, Task 5, Task 6, Task 7, Task 8 | Complete ranges, primary identity, EOF preservation |
| FR-5 | Task 2, Task 7, Task 8 | Binding contexts, read-only, labels, native input, overrides |
| FR-6 | Task 3, Task 4, Task 5, Task 8 | Named upstream inventory and unchanged expected values |
| FR-7 | Task 3, Task 8 | Real Helix generation, deterministic check, core and host replay |
| NFR-1 | Task 4, Task 5, Task 6, Task 8 | Pure Node tests and dependency review |
| NFR-2 | Task 7, Task 8 | Paired host configurations and configuration snapshots |
| NFR-3 | Task 1, Task 2, Task 3, Task 7, Task 8 | Full existing unit and integration suites |

## Final Verification

Run these checks after all tasks. They were not run during planning.

1. Verify source freshness and inspect all changes against the recorded baseline.
2. Run `npm test`. Generated bindings, compilation, existing unit tests, and all new core cases must pass.
3. Run the Task 8 oracle generator with `--check`. Checked-in results must equal pinned real Helix output.
4. Run `npm run test:integration` with the compatible isolated profile. All keyboard and follow-on assertions must pass.
5. Run the documented default-setting experiment. It must expose the EOF limitation without claiming full parity.
6. Repeat host checks using the minimum and acceptance Electron binaries; record their exact versions.
7. Review the upstream inventory. Both command cases and every required supporting case must execute without skips.
8. Review the diff for settings writes, runtime dependencies, unrelated repairs, and excluded features.

For explicit host replay, use the existing runner override:

```sh
VSCODE_EXECUTABLE_PATH="$VSCODE_MIN_EXECUTABLE" npm run test:integration
VSCODE_EXECUTABLE_PATH="$VSCODE_ACCEPTANCE_EXECUTABLE" npm run test:integration
```

Set both variables to actual Electron binaries before running these proposed commands.
Use `xvfb-run -a` around the commands when headless Linux requires it.
Do not report unexecuted checks as passing.

The implementation is accepted only when compatible-host parity and existing regressions pass.
Keep the default-setting limitation explicit in the delivery report.
