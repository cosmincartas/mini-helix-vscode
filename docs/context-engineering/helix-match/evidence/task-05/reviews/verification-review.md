# Task 5 Verification Review (Claude Code reviewer, task #38)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after the single correction batch (task #39, including its same-batch continuation for the Node 18.15 minimum runtime).
Inputs: [initial review](initial-review.md); snapshot `snapshots/post-task05/precorrection.tar`; delta `snapshots/task05-correction-delta.md` (excludes `reviews/` and supervisor-authored `supervisor-context/`).
An earlier dispatch of this review was interrupted by the supervisor before producing any result.

## Verdict

Fail (narrow). P5R-1..P5R-4 verified fixed; one P3 correction-caused regression (VR5-1), escalated by the orchestrator because the single correction allowance is consumed.

## Per-ID status

- P5R-1 verified. `helperPath.ts:58-77` calls `getReport()` only when `typeof process.report.excludeNetwork === 'boolean'` (set true, restored in `finally`); otherwise `/proc/self/maps`, then `/lib/ld-musl-<arch>.so.1`. Probes with a live loopback TCP pair and wrapped `getReport`:

| Runtime | Target | `getReport` calls | Reverse-resolved | `excludeNetwork` before / after |
|---|---|---|---|---|
| Host Node v26.8.2 | linux-x64 | 1 (flag true) | no (`127.0.0.1`, no interface list) | false / false |
| VS Code 1.85.2, Node v18.15.0 | linux-x64 | 0 | n/a | absent / absent |
| VS Code 1.143.1, Node v24.21.0 | linux-x64 | 1 (flag true) | no | false / false |

  Control: direct `getReport()` returns `localhost` on Node 26 and Node 18. No other network-capable path in `src/native/`.
- P5R-2 verified. `recovery.ts:11-39` latches only after an earlier failure; `teardown` records unexpected ends (`matchClient.ts:511`). `fail-startup:2`: `startup_failed`, `startup_failed`, `recovery_required`; `restart()` → start 3 `ready`. `crash-then-fail`: `startup_failed` then `recovery_required` ×3, start count 2. Real-helper identity test passes.
- P5R-3 verified. Named constants in `protocol.ts`; no timeout literals in `src/native/*.ts`; `setTimeout` at `matchClient.ts:235,427,479` use constants/options.
- P5R-4 verified. `hang-shutdown` + in-flight `open`: grace 0 / 150 / -5 → `stopped`, one `stopped` event, pending rejects `stopped`, child gone (1 / 151 / 2 ms). Normal shutdown 14 ms `stopped`; dead-helper shutdown keeps `exited`, no extra event. No hang possible.

## Later findings

### VR5-1 [P3] `shutdown()` during startup leaves state `starting` (origin: correction-caused)

- Location: `src/native/matchClient.ts:228-247, 512-515`.
- Trigger: `shutdown()` while the handshake is in flight (e.g. deactivation during the first match action). `hang-init` probe: state `starting` before, `ensureReady` rejects `stopped`, state still `starting` after; no helper running.
- Cause: the correction removed the trailing `this.clientState = 'stopped'` from `shutdown()`; `teardown` updates state only when `wasReady`; the handshake `catch` rethrows without setting state. Contradicts the new doc comment at `:225` ("the outcome is always the same: state `stopped`").
- Impact: public `state` misreports until the next `ensureReady`; nothing outside `src/native` reads it yet.
- Basis: spec L634 (shutdown releases resources; consistent lifecycle) and the correction's own documented contract; demonstrable regression versus the pre-correction behaviour.
- Suggested fix: in `teardown`, `if (wasReady || error.kind === 'stopped') this.clientState = error.kind === 'stopped' ? 'stopped' : 'exited';` plus a `hang-init` shutdown test.

## Checks run

- `npm run compile` exit 0; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 node --test out/test/unit/matchClient.test.js` ×2: 42/42.
- `npm test` 119/119; `npm run check:keybindings` exit 0.
- DNS probes on Node 26, VS Code 1.85.2, VS Code 1.143.1, plus control; shutdown/recovery probes against the fake helper; no leftover processes.
- Scope: only `src/native/{helperPath,matchClient,protocol,recovery}.ts`, `test/unit/matchClient.test.ts`, `test/unit/fixtures/matchClient/fakeHelper.ts`, `evidence/task-05/{README.md,file-hashes.txt,correction/*}` changed.
- `evidence/task-05/file-hashes.txt` verified; spec/plan hashes frozen; baseline only `package.json` (earlier tasks' scripts).

## Coverage and limits

Linux x64 only; no `strace`; musl and `/proc/self/maps` on Alpine untested; worker mutation runs not repeated.
