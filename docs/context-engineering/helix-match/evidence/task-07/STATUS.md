# Task 7 status (semantic selection identity) - worker #43

DONE (final verification complete; see README.md and logs/).

- [x] oracle cases: test/fixtures/helix-match/cases/selection-identity.json (28 cases, expected from oracle only; other case files unchanged)
- [x] RED archived: logs/red-1-compile.txt (module missing), logs/red-2-helper-not-rebuilt.txt (helper without the method: 12 of 23 fail)
- [x] helper: native/match-helper/src/documents/selection.rs (+ text.rs utf16_of_char, mod.rs replica_text/gated normalize_selection, protocol/session.rs test-only method)
- [x] TS: src/native/selectionCodec.ts, typings in src/native/protocol.ts
- [x] test/unit/matchSelections.test.ts: 23 tests, strict real helper, 0 skipped
- [x] verification logs/final-*.txt: cargo plain + test-support, matchSelections strict/non-strict, oracle (153 PASS, 0 FAIL), npm test 161/161, check:keybindings, compare-cargo-lock (0 deviations), check:helix-runtime OK
- [x] mutation checks logs/mutation-checks.txt
- baseline: only package.json differs from baseline.json (pre-existing, modified 04:48, not touched by this task)
- Pending for Task 8: re-verify consecutive commands with real evaluate and real VS Code (README "Task 8 must re-verify")
