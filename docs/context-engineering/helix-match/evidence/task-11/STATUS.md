# Task 11 status (match brackets: `mm`) - worker

DONE. All logs in logs/ (.txt); README.md has results, adapter inventory, coverage, deviations; file-hashes.txt has SHA-256 of every created/modified file.

- [x] oracle fixture group `brackets` (266 cases; expected by oracle only; the 13 existing fixture files byte-identical)
- [x] RED archived: logs/red-1-brackets-not-implemented.txt
- [x] helper `brackets` arm (src/evaluate/brackets.rs), adapter inventory in the module doc and README
- [x] tests/brackets.rs green with and without test-support (7 tests)
- [x] full verification: crate plain/test-support, oracle (940 cases), npm compile + strict npm test (166/166), keybindings, lock compare (Cargo.lock unchanged), check:helix-runtime (hash unchanged), baseline hashes (package.json differs, pre-existing), mutation (restored by hash)
- [x] README.md, file-hashes.txt

Notes for the supervisor: upstream debug-build overflow at match_brackets.rs:154 (README finding 1, guarded with catch_unwind; not an oracle fixture); `keys` must be empty for `brackets`; test/fixtures/helix-match/README.md and schema/case-file.schema.json changed during this task by someone else (not by this worker).
