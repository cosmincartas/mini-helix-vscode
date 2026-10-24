# Task 14 status (replacement transactions, `continue` with a character key) - worker #19

DONE: all verification green (see README.md and logs/). Not committed.

- [x] oracle fixtures cases/surround-replace.json (214 cases, oracle-generated only); 14 earlier case files byte-identical (logs/fixtures-unchanged.txt)
- [x] RED archived (logs/red-1-continue-not-implemented.txt): tests written before the implementation, 7/8 failed
- [x] helper: surround_replace::second_phase, shared evaluate::proposal export, single-use token release on success only
- [x] tests/surround_replace.rs: 8 tests plain (428 cases, 5 skipped), 9 tests test-support (433 cases, 0 skipped); 200/201 replacements equal the oracle
- [x] compatibility: surround_preview.rs (2 spots), continuation.rs docs, src/native/protocol.ts typing
- [x] crate tests plain + test-support, oracle, npm test strict 166/166, check:keybindings, compare-cargo-lock (0 deviations), check:helix-runtime, baseline (only package.json differs, pre-existing)
- [x] mutation: no token release on success -> 3 tests fail; continuation.rs restored by sha256
- [x] README.md, file-hashes.txt
