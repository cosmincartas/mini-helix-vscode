I found 4 new problems that need fixes, and C-1 through C-8 are not all closed. C-2 and C-5 are only partly fixed; C-1, C-4, C-6, C-7 and C-8 are fixed; C-3 is fixed for Helix but now clashes with how this extension handles Escape. I'm marking the review **Incomplete** for procedural reasons covered at the end.

### Findings

**[P2] `miw<Escape>` doesn't fit this extension's Escape — spec.md:579-580; plan.md:401, 407, 413, 594**
- **What happens:** in Helix, Escape in NORMAL does nothing (`default.rs:187` → `enter_normal_mode`, which returns early at `editor.rs:2536`). So "delayed `miw<Escape>` leaves the word selected" is correct for Helix.
- **The conflict:** in this extension, Escape in NORMAL is left to VS Code unless a count is pending (`scripts/keybindings.cjs:18`, `:100`). VS Code's Escape clears a non-empty selection. Neither document lists Escape as a command that waits in the match queue.
- **Effect:** the same keys give different results depending on helper speed. With a fast helper, `miw` finishes first and Escape then clears the selection. With a slow helper, Escape runs first and the word stays selected. That breaks the ordering rule at spec.md:245 and plan.md:594.
- **Smallest fix:** pick one rule and write it down.
  - Either: "Escape after a completed match command waits behind queued match work and then does the extension's existing Escape." The expected result for delayed `miw<Escape>` is then the same as non-delayed (selection cleared).
  - Or: explicitly adopt Helix's do-nothing Escape in NORMAL as an approved change to current behavior.
  - Either way, reword plan.md:594 so it doesn't claim Helix parity for ordinary Escape unless the second option is chosen.

**[P2] Buffered replacement keys have no rule when the preview fails for non-Helix reasons — spec.md:575-578; plan.md:382, 408**
- **What's covered:** replay is defined only for an old-surround lookup error, which matches Helix (`commands.rs:6438-6445`).
- **What's not covered:** what happens to buffered keys when the preview request fails for reasons Helix never has. That includes a helper crash, timeout or error response, a stale result rejected after a mouse move, or a session cancelled while the preview is pending.
- **Effect:** with `mr(d` typed quickly and a helper timeout, an implementer could treat that as a failed lookup and replay `d` as an ordinary delete. That deletes text the user meant as a replacement character.
- **Smallest fix:** add one sentence to spec.md (Pending input and ordering) and mirror it in Tasks 16 and 17: "Only a reference lookup error replays buffered keys. On infrastructure errors, stale preview results or cancellation, discard the buffered keys, report the error, and make no edit." Add a fault-injection test for `mr(d`.

**[P3] Task 19 says match input overrides digit commands, which contradicts counts after `m` — plan.md:448 (also spec.md:217)**
- **The rule:** Helix keeps the count growing while only `m` is pending (`editor.rs:1014-1028`). It checks `contains_key` against the pending `m` menu, which has no digits (`keymap.rs:295-302`). Spec.md:569-572 and Task 16 already say this.
- **The conflict:** Task 19 says "ensure pending match input overrides edit and digit commands", with no phase limit.
- **Effect:** binding digits to match input during the action phase would break `m3i{` and `2m3i{`.
- **Smallest fix:** "During callback phases, match input overrides edit and digit commands. During the action phase, digits keep routing to `Count` under the pinned digit rules." Also qualify spec.md:217 by phase.

**[P3] The query-failure rule only fits text-object queries — spec.md:411, 467-469, 489, 635; plan.md:142, 267 (part of C-5)**
- **What's correct:** a `textobjects.scm` compile failure logs an error and returns `None` (`syntax.rs:152-160`), so capture objects do nothing and other syntax features keep working.
- **What's wrong:** a failure in `highlights.scm`, `injections.scm` or `locals.scm` makes `compile_syntax_config` fail (`syntax.rs:67-104`). Then `Syntax::new` returns `NoRootConfig` and the document has no syntax at all (`document.rs:1364-1376`). That means pairs and surrounds use plaintext and every capture does nothing. For an injected language, that layer is simply missing.
- **Two consequences:**
  - "While retaining other available syntax behavior" (spec.md:489) is wrong for these three files.
  - None of the five `syntaxState` values covers this case.
- **Smallest fix:** in spec.md:489 and plan.md:267, split the rule by query file as above. Map a failed root syntax config to `initial_failure`, or add a `config_failure` state. Have Task 2 record which query file failed.

### Status of C-1 to C-8

| ID | Status | Evidence |
|---|---|---|
| C-1 | Fixed | Matches `KeyEvent::char()` (`input.rs:73`), `canonicalize_key`, which only strips Shift (`editor.rs:1753`), and the replacement restore at `commands.rs:6459`. Spec 219-223 and 373-375; Tasks 16 and 19. |
| C-2 | Partly fixed | Spec 376-377 and 569-572 plus Task 16 match `editor.rs:1014-1092`. Task 19 still contradicts this (finding 3). |
| C-3 | Fixed for Helix, conflicts here | Replay matches `commands.rs:6438-6445`, and Escape not cancelling completed commands matches Helix. Findings 1 and 2 remain. |
| C-4 | Fixed | Task 8 is plaintext-only (plan 244). Tasks 9, 13 and 15 have syntax and injection cases, consistent with `textobject_pair_surround(syntax, …)`. |
| C-5 | Partly fixed | The 500 ms timeout (`syntax.rs:518`), the permanent disable after a failed update (`document.rs:1522-1523`) and carry-over through recovery (spec 411-423 and 488; Tasks 6 and 20) are correct. Query-file handling is wrong for three files (finding 4). |
| C-6 | Fixed | Spec 50-52, 347-349 and 677; Tasks 1 and 7 agree. |
| C-7 | Fixed | Spec 311-312; Task 1 line 123; Task 21 lines 487 and 497 cover both Alpine architectures. |
| C-8 | Fixed | review.md exists. Its links to spec.md and plan.md, and plan.md's link to spec.md, all point to existing files. |

### Verification
- Read the current spec.md, plan.md and review.md in full.
- Checked against pinned Helix source in `/tmp/…/helix-ba40e547…`:
  - Key handling: `helix-view/src/input.rs`; `helix-term/src/ui/editor.rs` (count, callback and canonicalize code); `keymap.rs` (`get`, `contains_key`); `keymap/default.rs` (Escape).
  - Commands and syntax: `commands.rs` (`surround_replace`); `textobject.rs` (pair-surround functions); `helix-core/src/syntax.rs` (timeout, query compilation); `helix-view/src/document.rs` (`set_language`, failed-update handling).
  - `rust-toolchain.toml` (1.90.0).
- Checked this extension's Escape and digit bindings in `scripts/keybindings.cjs`. No builds, tests or edits were run, as instructed.

### Scope and limits
- **Mode:** I treated this as a Verification review limited to the eight corrections. I did not re-review the whole documents for new defects.
- **Why it's marked Incomplete:**
  - I had no snapshot of the documents before the corrections. They are untracked in git, so I couldn't produce a correction-only diff.
  - The original review exists only as the C-1 to C-8 summaries in review.md.
  - Because of that, I can't fully attribute new issues to the corrections, or rule out regressions in unchanged-looking text.
- **Origin of the new findings:** findings 1-3 follow from the C-3 and C-2 corrections. Finding 4 is a gap inside the C-5 correction.
- **Not checked:**
  - Whether VS Code's default Escape actually clears the selection. That comes from known VS Code behaviour and wasn't run in an editor.
  - Whether a statically linked musl binary can load grammar libraries (known musl behaviour, not tested).
  - The `surround_add` Enter path and the oracle's ability to inject query failures.
- **Not counted as defects, as you asked:** the draft status, the hash placeholder and the pending follow-up note.
