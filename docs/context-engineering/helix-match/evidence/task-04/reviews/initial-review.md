# Task 4 Initial Review (Claude Code reviewer, task #33)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #32 (delta vs `/tmp/helix-match-implementation-khd3bwgf/snapshots/pre-task03-04/tree.tar`).
Orchestrator filter: P4R-1 and P4R-2 accepted (grounded in spec L405-407). Non-findings not accepted.

## Verdict

Approve with two P3 findings and no blockers.

## Findings

| ID | Sev | Location | Summary |
|---|---|---|---|
| P4R-1 | P3 | `native/match-helper/src/protocol/envelope.rs:91-111` | Unknown `protocolVersion` does not end the session when `requestId` is missing or invalid |
| P4R-2 | P3 | `native/match-helper/src/protocol/session.rs:99-108` (with `:129-141`) | Error responses return the helper's epoch instead of echoing the request's `helperEpoch` |

P4R-1: after `initialize`, `{"protocolVersion":2,"id":"a","method":"initialize"}` or `{"protocolVersion":2,"requestId":"abc",...}` returns non-fatal `missing_field`/`invalid_field` for `requestId` (early return at L92/L93) and never reaches the fatal `unsupported_protocol_version` branch (L101-107); the process keeps serving.
Tests cover only a wrong version with a valid `requestId`.
Basis: spec L407 "An unknown protocol version ... terminates match availability for that session."
Suggested fix: check `protocol_version` before `request_id`; add a process test for version 2 with missing/string `requestId`.

P4R-2: `error_reply` always encodes `self.epoch()`; a stale-epoch request (`ep+1`) got the helper's own epoch back with `resync_required/helper_epoch_mismatch`; before initialization a request with `helperEpoch: 5` gets `"helperEpoch":null` (asserted at `tests/protocol.rs:~578`).
Basis: spec L405-406 "Every response echoes them"; F-1 relies on epoch matching.
Suggested fix: echo the request's parsed `helperEpoch`; put the actual epoch in `error.data`; update the test assertion.

## Coverage by acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED process-level `initialize` tests | Met | `evidence/task-04/logs/red-protocol-test.txt` (21/22 failing on stub) |
| JSON Lines framing | Met | `frame.rs`; 3-piece fragmented frame; CRLF shutdown exit 0 |
| Request identity / envelope echo | Partly met | P4R-2 |
| Handshake and termination on mismatch | Partly met | `session.rs:154-204`, exit 10; P4R-1 |
| Runtime verified before use; no grammar load on failure | Met | `verify_runtime` before identity checks; corrupted-runtime test |
| Stable error codes (spec L447) | Met | `ErrorCode::ALL` verbatim |
| Bounded buffers, no truncation | Met | `frame.rs:42,53`; 200 MiB oversize stream peak ~72 MB; exact 64 MiB accepted; next frame intact |
| Policy declared once | Met | `protocol::POLICY`, capabilities, `constants.json` |
| Constants and fixtures under one check (spec L546) | Met | constants/fixtures test and real-runtime round trip |
| stdout frames only; stderr sanitized | Met | single writer; fixed-field stderr; serde text not forwarded; panic hook location only |
| Shutdown/EOF/stall/closed stdout; no hangs or leaks | Met | exit 0/11/12/13; `pgrep` clean |
| REFACTOR one validation boundary | Met | `envelope::parse` → `Request::parse` → `ProtocolError` |
| `protocol` test target | Met | `tests/protocol.rs` |

## Checks run

- `cargo +1.90.0 test --locked --manifest-path native/Cargo.toml -p mini-helix-match-helper --test protocol`: 22 passed (10.01 s); no leftover `serve` processes.
- Whole crate: `protocol` 22/22, `runtime_isolation` 4/4. `cargo +1.90.0 build --locked`: ok (existing helix-loader warning).
- `compare-cargo-lock.cjs`: no deviations. `npm run check:helix-runtime`: OK. `npm test`: 77/77.
- Manual probes: fragmented frame, invalid UTF-8, sentinel in unknown field/method, stale/missing epoch, version 2 with bad id, string version, array frame, duplicate key, array params, 5000-deep nesting, EOF mid-frame, 200 MiB oversize stream, exact 64 MiB frame, EOF on 64 MiB partial, closed stdout, CRLF; sentinel never surfaced.
- Integrity: spec/plan hashes frozen; `evidence/task-04/file-hashes.txt` OK; only `package.json` differs from baseline (Task 2 scripts + Task 3 oracle script); `native/Cargo.*` unchanged.

## Attribution and scope

Changed `native/match-helper/Cargo.toml` (serde_json `raw_value`), `src/lib.rs`, `src/main.rs`; new `src/protocol/*`, `tests/protocol.rs`, 9 fixtures, `evidence/task-04/**`. All in scope.

## Coverage limits

Linux only; panic path read, not triggered; RED state not re-run; concurrent Task 3 work not reviewed.

## Non-findings (not accepted)

Unsupported-version reply reports `protocolVersion: 1` (deliberate; `data.supported`); panic reply loses `requestId` (no reachable input); Unicode `trim_start`; 64 MiB limit may reject heavily escaped ~50 MiB documents explicitly; `shutdown` before `initialize` and epoch mismatch → `resync_required` are unconstrained choices; document-level methods deferred.
