# Task 12 Initial Review (Claude Code reviewer, task #48)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #17 (plan Task 12); snapshot `pre-task12` → delta list `post-task12/delta-files.txt`.
Orchestrator filter: no findings.

## Verdict

Accept; no actionable defects; every acceptance criterion has passing evidence.

## Compatibility edits (necessary, minimal)

- `tests/textobjects_plain.rs:255`: `add` removed from `action_not_implemented` list.
- `test/unit/matchEvaluate.test.ts:394`: probe uses `replace`.
- `evaluate/textobjects.rs:75,101`: `changes: None` in `Outcome` literals.
- `src/native/protocol.ts`: doc comments only (L254-257, L279-283).
- `documents/mod.rs`: `ReplicaView.eol` from configured line ending.
- `tests/common/{keys,oracle}.rs`: opt-in `Scope::Surround`; Plaintext/Syntax planning unchanged.

## Coverage by acceptance criterion

| Criterion | Evidence | Status |
|---|---|---|
| RED: aliases, literal `m`, Unicode, Enter, multi-selection | `surround-add.json` (112): all brackets, `msm`/`msw`/digits, 15 Unicode incl. non-BMP/combining/ZWJ, Enter LF/CRLF incl. mismatched configured EOL, multi-selection shapes; RED 5/6 failing | Pass |
| `--test surround_add` | with feature 6/6 (127 cases); plain 6/6 (124, 3 skipped, printed) | Pass |
| Adapts pinned `surround_add` | `surround_add.rs:40-77` vs `commands.rs:6379-6414` | Pass |
| Pair mapping | `match_brackets::get_pair` unchanged | Pass |
| Modifiers/non-char/Enter | `MatchKey::character` = `KeyEvent::char` (input.rs:73); `Other` no edits; Enter ignores modifiers; oracle cases `<C-x>`, `<A-x>`, `<C-A-x>`, `<C-(>`, `<C-ret>`, `<A-ret>`, tab, left, up, backspace, home | Pass |
| Enter uses configured EOL | `replica.eol` (= upstream `doc.line_ending`; oracle `main.rs:480`); mixed cases + `configure` test; mutation caught | Pass |
| Count handling | ignored as upstream; `2ms(`, `3ms5`, `ms3`; equal proposals with/without count | Pass |
| One sorted transaction; base UTF-16 edits | `edits.rs` via `changes_iter` + `base.char_to_utf16_cu`; sorted, non-overlapping, no double insert | Pass |
| Touching ranges | merged `")("` insert in upstream order; oracle text reproduced (`add-multi-adjacent-touching` + Enter variant) | Pass |
| Post-edit semantic selections | clone + `ensure_invariants` on post-edit rope (= `apply_impl` ~L1630-1635); oracle match each step | Pass |
| Replica unchanged; evaluate twice | every evaluation sent twice; `test_observe` text/version; only mirrored `change` commits | Pass |
| Compare to real Helix | expected from oracle fixtures; 112 re-run pass; provenance | Pass |
| Existing case files unchanged | 11 files byte-identical | Pass |
| VR4-1/5-1/6-1 untouched | files identical to snapshot | Pass |
| Lock and baseline | keys match; only `package.json` (pre-existing) | Pass |
| No TS Helix algorithm | comment + one test literal | Pass |

## Checks run

- `cargo +1.90.0 test --locked ... --test surround_add --features test-support -- --nocapture`: 6 passed; 127 cases, 130 `ms` requests (123 edited), 301 edits; 1 exclusion (`select-mode-ms`, FR-16).
- Without feature: 6 passed (124, 3 skipped). Crate tests plain and with feature: all ok.
- `npm run test:match:oracle`: 664 PASS, 0 FAIL. `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test`: 166/166. `check:keybindings`, `compare-cargo-lock.cjs` (no deviations), `check:helix-runtime` (`fd5ee12c…`): OK.
- Snapshot diff of 8 modified files; `sha256sum -c` key and evidence hashes OK; `git status` unchanged; no `native/runtime/out` writes; upstream sources read.

## Coverage limits

RED/mutation from archived logs; VS Code application/history/keyboard deferred (Tasks 18-19); oracle not regenerated; Linux x64 only.

## Non-findings (not accepted)

Adapter inventory line citations off (`document.rs:1467-1471` vs ~L1630-1635; README `transaction.rs:589` is `Transaction::changes`, not `with_selection` L625 / `ChangeSet::apply` L342) — symbols and behaviour correct; count pass-through ignored (upstream); select-mode exclusion (FR-16); Escape as `other` no-op.
