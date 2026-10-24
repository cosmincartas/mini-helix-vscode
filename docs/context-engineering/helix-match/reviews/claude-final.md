I checked the four follow-up corrections against the archived reports, the before-snapshots, the correction diff, the current documents and the pinned Helix source. **D-1 through D-4 are all resolved.** The D-1 fix adds one new, small problem, reported below as V-1.

**Mode: Verification review** (bounded to D-1 through D-4)

### Findings

**[P3] V-1: Don't let the new NORMAL Escape binding take over Escape from VS Code popups — spec.md:44-46, 205-206; plan.md:420, 463**
- **Origin:** the D-1 correction caused this. It fits within the existing limit of one automatic correction batch.
- **How it happens:** VS Code tries extension keybindings before its built-in ones. Today the extension only binds NORMAL Escape while a count is pending (`scripts/keybindings.cjs:18`, `:117`). Otherwise, Escape goes to VS Code's own handlers, which close the hover popup, the peek view and the error/warning popup.
- **Trigger:** Task 19 now binds NORMAL Escape unconditionally, including in read-only editors, and says "do not delegate it to native Escape". With a hover popup, a peek view (the inline window opened by Shift+F12) or an error/warning popup open while the cursor is in a NORMAL-mode editor, Escape would run the do-nothing command. The popup would stay open.
- **Why it's a defect:** this change in existing behavior isn't part of the scope change at spec.md:44-46. That change only says Escape stops clearing the selection. It also conflicts with plan.md:608-612, which says existing navigation and mode behavior must not change.
- **Smallest fix:** add one sentence to spec.md:205-206 and Task 19: the NORMAL Escape binding defers to VS Code while one of its popups is open (exclude those VS Code `when` contexts). Add one integration case, such as Escape closing a hover in NORMAL mode.
- **Confidence:** plausible. The precedence rule is standard VS Code behavior. I didn't check every affected popup context against the VS Code docs or run anything.

No other contradictions were introduced by the corrections.

### Status of D-1 to D-4

| ID | Status | Evidence |
|---|---|---|
| D-1 | **Resolved** (see V-1) | The scope change is stated in spec.md:44-46, plan.md:28-29 and spec.md FR-8:120. The routing is at spec.md:205-206 and plan.md:420, 463. The fast case is at spec.md:597 and plan.md:426; the delayed case at spec.md:596 and plan.md:425. This matches pinned Helix: `default.rs:187` maps Escape to `normal_mode`, `enter_normal_mode` returns early in NORMAL (`helix-view/src/editor.rs:2533`), and the count is cleared after a matched command (`ui/editor.rs:1092`). INSERT Escape is unchanged. The old "native Escape" wording no longer appears. |
| D-2 | **Resolved** | Only a reference lookup error replays buffered keys (spec.md:590-592). Infrastructure errors, stale results and cancellation discard them, and only infrastructure errors are reported. Tasks 16 and 17 match (plan.md:390, 419). The failed-helper `mr(d` test is at plan.md:399 and plan.md:426, and the acceptance item at plan.md:610. The plan.md:425 case ("failed `mr(d` runs delete") is the lookup-error case, while plan.md:426 is the failed-helper case, so they don't conflict. |
| D-3 | **Resolved** | Digit routing is split by phase at spec.md:224 and plan.md:460-461. This agrees with spec.md:383-384, 581-583, plan.md:400 and the pinned `command_mode` (`ui/editor.rs:1014-1024`). spec.md:221-223 only overrides edit keys. |
| D-4 | **Resolved** | Behavior is split by query file at spec.md:498-501 and plan.md:272-273. The query path and failure type are recorded at spec.md:476-477 and plan.md:146. Mapping root failures to `initial_failure` uses an existing state (spec.md:418) and matches the initial-failure behavior at spec.md:494. This is consistent with pinned `syntax.rs:67-104` (highlights, injections and locals compiled together, then `.ok()` at line 100) and `document.rs:1366-1376` (`NoRootConfig`, so no syntax). |

### Verification
- Compared the provided `corrections.diff` with a fresh `diff -u` of the before-snapshots against the current spec.md, plan.md and review.md. The changed lines are the same; the only difference is where one blank line falls in the hunks.
- Read the D-1 to D-4 findings in `reviews/claude-followup.md` and the D table in review.md:42-49.
- Searched the current spec.md and plan.md for every mention of Escape, digits and `syntaxState`.
- Read the pinned Helix source (`ui/editor.rs` 1005-1092, `helix-view/src/editor.rs` 2525-2545, `keymap/default.rs` Escape bindings, `syntax.rs` 67-104, `document.rs` 1355-1380) and the current `scripts/keybindings.cjs`.
- No tests or builds were run, as instructed.

### Scope and limits
- **Scope:** only the D-1 to D-4 corrections in the correction diff and their surrounding text. I didn't reopen C-1 to C-8; nothing in the corrected sections changes them.
- **Not checked:** how injected-language config failures are handled inside tree-house (D-4's "remove the layer" wording), which relies on the earlier follow-up's reading. I also didn't check the full list of VS Code popup contexts for V-1 against the docs.
- I ignored the draft status, the hash and the "final verification pending" note, as asked.
- This review checks the design documents only. It doesn't show that native builds work or that the extension matches Helix in practice.
- **Review status: Complete.** All four items are resolved, with one new P3 finding (V-1) that the D-1 correction caused.
