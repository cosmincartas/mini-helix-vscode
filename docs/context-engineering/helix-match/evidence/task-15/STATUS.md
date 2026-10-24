# Task 15 status (surround deletion transactions, `evaluate` action `delete`) - worker #20

DONE: all verification green (see README.md and logs/). Not committed.

- [x] oracle fixtures cases/surround-delete.json (243 cases, oracle-generated only); existing fixture files byte-identical (logs/fixtures-unchanged.txt)
- [x] RED archived (logs/red-1-delete-not-implemented.txt): tests written before the helper arm, 7/7 failed
- [x] helper: evaluate/surround_delete.rs (adapted orchestration) + evaluate/surround_lookup.rs (shared key conversion and lookup result, also used by `mr`)
- [x] tests/surround_delete.rs: 7 tests plain (236 cases, 12 skipped), 7 test-support (248 cases, 0 skipped)
- [x] compatibility: tests/textobjects_plain.rs, test/unit/matchEvaluate.test.ts (asserted `delete` not implemented), src/native/protocol.ts typing
- [x] crate tests plain + test-support, oracle, npm test strict 166/166, check:keybindings, compare-cargo-lock, check:helix-runtime, baseline (only package.json differs, pre-existing)
- [x] mutation: partial deletion on failure -> 4 tests fail; surround_delete.rs restored by sha256
- [x] README.md (adapter inventory), file-hashes.txt
