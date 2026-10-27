---
schema_version: 1
artifact: implementation-plan
status: validated
subject: helix-surround-add-delete
spec: spec.md
spec_sha256: 1ef60714d78bf3afafd7181a76f117c06f33f7e9f0ffc0dfcc9f2e238db1337c
repository_baseline: 5326c516f21fae9d2d75c2509e5410fe80c649e4
working_tree: "Uncommitted backtick text-object work (README.md, docs/context-engineering/helix-match-typescript/spec.md, package.json, scripts/keybindings.cjs, src/core/match.ts, test/integration/match.ts, test/unit/keybindings.test.ts, test/unit/surround.test.ts, test/unit/textObject.test.ts). Open-line (o/O) implementation in progress (src/core/editing.ts, src/core/mode.ts, src/extension.ts, src/vscode/editing.ts, test/integration/editing.ts, test/integration/index.ts, test/unit/editing.test.ts, test/unit/mode.test.ts, and shared files above). Untracked: docs/context-engineering/open-line/, docs/context-engineering/helix-surround-add-delete/."
created: 2026-10-24
updated: 2026-10-24
---

# Helix Surround Add and Delete Implementation Plan

## Source and Execution Boundaries

This plan implements only the included requirements of the referenced specification.
Before execution, confirm that the specification's exact content matches `spec_sha256`.
Resolve relative specification paths against this plan's folder. Resolve relative intent paths against the specification's folder.
Accept existing absolute source paths as written. Verify source existence and hash equality regardless of path format.
For file-based intent, verify the specification's `intent_sha256` against its source file. Stop on missing sources or mismatched hashes.
Verify the supporting-file hashes below. Stop if a file is missing or changed, and request review of affected approvals.
Inspect relevant repository changes against the baseline, including working-tree changes. Review affected tasks before execution.
Execution state belongs to the implementer, not this planning artifact.

## Supporting Sources

- **Path:** intent.md
  - SHA-256: 224025c672fe0fe9a3fc2db0a6cb67d676237ebcd959ceeb6bf0cde777531d47
  - Role: Intent of the specification. The specification records the same hash.

The specification has no separate UI mock file. UI-1 is inline.

## Implementation Discretion

Preserve approved behavior, required signatures, contracts, invariants, architecture, and acceptance conditions.
Choose private helpers, class structure, and incidental wiring within those constraints. Required internal contracts remain binding.
Trace downstream from each task's entry point. The entry point is not an exhaustive list of affected files.
Check existing code, standard libraries, native capabilities, and installed dependencies before adding abstractions or dependencies.
Justify additions through a present requirement and an unmet need. Obtain specification approval for consequential technology changes.

Required signatures: `addSurround` and `deleteSurround` in the specification's Functions section.
Required names: `miniHelix.surroundAdd`, `miniHelix.surroundDelete`. The names `miniHelix.surroundReplacePending`, `miniHelix.surroundReplaceInput`, and `miniHelix.cancelSurroundReplace` must not change.

## Correction Rules

Stop dependent work when a change affects approved scope, acceptance, UI, contracts, or architecture.
Request specification review through `design-specs` or the original specification workflow. Do not silently change upstream artifacts.
For changed intent, request intent review first. Reassess downstream approvals after upstream correction.
For task order, grouping, or verification changes within the approved specification, request plan revision through `implementation-plan`.
Private structural changes within approved constraints require verification, not another design approval.
Do not refresh source hashes without reviewing changes and obtaining approval for affected content.

## Approval Record

- **Decision:** Delegated approval
- **Evidence:** `/quickie` invocation on 2026-10-24
- **Limits:** Quickie limited delegation for routine plan approval. The user did not review this plan directly. No implementation started.

## Repository Findings

- **Entry points and callers:**
  - `src/vscode/match.ts:Match` registers `miniHelix.selectTextObject`, `miniHelix.surroundReplace`, `miniHelix.surroundReplaceInput`, and `miniHelix.cancelSurroundReplace`.
  - `Match.start` begins the pending `mr` session. `Match.input` applies it in the `CommandQueue`, with `UndoHistory.hold` and `commit` around one `editor.edit`.
  - `src/extension.ts` constructs `Match` and registers `match.register()`. On deactivation, it resets `miniHelix.surroundReplacePending`.
  - `src/core/match.ts` has `findPair`, `delimiterPair`, `replacementPair`, `cursorOffset`, and `replaceSurround`. `replaceSurround` already does the all-or-nothing check and merges cursors in one pair.
  - `src/core/editing.ts` has `blockRange`, `Edit`, and `EditResult`. `src/vscode/editing.ts:select` shows how a result's selections are set.
- **Tests and commands:**
  - `npm test` runs `check:keybindings`, `compile`, and the unit tests in `out/test/unit/*.test.js` (`package.json` `scripts`).
  - `npm run test:integration` compiles and runs `out/test/runIntegration.js`. It drives a real VS Code with real keyboard input.
  - `npm run generate:keybindings` rewrites `package.json` `contributes.keybindings` from `scripts/keybindings.cjs`.
  - The unit tests for surround are in `test/unit/surround.test.ts`. They use `|` for cursors.
  - `test/unit/upstreamHelix.ts:parseUpstream` reads Helix test notation such as `(#[|  ]#)`.
  - The keybinding tests are in `test/unit/keybindings.test.ts`. Three of them are relevant: "m is a chord prefix", "every other key after m...", and "a pending replacement captures every printable key...". The test "the new commands are contributed and registered" checks a fixed command list against `src/vscode/match.ts`.
  - The real-keyboard match checks are in `test/integration/match.ts:checkMatch`, called from `test/integration/index.ts`. The `punctuation` map in that file defines the special keys. It has no Enter entry today.
- **Contracts and conventions:**
  - The keybindings are generated. The pending bindings must stay the last group.
  - `chordNoops(prefix, bound)` makes every other key after a chord prefix a `miniHelix.noop`.
  - Delimiter keys are `delimiterKeys`. Typed characters for pending input are `typedCharacters`.
- **Existing changes:**
  - The backtick work and the open-line work both change `package.json`, `scripts/keybindings.cjs`, and `test/unit/keybindings.test.ts`, which this plan also changes.
  - The open-line spec and plan refer to `miniHelix.surroundReplaceInput` in binding-order checks.
- **Baseline verification:**
  - Executed earlier on 2026-10-24, with only the backtick changes in the tree: `npm test` passed 446 of 446, and `npm run test:integration` passed.
  - Not executed on the current tree, which now also has the open-line work in progress.
- **Known failures or limits:**
  - No known failure.
  - `editor.edit` returning `false` (spec F-4) cannot be forced reliably in the tests.

## Tasks

### Task 1: `addSurround` computes Helix `ms` edits and selections

- **Requirements:** FR-1, FR-2, FR-3
- **Design references:** Spec "Functions", `addSurround`; "Failure Model" F-3
- **Entry point:** `src/core/match.ts:addSurround` (new)
- **Depends on:** none
- **RED:**
  - Add tests to `test/unit/surround.test.ts`. Each one applies the returned edits and checks the text and every selection:
    - `ms(` and `ms)` on a selection give `(text)`. `ms*` gives `*text*`. A space gives ` text `.
    - `'\n'` with eol `\n` gives `\ntext\n`, and with eol `\r\n` it gives `\r\ntext\r\n`. The selection grows by twice the line-ending length.
    - A forward selection stays forward and a reversed one stays reversed.
    - A cursor before `b` in `abc` gives `a(b)c`, with `(b)` selected forward.
    - A cursor at the end of the text gives `()` selected.
    - Adjacent selections `[a][b]` give `(a)(b)`. Each selection covers its own pair.
    - Selections in non-ascending input order return in input order.
    - A tab character, an empty string, and two characters return `undefined`.
    - Overlapping ranges return `undefined`.
  - Command: `npm test`
  - Expected failure: compile error, because `addSurround` does not exist.
- **GREEN:** Add `addSurround` with the specified signature and rules. Use `blockRange` and `replacementPair`.
- **REFACTOR:** Share small offset helpers with existing code if this removes duplication. Keep `replaceSurround` behavior unchanged.
- **Verification:** `npm test` passes, including the new tests and all existing tests.
- **Prerequisites:** The working-tree prerequisite in "Final Verification".

### Task 2: `deleteSurround` computes `md` edits and Helix-mapped selections

- **Requirements:** FR-6, FR-7, FR-8, FR-9
- **Design references:** Spec "Functions", `deleteSurround`; "Failure Model" F-2
- **Entry point:** `src/core/match.ts:deleteSurround` (new)
- **Depends on:** none
- **RED:**
  - Add tests to `test/unit/surround.test.ts`:
    - `md(` and `md)` on `a (te|xt) b` give `a text b`. `md[`, `md{`, `md<`, `md"`, `md'`, and `` md` `` delete their pairs.
    - Line-local quotes: `"a" |b "c"` gives `undefined`. An escaped quote is skipped.
    - Count: with the cursor on `b` in `(a (b))`, count 2 gives `a (b)`. A quote with count 2 gives `undefined`.
    - All or nothing: one unmatched cursor among matched cursors gives `undefined`. Two cursors in one pair give one deletion. A delimiter shared by two different pairs gives `undefined`.
    - `*` and `w` as targets give `undefined`.
    - Selection mapping: a cursor on `)` of `(ab)` ends at offset 2 of `ab`. The selection from `ma(` on `(ab)` ends as `ab` selected.
  - Port the upstream Helix case with `parseUpstream`: `(#[|  ]#)` with target `(` gives `#[|  ]#`, with the reversed direction kept. Name its source: `helix-term/tests/test/commands.rs:surround_delete` at `ba40e547`.
  - Command: `npm test`
  - Expected failure: compile error, because `deleteSurround` does not exist.
- **GREEN:** Add `deleteSurround` with the specified signature. Reuse the pair search and the all-or-nothing check of `replaceSurround`.
- **REFACTOR:** Extract one private helper for the pair collection that `replaceSurround` and `deleteSurround` share. The existing `replaceSurround` tests must stay green.
- **Verification:** `npm test` passes.
- **Prerequisites:** The working-tree prerequisite in "Final Verification".

### Task 3: `ms` works from the keyboard in VS Code

- **Requirements:** FR-1, FR-2, FR-4, FR-5, FR-10, FR-11 (for `ms`), NFR-1
- **Design references:** Spec "Architecture (HLD)", "Contracts", "Behavior" (`ms` session), UI-1, F-1, F-4, F-5
- **Entry point:** `scripts/keybindings.cjs:createKeybindings` and `src/vscode/match.ts:Match`
- **Depends on:** Task 1
- **RED:**
  - In `test/unit/keybindings.test.ts`:
    - `m s` has a read-only `miniHelix.noop` binding and a writable `miniHelix.surroundAdd` binding. The writable `when` excludes `miniHelix.wordJumpActive` and `miniHelix.surroundReplacePending`.
    - `keys('m')` excludes `s`.
    - In the pending state, `enter` and `shift+enter` send `'\n'`, and `space` and `shift+space` send `' '`, to `miniHelix.surroundReplaceInput`.
    - Escape, Tab, Backspace, Delete, navigation keys, and Insert still cancel.
    - Add `surroundAdd` to the "contributed and registered" list.
  - In `test/integration/match.ts:checkMatch`:
    - Add an Enter key to the `punctuation` map.
    - `ms(`, `ms)`, `ms*`, and `ms` then Space on a selection give the expected text and selections.
    - `ms` then Enter gives `\ntext\n`.
    - `3ms(` adds one pair, and the count does not apply to the next command.
    - `ms` then Escape changes nothing, and the next key acts normally.
    - `ms(` with two cursors, then `u`, restores the text. Native undo also restores it in one step.
    - In a read-only editor, `ms(` changes nothing.
    - `ms`, then a selection change, then `(` changes nothing (F-1).
    - NFR-1: `mr(` then Enter, and `mr(` then Space, change nothing.
  - Commands: `npm test`, then `npm run test:integration`
  - Expected failures: the unit tests fail on missing bindings and registration. The integration checks fail because `m s` is a no-op.
- **GREEN:**
  - In `scripts/keybindings.cjs`:
    - Add the `m s` bindings.
    - Add `s` to the `chordNoops('m', ...)` exclusions.
    - Add Enter, Shift+Enter, Space, and Shift+Space to `typedCharacters`.
    - Run `npm run generate:keybindings`.
  - In `package.json`, add `miniHelix.surroundAdd` to `contributes.commands`, with the title, category, and enablement from the specification.
  - In `Match`:
    - Add the session kind and register `miniHelix.surroundAdd`.
    - Show the UI-1 text.
    - For an add session, `input` calls `addSurround` with the document line ending. It applies the edits and selections in one undo step, as the specification describes.
- **REFACTOR:** Keep one session flow for both kinds. Update the comments in `scripts/keybindings.cjs` and `src/vscode/match.ts` that name only `mr`.
- **Verification:** `npm test` and `npm run test:integration` pass. The output includes `PASS match: text objects and surround replacement`.
- **Prerequisites:** A desktop session that can start VS Code for `npm run test:integration`. The working-tree prerequisite in "Final Verification".

### Task 4: `md` works from the keyboard in VS Code

- **Requirements:** FR-6, FR-7, FR-9, FR-10, FR-11 (for `md`), FR-12
- **Design references:** Spec "Architecture (HLD)" (`md` chord), "Contracts" (New commands), "Behavior" (`md` command), F-2, F-5
- **Entry point:** `scripts/keybindings.cjs:createKeybindings` and `src/vscode/match.ts:Match`
- **Depends on:** Task 2, Task 3. Task 3 changes the same `chordNoops('m', ...)` line and the same tests.
- **RED:**
  - In `test/unit/keybindings.test.ts`:
    - For each `delimiterKeys` entry, `m d <key>` has a read-only `miniHelix.noop` and a writable `miniHelix.surroundDelete` with `{ target }`.
    - `keys('m')` excludes `d`. `keys('m d')` is every other key.
    - Add `surroundDelete` to the "contributed and registered" list.
  - In `test/integration/match.ts:checkMatch`:
    - `md(` and `md"` delete their pairs.
    - With the cursor on `b` in `(a (b))`, `2md(` gives `a (b)`.
    - After `ma(` then `md(`, the inner text is selected.
    - `md(` with two cursors, then `u`, restores the text in one step.
    - In a read-only editor, `md(` changes nothing.
    - `md` then `x` changes nothing and clears the count.
  - Commands: `npm test`, then `npm run test:integration`
  - Expected failures: missing bindings and registration in the unit tests. `m d` is a no-op in the integration checks.
- **GREEN:**
  - In `scripts/keybindings.cjs`:
    - Add the `m d <delimiter>` bindings and their read-only no-ops.
    - Add `d` to the `chordNoops('m', ...)` exclusions, and add `chordNoops('m d', ...)`.
    - Run `npm run generate:keybindings`.
  - In `package.json`, add `miniHelix.surroundDelete` to `contributes.commands`.
  - In `Match`, register the command. Take the count, then call `deleteSurround` in the queue and apply the result in one undo step.
- **REFACTOR:** Share the "apply an `EditResult` as one revision" step between `ms` and `md` in `Match`.
- **Verification:** `npm test` and `npm run test:integration` pass.
- **Prerequisites:** As Task 3.

### Task 5: The README documents `ms`, `md`, and the Helix gaps

- **Requirements:** FR-13
- **Design references:** Spec FR-13; "Excluded and Deferred Requirements" X-2, X-3, X-5, X-6
- **Entry point:** `README.md`, section "Match text objects and surround (`mi`, `ma`, `mr`)"
- **Depends on:** Task 3, Task 4
- **TDD does not apply:** This task changes documentation only. The repository has no documentation test.
- **Steps:**
  - Add `ms<char>`, `ms<Enter>`, and `[count]md<d>` rows to the key table. Update the section heading.
  - State that `ms` ignores a count, and that the selection then covers the new pair.
  - In Limitations, name only `mm` as missing.
  - In Limitations, list these gaps:
    - `md` accepts only the delimiters, not any character or `m`.
    - `md` uses line-local quotes.
    - `md` merges cursors in one pair.
    - `md` shows no error message.
    - `mr<old><space>` does not replace with spaces.
  - Update the Escape line to include `ms` and `md`.
- **Verification:** Read the section. Check that each FR-13 rule appears. Check that the backtick is in the delimiter list.
- **Prerequisites:** none

## Requirement Coverage

- **FR-1** → Task 1, Task 3
  - Verification: Task 1 unit tests; Task 3 `ms(`, `ms)`, `ms*`, `ms<space>` integration checks
- **FR-2** → Task 1, Task 3
  - Verification: Task 1 LF and CRLF tests; Task 3 `ms<Enter>` check and pending-binding unit test
- **FR-3** → Task 1
  - Verification: Task 1 selection tests
- **FR-4** → Task 3
  - Verification: `3ms(` integration check
- **FR-5** → Task 3
  - Verification: cancel-key unit test; `ms<Escape>` integration check
- **FR-6** → Task 2, Task 4
  - Verification: Task 2 delimiter tests; Task 4 `md(` and `md"` checks
- **FR-7** → Task 2, Task 4
  - Verification: count tests; `2md(` check
- **FR-8** → Task 2
  - Verification: all-or-nothing unit tests
- **FR-9** → Task 2, Task 4
  - Verification: ported upstream case; `ma(` then `md(` check
- **FR-10** → Task 3, Task 4
  - Verification: `u` and native undo checks
- **FR-11** → Task 3, Task 4
  - Verification: read-only binding unit tests and integration checks
- **FR-12** → Task 4
  - Verification: `keys('m d')` unit test; `mdx` check
- **FR-13** → Task 5
  - Verification: README review
- **NFR-1** → Task 3
  - Verification: `mr(<Enter>` and `mr(<space>` checks; full suites green

## Final Verification

- **Check:** Working-tree prerequisite before Task 1
  - Prerequisites: none
  - Expected result: The backtick work and the open-line work are committed or finished. Their `npm test` and `npm run test:integration` runs pass. Then record the new baseline commit. If they are still in progress, stop and ask the user, because Tasks 3 and 4 edit the same generator, manifest, and tests.
  - Coverage: repository constraint (shared files)
- **Check:** `npm test`
  - Prerequisites: Tasks 1 to 4
  - Expected result: All unit tests pass, and `check:keybindings` reports no stale bindings.
  - Coverage: FR-1 to FR-12, NFR-1
- **Check:** `npm run test:integration`
  - Prerequisites: Tasks 3 and 4, and a desktop session for VS Code
  - Expected result: Exit code 0, and every `PASS` line, including `PASS match: text objects and surround replacement`.
  - Coverage: FR-1, FR-2, FR-4 to FR-7, FR-9 to FR-12, NFR-1
- **Check:** Manual check in an installed build (`npm run package:vsix`, then `code --install-extension mini-helix-0.1.0.vsix`)
  - Prerequisites: Tasks 1 to 5
  - Expected result:
    - `ms(` on a word wraps it and selects `(word)`.
    - `md(` removes the pair.
    - UI-1 shows while `ms` waits for a key.
  - Coverage: UI-1, FR-1, FR-6
