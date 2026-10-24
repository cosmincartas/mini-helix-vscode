# Task 6 status (document replica synchronization) - worker #40

DONE (final verification complete).

- [x] RED archived: logs/red-matchsync-test.txt (observed against the pre-Task-6 release helper; see README "RED")
- [x] helper: native/match-helper/src/documents/{mod,text,language}.rs; open/change/snapshot/configure/close in protocol/session.rs; evaluate/continue/cancel still unsupported
- [x] gated test observation: cargo feature `test-support` + bin `mini-helix-match-helper-test` + per-session enable; production binary has no such code (strings check)
- [x] client: src/native/documents.ts (DocumentSync), MatchClient.documents/requestTyped/readyNow, typed shapes in protocol.ts
- [x] test/unit/matchSync.test.ts: 18 tests, strict real helper, 0 skipped (first green run after fixing 3 test-fixture bugs)
- [x] cargo tests (plain 8+25+4 pass; --features test-support adds documents.rs 6 pass)
- [x] lock: Cargo.lock/helix-lock.json byte-identical; compare-cargo-lock 0 deviations; check:helix-runtime OK (hash fd5ee12c...ffbea2b)
- [x] npm test 137/137, check:keybindings exit 0, baseline: only package.json differs (pre-existing, not touched)
- [x] mutation checks logs/mutation-checks.txt (one gap found: client retention masked helper stickiness; direct-snapshot assertion added, now killed)
- [x] latency measured (logs/latency-release.json)
- [x] README.md, file-hashes.txt, final full re-run (3x matchSync 18/18, cargo plain+test-support, npm test 137/137, keybindings, check:helix-runtime, lock compare)
