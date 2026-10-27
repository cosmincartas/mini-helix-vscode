---
schema_version: 1
artifact: implementation-plan
status: validated
subject: open-line
spec: spec.md
spec_sha256: 480e6660724e2f325524276e20e2fb5aacd7096d29f49f911909c2bce96dfc2a
repository_baseline: 5326c516f21fae9d2d75c2509e5410fe80c649e4
working_tree: "Uncommitted backtick text-object work: README.md, docs/context-engineering/helix-match-typescript/spec.md, package.json, scripts/keybindings.cjs, src/core/match.ts, test/integration/match.ts, test/unit/keybindings.test.ts, test/unit/surround.test.ts, test/unit/textObject.test.ts. Untracked: docs/context-engineering/open-line/."
created: 2026-10-24
updated: 2026-10-24
---

# Open Line Implementation Plan

## Source and Execution Boundaries

This plan implements only the included requirements of the referenced specification.
Before execution, confirm that the specification's exact content matches `spec_sha256`.
Resolve relative specification paths against this plan's folder. Resolve relative intent paths against the specification's folder.
Accept existing absolute source paths as written. Verify source existence and hash equality regardless of path format.
For file-based intent, verify the specification's `intent_sha256` against its source file. Stop on missing sources or mismatched hashes.
Inspect relevant repository changes against the baseline, including working-tree changes. Review affected tasks before execution.
When Git metadata is unavailable, inspect current relevant files and record the comparison limit.
Execution state belongs to the implementer, not this planning artifact.

## Supporting Sources

None. The specification has no UI mock or other supporting file. Its intent is `intent.md` (SHA-256 `aa259adabae505a454b36baf6473103ada941d2f569936d8ac31324efcb857c3`), which the specification records.

## Implementation Discretion

Preserve approved behavior, required signatures, contracts, invariants, architecture, and acceptance conditions.
Choose private helpers, class structure, and incidental wiring within those constraints. Required internal contracts remain binding.
Trace downstream from each task's entry point. The entry point is not an exhaustive list of affected files.
Check existing code, standard libraries, native capabilities, and installed dependencies before adding abstractions or dependencies.
Justify additions through a present requirement and an unmet need. Obtain specification approval for consequential technology changes.

Binding items from the specification:

- `openReferences` and `openedBlankLine` signatures in `src/core/editing.ts` (spec "Functions").
- `InsertEntry` value `'open'` and `ModeHost.restoreOpenIndent` (spec "Models", "Interfaces or Classes").
- Command ids, titles, category, and enablement (spec "Contracts").
- Native commands `editor.action.insertLineAfter` and `editor.action.insertLineBefore` as the only line inserters (spec "Architecture Decisions").

## Correction Rules

Stop dependent work when a change affects approved scope, acceptance, UI, contracts, or architecture.
Request specification review through `design-specs` or the original specification workflow. Do not silently change upstream artifacts.
For changed intent, request intent review first. Reassess downstream approvals after upstream correction.
For task order, grouping, or verification changes within the approved specification, request plan revision through `implementation-plan`.
Private structural changes within approved constraints require verification, not another design approval.
Do not refresh source hashes without reviewing changes and obtaining approval for affected content.

Specific trigger: if an integration test shows that VS Code does not convert the inserted `\n` to `\r\n` in a CRLF document (FR-7), stop. That result changes the architecture assumption, so it needs specification review.

## Approval Record

- **Decision:** Delegated approval.
- **Evidence:** `/quickie` invocation on 2026-10-24.
- **Limits:** Quickie delegation covers routine plan approval only. The user did not review this plan directly. Execution is not authorized by this plan.

## Repository Findings

- **Entry points and callers:**
  - `src/vscode/editing.ts:SelectionEdits` registers `a`, `c`, `d`. `SelectionEdits.run` queues the work, holds the revision, edits, selects, and enters INSERT.
  - `src/core/mode.ts:ModeController.enter` calls `restoreAppendCursor` and then `commitInsert` when INSERT ends.
  - `src/extension.ts:activate` builds the `ModeHost` and connects it to `SelectionEdits` and `UndoHistory`.
  - `src/vscode/history.ts:UndoHistory.hold` keeps native changes in one revision until `commitInsert`.
  - `src/core/editing.ts:blockRange` gives Helix's block range for an empty selection.
  - `scripts/keybindings.cjs:edits` lists `a`, `c`, `d`. `createKeybindings` binds them with `normalWhen` after the blockers.
  - `o` and `shift+o` are blocked today through `miniHelix.noop`.
- **Tests and commands:**
  - `npm test` runs `check:keybindings`, `compile`, and `node --test out/test/unit/*.test.js` (`package.json` scripts).
  - `npm run test:integration` compiles and runs `out/test/runIntegration.js`. It uses VS Code 1.143.1 from `.vscode-test/` and real keyboard input through `test/integration/keyboard.ts`.
  - `npm run generate:keybindings` writes `package.json` keybindings.
  - `test/integration/editing.ts:checkEditing` has `press` (letters, with Shift for uppercase), `reset`, and `carets` helpers.
  - `test/unit/mode.test.ts:fixture` records host calls in `endings`.
  - `test/unit/editing.test.ts` uses Helix notation helpers from `test/unit/helix.ts`.
- **Contracts and conventions:**
  - Commands are contributed in `package.json` with category `Mini Helix` and an enablement clause.
  - `test/unit/keybindings.test.ts` checks that each bound edit command is contributed and that its id appears in `src/vscode/editing.ts`.
  - Unit tests cite Helix functions. The integration suite avoids built-in language extensions (`test/integration/navigation.ts`).
- **Existing changes:** Uncommitted backtick text-object work touches `scripts/keybindings.cjs`, `package.json`, and `test/unit/keybindings.test.ts`. Keep these changes. Regenerate keybindings from the combined generator.
- **Baseline verification:** Not executed during planning.
- **Known failures or limits:** None known. Integration tests need a desktop session that can start VS Code with a remote debugging port.

## Tasks

### Task 1: `openReferences` gives Helix's reference caret for each selection

- **Requirements:** FR-1, FR-2, FR-3, NFR-3
- **Design references:** spec "Functions" (Editing core), "Architecture Decisions" (distinct reference carets), "Models" (`OffsetRange`)
- **Entry point:** New `src/core/editing.ts:openReferences`
- **Depends on:** none
- **RED:** In `test/unit/editing.test.ts`, add a test group that cites Helix `open` at `ba40e547`. Cases:
  - `below`, a forward and a reversed multi-line selection, gives the start of the last character.
  - `below`, a caret, gives the caret.
  - `below`, a caret at the end of `abc\n`, gives offset 3.
  - `below`, a selection that ends after a line ending (`ab\n` selected), gives the line ending's offset.
  - `below`, an empty text, gives 0.
  - `above` gives the start of the block range for forward, reversed, and caret selections.
  - Several selections keep their input order.
  - Run `npm run compile && node --test out/test/unit/editing.test.js`. Expected: compile fails because `openReferences` is not exported.
- **GREEN:** Add `openReferences` with the specified signature. Use `blockRange` and `WordMotionText.before`.
- **REFACTOR:** Share small offset helpers with existing code in the file, if useful.
- **Verification:** `npm run compile && node --test out/test/unit/editing.test.js` passes.
- **Prerequisites:** none

### Task 2: `openedBlankLine` detects Helix's untouched open line

- **Requirements:** FR-8, NFR-3
- **Design references:** spec "Functions" (Editing core), "Failure Model" F-4
- **Entry point:** New `src/core/editing.ts:openedBlankLine`
- **Depends on:** none
- **RED:** In `test/unit/editing.test.ts`, add a test group that cites Helix `try_restore_indent` at `ba40e547`. Cases:
  - Insertion `\n    ` at a line end, caret after it: returns the four spaces.
  - Same with `\r\n    `: returns the four spaces.
  - Insertion `\n` only (no indentation): returns an empty range or `undefined`; both remove nothing. Assert the text after removal is unchanged.
  - Insertion `\n    x`: `undefined`.
  - Caret not at the end of the insertion: `undefined`.
  - Text after the caret on the same line: `undefined`.
  - Insertion that does not start with a line ending (`    \n`, from `O` at offset 0): `undefined`.
  - Two separate insertions: `undefined`.
  - Text before equals text after: `undefined`.
  - Run `npm run compile && node --test out/test/unit/editing.test.js`. Expected: compile fails because `openedBlankLine` is not exported.
- **GREEN:** Add `openedBlankLine` with the specified signature.
- **REFACTOR:** None required.
- **Verification:** `npm run compile && node --test out/test/unit/editing.test.js` passes.
- **Prerequisites:** none

### Task 3: `o` and `O` open lines and enter INSERT

- **Requirements:** FR-1, FR-2, FR-4, FR-5, FR-6, FR-7, FR-10, FR-11, NFR-2
- **Design references:** spec "Architecture (HLD)", "Contracts", "Behavior" (Open flow), "Failure Model" F-1, F-2
- **Entry point:** `scripts/keybindings.cjs:edits`
- **Depends on:** Task 1
- **RED:**
  - In `test/unit/keybindings.test.ts`:
    - Add `o` → `miniHelix.openBelow` and `shift+o` → `miniHelix.openAbove` after `d` in the default-bindings list.
    - Add `o` to the override-order test with `miniHelix.openBelow`.
    - Add a `shift+o` order test: `miniHelix.noop`, `miniHelix.openAbove`, `miniHelix.cancelWordJump`, `miniHelix.surroundReplaceInput`. Its edit binding contains `!editorReadonly`.
    - Extend the `src/vscode/editing.ts` pattern to `openBelow|openAbove`.
  - Run `npm test`. Expected: the new assertions fail because `o` and `shift+o` are bound only to `miniHelix.noop`.
  - In `test/integration/editing.ts:checkEditing`, add the FR-1, FR-2, FR-4, FR-5, FR-6, and FR-7 cases from the specification:
    - FR-6: use `vscode.languages.setLanguageConfiguration` on the test document's language with a rule that indents after `{`. Dispose it after the case. For the `none` case, set `editor.autoIndent` to `none` and restore the old value afterwards.
    - FR-7: use a document with `vscode.EndOfLine.CRLF`.
    - FR-5: send the digit key through `keyboard.press`.
    - Each case presses Escape at its end, so the next case starts in NORMAL.
  - Run `npm run test:integration`. Expected: the first new case fails because `o` does not change the text.
- **GREEN:**
  - Add `['o', 'miniHelix.openBelow']` and `['shift+o', 'miniHelix.openAbove']` to `edits`. Run `npm run generate:keybindings`.
  - Contribute both commands in `package.json` with the specified titles, category, and enablement.
  - In `SelectionEdits`, register both commands. Follow the open flow:
    - clear the count;
    - queue the work;
    - compute `openReferences` and hold the revision;
    - set the carets and run the native command;
    - if the document did not change, restore the selections and commit;
    - otherwise, enter INSERT with entry `'open'`.
  - Add `'open'` to `InsertEntry`.
- **REFACTOR:** Keep one queue path for all edit commands if it stays simple. Do not change `a`, `c`, or `d` behavior.
- **Verification:**
  - `npm test` passes.
  - `npm run test:integration` passes. Its output shows `PASS` for the editing check.
- **Prerequisites:** Desktop session for the integration run.

### Task 4: Escape after `o` or `O` removes untouched indentation, in one undo revision

- **Requirements:** FR-8, FR-9, NFR-2
- **Design references:** spec "Interfaces or Classes" (`ModeHost`), "Behavior" (INSERT end after `o` or `O`), "Failure Model" F-3, F-4
- **Entry point:** `src/core/mode.ts:ModeController.enter`
- **Depends on:** Task 2, Task 3
- **RED:**
  - In `test/unit/mode.test.ts`, add `restoreOpenIndent` to the fixture host. It pushes `'open'` to `endings`. Add tests:
    - `enter('insert', 'open')` then `enter('normal')` gives `endings` equal to `['open', 'commit']`.
    - A later plain INSERT and NORMAL do not call it again.
    - `setEnabled(false)` during an `open` INSERT does not call it.
  - Run `npm run compile && node --test out/test/unit/mode.test.js`. Expected: compile fails because `ModeHost` has no `restoreOpenIndent`, or the tests fail on `endings`.
  - In `test/integration/editing.ts:checkEditing`, add the FR-8 and FR-9 cases from the specification. Add one more case: two carets, `o`, Escape. The indentation stays on both new lines, because there is more than one selection.
  - Run `npm run test:integration`. Expected: the FR-8 case fails because the whitespace stays.
- **GREEN:**
  - Add `restoreOpenIndent` to `ModeHost`. `ModeController` calls it before `commitInsert` when the INSERT entry was `'open'`.
  - In `SelectionEdits`, save the document and its text before the native command. Add the restore method:
    - check the document and that there is exactly one selection;
    - call `openedBlankLine`;
    - delete the range;
    - clear the saved state.
  - Connect the method in `src/extension.ts:activate`.
- **REFACTOR:** Align the `open` flag handling with the `appending` flag in `ModeController`.
- **Verification:**
  - `npm test` passes.
  - `npm run test:integration` passes, including the FR-8, FR-9, and two-caret cases.
- **Prerequisites:** Desktop session for the integration run.

### Task 5: The README documents `o` and `O`

- **Requirements:** FR-12
- **Design references:** spec FR-12, "Excluded and Deferred Requirements"
- **Entry point:** `README.md`
- **Depends on:** Task 3, Task 4
- **TDD:** Not applicable. This task changes documentation only.
- **Changes:**
  - Description: In "What this version does", add `o` and `O` to the list of unblocked keys.
  - Count rules: In "Counts", add `o` and `O` to the keys that ignore a count.
  - Key table: In "Selection edits", add an `o` row and an `O` row.
  - Differences from Helix:
    - VS Code indentation.
    - No indentation for `O` on the first line.
    - Count ignored.
    - No comment continuation.
    - The Escape whitespace rule.
  - Command table: Add `miniHelix.openBelow` / `openAbove` to "Commands and context keys".
- **Verification:** Read `README.md`. Each item in FR-12 is present. `npm test` still passes.
- **Prerequisites:** none

## Requirement Coverage

- **FR-1** → Task 1, Task 3
  - Verification: Task 1 unit tests; Task 3 FR-1 integration case
- **FR-2** → Task 1, Task 3
  - Verification: Task 1 unit tests; Task 3 FR-2 integration case
- **FR-3** → Task 1
  - Verification: Task 1 unit tests
- **FR-4** → Task 3
  - Verification: Task 3 FR-4 integration case
- **FR-5** → Task 3
  - Verification: Task 3 FR-5 integration case
- **FR-6** → Task 3
  - Verification: Task 3 FR-6 integration cases
- **FR-7** → Task 3
  - Verification: Task 3 FR-7 integration case
- **FR-8** → Task 2, Task 4
  - Verification: Task 2 unit tests; Task 4 mode unit tests and integration cases
- **FR-9** → Task 4
  - Verification: Task 4 FR-9 integration case
- **FR-10** → Task 3
  - Verification: Task 3 keybinding unit test (`!editorReadonly`)
- **FR-11** → Task 3
  - Verification: Task 3 keybinding order tests
- **FR-12** → Task 5
  - Verification: Task 5 README check
- **NFR-1** → Tasks 1 to 5
  - Verification: Final verification `npm test`
- **NFR-2** → Task 3, Task 4
  - Verification: Final verification `npm run test:integration`
- **NFR-3** → Task 1, Task 2
  - Verification: Task 1 and Task 2 test groups cite Helix functions

## Final Verification

- **Check:** `npm test`
  - Prerequisites: Tasks 1 to 5 complete.
  - Expected result: Exit code 0. The keybinding check reports no stale bindings.
  - Coverage: NFR-1, FR-1 to FR-3, FR-8, FR-10, FR-11
- **Check:** `npm run test:integration`
  - Prerequisites: Tasks 3 and 4 complete; desktop session.
  - Expected result: Exit code 0. The output shows `PASS` for the editing check.
  - Coverage: NFR-2, FR-1, FR-2, FR-4 to FR-9
- **Check:** Manual review of `README.md`.
  - Prerequisites: Task 5 complete.
  - Expected result: All FR-12 items are present.
  - Coverage: FR-12
