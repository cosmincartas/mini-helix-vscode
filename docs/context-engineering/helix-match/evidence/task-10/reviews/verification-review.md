# Task 10 Verification Review (Claude Code reviewer, task #49)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after the single correction batch (task #50); bounded to P10R-1..P10R-3 and correction regressions.
Inputs: [initial review](initial-review.md); snapshot `snapshots/post-task10/precorrection.tar`; delta `snapshots/task10-correction-delta.md`.

## Verdict

Accept. All three IDs resolved; no correction regressions; no later findings.

## Per-ID status

- P10R-1 resolved. Single declaration `protocol::POLICY.diff_settle_timeout` (15 s); `git/mod.rs` reads it; `constants.json` `diffSettleTimeoutMs: 15000` asserted against `POLICY` in `tests/protocol.rs`. Deterministic failure-path test `a_diff_that_is_not_published_in_time_fails_with_diff_timeout_and_the_session_continues` (elapsed ≥ 50 ms; stable non-terminating `internal_error/diff_timeout`; no document or HEAD text; session replays oracle case afterwards). Hook gated by `test-support` and session flag; production debug binary contains `test_set_diff_settle` and `withholdPublication` 0 times. `session.rs` edit only registers the gated test method (not a finding).
- P10R-2 resolved. Schema `git` object (still rejecting unknown keys) allows optional string `attributes`/`config`; README L38 documents them. `jq` checks: `git-hunks-2.json` uses only allowed keys with string values; `git-hunks.json` uses head/path/trust; no other `git` objects; no case file changed vs snapshot.
- P10R-3 resolved. Optional `baselineIdentity` (`deny_unknown_fields`) only for Git-object requests (else `invalid_request/baseline_identity_not_applicable`); mismatch `resync_required/baseline_identity_mismatch` with `{field}`; stale token `resync_required/baseline_identity_stale` with current SHA-256 token; `git.refresh` still precedes each Git-object evaluation; `git.handle()` equivalent to previous return; HEAD move refreshes and rejects stale token; untitled → `null` token; requests without the field unchanged; README Correction section explains spec L419/L523; spec/plan hashes frozen.

## Later findings

None. Non-findings: "no contract change" wording acceptable (optional additions); post-timeout cache reuse not exercised directly; token covers converted baseline bytes but not conversion config (predates correction).

## Separate observation

`test/fixtures/helix-match/cases/selection-identity.json` (Task 7): tag `selection-identity` not in the schema tag list (only `quirk`, `quirk-control`) and 28 cases with empty `steps`; identical in `post-task07`, `pre-task10` snapshots and now — predates this correction; not a Task 10 finding (escalated by the orchestrator as a Task 7 miss).

## Checks run (each once)

- `cargo +1.90.0 test --locked … -p mini-helix-match-helper`: 78 tests (protocol 25, textobjects_git 14); with `test-support`: protocol 25, textobjects_git 15, textobjects_syntax 10.
- Helper and test-helper builds up to date; strings probe as above.
- `npm run test:match:oracle` OK; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `check:helix-runtime` OK (`fd5ee12c…ffbea2b`); `compare-cargo-lock.cjs` no deviations.
- File-by-file comparison with pre-correction snapshot: exactly the 13 delta files differ; `envelope.rs`, `matchClient.ts`, `documents.ts` hashes equal `pre-task10`; spec/plan frozen.

## Coverage and limits

No full schema validator run (no repository command; `jq` checks + worker ajv log); production probe via strings, not live `serve`; Linux only.
