# Task 4 Verification Review (Claude Code reviewer, task #33)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after correction task #34; bounded to P4R-1, P4R-2, and correction regressions.
Inputs: [initial review](initial-review.md); snapshot `snapshots/post-task04/tree.tar`; delta `snapshots/task04-correction-delta.md`.

## Verdict

Fail (narrow). P4R-1 and P4R-2 verified; one P3 correction-caused regression (VR4-1), escalated by the orchestrator because the single correction allowance is consumed.

## Per-ID status

- P4R-1 verified: after `initialize`, `{"protocolVersion":2,"id":"a",...}` and `requestId:"abc"` → fatal `unsupported_protocol_version`, `requestId:null`, epoch echoed, `data.supported:1`, exit 10; valid id 7 echoed, exit 10; before `initialize` (`helperEpoch:5`) echoed, exit 10.
- P4R-2 verified: stale epoch E+1 → `resync_required`/`helper_epoch_mismatch` echoing E+1 with `data:{"actual":E}`; session continues; shutdown with E exits 0. Pre-init `helperEpoch:5` echoed with `data:{"actual":null,"field":"helperEpoch"}`.

## Later findings

### VR4-1 [P3] Duplicate fields in a version-2 frame are no longer fatal (origin: correction-caused regression, plus related Initial-review miss)

- Location: `native/match-helper/src/protocol/envelope.rs:31-39` (`Probe`) and `:88`.
- Trigger: after `initialize`, `{"protocolVersion":2,"requestId":8,"helperEpoch":5,"helperEpoch":5,"method":"x"}` → non-fatal `invalid_envelope` with `requestId:null`, `helperEpoch:null`; session continues; a later v1 `shutdown` exits 0.
- Cause: the correction added `helper_epoch` to the derived `Probe`; serde derive rejects a repeated known field, so `Probe` fails before the version check. Before the correction `helperEpoch` was unknown to `Probe` and duplicates were not checked (inferred from snapshot source; old binary not run).
- Side effect: v1 frame with duplicated `helperEpoch` no longer echoes a valid `requestId`.
- Related miss (b): duplicated `requestId`/`protocolVersion` in a version-2 frame was already non-fatal before the correction; the Initial review did not probe duplicates with an unknown version.
- Basis: spec L407 (unknown protocol version terminates the session).
- Suggested fix: make the first pass duplicate-tolerant (e.g. probe into a map of raw values) and run the version check from it; leave duplicate rejection to the strict pass; add a version-2 duplicate-field test.

Non-findings: `helperEpoch:0` before initialize returns null (documented rule); reordering only changes which non-fatal error a frame missing both fields gets; non-integer versions remain non-fatal `invalid_field`.

## Checks run

- Spec hash frozen; delta matches snapshot (`envelope.rs`, `session.rs`, `tests/protocol.rs` changed).
- `cargo +1.90.0 build --locked ... -p mini-helix-match-helper` ok; process replays via coproc and `printf | serve`; success responses unchanged.
- `cargo +1.90.0 test --locked ... -p mini-helix-match-helper`: protocol 25/25 (incl. constants/fixtures compatibility, fixture termination, real-runtime round trip), runtime_isolation 4/4.
- `npm test` 77/77; `native/Cargo.lock` unchanged; no leftover `serve` processes.

## Coverage and limits

Correction delta and regressions only; pre-correction duplicate behaviour inferred from source; Linux only; concurrent Task 3 work not reviewed.
