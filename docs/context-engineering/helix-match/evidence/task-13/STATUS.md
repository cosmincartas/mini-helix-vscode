# Task 13 status (replacement preview and cancellation, `evaluate` action `replace`) - worker #18

DONE: all verification green (see README.md and logs/). Two items to note: RED was archived after the implementation was written (honest timing in README), and the first strict `npm test` run had 1 failure (capability list in matchSync.test.ts), fixed and rerun 166/166.

- [x] oracle fixtures cases/surround-replace-preview.json (214 cases, oracle-generated only); 14 earlier case files byte-identical (logs/fixtures-unchanged.txt)
- [x] RED archived (logs/red-1-replace-not-implemented.txt)
- [x] helper: continuation store, replace first phase, `cancel`, `continue` (non-character key restores; character key not implemented, token kept)
- [x] tests/surround_preview.rs: 8 tests, plain 216 cases (3 skipped, failure injection), test-support 219 cases / 0 skipped
- [x] crate tests plain and test-support, oracle (OK, existing expected unchanged), npm test strict 166/166, check:keybindings, compare-cargo-lock (0 deviations), check:helix-runtime
- [x] baseline: only package.json differs (pre-existing)
- [x] mutation: no release on change fails the lifecycle test, restored by sha256
- [x] README.md, file-hashes.txt
