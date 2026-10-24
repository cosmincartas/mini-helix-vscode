# Task 5 evidence: packaged helper process lifecycle (MatchClient)

Plan Task 5 (FR-13, FR-14, NFR-3, NFR-5; failure model F-6, F-9). Entry point `src/native/matchClient.ts:MatchClient`.
Only `src/native/**`, `test/unit/matchClient.test.ts`, `test/unit/fixtures/matchClient/fakeHelper.ts` and this directory were added. No existing
file was modified (`src/extension.ts` is untouched: activation wiring is a later task). Logs are in `logs/`, hashes in `file-hashes.txt`.

## Files
- `src/native/protocol.ts`: protocol constants (version 1, 64 MiB frame limit, stall timeout, error codes, exit codes) and the typed
  request/response unions (`MatchMethods` method table, `RequestFrame`, `ResponseFrame`). Document-method rows are placeholders until Tasks 6-15.
- `src/native/framing.ts`: `FrameReader` (JSON Lines, bounded buffer, limit+1 rejected as soon as seen, never truncates), `encodeFrame`
  (refuses over-limit frames), `decodeResponse` (UTF-8 / JSON / envelope validation before use).
- `src/native/diagnostics.ts`: `DiagnosticsLog` (bounded ring; keeps only allow-listed fields with restricted values from JSON stderr records).
- `src/native/recovery.ts`: `RecoveryPolicy`.
- `src/native/helperPath.ts`: target ids, `detectTarget/detectHostTarget`, `resolveHelperLayout`, `readLockIdentity`.
- `src/native/matchClient.ts`: `MatchClient`, `MatchClientError`.

## API (not a public extension API)
`new MatchClient({ identity, target?, extensionRoot?, startupTimeoutMs?, requestTimeoutMs?, shutdownGraceMs?, maxFrameBytes?, diagnosticsLimitBytes?,
helperPath?/runtimeRoot?/helperArgsPrefix? (dev/test overrides, never from workspace settings) })`
- `ensureReady(): Promise<MatchReady>` explicit-action entry: returns `{epoch, initialize, restarted}`, starts a helper when none runs, coalesces concurrent calls,
  rejects `recovery_required` (no spawn) after a startup failure.
- `restart()`: explicit recovery; replaces any helper (pending -> `restarted`), clears the latch, starts a new one.
- `request(method, params, {timeoutMs?, expectedEpoch?})`: typed; epoch added by the client; `not_ready` when no helper is ready (it never starts one);
  `stale_epoch` (not sent) when `expectedEpoch` differs; `request_too_large` (not sent) over the frame limit.
- `shutdown()` (graceful, then kill after the grace period), `dispose()` (sync; reject pending, SIGKILL child, destroy pipes, drop listeners; idempotent).
- `state`, `epoch`, `pid` (last spawned), `diagnostics` (bounded sanitized records), `onDidStop(listener)`.
- `MatchClientError.kind`: `unavailable startup_failed process_exited timeout protocol_error remote_error recovery_required stale_epoch request_too_large
  invalid_request not_ready restarted stopped disposed spawn_failed`; plus `cause` (startup), `helperCode`, `detail`, `data`, `exitCode`, `signal`.
  Messages are client-owned fixed strings (no request/response/document text).

## Installed layout decision (for Task 21)
Per-target VSIX: `<extensionRoot>/native/<target>/mini-helix-match-helper[.exe]` and `<extensionRoot>/native/<target>/runtime/` (manifest.json, grammars/,
queries/, licenses/). `<target>` is one of the nine ids that are also the keys of `native/helix-lock.json` `targets`; `.exe` for `win32-*`. This equals the helper's
default runtime root (`<exe dir>/runtime`); the client passes `--runtime-root` explicitly anyway. The client also needs the expected identity (Helix revision,
runtime hash): `readLockIdentity(lockPath, target)` reads `native/helix-lock.json`; where the lock sits in the package is a Task 21 decision (the client takes the
identity as an option). `.vscodeignore` currently excludes `native/**`: Task 21 must include `native/<target>/**`. Host target: `detectHostTarget()` (musl check via
`process.report` glibc header plus `/lib/ld-musl-*`; Alpine detection is unverified on a real Alpine host: pending Task 21). Unsupported host or missing helper:
`unavailable` (F-9), nothing spawned, no throw from the constructor.

## Recovery policy (spec "Recovery")
- A helper exit/timeout/protocol error rejects every pending request (`process_exited|timeout|protocol_error`), kills the child, fires `onDidStop` once and leaves
  the client `exited`. Nothing restarts by itself and the failed request is never retried.
- The next `ensureReady()` (an explicit match action) may start exactly one new helper; `restarted: true` tells the caller to resynchronize snapshots; the epoch
  differs, and `request(..., {expectedEpoch: old})` is rejected without sending.
- A startup failure (spawn error, exit before initialize, helper error such as identity mismatch with exit 10, wrong identity echo, malformed initialize reply,
  startup timeout) latches: later `ensureReady()` calls reject `recovery_required` and spawn nothing until `restart()`. Conservative reading: the first
  startup failure latches too (startup verification is deterministic; retrying per keypress would repeat a 0.1-4 s verification failure).
- Helper error responses (`remote_error`) do not end the session. Malformed/oversized/non-object/invalid-UTF-8/wrong-epoch/unknown-id frames do (F-6, F-8).

## Decisions
- Controlled-fixture cases always run (34 tests, node-only fake helper `fakeHelper.ts`, driven through `helperPath=process.execPath` + `helperArgsPrefix`).
  Real-helper cases (4 tests) run when the built helper (newest of `native/target/{debug,release}/mini-helix-match-helper`, or `HELIX_MATCH_TEST_HELPER`) and runtime
  (`native/runtime/out/<host>/runtime`) exist; otherwise the suite is skipped with an explicit logged reason (`logs/skip-behaviour-when-helper-absent.txt`). Setting
  `HELIX_MATCH_REQUIRE_REAL_HELPER=1` turns that skip into a failure (used for the verification runs). The release binary on this host predates the Task 4 correction
  (mtime 04:48 vs 05:05), so the debug binary (initialize about 4.3 s) was used.
- No Rust/Helix algorithm in TypeScript; no sockets, no `net/http/dgram` imports, `shell: false` (`logs/network-and-spawn-evidence.txt`).
- Helper environment is an allow-list (`PATH SystemRoot windir TMPDIR TEMP TMP HOME USERPROFILE LANG LC_ALL`): no `HELIX_RUNTIME` or other overrides (F-10, tested).
  cwd is the helper's directory, never a workspace folder.
- Stderr: only allow-listed fields (`level event code detail file field` with `[A-Za-z0-9_.:/\-]{1,128}` values, any numeric field) of JSON-object lines are kept,
  bounded (default 8 KiB total, 4 KiB per line); everything else becomes a fixed marker. Tested with a misbehaving fake that echoes request text.
- Process cleanup is one path (`teardown`) shared by timeout, malformed frame, exit, restart, shutdown and dispose. No separate process manager.

## Verification (see logs/)
- RED `red-matchclient-test.txt`: `npm run compile` fails (no `src/native/**`), emitted test cannot load (`MODULE_NOT_FOUND`); exit 2 / 1 failing test file.
- GREEN `green-matchclient-test.txt`: `npm run compile && node --test out/test/unit/matchClient.test.js`: 38 pass, 0 fail, 0 skipped (34 fixture + 4 real helper, 23 s).
  Three consecutive runs with `HELIX_MATCH_REQUIRE_REAL_HELPER=1`: `flakiness-3-runs.txt`.
- `npm test` (`npm-test.txt`): 115 tests, 115 pass (77 baseline + 38). `check-keybindings.txt` exit 0. Baseline hashes (`baseline-hash-check.txt`): all unchanged except
  `package.json`, which differs because of the concurrent Task 3 worker (also recorded in Task 4), not this task.
- Mutation checks (`mutation-checks.txt`, applied to compiled `out/` only): latch disabled, no SIGKILL, no frame limit, full environment, `shell: true`, no epoch check, raw
  stderr passthrough: each makes at least one named test fail.
- Network/port (`network-and-spawn-evidence.txt`, plus assertion inside the real-helper test): the helper's only sockets are fd 0-2 (libuv stdio socketpairs, Unix
  domain); none of their inodes appears in tcp/tcp6/udp/udp6/raw/packet/netlink tables; `ss -tulnap` shows nothing for the pid; no network imports in `src/native`.
  Document-bearing diagnostics: a sentinel sent in request params to the real helper (answered `invalid_request/unsupported_method`) never appears in `client.diagnostics`.
- Real helper cases: initialize against the real runtime + identity + capabilities + no network sockets + typed error + graceful shutdown; wrong runtime hash -> startup
  failure with helper code `runtime_unavailable/identity_mismatch`, exit 10, then `recovery_required`; SIGSTOP + pending request + SIGKILL -> `process_exited` (signal SIGKILL),
  explicit `restart()` -> new epoch, stale epoch rejected; helper resolved through `<extensionRoot>/native/<target>/` (symlinks to the dev build).

## Deviations, limits, pending
- Linux x64 host only for the real helper; `win32-*`, `darwin-*`, `linux-arm*`, `alpine-*` real-helper behaviour (and Alpine/musl detection, `.exe` spawn, Windows kill semantics) are
  untested here: pending per-target verification (Task 21 / target matrix).
- The `/proc` socket check and SIGSTOP/SIGKILL case are Linux-only (the SIGKILL case skips on win32; the socket check runs only on linux).
- Request/response shapes for `open change snapshot configure evaluate continue cancel close` are placeholders (`Record<string, unknown>`) until the tasks implementing them
  define the typed fields; the helper currently answers them `invalid_request/unsupported_method`.
- `MatchService` (`evaluate/continue/cancel`) is not implemented here; it builds on `MatchClient.request` in later tasks. Activation wiring/disposal in `src/extension.ts` is pending
  (not touched). The duplicate-key frame edge VR4-1 is a helper concern; the client never emits duplicate keys (`JSON.stringify` of a fixed-key object).
- Lone surrogates in future document text are a Task 8+ (selection codec) concern; `JSON.stringify` escapes them.
- Request ids start at 1 per helper and are not renewed (2^53 requests per helper process is unreachable; restart resets).

## Correction (task #39: P5R-1..P5R-4)
Evidence: `correction/` (`matchClient-run1..3.txt`, `trigger-tests.txt`, `mutation-p5r1-*.txt`, `minimum-runtime-node18-detection.txt`, `npm-test.txt`, `check-keybindings.txt`, `baseline-check.txt`).
- P5R-1 (`src/native/helperPath.ts`): musl detection never resolves names on any supported runtime. `process.report.getReport()` is used only when the runtime really supports `excludeNetwork`
  (`typeof process.report.excludeNetwork === 'boolean'`), with it set to true around the call and the previous value restored in `finally`. Otherwise (Node 18.15 in VS Code 1.85.2, the supported minimum,
  where assigning the property does not disable reverse lookup or interface listing; see `supervisor-context/`) `getReport` is not called: the libc is read from `/proc/self/maps` (musl loader/libc vs glibc),
  then from the presence of `/lib/ld-musl-<arch>.so.1`. Nothing is assigned to `process.report` on an unsupported runtime. Tests (`host libc detection never resolves names`): with `excludeNetwork` supported,
  `getReport` runs once with it true and the setting is restored; with it unsupported, `getReport` is not called, detection still returns the host target and no property is left behind. With the guard removed
  from the compiled output the unsupported-runtime test fails (`mutation-p5r1-unconditional-getReport.txt`; the earlier `mutation-p5r1-excludeNetwork-removed.txt` covers the supported path).
  Minimum-runtime check (`minimum-runtime-node18-detection.txt`): VS Code 1.85.2 binary with `ELECTRON_RUN_AS_NODE=1 --ms-enable-electron-run-as-node`, Node v18.15.0, a live loopback TCP connection open:
  `detectedTarget: linux-x64`, `getReportCalls: 0`, `excludeNetwork` still undefined afterwards (only those fields are printed). The host Node 26 run shows the supported path (`getReportCalls: 1`).
- P5R-2 (`src/native/recovery.ts`, `matchClient.ts`): `RecoveryPolicy` tracks "failed since last success" (`recordHelperFailure` from `teardown` for an unexpected end of a ready helper; `recordStartupFailure`).
  A startup failure latches `recovery_required` only when an earlier failure (exit or startup failure) precedes it. Tests: `allows one new start after a first startup failure, then stops until an explicit
  restart` (start 1 fails, `ensureReady` spawns once more, that fails, then `recovery_required` without spawning, `restart()` spawns), `recovers on the next explicit action when only the first startup failed`,
  the unchanged crash-then-fail test, and the real-helper identity test (second start allowed, third refused with the same pid).
- P5R-3 (`src/native/protocol.ts`): `STARTUP_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`, `SHUTDOWN_GRACE_MS`, `STARTUP_ERROR_CLOSE_WAIT_MS` next to `MAX_FRAME_BYTES`; `matchClient.ts` and its doc comments reference them; no inline timeout literals remain.
- P5R-4 (`matchClient.ts`): the `shutdown` request has no timer of its own (`Pending.timer` optional); the grace timer governs; `shutdown()` no longer overwrites the state after teardown. Fake mode `hang-shutdown`
  ignores `shutdown` and `open`. Test `kills a helper that ignores shutdown after the grace period...` (`shutdownGraceMs: 150`): child gone, state `stopped`, exactly one stop event of kind `stopped`, in-flight
  `open` rejected with `stopped`, elapsed time governed by the grace period, repeat `shutdown()` idempotent.
- Verification: `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 node --test out/test/unit/matchClient.test.js` three times (41 pass, 0 fail, 0 skipped each); `npm test` 118 pass; `npm run check:keybindings` exit 0.
- Baseline: only `package.json` differs from the baseline hashes, as before this correction (concurrent Task 3 work; not touched here). No helper processes left behind.
