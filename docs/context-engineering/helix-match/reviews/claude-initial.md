# Review: Helix match-family spec and plan

**Mode: Initial review** of the documents only. Both files are untracked and new, so this review covers their full contents. I didn't run or check any native build, test, or parity result.

The two documents are mostly sound. There are 8 actionable findings: 5 P2 and 3 P3. None of them is a P0 or P1, but each P2 would cause an observable mismatch with pinned Helix if implemented as written. All five P2s can be fixed by editing the documents without changing the overall design.

### Findings

**[P2] Fix key input so Ctrl/Alt+character and other non-character keys behave like Helix — spec.md:206-219, 340, 516; plan.md Task 16, Task 19**
- **What Helix does:** Every pending match handler checks `event.char()`. That function returns the character for any `KeyCode::Char`, whatever the modifiers (`helix-view/src/input.rs:73-78`). The key handler only strips SHIFT (`helix-term/src/ui/editor.rs:1753-1761`).
  - So `mi<A-w>` behaves exactly like `miw`, and `ms<C-x>` surrounds with `x`.
  - Keys that aren't characters (Tab, Backspace, arrows, F-keys) are their own input class. They are silently ignored in `mi`, `ma`, `ms`, `md` and the first `mr` key. During the `mr` preview they restore the original selection (`commands.rs:6461-6463`).
- **What the spec says:** `MatchKey` only allows `char | enter`. Line 516 says modified shortcuts "remain native and invalidate pending ownership". That directly contradicts the pinned behaviour.
- **Fix:** Change `MatchKey` to `char` (modifiers other than Shift ignored), `enter`, and `other` (non-character key, Escape included). Require the scoped bindings to send modified characters to the match owner while a match is pending, and add those cases to the Task 16 and Task 19 tests.
  - The alternative is to record this as an explicitly reviewed exclusion from the parity domain. You can't leave it as is.

**[P2] Take the count at the `i`/`a`/`r`/`d` key, and let digits typed after `m` set or extend the count — spec.md:279; plan.md Task 16 ("pending digits must follow the active phase rather than accidentally extending a count")**
- **What Helix does:** The `m` key leaves a pending keymap node, and that node has no digit keys. So a digit typed after `m` starts or extends the count (`editor.rs:1014-1027`, where `contains_key` checks the pending node at `keymap.rs:295-302`). The count is then read when the action runs (`cx.count()` at `commands.rs:6263, 6426, 6497`).
  - `m3iw` is therefore the same as `3miw`, and `3m2ip` uses count 32.
  - `m0` with no count already pending cancels the `m` menu.
  - After `mi`, `mr` and the other actions, digits go to the next-key callback instead (`editor.rs:1498`). `mi3` is a no-op that still re-normalizes the selection.
- **What the spec says:** "`Count.take()` snapshots the prefix when the match session starts." That reads the count too early and gives a different result for `m3iw`.
- **Fix:** In the action phase, send digits to `Count.digit()`. Call `take()` when the action key arrives. `mm` and `ms` should consume and clear the count. Add `m3iw`, `3m2ip` and `m0` to the Task 16 tests and the oracle fixtures.

**[P2] Say what happens to buffered keys when the `mr` preview fails, and don't let Escape cancel commands that are already complete — spec.md:513-515, 190; plan.md Task 16, Task 17**
- **Preview failure:** In Helix, if `get_surround_pos` fails (`commands.rs:6437-6443`), the error is shown and no second key callback is installed. The next key is then an ordinary NORMAL command: `mr(d` with no parentheses shows the error and then runs `d`.
  - The spec buffers keys while the preview is pending, but never says what happens to them when the preview fails or does nothing.
  - The scoped bindings will already have captured those keys as match characters, so a naive implementation would either drop them or use them as the replacement character.
- **Escape:** Line 515 says Escape cancels "the session immediately, even during helper work". In Helix, Escape after a completed `miw` is a separate NORMAL key, and the object stays selected.
  - Cancelling a finished `miw` that is still queued and waiting on the helper would change the result.
- **Fix:**
  - If the preview errors or is a no-op, replay the buffered keys in order as ordinary NORMAL input.
  - Escape and lifecycle cancellation should only cancel phases that are still collecting input. Completed commands stay in the queue and are subject only to the freshness checks.
  - Add `mr(d` (no pair) and `miw<Esc>` with a delayed helper to the Task 16 and Task 17 tests.

**[P2] Treat pair objects and `md`/`mr` lookup as syntax-dependent — spec.md:487-502, FR-9; plan.md Task 8, Task 9**
- **What Helix does:** `textobject_pair_surround`, `textobject_pair_surround_closest` and `surround::get_surround_pos` all take `doc.syntax()`. When a syntax tree exists, they use tree-sitter bracket matching (`surround.rs:42-66, 161-186, 306-318`).
- **What the plan says:** Task 8 is titled "plaintext" and runs before syntax support, but it claims oracle parity for explicit pairs and closest pairs (`m`). Task 9's RED step lists only the seven capture families. Nothing covers `mi(`, `mim`, `ma"`, `md` or `mr` on syntax-enabled or injected documents.
- **Fix:**
  - Limit Task 8's oracle cases to documents with no language.
  - Add syntax-aware and injected-language pair cases (`mi(`/`ma(`, `mim`, quote pairs) to Task 9.
  - Make Tasks 13 and 15 explicitly cover syntax-backed old-surround lookup.
  - In the spec's object table, note that pair objects depend on syntax.

**[P2] Treat query compile failures and parse timeouts as Helix behaviour, not installation errors — spec.md:427, F-4 (line 563), line 37; plan.md Task 2, Task 9**
- **Query errors:** In the pinned code, a `textobjects.scm` that fails to compile is logged and treated as missing, so the object is a no-op (`helix-core/src/syntax.rs:152-163`).
  - The spec (line 427, F-4) calls query errors "installation errors, not reference no-ops". That contradicts line 37 whenever an unmodified pinned query fails against its pinned grammar.
- **Parse timeouts:** Syntax uses a 500 ms parse timeout (`syntax.rs:518`).
  - If the first parse fails, the document has no syntax, so `mm` and pair objects fall back to plaintext and captures become no-ops (`document.rs:1366-1373`).
  - If an incremental update fails, tree-sitter is turned off for that buffer for good (`document.rs:1516-1523`).
  - So results depend on timing and on edit history, and neither the spec nor the plan mentions this.
- **Fix:**
  - Split "the unmodified pinned asset fails to compile in the reference too" (record it in the inventory as a reference no-op, and check the oracle fails the same way) from "a package asset fails its checksum or won't load" (installation error).
  - Either reproduce the timeout and the permanent disabled state in the replica and keep timing-dependent inputs out of the parity fixtures, or record a reviewed exclusion.

**[P3] Define the parity text domain as VS Code's normalized document text — spec.md:231, 330-334, 610**
- **Why lone CR can't be tested through VS Code:** As far as I know, VS Code's text model rewrites mixed or lone-CR line endings to one EOL when it loads a file, and no position can fall inside a CRLF.
  - The spec's lone-CR fixtures (line 610) can't be reached through the editor, though they can in helper or oracle tests.
  - For files with mixed line endings, Git hunks will differ from what Helix shows when it opens the file from disk.
- **Why the CRLF metadata may be dead code:** Helix grapheme-aligns every selection it sets (`selection.rs:662-665`, `document.rs:1399, 1467-1471`), and CRLF is a single grapheme. So Helix results never split a CRLF, and the CRLF "semantic metadata" machinery at lines 330-334 may never be used.
- **Enter in files with no line break:** Helix's `doc.line_ending` falls back to its configured default when the file has no line break, so `ms<Enter>` in such a file needs the same configuration in the oracle.
- **Fix:**
  - State that the parity domain is the text VS Code exposes, with a single EOL.
  - Move lone-CR and mixed-EOL cases to helper/oracle-only tests or list them as a documented host limit.
  - Have Task 1 confirm whether the CRLF metadata is needed at all before Task 7 builds it.

**[P3] Make the Alpine targets prove grammars can actually load at runtime — spec.md:295-298; plan.md Task 1, Task 21**
- **Problem:** Pinned Helix loads grammars as shared libraries at runtime (`helix-loader/src/grammar.rs:73+`). Rust's musl targets link fully statically by default, and a fully static musl binary can't load shared libraries that way.
  - A "build probe" for `alpine-x64` or `alpine-arm64` could pass while every grammar fails to load at runtime.
- **Fix:** Task 1 and Task 21 should require the helper to be dynamically linked against musl (or some other strategy that can load shared libraries), and should actually load a grammar on Alpine. A successful compile is not enough.

**[P3] Remove or fix the reference to a non-existent `review.md` — plan.md:34**
- The plan says "the companion `review.md` records review evidence", but `docs/context-engineering/helix-match/` only contains `spec.md` and `plan.md`.
- **Fix:** Remove the sentence, or create the file as part of finishing the review.

### Optional suggestions (not defects)
- **Git baseline refresh (spec.md:449):** Refreshing before every `mig`/`mag` differs from Helix, which loads the diff base when a file is opened or saved, among other events. That's acceptable because parity is defined for an identical baseline, but the oracle fixtures must use the same refreshed baseline.
- **Ambiguous repeat wording (spec.md:39-42):** "Repeated match commands … remain included" sits close to the exclusion of global repeat. Helix records `mi`/`ma` as `last_motion` through `apply_motion` (`helix-view/src/editor.rs:1484-1487`), so saying explicitly that Alt-`.` is excluded would remove the ambiguity.
- **Focus loss (spec.md:197):** Cancelling on focus loss or window deactivation is a VS Code adaptation; Helix keeps the pending input. It's worth listing as a deliberate, user-visible difference.
- **Packaging (plan Task 21):** Exclude `native/target/**` and other targets' build output in `.vscodeignore`. Today it doesn't exclude a `native/` tree.

### Strengths
- These claims match the pinned source exactly:
  - The six-command `m` menu (`keymap/default.rs:103-110`).
  - The object-key mapping, including `m` meaning closest pair and the `!is_ascii_alphanumeric` rule for custom pairs (`commands.rs:6300-6328`).
  - Word and capture objects ignoring the count.
  - Using the document's line ending for Enter in `ms`.
  - The two-phase `mr` with a preview and restore.
  - The all-or-nothing error behaviour of `md`/`mr`.
- Runtime lookup order: the claim is correct, and also understated, because `CARGO_MANIFEST_DIR` ranks higher too (`helix-loader/src/lib.rs:42-78`). The spec's call for a narrow isolation patch is justified.
- The claim that loading grammars through WebAssembly is unimplemented is correct (`grammar.rs:68-71`).
- The Git trust boundary claim is correct (`helix-vcs/src/git.rs:30-53`).
- The count maximum of 100,000,000 matches Helix (`editor.rs:1019`) and `src/core/count.ts:2`.
- The design is good:
  - A test-only oracle that drives the real `helix-term` key handling, kept separate from the production adapter.
  - Proposals that never change the helper's copy of the text, so only the real VS Code change event commits.
  - A continuation token tied to a specific document version.
  - Honouring the boolean result of `TextEditor.edit`.
  - An explicit go/no-go feasibility gate in Task 1.
  - The rule that a failed check never lowers the parity target.
- The plan's dependencies form a valid order, every task names the task that creates its commands, and the requirement-coverage table is complete.

### Verification
- I read both documents in full. In the pinned source I inspected:
  - `keymap/default.rs`
  - `commands.rs` (`match_brackets`, `select_textobject`, `surround_add`, `surround_replace`, `surround_delete`)
  - `ui/editor.rs` (count handling, next-key routing, `canonicalize_key`, undo-history commits)
  - `helix-view` `input.rs`, `editor.rs` (`apply_motion`) and `document.rs` (`set_selection`, `apply_impl`, syntax setup and update)
  - `helix-core` `textobject.rs`, `surround.rs`, `match_brackets.rs`, `selection.rs`, `syntax.rs`
  - `helix-loader` `lib.rs` and `grammar.rs`
  - `helix-vcs/src/git.rs`
- In the repo I read `package.json` (scripts, `engines ^1.85.0`), `src/core/count.ts`, `src/vscode/queue.ts`, `src/vscode/presentation.ts` (it has a named status item), `.vscodeignore`, and the directory layout.
- I ran no builds, tests or packaging. The VS Code points (line-ending normalization, the version check inside `TextEditor.edit`, delivering keys through keybindings) come from my knowledge of VS Code and are not verified against its source or docs. Task 1 should confirm them.

### Scope and residual risk
- **Scope:** `docs/context-engineering/helix-match/spec.md` and `plan.md` only. I didn't review the user's other uncommitted changes. As requested, I didn't report the draft status or the pending spec hash.
- **Not fully checked:**
  - The `helix-vcs` diff-hunk details (`hunk_at`, pure deletions).
  - The tree-house injection-layer edge cases.
  - Whether the test-harness feature in `helix-term` is usable for the oracle.
  - How large the language and grammar inventory is, and whether every grammar can be cross-compiled for all nine targets.
- **Review status: Complete** for the requested document review, within these limits. It does not show the design can be built or that it reaches parity.
