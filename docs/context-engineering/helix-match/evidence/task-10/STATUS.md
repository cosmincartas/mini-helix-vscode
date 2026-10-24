# Task 10 status (match change hunks against HEAD) - worker #15

DONE except one item that needs supervisor ratification (see "Needs ratification"). All logs in logs/ (.txt).

- [x] dependency: helix-vcs (feature git), helix-view (from_reader), tokio in native/match-helper/Cargo.toml; native/Cargo.lock re-resolved from the upstream lock (288 pairs, 0 version/checksum deviations, `logs/final-compare-cargo-lock.txt`); native/helix-lock.json `cargoLockSha256` 01b15f23... -> f9ca4e5d... ONLY, via `node scripts/build-match.cjs --update-lock` (`logs/update-lock-build-match.txt`); runtime hash unchanged fd5ee12c...ffbea2b (`logs/final-check-helix-runtime.txt`)
- [x] RED archived: logs/red-1-g-not-implemented.txt (10 of 13 process-level tests fail with object_not_implemented; the 3 library-level tests were written against the already-present module and passed - stated, not hidden)
- [x] oracle additive input extension: `git.attributes`, `git.config` (native/oracle/src/main.rs); new oracle-generated fixture cases/git-hunks-2.json (22 cases)
- [x] helper: src/git/mod.rs (baseline identity/refresh, pinned DiffHandle), `g` arm (evaluate/textobjects.rs), session close/initialize hooks
- [x] tests/textobjects_git.rs (13 tests): green (`logs/final-green-textobjects_git.txt`)
- [x] full verification: crate plain/test-support, oracle, npm compile + strict npm test (166/166), keybindings, lock compare, check:helix-runtime, baseline hashes, mutation (`logs/mutation-ignore-trust.txt`, restored by hash)
- [x] README.md, file-hashes.txt

## Needs ratification
Changing `cargoLockSha256` (required by the task) invalidates the `reference.cargoLockSha256` identity embedded in every stored oracle `expected`
(652 of 674 cases failed the oracle gate: `logs/oracle-update-all-reference-identity.txt` shows the regeneration, the failing run is described in README).
I regenerated all fixtures with `npm run test:match:oracle -- --update`. Proof that ONLY that field changed: `logs/oracle-update-diff-proof.txt`
(652 differences, all `/reference/cargoLockSha256` old->new, 0 other). The existing expected values are therefore NOT byte-identical files;
every other value is identical. Pre-image hashes: `logs/fixtures-before-sha256.txt`. Revert = restore those files (the oracle gate then fails again).
