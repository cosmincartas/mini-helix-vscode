# Task 12 status (surround add, `evaluate` action `add`) - worker #17

DONE (all verification green; see README.md and logs/).

- [x] oracle fixtures (oracle-generated only): cases/surround-add.json (112 cases); the 11 pre-existing case files byte-identical (logs/fixtures-unchanged.txt)
- [x] RED archived: logs/red-1-add-not-implemented.txt
- [x] helper: evaluate/surround_add.rs, evaluate/edits.rs, evaluate/mod.rs (add arm, post-edit selection, edits), documents ReplicaView.eol
- [x] tests/surround_add.rs (+ common/keys.rs, common/oracle.rs Scope::Surround): 6 tests, plain build 124 cases (3 skipped: failure injection), test-support build 127 cases / 0 skipped
- [x] final verification: crate plain/test-support, oracle, npm compile + test (166/166, real helper required), check:keybindings, compare-cargo-lock (0 deviations), check:helix-runtime
- [x] mutation check: Enter ignoring document EOL fails (logs/mutation-enter-ignores-eol.txt), restored by hash
- [x] baseline: only package.json differs (pre-existing; not touched)
- file-hashes.txt lists created/modified files.
