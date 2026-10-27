---
schema_version: 1
artifact: implementation-plan
status: validated
subject: goto-motions
spec: spec.md
spec_sha256: a4a4280643a80bc3bfd35237a85c87527988cce336275bc06f41660cfaad6b4a
repository_baseline: b4683aa28abc90c52cc8402b29c77acc45ead865
working_tree: "Clean, except untracked docs/context-engineering/goto-motions/ (this plan and its specification)."
created: 2026-10-25
updated: 2026-10-25
---

# Goto Motions Implementation Plan

## Source and Execution Boundaries

This plan implements only the included requirements of the referenced specification.
Before execution, confirm that the specification's exact content matches `spec_sha256`.
Resolve relative specification paths against this plan's folder. Resolve relative intent paths against the specification's folder.
Accept existing absolute source paths as written. Verify source existence and hash equality regardless of path format.
For conversation-supplied intent, require recorded intent content and `intent_sha256: not applicable` in the specification. The specification records the quoted request.
Inspect relevant repository changes against the baseline, including working-tree changes. Review affected tasks before execution.
When Git metadata is unavailable, inspect current relevant files and record the comparison limit.
Execution state belongs to the implementer, not this planning artifact.

## Supporting Sources

None. The specification has no local supporting files. Helix sources are external, pinned to tag `25.07.1`, and listed in the specification section "Helix reference behavior".

## Implementation Discretion

Preserve approved behavior, required signatures, contracts, invariants, architecture, and acceptance conditions.
Choose private helpers, class structure, and incidental wiring within those constraints. Required internal contracts remain binding.
Trace downstream from each task's entry point. The entry point is not an exhaustive list of affected files.
Check existing code, standard libraries, native capabilities, and installed dependencies before adding abstractions or dependencies.
Justify additions through a present requirement and an unmet need. Obtain specification approval for consequential technology changes.

Binding items from the specification:

- The four exported signatures in `src/core/gotoMotion.ts` (specification section "Functions").
- The four command IDs and titles (specification section "Contracts").
- All four chords register through `src/core/registerMotion.ts:registerMotion` with the shared `CommandQueue`.
- `src/core/charMotion.ts:cursorOf` becomes exported and is reused. Do not copy it.

Discretionary items:

- The shape of `src/motions/goto.ts`. Follow `src/motions/word.ts` and `src/motions/hjkl.ts`.
- How the adapter builds `Lines` (`textLines(document.getText())`, or a shared document-backed `Lines` like `src/motions/hjkl.ts:documentLines`). The duplicate `documentLines` in `src/motions/hjkl.ts` and `src/motions/line.ts` can be shared, but that is not required.
- How unit tests drive the core: extend `test/unit/helix.ts:Session` with `g` chords (recommended, so one case table serves unit and integration tests), or call the core functions directly.
- The replacement chord for the user-override examples. This plan uses `g h` → `cursorLineStart`. Any chord that stays unbound is acceptable.

## Correction Rules

Stop dependent work when a change affects approved scope, acceptance, UI, contracts, or architecture.
Request specification review through `design-specs` or the original specification workflow. Do not silently change upstream artifacts.
For changed intent, request intent review first. Reassess downstream approvals after upstream correction.
For task order, grouping, or verification changes within the approved specification, request plan revision through `implementation-plan`.
Private structural changes within approved constraints require verification, not another design approval.
Do not refresh source hashes without reviewing changes and obtaining approval for affected content.

If a case in the specification disagrees with real Helix 25.07.1 (`hx` is installed locally as `helix 25.07.1 (ba5b022c)`), stop. Report the case, the Helix result, and the specification result. That difference is a specification correction.

## Approval Record

- **Decision:** Delegated approval.
- **Evidence:** `/quickie` invocation, 2026-10-25 ("I need to add some motions: gs, gl, gg, ge").
- **Limits:** Quickie delegation covers routine scope, UI, HLD, specification, and plan approvals only. The user did not review this plan directly. The delegation does not authorize implementation, commits, branches, or pushes.

## Repository Findings

- **Entry points and callers:**
  - `src/extension.ts:activate` registers all commands and passes `modes`, `count`, and `queue`.
  - `src/core/registerMotion.ts:registerMotion` takes the count before the queue wait, guards editor and mode, applies `uniqueSelections`, and calls `editor.revealRange(editor.selection)`.
  - `src/core/count.ts:Count.take` returns 1 when no count is pending. So `gg` and `1gg` both go to line 1, as in Helix.
  - `src/core/charMotion.ts:cursorOf` is the private Helix `Range::cursor` port. `Lines`, `Line`, and `textLines` are exported.
  - `src/core/wordMotion.ts:WordMotionText.before` gives the grapheme before an offset; `\r\n` is one unit.
  - `src/motions/word.ts:prepared` caches a `WordMotionText` per document version.
- **Tests and commands:**
  - `npm test` runs `check:keybindings`, `tsc -p .`, and `node --test out/test/unit/*.test.js` (`package.json` `scripts.test`).
  - `npm run test:integration` compiles and runs `out/test/runIntegration.js` with `@vscode/test-electron`. A cached VS Code exists at `.vscode-test/vscode-linux-x64-1.143.1`. The runner drives real keys through the Chrome DevTools port (`test/integration/keyboard.ts:Keyboard`). It needs a graphical display.
  - `npm run generate:keybindings` rewrites `package.json` `contributes.keybindings` from `scripts/keybindings.cjs`.
  - Case tables use `[input, keys, helix]` (`test/unit/charMotionCases.ts:Case`). Unit tests replay them through `test/unit/helix.ts:Session`. `test/integration/hjkl.ts:checkCharMotions` replays the same tables with real keys and compares `ordered(normalize(...))`.
- **Contracts and conventions:**
  - `scripts/keybindings.cjs` binds `g w`, `g d`, `g r` with `idleMotionWhen`, and generates `miniHelix.noop` for every other `g` chord through `chordNoops('g', ['w', 'd', 'r'])`.
  - `test/unit/keybindings.test.ts` asserts the exact default binding list, the set of commands on `g` chords ("every other g chord is an unbound key that clears the count"), and that every bound motion command is contributed and registered in a listed source file.
  - Every command has a `contributes.commands` entry with `category` `Mini Helix` and `enablement` `miniHelix.enabled && miniHelix.mode == normal`.
  - `test/runIntegration.ts` writes a user binding `g l` → `cursorEnd`. `test/integration/index.ts` checks it ("user-defined g l overrides blockers and uses native VS Code chords"). This binding would hide the new `gl` in integration tests.
  - The integration profile sets `editor.multiCursorMergeOverlapping` to `false`.
  - `README.md` states "There are deliberately **no** bindings for `gs`, `gl`, or `%`." and uses `g l` → `cursorEnd` in "Add your first motion, without changing the extension".
- **Existing changes:** None, except the untracked folder of this plan.
- **Baseline verification:** Not executed. Planning was read-only.
- **Known failures or limits:** No known failures. Integration tests need a display and the VS Code test download or cache. Overlapping non-identical selections are an accepted limit (specification "Open Issues").

## Tasks

### Task 1: `gs` Core Moves to the First Non-Whitespace Character

- **Requirements:** FR-1, FR-2, FR-4, NFR-1
- **Design references:** Specification "Helix reference behavior", "Functions" (`gotoFirstNonWhitespace`), "Models" (`OffsetRange` invariant)
- **Entry point:** new `src/core/gotoMotion.ts:gotoFirstNonWhitespace`
- **Depends on:** none
- **RED:** Add `test/unit/gotoMotionCases.ts` with a `Case[]` table for `gs` from the FR-1, FR-2, and FR-4 verifications (including the U+3000 case and the backward and `x`-style forward selections). Add `test/unit/gotoMotion.test.ts`. It replays each case through `Session` (extended with `g s`) or calls `gotoFirstNonWhitespace` directly, then compares `ordered(normalize(...))` with the Helix output. Run `npm test`. Expected failure: `tsc` reports that `../../src/core/gotoMotion` (or the `Session` `g s` key) does not exist.
- **GREEN:** Export `cursorOf` from `src/core/charMotion.ts`. Add `gotoFirstNonWhitespace(lines, range)`: find the cursor line through `cursorOf`, return a point at the first character that does not match `/\p{White_Space}/u`, or return `range` unchanged.
- **REFACTOR:** Keep the Helix-port doc comment style of `src/core/charMotion.ts`. Tests stay green.
- **Verification:** `npm test` passes. The `gs` cases pass, and all existing unit tests still pass.
- **Prerequisites:** Node and installed dev dependencies (`npm ci` if `node_modules` is absent).

### Task 2: `gl` Core Moves to the Last Grapheme of the Line

- **Requirements:** FR-3, FR-4, NFR-1
- **Design references:** Specification "Functions" (`gotoLineEnd`), "Failure Model" F-1
- **Entry point:** new `src/core/gotoMotion.ts:gotoLineEnd`
- **Depends on:** Task 1
- **RED:** Add the `gl` cases from FR-3 and FR-4 to `test/unit/gotoMotionCases.ts`: CRLF, the combining-accent grapheme, the emoji with a skin-tone modifier, the empty line, the last line without a line break, and `#[|]#` from F-1. Run `npm test`. Expected failure: `gotoLineEnd` does not exist, or the `Session` key `g l` is unsupported.
- **GREEN:** Add `gotoLineEnd(text, lines, range)`: same cursor line; return a point at `max(line.start, text.before(line.end)?.start ?? line.start)`.
- **REFACTOR:** Share the cursor-line lookup between `gotoFirstNonWhitespace` and `gotoLineEnd` if it reads better. Tests stay green.
- **Verification:** `npm test` passes with the `gs` and `gl` cases.
- **Prerequisites:** Task 1.

### Task 3: `gg` and `ge` Core Go to a Line Start

- **Requirements:** FR-5, FR-6, FR-7, NFR-1
- **Design references:** Specification "Functions" (`gotoLine`, `gotoLastLine`), "Failure Model" F-1 and F-2
- **Entry point:** new `src/core/gotoMotion.ts:gotoLine` and `gotoLastLine`
- **Depends on:** Task 1
- **RED:** Add the FR-5, FR-6, FR-7, F-1, and F-2 cases to `test/unit/gotoMotionCases.ts`. Include multi-selection `gg` (one result selection), `2gg`, `9gg` with and without a final line break, `1gg`, `99999999gg`, `ge` on `#[a|]#\n\n`, `ge` on `#[|]#` and `#[\n|]#`, and `3ge`. In `Session`, `g g` passes the taken count as the line; `g e` ignores it. Run `npm test`. Expected failure: `gotoLine` and `gotoLastLine` do not exist.
- **GREEN:** Add a private last-target-line rule: `lines.count - 1`, or `max(lines.count - 2, 0)` when the last line has zero characters. `gotoLine(lines, line)` returns a point at the start of `min(line - 1, last)`. `gotoLastLine(lines)` returns a point at the start of `last`.
- **REFACTOR:** Keep one last-target-line helper for both functions. Tests stay green.
- **Verification:** `npm test` passes with all core cases.
- **Prerequisites:** Task 1 (shared test files).

### Task 4: Chords Run the Motions in VS Code

- **Requirements:** FR-1, FR-3, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, NFR-1
- **Design references:** Specification "Architecture (HLD)", "Contracts" (contributed commands, generated keybindings), "Behavior", "Failure Model" F-3 and F-4
- **Entry point:** `scripts/keybindings.cjs:createKeybindings`, new `src/motions/goto.ts`, `src/extension.ts:activate`
- **Depends on:** Task 2, Task 3
- **RED:**
  1. Update `test/unit/keybindings.test.ts`:
     - The default binding list in "i, a, c, d, o, O, u, U, Escape, g w, motions, and counts are the default bindings outside a word jump" includes `g s`, `g l`, `g g`, and `g e`, each with `when` equal to `idleWhen`, at the position the generator emits them.
     - "every other g chord is an unbound key that clears the count" expects the four new commands in the `g` chord command set.
     - "every bound motion and edit command is contributed and registered" lists `['src/motions/goto.ts', /^miniHelix\.goto(FirstNonWhitespace|LineEnd|FileStart|LastLine)$/]`.
  2. Add `test/integration/goto.ts` with `checkGotoMotions(api, keyboard)`. Call it from `test/integration/index.ts`. Use the pattern of `test/integration/hjkl.ts:checkCharMotions`:
     - Replay every case in `test/unit/gotoMotionCases.ts` with real keys, compared after `ordered(normalize(...))`.
     - Check the FR-8 case `#[a|]#bc\ndefg\n` + `3gll`.
     - Check the FR-10 cases.
     - Check FR-9: in a read-only document (for example, a `TextDocumentContentProvider` document, as `test/integration/navigation.ts` uses), `gl` moves the cursor. In INSERT mode, typing `gs` inserts `gs`.
     - Check FR-11: in a 500-line document with the cursor on line 1, `ge` makes line 499 visible in `editor.visibleRanges`, and `gg` makes line 0 visible again.
  3. Change the test-only user binding in `test/runIntegration.ts` from `g l` → `cursorEnd` to `g h` → `cursorLineStart`. Update the check in `test/integration/index.ts` to match: start at the line end, press `g` `h`, and expect character 0. Rename it to "user-defined g h overrides blockers and uses native VS Code chords".
  4. Run `npm test`. Expected failure: the keybinding tests fail because the generator does not emit the chords and `src/motions/goto.ts` does not exist.
  5. Run `npm run test:integration`. Expected failure: `gs`, `gl`, `gg`, and `ge` do not move the selections, because they are still `miniHelix.noop` chord blockers.
- **GREEN:**
  1. In `scripts/keybindings.cjs`, add the four chords to the bindings with `idleMotionWhen`, next to `navigation`. Change the bound list of `chordNoops('g', ...)` to include `s`, `l`, `g`, and `e`. Export any new table if the tests import it.
  2. Run `npm run generate:keybindings`.
  3. Add the four `contributes.commands` entries in `package.json`, with the IDs and titles from the specification.
  4. Add `src/motions/goto.ts`. It maps each command ID to a `Motion` that converts the selection to offsets, calls the core function, and converts back. `miniHelix.gotoFileStart` passes `count` as `line`. It registers each command through `registerMotion(id, motion, modes, count, queue)`.
  5. Spread the registrations into `context.subscriptions` in `src/extension.ts:activate`.
- **REFACTOR:** Share the `vscode.TextDocument` → `Lines` adapter with `src/motions/hjkl.ts` and `src/motions/line.ts` only if it removes duplication without other changes. Tests stay green.
- **Verification:**
  - `npm test` passes, including `check:keybindings`.
  - `npm run test:integration` passes. It prints a PASS line for the goto cases, and no existing check fails.
  - `grep -c '"key": "g [slge]"' package.json` gives `4`. Each match has a motion command, not `miniHelix.noop`.
- **Prerequisites:** Tasks 2 and 3. A graphical display for the integration suite. The VS Code test build in `.vscode-test/` or network access to download it.

### Task 5: README Documents the Goto Chords

- **Requirements:** Repository constraint: the README documents every binding (specification "Constraints", "Components" README entry). Supports FR-1, FR-3, FR-5 to FR-9.
- **Design references:** Specification "Intent and Delivery Scope" constraints; "Components" README and integration test profile entries
- **Entry point:** `README.md`
- **Depends on:** Task 4
- **TDD does not apply:** The change is documentation. No program behavior changes.
- **Changes:**
  - Feature summary and "What this version does": add `gs`, `gl`, `gg`, and `ge` to the bound chord lists.
  - Replace "There are deliberately **no** bindings for `gs`, `gl`, or `%`." with a statement about `%` only.
  - Add a section with a `Key | Command | Does` table for the four chords. State the Helix 25.07.1 rules: the block-cursor line, blank lines for `gs`, the final empty line for `gg` and `ge`, and no jump-history entry (FR-X1).
  - "Counts": `<n>gg` goes to line `<n>`; `gs`, `gl`, and `ge` ignore the count.
  - "Add your first motion, without changing the extension": change the `g l` → `cursorEnd` example to `g h` → `cursorLineStart`, and change the prose that names `g l`.
  - "Architecture": add the chords to the resolver diagram, and add `core/gotoMotion.ts` and `motions/goto.ts` to the file tree.
- **Verification:**
  - `grep -n 'deliberately' README.md` names `%` only.
  - `grep -n '"g l"' README.md` gives no match.
  - `grep -n 'gotoMotion.ts\|motions/goto.ts' README.md` gives two matches.
  - Read the new section. It lists all four chords with the command IDs from the specification.
- **Prerequisites:** Task 4 (final command IDs and behavior).

## Requirement Coverage

- **FR-1** → Task 1, Task 4
  - Verification: Task 1 unit cases; Task 4 integration replay.
- **FR-2** → Task 1, Task 4
  - Verification: Task 1 unit cases (unchanged non-empty range); Task 4 integration replay.
- **FR-3** → Task 2, Task 4
  - Verification: Task 2 unit cases; Task 4 integration replay.
- **FR-4** → Task 1, Task 2, Task 4
  - Verification: Forward `x`-style and backward selection cases in Tasks 1 and 2; Task 4 integration replay.
- **FR-5** → Task 3, Task 4
  - Verification: Task 3 multi-selection `gg` case; Task 4 integration replay.
- **FR-6** → Task 3, Task 4
  - Verification: Task 3 `2gg`, `9gg`, `1gg`, `99999999gg` cases; Task 4 integration replay with real count digits.
- **FR-7** → Task 3, Task 4
  - Verification: Task 3 `ge` and `3ge` cases; Task 4 integration replay.
- **FR-8** → Task 4
  - Verification: Task 4 integration case `3gll`.
- **FR-9** → Task 4
  - Verification: Task 4 keybinding unit tests (`idleWhen`, no chord no-ops); integration read-only and INSERT checks.
- **FR-10** → Task 4
  - Verification: Task 4 integration FR-10 cases.
- **FR-11** → Task 4
  - Verification: Task 4 integration `visibleRanges` check.
- **NFR-1** → Task 1, Task 2, Task 3, Task 4
  - Verification: The shared case table, derived from the Helix 25.07.1 sources, passes in unit tests and with real keys.

## Final Verification

- **Check:** `npm test`
  - Prerequisites: Tasks 1 to 4.
  - Expected result: All unit tests pass, and `check:keybindings` reports no stale bindings.
  - Coverage: FR-1 to FR-7, FR-9, NFR-1
- **Check:** `npm run test:integration`
  - Prerequisites: Tasks 1 to 4; a graphical display; the VS Code test build.
  - Expected result: All checks pass, including the goto PASS line and the renamed user-override check.
  - Coverage: FR-1 to FR-11, NFR-1
- **Check:** Optional manual confirmation with `hx` 25.07.1 for any case whose expected result is unclear.
  - Prerequisites: none.
  - Expected result: Helix gives the specification result. A difference stops work under the correction rules.
  - Coverage: NFR-1
