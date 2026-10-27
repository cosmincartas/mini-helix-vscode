# Intent: `o` and `O` (open line below / above)

Sources are marked like this:
- **[user]**: the user said it.
- **[repo]**: the repository shows it.
- **[proposed]**: an inference that the user has not confirmed yet.
- **[unknown]**: still open.

## Problem

In NORMAL mode, `o` and `O` do nothing today. They are in the list of
blocked printable keys (`scripts/keybindings.cjs`, `blocked`), so typing them
has no effect. **[repo]**

To add a new line and start typing on it, users have to put the cursor at
the end of a line, press `a` or `i`, and then press Enter. In Helix, one key
does this. **[proposed]**

The user wants `o` and `O` to work as in Helix. **[user]**
- `o` opens a new line below the selection and enters INSERT.
- `O` opens a new line above the selection and enters INSERT.

## Definition of done

1. In NORMAL mode, `o` opens an empty line below the line where each
   selection ends. Each selection becomes a cursor on its new line, and
   the mode becomes INSERT. **[user]** (Helix parity)
2. `O` does the same, but opens the line above the line where each
   selection starts. **[user]** (Helix parity)
3. Behavior matches pinned Helix `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.
   That includes multiple selections, reversed selections, the first and
   last lines, a document with no final line ending, and CRLF documents.
   The two planned differences below are the only exceptions. **[user]**
4. Planned difference: **the count is ignored.** `3o` opens one line, not
   three. This matches how `i`, `a`, and `c` treat a count here. **[user]**
5. Planned difference: **the indentation of the new line follows VS Code's
   language indent rules**, not Helix's fallback indent. Parity checks
   against Helix do not compare indentation. **[user]**
6. `c` keeps its current Helix fallback indentation. It does not change.
   **[user]**
7. The README documents `o` and `O`:
   - the key table
   - the list of unblocked keys
   - how counts behave
   - both planned differences
   **[repo]** (every existing key has these)
8. `npm test` passes. This includes the keybinding check, which compares
   `package.json` to `scripts/keybindings.cjs`. **[repo]**

## Affected users and systems

- **Users:** people who use Mini Helix in NORMAL mode. Until now, `o`/`O`
  did nothing. After this change, they edit text. **[repo]**
- **Keybindings:** `scripts/keybindings.cjs` and the keybindings it
  generates in `package.json`. `o` and `shift+o` move from the blocked
  list to real commands. **[repo]**
- **Commands:** two new contributed commands. The README command table
  will also need new rows. **[proposed]**
- **Editing core:** `src/core/editing.ts` already handles `a`, `c`, `d`,
  and an "open a line" path for linewise `c`. **[repo]**
- **History:** `u` treats a whole edit as one revision. Whether the new
  line plus the text typed after it count as one revision is
  **[unknown]** (see Open questions).
- **Read-only editors:** `a`, `c`, and `d` are not bound there. **[repo]**
  `o` and `O` should follow the same rule. **[proposed]**

## Constraints

- **Match pinned Helix**, with only the planned differences on count and
  indentation. **[user]**
- **Comment continuation is out of scope.** Helix can start the new line
  with the comment token (`// `) when the current line is a comment. Mini
  Helix will not. The README must list this as a known difference.
  **[user]**
- **No parser and no tree-sitter.** The extension does not install a
  language server, a parser, or a global `type` override. **[repo]**
  (README, "What this version does")
- **The keybindings are generated.** `package.json` keybindings come from
  `scripts/keybindings.cjs`. `npm test` fails if the two drift apart.
  **[repo]**
- **US keyboard layout** is the layout the project tests against. **[repo]**
- **Mixed-in changes:** the working tree has uncommitted, unrelated work
  that adds backtick (`` ` ``) text objects. That work touches
  `scripts/keybindings.cjs` and `package.json`, the same files this change
  will touch. **[repo]**

## Open questions

1. **Undo grouping:** in Helix, one `u` undoes the opened line and the
   text typed in it together. Should Mini Helix do the same?
   **[proposed]**: yes, as part of Helix parity.
   - Consequence: this decides how the change hooks into
     `src/vscode/history.ts`.
2. **Which VS Code indent source to use:** VS Code can indent with
   `onEnterRules`, with `indentationRules`, or by running its native
   "insert line below/above" commands.
   - **[unknown]**. The design phase picks one.
   - Consequence: what counts as "correct" indentation in the tests.
3. **Escape after `o`/`O`:** `a` moves the cursor back when INSERT ends.
   What Helix does when you leave INSERT after `o` on a line where
   nothing was typed is **[unknown]**. Check it against pinned Helix.
4. **Upstream tests:** for `x`/`X`, the project ported Helix's own tests
   and an oracle (`scripts/helix-line-oracle.cjs`). Should `o`/`O` get
   the same treatment?
   - **[unknown]**. The user did not say.
   - Consequence: how much test work the plan contains.
5. **Comment continuation in pinned Helix:** whether
   `ba40e547` has this feature is **[unknown]**.
   - Consequence: whether it is really a difference from that version
     or only from newer Helix. Either way, it stays out of scope.
