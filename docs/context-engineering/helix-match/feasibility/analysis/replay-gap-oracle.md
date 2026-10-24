> Provenance: read-only oracle memo, session 1833127f, 2026-10-24. Copied verbatim from /tmp/helix-match-implementation-khd3bwgf/evidence/oracle-replay-gap.md.

# Oracle decision memo: replay of buffered keys after failed `mr` lookup (2026-10-24)

Conclusion: No supported VS Code 1.85+ mechanism can replay native/user/other-extension-bound keys
(no key injection, keybinding resolution, or context-key read API; @types/vscode 1.85 index.d.ts:10236-10293;
1.85.2 resolver is renderer-only; none of 182 API proposals in 1.143.1 covers it). Capturing is required during
the lookup window (key meaning depends on helper answer); letting keys through breaks the success case
(ctrl+x would cut instead of replacing with x) and cancels ownership.

Affected keys (writable idle NORMAL, from scripts/keybindings.cjs): extension owns 40 single-key commands,
100 no-op blockers (104 with hjkl off), 145 g chords (3 commands, 142 no-ops); Escape becomes extension-owned
under the spec (except popups). Native/unreplayable: arrows/Home/End/PageUp/PageDown without count, Ctrl/Alt/Meta
combos except alt+o/alt+i/ctrl+o/ctrl+i, shifted/ctrl navigation keys, F-keys, Insert, user & other-extension bindings.

Contract: spec.md:596 and :601 cannot be met literally for native/user-bound keys. User approval of an amendment is
required; do not implement around silently. Not a Task 1 gate failure (gate criteria plan.md:131-132); triggers
plan.md:55 material-change rule for Task 16 (and dependent 17-22). Tasks 2-15 unaffected.

Option 1 (recommended): replay buffered keys in order through the extension's generated NORMAL keymap evaluated
against extension state; extension commands, no-ops, NORMAL Escape, and `type` text replay with full identity; at the
first native/user/other-extension-bound key, discard it and all later buffered keys, execute nothing further, report
the discarded input in the status item; same rule for late keys arriving before context publication; replay does not
observe user overrides of extension-owned keys.
Option 2: Option 1 + closed table of default native commands for arrows/Home/End/PageUp/PageDown (precedent
keybindings.cjs:48-54, extension.ts:79-82) — fewer lost keys but wrong for users who rebound them.
Rejected: literal contract (unimplementable); skip-and-continue (destructive, e.g. `mr(` ctrl+d c).

Suggested tests after approval: `mr(` d ctrl+d; `mr(` ctrl+d d (nothing runs); `mr(3<left>` counted; replayed Escape;
forced-lag `miw` ctrl+d.
Risks: window size end-to-end unmeasured (esp. remote hosts); replayed Escape cannot dismiss popups; user bindings
scoped to NORMAL already outrank match capture in every phase (unmentioned in spec). Confidence high on API facts.
