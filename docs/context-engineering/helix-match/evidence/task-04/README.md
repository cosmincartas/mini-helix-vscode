# Task 4 evidence: validated helper protocol

Plan Task 4 (FR-12, FR-13, FR-14, NFR-1, NFR-3; failure model F-1, F-6, F-8). Entry point: `mini-helix-match-helper serve [--runtime-root DIR]`
(default root `<exe dir>/runtime`), dispatcher in `native/match-helper/src/protocol/`. No TypeScript change. `native/Cargo.lock` and
`native/helix-lock.json` are unchanged (the only Cargo change is the `raw_value` feature of the already locked `serde_json`).

Archived logs are in `logs/` (`.txt`). File hashes: `file-hashes.txt`.

## Protocol summary (version 1)

Transport: UTF-8 JSON Lines. One frame = one JSON object + one `\n` (embedded newlines are JSON-escaped). Stdout carries protocol frames only;
stderr carries one-line JSON records with fixed fields (`level`, `event`, `code`, `detail`, numbers), never request or document text.

Request envelope: `{"protocolVersion":1,"requestId":<int 0..2^53-1>,"helperEpoch":<int>,"method":"...","params":{...}}`.
`params` is optional (an object when present); `null` counts as absent. Unknown or duplicate top-level fields are rejected. `method` is
`[A-Za-z0-9_]{1,64}`. The envelope's `protocolVersion` is the single carrier of the protocol version (the spec's `initialize` "protocol version"
field); `initialize.params` carries the other three expected values.

Response: `{"protocolVersion":1,"requestId":<id|null>,"helperEpoch":<epoch|null>,"ok":true,"result":{...}}` or
`...,"ok":false,"error":{"code","detail","message","data?"}`. `code` is one of the six stable codes; `detail` is a stable machine string;
`message` is fixed human text (not contractual); `data` holds field names, limits and helper-owned values only. A response always carries the
helper's own `protocolVersion` (also when rejecting another version). `requestId` is `null` when the frame had no readable, unambiguous id.

`helperEpoch`: absent before initialization (a present value is `invalid_field`); assigned by the helper in the `initialize` response (nonzero,
at most 2^53-1, different per helper start); required and checked on every later request (`missing_field`, or `resync_required` /
`helper_epoch_mismatch` for a different helper instance).

| Method | Status |
|---|---|
| `initialize` | implemented. Params `{expectedHelixRevision, expectedRuntimeHash, target}` (target id such as `linux-x64`). Order: revision vs compiled pin (no I/O) -> isolate runtime root -> full static runtime verification (`verify_runtime`, no grammar library is ever loaded) -> manifest revision, runtime hash, target. Result: `helperVersion, helixRevision, compatibilityIdentity, runtimeHash, target, targetTriple, capabilities{methods, limits{maxFrameBytes, partialFrameStallTimeoutMs}}` |
| `shutdown` | implemented. No params (or `{}`); replies `{}` then exits 0; allowed before `initialize`; later frames in the same write are not processed |
| `open change snapshot configure evaluate continue cancel close` | NOT implemented (Tasks 6, 8-15). They (and any unknown name) return `invalid_request` / `unsupported_method`, session continues; before `initialize` they return `invalid_request` / `not_initialized`. `capabilities.methods` lists what is implemented. Adding a method = one `METHODS` row, one `Request` variant, one parse arm, one handler arm; envelope/framing/errors do not change |

Error codes (spec set): `resync_required`, `stale_continuation`, `invalid_request`, `unsupported_text`, `runtime_unavailable`, `internal_error`.
Details used now: `invalid_request`: `empty_frame invalid_utf8 malformed_json invalid_envelope missing_field invalid_field invalid_params
unsupported_method not_initialized already_initialized unsupported_protocol_version frame_too_large frame_timeout unterminated_frame`;
`runtime_unavailable`: `identity_mismatch` (data `field` in `helix_revision|runtime_hash|target`, `actual`), `runtime_root_unavailable`,
`runtime_verification_failed` (data: finding classes and runtime-relative paths, at most 16, no hashes/contents); `resync_required`:
`helper_epoch_mismatch`; `internal_error`: `internal_failure`. `unsupported_text` and `stale_continuation` are reserved for document tasks.

Session termination (the spec's "terminates match availability for that session"): the helper sends the error, then exits 10, for unknown
protocol version, identity mismatch, runtime unavailable. Malformed requests, unknown methods, wrong epoch, oversize frames do not end the session.

Frame and timeout policy, declared once in `protocol::POLICY` (mirrored in `tests/fixtures/protocol/constants.json`):
- `max_frame_bytes` = 64 MiB (excluding the newline). A frame of exactly that size is accepted. One byte more: `frame_too_large` is sent as soon as the
  limit is crossed, the whole line is then skipped without buffering (memory bounded), nothing truncated is ever processed, the session continues.
  If stdin ends during the skipped line the helper exits 11 (the oversize error is not repeated).
- `partial_frame_stall_timeout` = 10 s without any byte while a frame is incomplete: `frame_timeout`, exit 12. Idle time between frames is not
  limited (the parent owns lifetime; closing stdin ends the helper). The total transfer time of a big frame is not limited, only a stall.
- `read_chunk_bytes` = 64 KiB, channel depth 2.
- Structure is validated before allocation: UTF-8 check on the borrowed frame, first pass (`protocolVersion`, `requestId`) tolerant of unknown
  fields, second strict pass with `params` kept as an unparsed borrowed `RawValue`; `method` is length-checked before it is parsed. serde error
  text is never forwarded (it can quote input).
- Exit codes: 0 shutdown or EOF on a frame boundary; 10 protocol-fatal; 11 EOF mid-frame (the partial frame is never executed, an
  `unterminated_frame` error is attempted); 12 stall; 13 stdin/stdout I/O failure; 14 internal (panic in the dispatcher, reported as `internal_error`;
  the panic hook prints file and line only).

## Verification

Commands run from the worktree root; outputs in `logs/`.
- RED (`logs/red-protocol-test.txt`): `tests/protocol.rs` against a constants-only stub (no `serve` subcommand): 21 failed, 1 passed (the constants
  check). Helper stderr: `{"error":"unknown command serve"}`.
- GREEN (`logs/green-protocol-test.txt`): `cargo +1.90.0 test --locked --manifest-path native/Cargo.toml -p mini-helix-match-helper --test protocol`:
  22 passed (10 s, dominated by the declared stall timeout test). Run three times without a failure; no `serve` process left behind.
- All crate tests (`logs/cargo-test-all-match-helper.txt`): protocol 22 + runtime_isolation 4 pass. `logs/cargo-build-locked.txt`: `cargo build --locked` ok.
- `logs/compare-cargo-lock.txt`: `"deviations": []` (only `mini-helix-match-helper@0.0.0` path package added, as before).
- `logs/check-helix-runtime.txt`: `check:helix-runtime OK for linux-x64`, runtimeHash `fd5ee12c...ffbea2b` unchanged.
- `logs/npm-test.txt`: 77 tests, 77 pass.
- Mutation check of the no-library-load test: calling `load_selected_grammars` in `initialize` before verification made
  `corrupted_runtime_is_runtime_unavailable_and_no_library_is_loaded` fail with "initialize must not load grammar libraries" (reverted).
- Measurements (`logs/measure-initialize-and-frames.txt`, warm page cache, 24 CPU Linux x86_64): `initialize` on the real 255 MB / 1799-asset runtime
  0.144 s with the release binary (4.3 s with the unoptimized debug binary); warm unsupported-method round trip 0.1 ms; a 64 MiB frame answered in
  0.052 s (release); helper peak RSS about 70 MiB with that frame.

Test cases in `native/match-helper/tests/protocol.rs` (all spawn the real binary; per-test bounded waits, kill-on-drop, `/proc` child check):
fixtures + constants as one compatibility check, round trip of the fixtures with the real runtime and lock values; valid initialize (identity echo,
capabilities, epoch range); wrong protocolVersion (0, 2, 4e9; also after initialize); wrong revision / runtime hash / target; corrupted, missing-manifest,
missing-root and tampered runtimes (synthetic with a marker `.so` proving no library load) and a hard-linked scratch copy of the real runtime with a corrupted
and then a deleted grammar; requests before initialize; 21 envelope violations; initialize params validation, second initialize; unknown / unimplemented
methods; byte-at-a-time and mid-UTF-8 / mid-key fragmentation; several frames in one write and nothing processed after shutdown; malformed JSON, invalid
UTF-8, empty frame, arrays/strings as frames; oversize (limit+1 rejected whole then next frame served; exactly limit accepted); EOF mid-frame (a complete
but unterminated `shutdown` is not executed); EOF after oversize; clean EOF; stalled partial frame; shutdown with stdin open; sentinel text in 10 request
shapes never appears on stdout or stderr and stderr lines are JSON records.

## Deviations, limits, pending

- The test target needs the built runtime (`npm run build:match`) and a C compiler (marker library); it fails with an explicit message otherwise.
- Process-level test for a stalled frame takes the real 10 s policy (no environment override exists by design: policy is declared in one place).
- The Task 2 reviewer's note is honoured for `initialize` (no library is loaded; verification happens first). `resolve-report` is unchanged.
- Shutdown before `initialize` is allowed (not specified); `helperEpoch` mismatch maps to `resync_required` (not specified; closest stable code).
- A blocked stdout (client not reading) blocks the helper's writes; the client owns draining stdout and killing the helper (spec: never roll back).
- Windows/macOS behaviour of the process tests was not run (Linux host only); the `/proc` child check is Linux-only.
- `package.json` differs from the baseline hash because of the concurrent Task 3 worker, not this task.

## Correction (task 34: P4R-1, P4R-2)

- P4R-1: `envelope::parse` now checks `protocolVersion` before `requestId`. Any integer version other than 1 (including negative) is the fatal
  `unsupported_protocol_version` (exit 10) even when `requestId` is missing or not a safe integer; `requestId` is echoed only when readable. A
  non-integer version (`2.5`, `"1"`) stays a non-fatal `invalid_field`.
- P4R-2: error responses echo the request's `helperEpoch` when it was readable (also on rejected frames: `Rejected.helper_epoch`); otherwise the
  session epoch (null before initialize). The helper's actual epoch is in `error.data.actual` for `helper_epoch_mismatch`, and
  `actual: null` for a `helperEpoch` sent before initialize. Success responses are unchanged (session epoch = the matching request epoch).
- Tests (`tests/protocol.rs`): new `unsupported_protocol_version_is_fatal_even_when_request_id_is_missing_or_invalid`,
  `non_integer_protocol_version_stays_a_non_fatal_field_error`, `epoch_mismatch_echoes_the_request_epoch_and_reports_the_helper_epoch_in_data`;
  updated the before-initialize assertion and the epoch-mismatch case of the envelope table. Protocol test target: 25 pass; fixtures unchanged.
- Evidence: [correction/](correction/) (`process-triggers.txt` real-binary replay of both original triggers, test, build, lock, runtime, npm outputs).
