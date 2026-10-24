---
artifact: spec
status: frozen
subject: helix-match-typescript
version: 1
created: 2026-10-24
supersedes: ../helix-match/spec.md (native Rust full-parity design, historical)
---

# Helix match (TypeScript only): frozen specification

The user asked to clean up and switch to a TypeScript-only implementation:
"Let's go for a cleanup and go for Typescript only implementation".
They need `mi` and `ma` for the word `w` and for the delimiters `"`, `'`, `[`, `{`, `(` and `<`, plus the `mr` surround replacement.
They accepted plain text scanning: no Rust, native helper, parser, tree-sitter or exact Helix parity.
The `{` that appears twice in their `ma` list means `(`. Closing delimiters are aliases for their pair.

The native Rust experiment (`../helix-match/`) is superseded and archived outside the repository at
`/home/cosmincartas/work/archives/vscode-extension-helix-match-native-20261024`.

## Commands (NORMAL mode)

| Keys | Effect |
| --- | --- |
| `miw` / `maw` | Select inside or around the word under each cursor. |
| `mi<d>` / `ma<d>` | Select inside or around the enclosing `<d>` pair. |
| `[count]mi<d>` / `[count]ma<d>` | Use the count-th enclosing pair. A count on `miw`/`maw` is ignored (Helix ignores it there too). |
| `[count]mr<old><new>` | Replace the count-th enclosing `<old>` pair with the `<new>` pair, e.g. `mr([` turns `(text)` into `[text]`. |

`<d>` and `<old>` take any of `'`, `"`, `(`, `)`, `[`, `]`, `{`, `}`, `<`, `>`. A closing character is an alias for its pair.
`<new>` takes those characters, which map to their pair, or any other single printable non-whitespace character, which is used on both sides (`mr"*` turns `"x"` into `*x*`).
Keys follow the US layout like the rest of the generated bindings: `shift+9` is `(`, `shift+'` is `"`, and so on.

## Behavior

### Cursor

A selection's cursor follows the extension's block-cursor convention: an empty selection's cursor is at its offset.
A reversed selection's cursor is its active offset. A forward non-empty selection's cursor is the start of its last grapheme.

### Word (`w`)

The word uses the categories from `src/core/wordMotion.ts` (`WordMotionText`): word, punctuation, whitespace, end of line, unknown.
- Inner: the run of graphemes around the cursor that share the cursor grapheme's category (word characters, punctuation, inline whitespace or unknown).
- Around: the inner run plus the inline whitespace (spaces or tabs, never a line break) that follows it. If there is none, the inline whitespace that precedes it is used instead. If there is neither, the result is the same as inner.
- If the cursor is on whitespace, around selects the same whitespace run as inner.
- If the cursor is on a line break or at the end of the document (no grapheme), there is no match.
- The count is ignored.

### Bracket pairs `()`, `[]`, `{}`, `<>`

- This is plain lexical scanning of the whole document with nesting depth. There is no parser, and brackets inside comments, strings or operators (for example `->`) count like any others.
- If the cursor is on an opening or closing delimiter, that pair is the first enclosing pair. Otherwise the first enclosing pair is the nearest unmatched opener to the left and its matching closer.
- Count `n` selects the n-th enclosing pair. The search continues outward from the previous pair, so the work is bounded by the document size, not by the numeric count.
- An unbalanced or missing pair means there is no match.

### Quote pairs `'` and `"`

- Quotes pair up within a single line, from left to right: the 1st with the 2nd, the 3rd with the 4th, and so on. A quote preceded by an odd number of backslashes is skipped.
- The cursor must be inside a pair or on one of its quotes. A cursor between pairs, or on a line with an unmatched quote that has no partner, gets no match.
- Same-character quotes cannot nest, so a count of 2 or more gets no match.

### Results for `mi` / `ma`

- Inner selects what lies between the delimiters, keeping whitespace. An empty pair gives a caret between the delimiters. Around also includes both delimiters.
- Every selection is handled on its own. A selection with no match stays unchanged. The selection order (primary first) is kept.
- A reversed selection gives a reversed result. Empty and forward selections give forward results.
- These commands work in read-only editors because they only change selections.

### `mr<old><new>`

- Uses the same pair finder as `mi`, with the count, for each selection's cursor.
- If any selection has no match, or `<new>` is invalid, nothing is edited (as in Helix).
- Several selections inside the same pair are reduced to one replacement. If one delimiter offset would belong to two different pairs, the command is rejected with no edit. Nested distinct pairs are fine.
- If the replacement pair equals the old pair, no edit is made.
- All replacements are applied in one `editor.edit` call, which is a single native undo step and one `u` revision (through `UndoHistory`). Native undo and redo both work.
- Requires a writable editor. In read-only editors no edit happens.

## Input model and controller

- Bindings come from `scripts/keybindings.cjs` (the generated manifest). `m i <d>`, `m a <d>` and `m r <old>` are multi-key chords that VS Code's resolver handles synchronously, so the chord keys take precedence over `i`, `a`, `w`, `r`, `d` and the others with no context-key race.
- `m <other>`, `m i <other>`, `m a <other>` and `m r <other>` are `miniHelix.noop`, like the existing `g <other>` chords. Escape and invalid keys therefore cancel, clear the count and never type or enter INSERT.
- After `m r <old>`, a small pending controller (in `src/vscode/`) waits for `<new>`, with the context key `miniHelix.surroundReplacePending`. While it is set, generated bindings send every printable key to the input command, and they take precedence over all other NORMAL bindings, including digits and `i`/`a`/`w`/`r`/`d`. Escape, whitespace, editing and navigation keys cancel. Idle Escape (nothing pending) keeps its existing native behavior.
- The pending session records the editor, document version and selections inside the shared `CommandQueue`, so it sees the result of earlier queued edits and motions. The input is applied in the same queue.
- The session cancels on any of these: active-editor change, a selection change that differs from the recorded selections, a document change past the recorded version, closing the document, mode or enabled change, or window focus loss. Before editing it checks the editor, version, selections and mode again. No key buffering or replay.
- A count typed before `m` belongs to the command, as with the other commands.

## Exclusions

- No Rust, native helper, child process, parser, tree-sitter, syntax-aware objects, `mm`/`ms`/`md`, function/class/argument objects, or global `type` override.
- No exact Helix parity outside what this document states.

## Verification

- `npm test` (unit tests, including new core tests for word, brackets, quotes, counts, multi-selection and surround replacement).
- `npm run test:integration` (real keyboard through CDP: chords, shifted punctuation, aliases, counts, pending cancellation, stale state, multi-cursor replace, one-step undo, edit ordering in the queue, read-only).
- `npm run package:vsix`: the VSIX contains no `native/`, `docs/`, `src/` or test files, and its size is checked. Do not publish.
- No Rust, native or npm runtime dependency remains in the active build, test or production paths.
