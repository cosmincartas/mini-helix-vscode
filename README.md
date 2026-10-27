# Mini Helix

A minimal VS Code extension with **NORMAL / INSERT modes**, Helix-style
**`h`/`j`/`k`/`l`** and selection-first **word motions** (`w`, `b`, `e`, `W`,
`B`, `E`), **counts** (`3w`, `5j`), the **selection
edits** `i`, `a`, `c`, `d`, **line selections** (`x`, `X`), **undo/redo** with `u` and `U`, **`gs`/`gl`/`gg`/`ge` goto motions**, and **`gw` word jumps**. Add other individual bindings as you need them; this is not a full Helix
emulator.

Exact Helix line-selection parity requires **`"editor.multiCursorMergeOverlapping": false`**.
With VS Code's default value, an EOF cursor touching another selection is merged
away, so that configuration cannot preserve Helix's complete selection set.
Mini Helix never changes this setting automatically; choose it in your settings
before relying on exact multi-selection parity.

## Try it

Requires VS Code 1.85+ and Node.js 22+ for development.

```sh
npm ci
npm test
```

Open this folder in VS Code, select **Run Mini Helix** in Run and Debug, and press
**F5**. In the new Extension Development Host, open a text file:

- **NORMAL** is the initial mode, with a block cursor.
- Press **`i`** to enter **INSERT** and type normally; **`a`** appends instead.
- Press **Escape** to return to **NORMAL**.
- In NORMAL, press **`w`**, **`b`**, or **`e`** to select the next/previous word.
- Press **`x`** to select whole lines and repeat to extend below; **`Shift+x`**
  expands to line boundaries while preserving direction. **`2x`** selects two lines.
- Press **`d`** to delete the selection, or **`c`** to delete it and type a
  replacement.
- In NORMAL, press **`g` then `w`**, then type a word's two-letter label to select it.
- Use **`gd` / `gr`** for definitions/references, **Alt+O / Alt+I** to expand/shrink
  selections, and **Ctrl+O / Ctrl+I** to navigate back/forward.
- Click the status-bar mode indicator to switch modes.
- Run **Mini Helix: Suspend / Resume Modal Editing** from the Command Palette to
  temporarily return to native VS Code input. Click **HELIX OFF** to resume.

The development launch disables other installed extensions to avoid competing
modal keybindings. Disable other modal extensions when using the installed build.

### Install in your usual VS Code window

```sh
npm run package:vsix
```

In VS Code, run **Extensions: Install from VSIX…** and choose
`mini-helix-0.1.0.vsix`. Reload the window if prompted.

## What this version does

- One global mode shared by the window's text editors.
- NORMAL blocks ordinary printable keys (including numeric keypad digits and
  operators), Space, Enter, Tab, Backspace, Delete, and their Shift variants,
  except `i`, `a`, `c`, `d`, `o`, `O`, `u`, `U`, `h`, `j`, `k`, `l`, `x`, `X`, the word motions,
  count digits, the `gw`, `gd`, `gr`, `gs`, `gl`, `gg`, `ge` chords, and the
  `Space f`, `Space b`, `Space s`, `Space S` chords. Every other Space chord is
  still blocked and does nothing.
- INSERT uses VS Code's native typing, completion, and cursor style.
- `i` collapses each selection to its start, so typing inserts before the
  selection rather than replacing it. This also works with multiple and reversed
  selections. Entering NORMAL does not move the cursor or rewrite selections.
- Cursor changes are temporary editor options, not changes to your settings.
  Suspending the extension restores each editor's configured cursor style.
- Blocker bindings are limited to editable text-editor focus. Search fields,
  Quick Input boxes, and terminals keep their native input. Read-only editors
  keep native input too, except for motions, navigation/selection bindings below,
  `gw` and its temporary label input, and the Space chords; `a`, `c`, `d`, `o`,
  `O`, `u`, and `U` are not bound there.
  While a count is pending, the blockers also run in read-only editors, so that
  any other key clears the count.
- Arrow keys remain native outside word jumps; Ctrl/Cmd/Alt shortcuts remain
  native except for the NORMAL-mode bindings below. NORMAL is **not read-only**: paste, cut, undo, command-driven
  edits, and other native editing shortcuts can still modify the document.

There is deliberately **no** binding for `%`.
No language server, parser, custom buffer, custom jump history, or global `type`
override is installed.

### Navigation and selection

These bindings work in NORMAL, including read-only editors, outside word-label
sessions. INSERT, suspended mode, and non-editor inputs keep native shortcuts.

| Key | Does (native VS Code action) |
| --- | --- |
| `gd` | Go to definition |
| `gr` | Go to references |
| Alt+O | Expand selection (Smart Select) |
| Alt+I | Shrink selection (Smart Select) |
| Ctrl+O | Navigate back |
| Ctrl+I | Navigate forward |

Press `g`, then `d` or `r` for the chords. Definitions and references require a
language extension providing them. Selection expansion uses VS Code's selection
range providers and fallback rules, not Helix's tree-sitter syntax nodes. Back
and forward use VS Code's navigation history, not a separate Helix jumplist.
These commands clear a count prefix without repeating the native action.

### Leader pickers (Space)

Press Space, then a key, to open a native VS Code picker.

| Keys | Command | Opens (native VS Code picker) |
| --- | --- | --- |
| `Space f` | `miniHelix.filePicker` | Quick Open (file picker) |
| `Space b` | `miniHelix.bufferPicker` | Show editors in the active editor group |
| `Space s` | `miniHelix.symbolPicker` | Go to Symbol in Editor |
| `Space S` | `miniHelix.workspaceSymbolPicker` | Go to Symbol in Workspace |

- They work in NORMAL, including read-only editors. In INSERT and suspended
  mode, Space keeps its native behavior.
- Each chord clears a pending count without using it.
- Any other Space chord (Space then another key) does nothing and clears the
  count. While `gw` labels are visible, Space still cancels them; while `mr` or
  `ms` waits for its character, Space is that character.
- Unlike Helix, `Space b` lists only the editors of the active editor group,
  not every open buffer.
- Quick Open with empty input shows recently opened files first.
- `Space s` lists symbols in the current file; `Space S` (Shift+S) searches
  symbols across the workspace. Both need a language extension that provides
  symbols. There are no other Space keys.

### Word motions (`w`, `b`, `e`, `W`, `B`, `E`)

Like Helix, motions are selection-first: each one **replaces** every selection
with the text it moved over, so a following command acts on that selection.

| Key | Command | Selects |
| --- | --- | --- |
| `w` | `miniHelix.moveNextWordStart` | to the start of the next word, including trailing whitespace |
| `b` | `miniHelix.movePrevWordStart` | back to the start of the current/previous word (reversed) |
| `e` | `miniHelix.moveNextWordEnd` | to the end of the current/next word |
| `W` | `miniHelix.moveNextLongWordStart` | `w` for WORDs |
| `B` | `miniHelix.movePrevLongWordStart` | `b` for WORDs |
| `E` | `miniHelix.moveNextLongWordEnd` | `e` for WORDs |

A *word* is a run of Unicode letters/numbers/underscores, or a run of
punctuation; `foo.bar` is three words. A *WORD* is any run of non-whitespace, so
`foo.bar` is one WORD. Pressing `w` on `one two` selects `one `; pressing it
again selects `two`.

The algorithm is a port of Helix's `movement.rs` and gives identical results on
text with `\n` line endings, including newline skipping and the block-cursor
rule that the previous anchor does not affect the result. Two VS Code
adaptations:

- Motions step over grapheme clusters, so they never split an emoji sequence,
  a combining accent, or a `\r\n` pair. `\r\n` and `\r` behave like Helix's `\n`.
- VS Code draws the block cursor *after* a forward selection's last character,
  where Helix draws it *on* that character. The selected text is the same.

Every cursor moves independently, and overlapping results are merged by VS Code.
Motions also work in read-only editors and take a count: `3w` repeats `w` three
times, stopping early at the end of the text. There is no select/extend mode
(`v`) yet.

### Goto motions (`gs`, `gl`, `gg`, `ge`)

| Key | Command | Does |
| --- | --- | --- |
| `gs` | `miniHelix.gotoFirstNonWhitespace` | move to the first non-whitespace character of the line |
| `gl` | `miniHelix.gotoLineEnd` | move to the last character of the line |
| `gg` | `miniHelix.gotoFileStart` | move to the start of the file, or to line `<n>` with `<n>gg` |
| `ge` | `miniHelix.gotoLastLine` | move to the start of the last line |

These follow Helix 25.07.1's NORMAL mode: each selection becomes a cursor, and
every selection moves on its own, so identical results merge into one.
They work in read-only editors and outside word-label input.

- `gs` and `gl` use the line of the block cursor. After `x`, the head is at the
  start of the next line, but `gl` still goes to the end of the selected line.
- `gs` leaves the selection as it is when the line is empty or only whitespace.
  Whitespace is Unicode `White_Space`, as in Helix.
- `gl` goes to the last grapheme before the line break, and stays on an empty line.
- `gg` and `ge` ignore a final empty line (the one after a closing line break):
  `ge` goes to the line before it, and `<n>gg` with a count beyond that line
  stops there. That target line can itself be empty.
- Like all other motions here, they add no entry to a jump history; Helix's `gg`
  and `ge` do, so Ctrl+O after them returns only through VS Code's own navigation history.
- Helix's select mode does not exist here, so these never extend a selection.

Other `g` chords (such as `gh` or `gt`) stay unbound and clear the count.

### Character and line motions (`h`, `j`, `k`, `l`)

| Key | Command | Does |
| --- | --- | --- |
| `h` | `miniHelix.moveCharLeft` | move the cursor one character left |
| `j` | `miniHelix.moveVisualLineDown` | move the cursor one line down |
| `k` | `miniHelix.moveVisualLineUp` | move the cursor one line up |
| `l` | `miniHelix.moveCharRight` | move the cursor one character right |

These are ports of Helix's `move_horizontally` and `move_vertically`. Each one
starts from the block cursor, so a selection collapses to a cursor first: after
`w` selects `one ` in `one two`, `h` lands on `e`, as in Helix. `h` and `l` cross
line endings, and can stop on a line ending, like Helix.

`j` and `k` keep the cursor's visual column. Tabs count up to the next tab stop
(the editor's tab size), and wide characters such as CJK count as two columns,
using the same character-width table as Helix. The column is remembered across
`j`/`k` presses, so moving through a short line and on to a long one returns to
the original column. Any other key forgets it.

With `editor.wordWrap` off (the default, matching Helix's default of no soft
wrap), results are identical to Helix's. With word wrap on, `j` and `k` move
by screen line, as Helix's do with soft wrap enabled, but VS Code's own cursor
movement does the work, because only VS Code knows where it wrapped lines. Its
column rules then apply: for example, `k` on the first screen line moves to the
start of the line, where Helix stays put. Toggling wrap with **View: Toggle Word Wrap** does not
change the setting, so `j` and `k` keep moving by whole lines. Helix has no
folding; how `j` and `k` behave around folded regions is untested.

Set `miniHelix.hjklMotions` to `false` to leave these keys unbound; NORMAL then
blocks them like other unbound keys. Arrow keys stay native unless a count is
pending (see below), although Helix maps them to the same motions.

### Counts

Type digits before a key to repeat it, as in Helix: `3w`, `5j`, `10l`, `2u`.
`1`–`9` start a count, any digit (including `0`) continues it, and numeric-keypad
digits work too. A lone `0` does nothing, as in Helix. The pending count shows
next to the mode in the status bar (`NORMAL 12`).

The next key uses the count and clears it, whether or not it uses it:

- `h`, `j`, `k`, `l`, the word motions, `x`, `u`, and `U` repeat.
- `X` consumes the count and expands to line bounds once.
- `<n>gg` goes to line `<n>` (the first line is 1). `gs`, `gl`, and `ge` ignore the count.
- `i`, `a`, `c`, `d`, `gw`, `gd`, and `gr` ignore it, as in Helix.
- `o` and `O` ignore it, unlike Helix, which repeats the opened line. `3o` opens one line.
- `Space f`, `Space b`, `Space s`, and `Space S` also ignore it.
- With a count, the arrow keys act as `h`, `j`, `k`, and `l`, so `3` Down moves
  three lines, as in Helix. Home, End, Page Up, and Page Down clear the count,
  then act natively.
- Escape, unbound keys, and unbound `g` chords (such as `gx`) just clear it.

Like Helix, a count stops growing at 100,000,000. Mode changes, suspending, and
switching editors also clear it. Other native VS Code shortcuts and mouse clicks
neither use nor clear a pending count. Unlike Helix, a digit after `g` (as in
`2g3w`) cancels the chord instead of continuing the count.

Escape, the arrow keys, and the blockers in read-only editors rely on the
`miniHelix.countPending` context key, so a key typed in the instant after the
first digit, before VS Code receives that update, can still act natively. Digits
themselves and every other Mini Helix key never wait for it.

### Line selections (`x`, `X`)

| Key | Command | Selects |
| --- | --- | --- |
| `x` | `miniHelix.extendLineBelow` | covered logical lines; repeat extends below |
| `X` (`Shift+x`) | `miniHelix.extendToLineBounds` | covered logical lines, keeping direction |

`x` counts its first expansion as a step: `2x` expands a partial selection to
two lines, while `x2x` first selects a line and then adds two more. `X` is
idempotent and consumes a count without repeating expansion (`2Xx` leaves an
ordinary single `x`). These commands change selections without changing text,
dirty state, or undo history, and work in read-only editors.

The pure core follows pinned Helix `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`,
including whole-set normalization and primary selection preservation. Its logical
lines split at LF, with CRLF kept together as a grapheme; a lone CR is content,
as in that Helix build. See [oracle provenance and regeneration](test/fixtures/line-selection-oracle.md)
and the [upstream test inventory](test/fixtures/helix-selection-upstream.md).

### Selection edits (`i`, `a`, `c`, `d`, `o`, `O`)

These act on every selection, like Helix. An empty selection stands for
Helix's block cursor, so it covers the character under the cursor: `d` on a
cursor deletes one character, as in Helix.

| Key | Command | Does |
| --- | --- | --- |
| `i` | `miniHelix.enterInsert` | INSERT before each selection |
| `a` | `miniHelix.append` | INSERT after each selection |
| `c` | `miniHelix.changeSelection` | delete each selection, then INSERT |
| `d` | `miniHelix.deleteSelection` | delete each selection |
| `o` | `miniHelix.openBelow` | open a line below each selection, then INSERT |
| `O` (`Shift+o`) | `miniHelix.openAbove` | open a line above each selection, then INSERT |

Typical sequences: `wd` deletes a word and its trailing space, `ec` changes to
the end of a word, and `ea` appends to a word.

`o` opens a line below the line of each selection's last character, and `O`
opens one above the line of its first character. Each selection opens its own
line, with one cursor on it, even when two selections share a line. An empty
selection uses the line of the character under the cursor, as in Helix. The
new line uses the document's line ending.

These follow Helix's `insert_mode`, `append_mode`, `change_selection`, and
`delete_selection`, and `open` for `o` and `O`, including:

- If a selection reaches the end of a document that has no final line ending,
  `a` adds one first, as Helix does to make room for its cursor.
- Escape after `a` puts the cursor back on the last appended character, so `a`
  then Escape doesn't move the cursor.
- `c` on whole lines (for example, line 2 through the start of line 3) replaces
  them with one empty line, indented to the level of the line that follows.
  Indentation uses the editor's tab and indent sizes. Helix's language-aware
  (tree-sitter) indentation is not used.
- Escape right after `o` or `O`, with nothing typed and a single selection,
  removes the new line's indentation, so the line is empty, as in Helix. Once
  you type anything, the indentation stays.
- Overlapping or touching selections merge into one cursor after `c` or `d`.
- Repeated keys wait for the previous edit, so `ddd` deletes three characters.

Because VS Code typing replaces a selection, `i`, `a`, and `c` leave a cursor
instead of keeping the selection while you type. Escape then shows the block
cursor where Helix would, but the text you typed is not selected. Unlike Helix,
`d` and `c` do not copy the deleted text to a register; there is no paste
command yet. Alt+D and Alt+C (delete or change without yanking) are not bound,
because those Alt shortcuts stay native.

`o` and `O` differ from Helix in these ways:

- The new line's indentation comes from VS Code's own Insert Line Below and
  Insert Line Above commands, so it follows `editor.autoIndent` and the
  document's language configuration. Helix uses its own indent rules.
- `O` on the first line adds only a line ending and no indentation, because VS
  Code does the same there.
- A count is ignored: `3o` opens one line, where Helix opens three.
- There is no comment continuation: `o` on a `//` line does not start the new
  line with `// `. VS Code's own language rules can still add text, such as ` * `
  inside a JSDoc block.
- The Escape rule above applies only after `o` and `O`. Helix also removes
  indentation after `i`, `a`, and `c`; Mini Helix does not.

### Undo and redo (`u`, `U`)

| Key | Command | Does |
| --- | --- | --- |
| `u` | `miniHelix.undo` | undo the last change |
| `U` | `miniHelix.redo` | redo the last undone change |

With a count, `3u` undoes up to three changes, stopping with the message below
when there is nothing left.

Like Helix, these undo whole changes. Each NORMAL-mode edit (`d`, or a paste)
is one change, and so is each INSERT session, from `i`, `a`, `c`, `o`, or `O`
through Escape, including what `a`, `c`, `o`, or `O` changed before you typed. So
`ihello world` Escape `u` removes all of it, and `cfoo` Escape `u` brings back
the replaced text in one step.

They use VS Code's own undo stack, so the dirty indicator, saving, and Ctrl+Z
behave as usual. VS Code's undo steps are smaller (typing splits at each word),
so one `u` runs as many VS Code undo steps as the change took, and recognizes the
earlier version of the document by its text. Leaving INSERT also ends VS Code's
current undo step, without moving the cursors, so that two INSERT sessions in a
row stay two changes.

- Undo restores the selections from before the change. Redo restores the cursor
  positions from after it, including where Escape after `a` put the cursor.
- Ctrl+Z and Ctrl+Shift+Z still undo and redo VS Code's smaller steps. After you
  use them, `u` and `U` also move one VS Code step at a time, until the next
  change.
- Changes made before a file was first shown, or while Mini Helix was
  suspended, are undone one VS Code step at a time.
- With nothing left to undo or redo, the status bar shows "Already at oldest
  change" or "Already at newest change", as in Helix.
- With multiple cursors, if one of them is scrolled out of view when you press
  Escape, VS Code may merge the next INSERT session into the same undo step, so
  `u` undoes both sessions.
- Helix keeps a history tree, but `U` only follows the newest branch, so as in
  VS Code, there is nothing to redo after an undo followed by a new change.
  Helix's Alt+U and Alt+Shift+U (`earlier` / `later`) are not bound, since Alt
  shortcuts stay native.

### Go to word (`gw`)

In NORMAL, press `g`, then `w`. Two-letter labels replace the first two
characters of eligible visible words without editing the document. Type both
letters to select the entire word. The command is also available as **Mini Helix:
Go to Word** in the Command Palette, including in read-only text editors.

Like Helix's default `gw`:

- Words contain Unicode letters/numbers or underscores and need at least two
  graphemes. Punctuation separates words; single-character words are skipped.
- The word under the primary cursor is skipped. Labels alternate between the
  next word and the previous word, working outwards from that cursor.
- Labels are always two lowercase letters: `aa` through `zz` (up to 676 words).
  The first letter does not filter or redraw the labels.
- A successful jump replaces all cursors/selections with one forward selection
  of the whole word. Merely opening or cancelling labels preserves selections.
- Escape, an unknown label, or another unmodified non-label key cancels without
  inserting text. `i`, `a`, `c`, `d`, `w`, `b`, and `e` are label letters while
  jumping, not commands.

Labels are cleared on scrolling, cursor/selection changes, edits, tab changes,
window focus loss, mode changes, or suspension. Modified shortcuts remain native
VS Code commands during label input. Visible ranges are vertical: full soft-wrapped document lines
can get labels, including portions outside the viewport horizontally. Folded
text does not get labels.

This uses the default alphabet only, VS Code's end-exclusive selections, and
native navigation history; it does not add Helix's select mode or a custom
jumplist. Input blocking and label keys share the keyboard-layout and context
update limitations below.

### Match text objects and surround (`mi`, `ma`, `ms`, `md`, `mr`)

| Keys | Does |
| --- | --- |
| `miw` / `maw` | select inside or around the word under each cursor |
| `mi<d>` / `ma<d>` | select inside or around the enclosing `<d>` pair |
| `[count]mi<d>` / `[count]ma<d>` | select the n-th enclosing pair (the count is ignored for `w`) |
| `ms<char>` | surround each selection with `<char>`; a delimiter gives its pair, and a closing one is an alias, so `ms(` and `ms)` both give `(text)`; any other printable character, including a space, goes on both sides |
| `ms<Enter>` | surround each selection with the document's line ending on both sides |
| `[count]md<d>` | delete the n-th enclosing `<d>` pair |
| `mr<old><new>` | replace the enclosing `<old>` pair with `<new>`; for example `mr([` turns `(text)` into `[text]` |

`<d>` and `<old>` can be `'` `"` `` ` `` `(` `)` `[` `]` `{` `}` `<` `>`; a closing
character is an alias for its pair, so `mi)` is the same as `mi(`. `<new>` can
be any of those, or any other printable character, which is used on both sides:
`mr"*` turns `"x"` into `*x*`.

`md` accepts the same `<d>` characters and finds pairs the same way as `mr`.

- `mi` and `ma` work on every cursor; a cursor with no match stays where it is.
- `mr` works with multiple cursors and is one undo step (and one `u` revision).
  If any cursor has no match, nothing changes.
- `ms` ignores a count. Afterwards each selection covers the new pair (the
  selected text plus the delimiters) and keeps its direction. An empty selection
  wraps the character under the cursor, so `ms(` on `b` in `abc` gives `a(b)c`
  with `(b)` selected.
- `ms` and `md` work with multiple cursors and are one undo step (and one `u`
  revision). `md` changes nothing if any cursor has no matching pair. After `md`,
  each selection keeps its direction and moves back by the delimiters deleted
  before it.
- In a read-only editor, `ms` and `md` change nothing and clear the count.
- Escape or an invalid key after `m`, `mi`, `ma`, `ms`, `md`, `mr` or `mr<old>`
  cancels the command, clears the count, and types nothing.

Limitations:

- Matching is lexical, not syntax-aware. Brackets inside comments and strings,
  and operators such as `->`, count like any other bracket.
- Quotes pair up on a single line from left to right and do not nest.
- The punctuation keys follow the US keyboard layout.
- There is no `mm` command and no syntax objects (function, class, argument).
  This is not exact Helix parity.
- `md` accepts only the delimiters (`'` `"` `` ` `` `(` `)` `[` `]` `{` `}` `<`
  `>`), not any character and not `m` (nearest pair).
- `md` pairs quotes on a single line; Helix searches across lines.
- `md` with several cursors in one pair deletes that pair once; Helix rejects
  this.
- `md` shows no error message when it finds no pair.
- `mr<old><space>` does not replace the pair with spaces, as Helix does.

### Settings

```json
{
  "miniHelix.enabled": true,
  "miniHelix.defaultMode": "normal",
  "miniHelix.hjklMotions": true
}
```

`hjklMotions` binds `h`, `j`, `k`, and `l` in NORMAL (see above) and takes effect
immediately.

`enabled` takes effect immediately. `defaultMode` can be `normal` or `insert` and
applies on activation; reload the window after changing it. The suspend command
is session-only and does not modify settings. Resuming preserves the last mode.

### Initial limitations

This version uses VS Code's normal caret/selection model, not Helix's inclusive,
non-empty character selections; word motions translate between the two (see
above). Syntax selection uses native Smart Select rather than Helix's tree-sitter
model. Input blocking uses normal VS Code keybindings, primarily tested
with a US keyboard layout. IME composition and alternate keyboard layouts are
not guaranteed to be fully blocked in NORMAL. Existing user keybindings can
override the extension's defaults intentionally. Mode context updates travel
between the extension host and the editor, so extremely rapid synthetic input
immediately after a mode switch can arrive before the new mode takes effect.

## Add your first motion, without changing the extension

Run **Preferences: Open Keyboard Shortcuts (JSON)** and add only the bindings
you want. User keybindings take precedence over the NORMAL-mode blockers:

```json
[
  {
    "key": "g h",
    "command": "cursorLineStart",
    "when": "editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive"
  },
  {
    "key": "shift+5",
    "command": "editor.action.selectAll",
    "when": "editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive"
  }
]
```

`g h` means press `g`, then `h`; VS Code handles the chord. `shift+5` is `%` on
a US keyboard; use the shortcut recorder for your layout.

These bindings are restricted to NORMAL outside word jumps. Include
`!miniHelix.wordJumpActive` on user bindings so they don't steal label input.
Remove one to disable that motion. They are examples, not extension defaults. When adding them to an existing
`keybindings.json`, merge the entries into its existing array.

## Architecture

```text
VS Code keybinding resolver
  ├── i / Escape ───────────> ModeController
  │                            ├── publish mode/enabled context keys
  │                            └── update cursor/status presentation
  ├── 0–9 ──────────────────> Count → pending count, status bar
  ├── w b e W B E h l ──────> registerMotion → word/character motion selections
  ├── j k ──────────────────> CharMotions → line moves, remembered columns
  ├── x X ──────────────────> queued whole-set line selections
  ├── a c d ────────────────> SelectionEdits → document edits, then mode
  ├── u U ──────────────────> UndoHistory → native undo/redo, whole revisions
  ├── gs gl gg ge ──────────> registerMotion → motions/goto.ts → core/gotoMotion.ts
  ├── g w / label input ────> WordJump → decorations / word selection
  ├── gd gr / Alt+O/I / Ctrl+O/I → native VS Code navigation / Smart Select
  ├── unbound NORMAL key ───> no-op
  ├── your native binding ──> VS Code command
  └── your custom binding ──> registerMotion → selection transformation
```

```text
src/
  extension.ts              Activation, commands, configuration, lifecycle
  core/
    mode.ts                 Small, independently tested state machine
    selections.ts           INSERT selection preparation
    registerMotion.ts       Guarded multi-selection command runner
    wordJump.ts             Visible word targets and Helix-style label order
    wordMotion.ts           Helix word motions (w/b/e/W/B/E), Node-testable
    charMotion.ts           Helix h/j/k/l, Node-testable
    gotoMotion.ts           Helix gs/gl/gg/ge, Node-testable
    unicodeWidth.ts         Helix's character widths (unicode-width 0.1.12 tables)
    count.ts                Helix's count prefix
    editing.ts              Helix selection edits (a/c/d), Node-testable
    history.ts              Helix revisions over VS Code's undo stack (u/U)
  motions/
    word.ts                 Word motion commands for registerMotion
    hjkl.ts                 h/j/k/l commands, remembered columns, word wrap
    goto.ts                 gs/gl/gg/ge commands for registerMotion
  vscode/
    editing.ts              a/c/d commands: edits, carets, append restore
    history.ts              u/U commands: revision tracking and undo stops
    queue.ts                Runs edit, undo, and mode commands in key order
    navigation.ts           Native definitions, references, Smart Select, back/forward
    presentation.ts         Temporary cursors and mode indicator
    wordJump.ts             Interactive jump session, labels, and cleanup
scripts/
  keybindings.cjs           Generates scoped NORMAL blockers in package.json
```

The extension owns mode state and transient jump sessions. VS Code remains the source of truth for
documents, selections, undo, and native navigation. A read-only `getState()` API
is returned from extension activation.

### Add a custom motion later

Create a module under `src/motions/` that exports a function of type `Motion`:

```ts
import { Motion } from '../core/registerMotion';

export const myMotion: Motion = (_document, selection, _count) => {
  // Compute a new vscode.Selection, repeating `count` times if that makes
  // sense. Do not edit the document here.
  return selection; // Replace with your motion's implementation.
};
```

Register it in `activate()`, using the existing shared `modes` and `count`:

```ts
context.subscriptions.push(
  registerMotion('miniHelix.myMotion', myMotion, modes, count)
);
```

Import `registerMotion` and your function in `extension.ts`, compile, then add a
user keybinding pointing to `miniHelix.myMotion`. The runner handles mode guards,
multiple selections, counts, and revealing the result. Commands are available after the
modal core activates; no new keyboard parser is needed.

Helix ranges are gap positions, so they map directly onto VS Code's
end-exclusive selections; `src/core/wordMotion.ts` and `src/motions/word.ts`
are a complete example to copy for further Helix motions. Larger features,
such as the `gw` session, can be independent modules.

### Commands and context keys

| Command | Purpose |
| --- | --- |
| `miniHelix.enterNormal` | Enter NORMAL |
| `miniHelix.enterInsert` | Enter INSERT |
| `miniHelix.toggleMode` | Switch modes |
| `miniHelix.append` / `changeSelection` / `deleteSelection` | `a` / `c` / `d` |
| `miniHelix.openBelow` / `openAbove` | `o` / `O` |
| `miniHelix.undo` / `redo` | `u` / `U` |
| `miniHelix.toggleEnabled` | Suspend / resume for this session |
| `miniHelix.gotoWord` | Show word labels (`gw`) |
| `miniHelix.gotoDefinition` / `gotoReferences` | `gd` / `gr` |
| `miniHelix.expandSelection` / `shrinkSelection` | Alt+O / Alt+I |
| `miniHelix.jumpBack` / `jumpForward` | Ctrl+O / Ctrl+I |
| `miniHelix.filePicker` / `bufferPicker` / `symbolPicker` / `workspaceSymbolPicker` | `Space f` / `Space b` / `Space s` / `Space S` |
| `miniHelix.moveNextWordStart` / `movePrevWordStart` / `moveNextWordEnd` | `w` / `b` / `e` |
| `miniHelix.moveNextLongWordStart` / `movePrevLongWordStart` / `moveNextLongWordEnd` | `W` / `B` / `E` |
| `miniHelix.moveCharLeft` / `moveVisualLineDown` / `moveVisualLineUp` / `moveCharRight` | `h` / `j` / `k` / `l` |
| `miniHelix.gotoFirstNonWhitespace` / `gotoLineEnd` / `gotoFileStart` / `gotoLastLine` | `gs` / `gl` / `gg` / `ge` |
| `miniHelix.count` | Internal count digit (argument: the digit) |
| `miniHelix.clearCount` | Clear a pending count (Escape) |
| `miniHelix.extendLineBelow` / `extendToLineBounds` | `x` / `X` |
| `miniHelix.wordJumpInput` | Internal label input |
| `miniHelix.cancelWordJump` | Cancel labels |
| `miniHelix.noop` | Internal NORMAL input blocker |

Bindings can use `miniHelix.enabled`, `miniHelix.mode` (`normal` / `insert`),
`miniHelix.wordJumpActive` (temporary label-input session), and
`miniHelix.countPending` (a count has been typed).
Always include `editorTextFocus` in editor-specific user bindings.

## Development and verification

```sh
npm run compile                 # TypeScript check and compilation
npm run watch                   # Recompile on changes
npm test                        # Unit tests and generated-binding checks
npm run test:integration         # Isolated VS Code + real renderer keyboard tests
npm run package:vsix             # Build an installable VSIX
```

Selection edit tests (`test/unit/editing.test.ts`) use Helix's `#[foo|]#`
selection notation. They port the Helix test suite's `i`, `a`, and `c` cases,
plus edge cases whose expected outputs were produced by running real Helix's
integration harness. Each case notes when only the cursor position, not the
whole selection, can match.

Motion tests port helix-core's `movement.rs` tests for the bound motions
(`test/unit/helixMovement.test.ts`): the `h`/`j`/`k`/`l` tests and every case of
the `w`, `b`, `e`, `W`, `B`, and `E` tables, including counts.
`test/unit/charMotionCases.ts` adds 102 key sequences for `h`/`j`/`k`/`l` and
counts, with outputs from real Helix. Unit tests run them through the core, and
`test/integration/hjkl.ts` replays them with real keystrokes in VS Code.
`test/unit/gotoMotionCases.ts` does the same for `gs`, `gl`, `gg`, and `ge`
(`test/integration/goto.ts`), with outputs from real Helix.

Undo tests replay 48 key sequences with real keystrokes in VS Code
(`test/integration/history.ts`), against outputs produced the same way by real
Helix, because only VS Code's real undo stack shows how it splits and merges
steps. `test/unit/history.test.ts` ports Helix's `history.rs` undo/redo test.

The integration runner downloads a stable VS Code build by default and creates
an isolated temporary profile/workspace. To use an existing Electron executable:

```sh
VSCODE_EXECUTABLE_PATH=/path/to/code/executable npm run test:integration
```

Use the actual Electron executable, not the CLI shell script. On Linux, a display
is required; on headless CI run under `xvfb-run -a`. Keyboard tests use a temporary
local Chrome debugging connection; the extension itself does not open a port.

If changing the built-in input policy, edit `scripts/keybindings.cjs`, then run
`npm run generate:keybindings`. The test suite rejects a stale generated manifest.
