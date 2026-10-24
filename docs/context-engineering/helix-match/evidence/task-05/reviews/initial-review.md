# Task 5 Initial Review (Claude Code reviewer, task #38)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #37 (plan Task 5); snapshots `pre-task05` → `post-task05`.
Orchestrator filter: P5R-1..P5R-4 accepted (NFR-3/NFR-5 and plan Task 5 verification; spec Recovery L630-633; spec L405). Non-findings not accepted.

## Verdict

Changes requested: two P2, two P3. All checks run pass (38/38 strict, `npm test` 115/115, keybindings, baseline).

## Findings

| ID | Sev | Location | Title |
|---|---|---|---|
| P5R-1 | P2 | `src/native/helperPath.ts:39-49` (L42), via `src/native/matchClient.ts:261` | Host-target detection triggers reverse DNS lookups that block the event loop |
| P5R-2 | P2 | `src/native/recovery.ts:6-18`, `src/native/matchClient.ts:193,270,313`, `test/unit/matchClient.test.ts:384-400` | First startup failure blocks match actions until `restart()` |
| P5R-3 | P3 | `src/native/matchClient.ts:213,222,224,281,301` vs `src/native/protocol.ts:3-4` | Timeout policy not declared in one place |
| P5R-4 | P3 | `src/native/matchClient.ts:217-237`, `test/unit/matchClient.test.ts` | Shutdown-grace timeout path untested |

P5R-1: without `options.target`, `handshake` → `detectHostTarget()` → `isMuslHost()` calls `process.report.getReport()` with default settings, which performs reverse DNS for libuv endpoints (Node report docs: `--report-exclude-network` disables them).
Verified on Node v26.8.2: loopback TCP pair resolved to `"host":"localhost"`; with `process.report.excludeNetwork = true` it returned `"127.0.0.1"`.
In an extension host with other TCP connections this issues PTR lookups synchronously on the extension-host thread. No test covers it (all pass explicit `target`).
Basis: NFR-3 (no network requests; spec L681), NFR-5, plan Task 5 "Confirm ... no runtime network request".
Suggested fix: set `process.report.excludeNetwork = true` around `getReport()` (restore in `finally`) or avoid `getReport()`.

P5R-2: first `ensureReady()` failure → `recordStartupFailure()` latches; later `ensureReady()` rejects `recovery_required` without spawning until `restart()`; test `:384-389` locks it in.
Basis: spec L630-633 "The next explicit match action may start one new helper ... Disable repeated automatic restart attempts after another startup failure until an explicit action requests recovery." `recovery.ts:6-7` documents a stricter reading, changing the frozen contract; user rule forbids quiet contract changes.
Consequence: one transient first-start failure disables match support until an explicit recovery action that does not yet exist.
Suggested fix: latch only on a startup failure following an earlier failure (crash/exit or earlier startup failure); update the test to expect a second start from the next `ensureReady()` and `recovery_required` only after that.

P5R-3: spec L405 "declare frame limits and timeout policy in one place"; `protocol.ts:3-4` claims so, but defaults are inline literals in `matchClient.ts` (`30_000` L213/L281, `2000` L222/L224, `1000` L301) and repeated in doc comments L77-82.
Suggested fix: named constants in `protocol.ts` referenced by `matchClient.ts`.

P5R-4: no fake mode ignores `shutdown` (`fakeHelper.ts:69-73`); no test sets `shutdownGraceMs`.
Untested behaviour: the shutdown request timer (`:222`) fires before the grace timer (`:224`), so `teardown` runs with `timeout` (state `exited`, `onDidStop` kind `timeout`, in-flight requests reject `timeout`) before state is overwritten with `stopped` (`:236`).
Basis: spec L405 "test their failure paths"; plan GREEN timeouts and child disposal.
Suggested fix: fake mode ignoring `shutdown`; test with small `shutdownGraceMs` asserting child gone, final state `stopped`, intended stop-event kind.

## Coverage per acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED tests (handshake failure, exit, pending rejection, restart) | Met | tests `:160-208`, `:296-313`, `:315-324`, `:363-420`; RED log |
| Resolve under installed root | Met (Linux) | `helperPath.ts:68-75`; symlinked-layout test `:653-666` |
| Spawn without shell | Met | `shell:false` `matchClient.ts:348`; hostile-path test |
| Env allow-list, no `HELIX_RUNTIME` | Met | `:115,340-344`; test `:232-243` |
| Epoch tracking / stale rejection | Met | `:442-452`; `expectedEpoch` `:210` |
| Typed unions; one compatibility check | Met | `protocol.ts:62-114`; constants/fixture test `:115-137` |
| Frame bound before buffering; no truncation | Met | `framing.ts:27,46` |
| Timeouts | Partly met | P5R-3, P5R-4 |
| Pending rejection on exit/timeout/protocol error | Met | single `teardown` `:479-511` |
| Bounded, sanitized stderr | Met | `diagnostics.ts`; sentinel tests |
| Recovery policy | Deviates | P5R-2 |
| Dispose listeners/pipes/child, idempotent | Met | `:240-246,488-497`; handle-count test |
| Shared cleanup, no framework | Met | one `teardown` |
| No listening port or network | Partly met | helper: no sockets; client: P5R-1 |
| No document-bearing diagnostics | Met | sentinel tests; manual stderr check |
| Baseline preserved | Met | no existing file changed |

## Checks run

- `cargo +1.90.0 build --locked ... -p mini-helix-match-helper`: up to date.
- `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 node --test out/test/unit/matchClient.test.js`: 38/38, 0 skipped (24.3 s).
- `npm test` 115/115; `npm run check:keybindings` exit 0; baseline hashes (only `package.json`, unchanged by this task).
- Manual real-helper run: `/proc/<pid>/fd` no sockets; `ss -tulnapx` no entry; sentinel absent from stderr; source grep for network APIs empty.
- `node -e` reverse-DNS demonstration (P5R-1).

## Coverage limits

Linux x64 only; no `strace`; worker mutation runs not repeated.

## Non-findings (not accepted)

Real-helper skip with logged reason and strict mode; newest-binary selection; path layout / `.vscodeignore` (Task 21); error messages include helper `detail`/`data` (fixed codes only today); no epoch uniqueness check; stderr partial line across sessions; `ensureReady()` during `shutdown()` race (later wiring); F-1 test does not send a late old response; `HOME` in env allow-list; deferred document methods, MatchService, activation, VR4-1.
