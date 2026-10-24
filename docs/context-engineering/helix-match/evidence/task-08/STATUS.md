# Task 8 status (plaintext inside/around objects) - worker #13

DONE (implementation and verification complete; see README.md and logs/).

- [x] RED archived: logs/red-1-evaluate-unsupported.txt (helper without `evaluate`: 5 of 6 tests fail; capability and every request unsupported)
- [x] oracle cases: test/fixtures/helix-match/cases/plaintext-objects-2.json (114 cases, expected from the oracle only; the 8 pre-existing case files byte-identical: logs/fixtures-unchanged.txt)
- [x] helper: native/match-helper/src/evaluate/{mod,textobjects}.rs, Documents::replica_view, session method table/capabilities
- [x] TS typings: src/native/protocol.ts (evaluate)
- [x] compat edits (evaluate no longer unsupported): matchClient.test.ts L685/L732, matchSelections/matchSync capability asserts, protocol.rs, protocol fixtures (README "Compatibility edits")
- [x] Rust differential target tests/textobjects_plain.rs: 6 tests, 156 in-scope oracle cases, 178 evaluate requests, 210 normalization checks
- [x] TS consecutive-chain test test/unit/matchEvaluate.test.ts (carried Task 7 criterion 12): 5 tests, strict real helper, 0 skipped
- [x] verification logs/final-*.txt: cargo plain + test-support, oracle (267 PASS, 0 FAIL), npm test 166/166, compile, check:keybindings, compare-cargo-lock (0 deviations), check:helix-runtime OK
- [x] mutation checks logs/mutation-checks.txt (swap inside/around, W as w, pair count ignored: each detected; sources restored by hash)
- baseline: only package.json differs from baseline.json (pre-existing, modified 04:48 before this task, not touched)
- Pending for Task 9+: capture objects, `g`, syntax-backed pair verification, other actions (README "Pending")
