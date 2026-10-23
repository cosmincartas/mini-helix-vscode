# Mini Helix

A minimal VS Code extension with **NORMAL / INSERT modes**, Helix-style
selection-first **word motions** (`w`, `b`, `e`, `W`, `B`, `E`), the **selection
edits** `i`, `a`, `c`, `d`, **undo/redo** with `u` and `U`, and **`gw` word jumps**. Add other individual bindings as you need them; this is not a full Helix
emulator.

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
- Press **`d`** to delete the selection, or **`c`** to delete it and type a
  replacement.
- In NORMAL, press **`g` then `w`**, then type a word's two-letter label to select it.
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
  except `i`, `a`, `c`, `d`, `u`, `U`, the word motions, and the `g w` chord.
- INSERT uses VS Code's native typing, completion, and cursor style.
- `i` collapses each selection to its start, so typing inserts before the
  selection rather than replacing it. This also works with multiple and reversed
  selections. Entering NORMAL does not move the cursor or rewrite selections.
- Cursor changes are temporary editor options, not changes to your settings.
  Suspending the extension restores each editor's configured cursor style.
- Blocker bindings are limited to editable text-editor focus. Search fields,
  Quick Input boxes, and terminals keep their native input. Read-only editors
  keep native input too, except for word motions, `gw`, and its temporary label
  input; `a`, `c`, `d`, `u`, and `U` are not bound there.
- Arrow keys remain native outside word jumps; Ctrl/Cmd/Alt shortcuts always
  remain native. NORMAL is **not read-only**: paste, cut, undo, command-driven
  edits, and other native editing shortcuts can still modify the document.

There are deliberately **no** bindings for `gs`, `gl`, `x`,
`%`, `gd`, `gr`, Ctrl+O/I, or Alt+O/I. No language server, parser, custom buffer,
custom jump history, or global `type` override is installed.

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
Motions also work in read-only editors. There is no count prefix (`3w`) and no
select/extend mode (`v`) yet.

### Selection edits (`i`, `a`, `c`, `d`)

These act on every selection, like Helix. An empty selection stands for
Helix's block cursor, so it covers the character under the cursor: `d` on a
cursor deletes one character, as in Helix.

| Key | Command | Does |
| --- | --- | --- |
| `i` | `miniHelix.enterInsert` | INSERT before each selection |
| `a` | `miniHelix.append` | INSERT after each selection |
| `c` | `miniHelix.changeSelection` | delete each selection, then INSERT |
| `d` | `miniHelix.deleteSelection` | delete each selection |

Typical sequences: `wd` deletes a word and its trailing space, `ec` changes to
the end of a word, and `ea` appends to a word.

These follow Helix's `insert_mode`, `append_mode`, `change_selection`, and
`delete_selection`, including:

- If a selection reaches the end of a document that has no final line ending,
  `a` adds one first, as Helix does to make room for its cursor.
- Escape after `a` puts the cursor back on the last appended character, so `a`
  then Escape doesn't move the cursor.
- `c` on whole lines (for example, line 2 through the start of line 3) replaces
  them with one empty line, indented to the level of the line that follows.
  Indentation uses the editor's tab and indent sizes. Helix's language-aware
  (tree-sitter) indentation is not used.
- Overlapping or touching selections merge into one cursor after `c` or `d`.
- Repeated keys wait for the previous edit, so `ddd` deletes three characters.

Because VS Code typing replaces a selection, `i`, `a`, and `c` leave a cursor
instead of keeping the selection while you type. Escape then shows the block
cursor where Helix would, but the text you typed is not selected. Unlike Helix,
`d` and `c` do not copy the deleted text to a register; there is no paste
command yet. Alt+D and Alt+C (delete or change without yanking) are not bound,
because Alt shortcuts stay native.

### Undo and redo (`u`, `U`)

| Key | Command | Does |
| --- | --- | --- |
| `u` | `miniHelix.undo` | undo the last change |
| `U` | `miniHelix.redo` | redo the last undone change |

Like Helix, these undo whole changes. Each NORMAL-mode edit (`d`, or a paste)
is one change, and so is each INSERT session, from `i`, `a`, or `c` through
Escape, including what `a` or `c` changed before you typed. So
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
VS Code commands. Visible ranges are vertical: full soft-wrapped document lines
can get labels, including portions outside the viewport horizontally. Folded
text does not get labels.

This uses the default alphabet only, VS Code's end-exclusive selections, and
native navigation history; it does not add Helix's select mode or a custom
jumplist. Input blocking and label keys share the keyboard-layout and context
update limitations below.

### Settings

```json
{
  "miniHelix.enabled": true,
  "miniHelix.defaultMode": "normal"
}
```

`enabled` takes effect immediately. `defaultMode` can be `normal` or `insert` and
applies on activation; reload the window after changing it. The suspend command
is session-only and does not modify settings. Resuming preserves the last mode.

### Initial limitations

This version uses VS Code's normal caret/selection model, not Helix's inclusive,
non-empty character selections; word motions translate between the two (see
above). Syntax selection can be added later. Input blocking uses normal VS Code keybindings, primarily tested
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
    "key": "g d",
    "command": "editor.action.revealDefinition",
    "when": "editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive"
  },
  {
    "key": "g l",
    "command": "cursorEnd",
    "when": "editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive"
  },
  {
    "key": "shift+5",
    "command": "editor.action.selectAll",
    "when": "editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive"
  }
]
```

`g d` means press `g`, then `d`; VS Code handles the chord. `gd` requires a
language extension that provides definitions. `shift+5` is `%` on a US keyboard;
use the shortcut recorder for your layout.

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
  ├── w b e W B E ──────────> registerMotion → word motion selections
  ├── a c d ────────────────> SelectionEdits → document edits, then mode
  ├── u U ──────────────────> UndoHistory → native undo/redo, whole revisions
  ├── g w / label input ────> WordJump → decorations / word selection
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
    editing.ts              Helix selection edits (a/c/d), Node-testable
    history.ts              Helix revisions over VS Code's undo stack (u/U)
  motions/
    word.ts                 Word motion commands for registerMotion
  vscode/
    editing.ts              a/c/d commands: edits, carets, append restore
    history.ts              u/U commands: revision tracking and undo stops
    queue.ts                Runs edit, undo, and mode commands in key order
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

export const myMotion: Motion = (_document, selection) => {
  // Compute a new vscode.Selection. Do not edit the document here.
  return selection; // Replace with your motion's implementation.
};
```

Register it in `activate()`, after creating `modes`:

```ts
context.subscriptions.push(
  registerMotion('miniHelix.myMotion', myMotion, modes)
);
```

Import `registerMotion` and your function in `extension.ts`, compile, then add a
user keybinding pointing to `miniHelix.myMotion`. The runner handles mode guards,
multiple selections, and revealing the result. Commands are available after the
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
| `miniHelix.undo` / `redo` | `u` / `U` |
| `miniHelix.toggleEnabled` | Suspend / resume for this session |
| `miniHelix.gotoWord` | Show word labels (`gw`) |
| `miniHelix.moveNextWordStart` / `movePrevWordStart` / `moveNextWordEnd` | `w` / `b` / `e` |
| `miniHelix.moveNextLongWordStart` / `movePrevLongWordStart` / `moveNextLongWordEnd` | `W` / `B` / `E` |
| `miniHelix.wordJumpInput` | Internal label input |
| `miniHelix.cancelWordJump` | Cancel labels |
| `miniHelix.noop` | Internal NORMAL input blocker |

Bindings can use `miniHelix.enabled`, `miniHelix.mode` (`normal` / `insert`), and
`miniHelix.wordJumpActive` (temporary label-input session).
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
