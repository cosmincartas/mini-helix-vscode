---
schema_version: 1
artifact: implementation-plan
status: validated
subject: leader-pickers
spec: spec.md
spec_sha256: fca5373d9f7e073356833172a619bd71fc1e7da9aca780e66042e355055f62aa
repository_baseline: 6eda5b30aac68772675c1b6c2d30ac556cdbac30
working_tree: "Only untracked docs/context-engineering/leader-pickers/ (intent.md, spec.md, plan.md). No source changes."
created: 2026-10-26
updated: 2026-10-26
---

# Leader Pickers Implementation Plan

## Source and Execution Boundaries

This plan implements only the included requirements of the referenced specification.
Before execution, confirm that the specification's exact content matches `spec_sha256`.
Resolve relative specification paths against this plan's folder. Resolve relative intent paths against the specification's folder.
Accept existing absolute source paths as written. Verify source existence and hash equality regardless of path format.
For file-based intent, verify the specification's `intent_sha256` against its source file. Stop on missing sources or mismatched hashes.
Inspect relevant repository changes against the baseline, including working-tree changes. Review affected tasks before execution.
Execution state belongs to the implementer, not this planning artifact.

## Supporting Sources

None. The specification has no UI mock or other supporting design file. The intent file is checked through the specification's `intent_sha256`.

## Implementation Discretion

Preserve approved behavior, required signatures, contracts, invariants, architecture, and acceptance conditions.
Choose private helpers, class structure, and incidental wiring within those constraints. Required internal contracts remain binding.
Trace downstream from each task's entry point. The entry point is not an exhaustive list of affected files.
Check existing code, standard libraries, native capabilities, and installed dependencies before adding abstractions or dependencies.
Justify additions through a present requirement and an unmet need. Obtain specification approval for consequential technology changes.

Binding contract items from the specification:

- Command IDs `miniHelix.filePicker`, `miniHelix.bufferPicker`, `miniHelix.symbolPicker`, with the titles, category, and enablement in spec "Contracts".
- Native targets `workbench.action.quickOpen`, `workbench.action.showEditorsInActiveGroup`, `workbench.action.gotoSymbol`.
- Keys `space f`, `space b`, `space s`, and Space chord blockers, all with `idleMotionWhen`.
- The single-key `space` bindings stay unchanged.

Free choices: the position of the leader bindings in the generated list, the name of an exported leader list in `scripts/keybindings.cjs`, and the structure of the new integration check.

## Correction Rules

Stop dependent work when a change affects approved scope, acceptance, UI, contracts, or architecture.
Request specification review through `design-specs` or the original specification workflow. Do not silently change upstream artifacts.
For changed intent, request intent review first. Reassess downstream approvals after upstream correction.
For task order, grouping, or verification changes within the approved specification, request plan revision through `implementation-plan`.
Private structural changes within approved constraints require verification, not another design approval.
Do not refresh source hashes without reviewing changes and obtaining approval for affected content.

## Approval Record

- **Decision:** Delegated approval
- **Evidence:** `/quickie` invocation on 2026-10-26. All completion checks passed.
- **Limits:** Quickie limited delegation for routine plan approval only. The user did not review this plan directly. No implementation is authorized by this record.

## Repository Findings

- **Entry points and callers:**
  - `src/vscode/navigation.ts:navigationCommands` maps `miniHelix.*` IDs to native commands. `registerNavigation` clears the count, runs in `CommandQueue`, and checks enabled state, NORMAL mode, and an active text editor.
  - `src/extension.ts:activate` registers `...registerNavigation(modes, count, queue)`. New table entries need no change there.
  - `scripts/keybindings.cjs:createKeybindings` generates all keybindings. `navigation` bindings use `idleMotionWhen`. `chordNoops(prefix, bound)` generates `miniHelix.noop` blockers for every key in `blocked`, `escape`, and `navigationKeys`.
  - Single-key `space` bindings today: `miniHelix.noop`, `miniHelix.cancelWordJump`, `miniHelix.cancelSurroundReplace` (from `package.json`).
- **Tests and commands:**
  - `npm test` = `check:keybindings` + `compile` + `node --test out/test/unit/*.test.js` (`package.json` scripts).
  - `npm run generate:keybindings` writes `contributes.keybindings` in `package.json`.
  - `npm run test:integration` runs `test/runIntegration.ts` with `@vscode/test-electron`, a temporary profile, and a CDP port. VS Code 1.143.1 is cached in `.vscode-test/`.
  - `test/integration/keyboard.ts:Keyboard` sends real key events (`keys(' f')` supports Space) and has `evaluate(expression)` for renderer DOM reads.
  - `test/integration/navigation.ts:checkNavigation` is the model for read-only documents (content provider scheme) and the INSERT/suspended guard check. `test/integration/index.ts:run` calls the checks in sequence.
  - `test/unit/keybindings.test.ts` asserts the exact default binding list, contributed and registered commands, blocker conditions, `g` chord sets, and modified-key rules.
- **Contracts and conventions:**
  - Command entries in `package.json` `contributes.commands` use category `Mini Helix` and a key hint in the title, for example `Go to Definition (gd)`.
  - Unit tests that currently match only `g` and `m` chords: `blockers are unique and NORMAL-only...` (`/^[gm] /`) and `only requested modified shortcuts are bound...` (`/^[gm] /`). They will need the `space` prefix after Task 2.
  - The integration check `unbound normal keys ... cannot type` in `test/integration/index.ts` presses Space then Enter and expects no text change. After Task 2, `space enter` is a chord blocker, so the expectation stays valid.
- **Existing changes:** None outside the topic folder.
- **Baseline verification:** Not executed during planning. `npm test` and `npm run test:integration` were not run.
- **Known failures or limits:**
  - `npm run test:integration` opens a VS Code window. It needs a graphical session or a virtual display (for example `xvfb-run -a npm run test:integration`). Availability in the execution environment is unknown.
  - Native command IDs were verified by source inspection only (VS Code 1.85.0 on GitHub and the local 1.143.1 bundle), not by a run.

## Tasks

### Task 1: Space then `f`, `b`, or `s` opens the native picker in NORMAL mode

- **Requirements:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, NFR-1
- **Design references:** spec "Architecture Decisions", "Contracts", "Functions — Navigation delegation", "Behavior — Leader key in NORMAL mode", "Failure Model" F-1, F-2
- **Entry point:** `src/vscode/navigation.ts:navigationCommands`; `scripts/keybindings.cjs:createKeybindings`
- **Depends on:** none
- **RED:**
  - In `test/unit/keybindings.test.ts`:
    - Add a test: each of `space f`, `space b`, `space s` has exactly one binding, with the contract command and `when` equal to `idleWhen`.
    - Add the three leader bindings to the expected list in `i, a, c, d, u, U, Escape, g w, motions, and counts are the default bindings...`.
    - Extend the `src/vscode/navigation.ts` pattern in `every bound motion and edit command is contributed and registered` to include `filePicker|bufferPicker|symbolPicker`.
  - Add `test/integration/leader.ts` with a check called from `test/integration/index.ts:run` after `checkNavigation`. Use a read-only content-provider document, as in `checkNavigation`. For each of ` f`, ` b`, ` s` through `keyboard.keys`:
    - Read the Quick Open widget through `keyboard.evaluate`. Expect it visible, with input `''` for `f`, starting with `edt active ` for `b`, and starting with `@` for `s`.
    - Close it with Escape (a real key press while the widget has focus) and expect it hidden.
    - Expect the document text unchanged and `api.getState()` equal to `{ enabled: true, mode: 'normal' }`.
  - In the same check: press `3`, Space, `f`, close the picker, refocus the editor, press `w` on known text. Expect a one-word selection (FR-6).
  - In the same check: run each leader command through `vscode.commands.executeCommand` in INSERT mode and in suspended mode. Expect no visible Quick Open widget (FR-5).
  - Commands: `npm test`, then `xvfb-run -a npm run test:integration` (or `npm run test:integration` in a graphical session).
  - Expected failure: unit tests fail because the bindings and commands do not exist. The integration check fails because no picker opens after Space then `f`.
- **GREEN:**
  - Add the three entries to `navigationCommands`.
  - Add the three commands to `package.json` `contributes.commands` with the contract titles, category, and enablement.
  - Add the three leader bindings with `idleMotionWhen` in `scripts/keybindings.cjs`, then run `npm run generate:keybindings`.
- **REFACTOR:** Optionally group the leader keys in a named, exported list in `scripts/keybindings.cjs`, like `navigation`. Keep `package.json` regenerated and tests green.
- **Verification:** `npm test` exits 0. The new integration check prints its PASS line and `npm run test:integration` exits 0. `git diff package.json` shows changes only in `contributes.commands` and `contributes.keybindings`.
- **Prerequisites:** `npm ci` done. A graphical session or `xvfb-run` for the integration command.

### Task 2: Other Space chords do nothing and clear the count

- **Requirements:** FR-7, FR-8
- **Design references:** spec "Contracts — Leader keybindings", "Behavior — Leader key during `gw` or `mr`"
- **Entry point:** `scripts/keybindings.cjs:chordNoops`
- **Depends on:** Task 1
- **RED:**
  - In `test/unit/keybindings.test.ts`:
    - Add a test like `every other g chord is an unbound key that clears the count` for the `space ` prefix. The set of `space *` keys must equal every single-key blocker, plus `escape` and the eight navigation keys. The commands must be `miniHelix.noop` and the three leader commands only.
    - Add a test: every binding whose key starts with `space ` has `when` equal to `idleWhen`.
    - Add a test: the single-key `space` bindings are exactly `miniHelix.noop`, `miniHelix.cancelWordJump`, `miniHelix.cancelSurroundReplace`, in that order.
    - Change the `/^[gm] /` key tests in `blockers are unique and NORMAL-only...` and `only requested modified shortcuts are bound...` to also accept the `space ` prefix.
  - In `test/integration/leader.ts`: press `2`, Space, `x`, then `w`, in a writable document. Expect the text unchanged and a one-word selection. Press Space then Enter. Expect the text unchanged.
  - Commands: `npm test`, then `xvfb-run -a npm run test:integration`.
  - Expected failure: the chord-set unit test fails because no `space <key>` blockers exist.
- **GREEN:** Add `...chordNoops('space', ['f', 'b', 's'])` to `createKeybindings`, then run `npm run generate:keybindings`.
- **REFACTOR:** None required. Keep `package.json` regenerated and tests green.
- **Verification:** `npm test` exits 0. `npm run test:integration` exits 0, including the existing `unbound normal keys ... cannot type` check and the `gw` and `mr` checks.
- **Prerequisites:** Task 1. A graphical session or `xvfb-run` for the integration command.

### Task 3: README documents the leader keys

- **Requirements:** NFR-2
- **Design references:** spec "Components — README", "Constraints and Assumptions", "Open Issues"
- **Entry point:** `README.md`
- **Depends on:** Task 2
- **TDD:** Does not apply. This task changes documentation only, with no runtime behavior.
- **Change:**
  - Add a section (for example `### Leader pickers (Space)`) with a table of `Space f`, `Space b`, `Space s`, their commands, and the native pickers.
  - State: works in NORMAL including read-only editors; clears a count; other Space chords do nothing; `b` lists only the active editor group; Quick Open shows recent files first; symbols need a language extension.
  - Update "What this version does" so that the Space blocker statement names the Space chords as exceptions.
  - Add `Space f`, `Space b`, `Space s` to the README "Counts" list of keys that ignore a count.
- **Verification:** Read `README.md`. It contains the three keys and the rules above, and no sentence states that Space is blocked without the exception. `npm test` still exits 0.
- **Prerequisites:** Task 2, so the documented behavior exists.

## Requirement Coverage

- **FR-1** → Task 1
  - Verification: Task 1 integration check for ` f`; unit test for `space f`.
- **FR-2** → Task 1
  - Verification: Task 1 integration check for ` b` (`edt active ` prefix); unit test for `space b`.
- **FR-3** → Task 1
  - Verification: Task 1 integration check for ` s` (`@` prefix); unit test for `space s`.
- **FR-4** → Task 1
  - Verification: Task 1 integration check runs in a read-only document; unit test asserts `idleWhen` without `!editorReadonly`.
- **FR-5** → Task 1
  - Verification: Task 1 integration guard check in INSERT and suspended modes.
- **FR-6** → Task 1
  - Verification: Task 1 integration check `3`, Space, `f`, then `w` selects one word.
- **FR-7** → Task 2
  - Verification: Task 2 chord-set unit test; integration check for `2`, Space, `x`, `w` and Space, Enter.
- **FR-8** → Task 2
  - Verification: Task 2 unit tests for `space *` conditions and unchanged single-key `space` bindings; existing `gw` and `mr` integration checks.
- **NFR-1** → Task 1
  - Verification: Task 1 `git diff package.json` check (no dependency change); integration run proves the native IDs on 1.143.1; 1.85.0 source check recorded in the specification.
- **NFR-2** → Task 3
  - Verification: Task 3 README review.

## Final Verification

- **Check:** `npm test`
  - Prerequisites: Tasks 1 to 3 complete; `npm ci` done.
  - Expected result: Exit code 0. The keybinding check, compile, and all unit tests pass.
  - Coverage: FR-1 to FR-8 (binding and registration level), NFR-1 (no stale manifest).
- **Check:** `xvfb-run -a npm run test:integration` (or `npm run test:integration` in a graphical session)
  - Prerequisites: Tasks 1 and 2 complete; display available.
  - Expected result: Exit code 0, with PASS lines for the new leader check and all existing checks.
  - Coverage: FR-1 to FR-8 with real key events.
- **Check:** `git diff --stat` and `git diff package.json`
  - Prerequisites: Tasks 1 to 3 complete.
  - Expected result: Changes only in `src/vscode/navigation.ts`, `scripts/keybindings.cjs`, `package.json` (`contributes` only), `test/unit/keybindings.test.ts`, `test/integration/leader.ts`, `test/integration/index.ts`, and `README.md`. No dependency changes.
  - Coverage: NFR-1, NFR-2, scope check against excluded FR-9 to FR-13.
