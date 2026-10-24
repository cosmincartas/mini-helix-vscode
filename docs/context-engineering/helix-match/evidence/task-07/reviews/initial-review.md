# Task 7 Initial Review (Claude Code reviewer, task #44)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #43 (plan Task 7); snapshot `pre-task07` → delta list `post-task07/delta-files.txt`.
The reviewer was interrupted once by a session boundary; it was resumed in the same context and returned this report without re-running completed checks.
Orchestrator filter: no findings. Criterion 12 (consecutive commands through real `evaluate`) is recorded as pending and carried into Task 8.

## Verdict

Accept, no actionable findings. "Consecutive match commands preserve semantic state after projection" is partly met: snapshot-level evidence now; real `evaluate` chains pending for Task 8 (recorded by the worker, not overclaimed).

## Coverage per acceptance criterion

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | RED round-trip/differential tests | `matchSelections.test.ts` (23); 28 fixture cases; RED logs | Pass |
| 2 | UTF-16 conversion in Rust | `selection.rs:55-76`, `text.rs` `char_of_utf16`/`utf16_of_char`; out-of-range and mid-pair rejected | Pass |
| 3 | Upstream invariants, same sequence | `Selection::new(..).ensure_invariants(..)` = `Document::set_selection` (`document.rs:1396-1399`), `selection.rs:662-665` | Pass |
| 4 | Canonical order and primary identity | export canonical + `primary_index()`; oracle differential 28/28 | Pass |
| 5 | Primary-first projection, index mapping | `selectionCodec.ts:119-141`; round trip 28/28 | Pass |
| 6 | Only needed metadata; no CRLF shadow ranges | `RetainedSelection` fields; 3 lossy shapes restored | Pass (VS Code simulated) |
| 7 | Invalidation; owned events | `selectionCodec.ts:255-308` | Pass at unit level; wiring Task 17 |
| 8 | Reject malformed UTF-16 / invalid boundaries, no replacement | Rust error codes; `unsupported_text` at open; no U+FFFD; sentinel | Pass |
| 9 | REFACTOR centralization | `text.rs`/`selection.rs`; `selectionCodec.ts` | Pass |
| 10 | No TypeScript Helix algorithms | codec converts/orders/compares only | Pass |
| 11 | Oracle comparisons for touching/overlapping | `touching-ranges`, `touching-eof-*` (3), `overlapping-*`, `zero-width-inside-range` | Pass |
| 12 | Consecutive commands preserve state | 266 oracle snapshots individually through projection/retention/import; VS Code simulated | Partial — pending Task 8 |
| 13 | `test_normalize_selection` test-only | `cfg(feature = "test-support")` + session flag; production returns `unsupported_method` | Pass |
| 14 | Oracle provenance; existing cases unchanged | `test:match:oracle` 153 PASS; 7 existing files byte-identical; oracle source unchanged | Pass |
| 15 | Lock, baseline, escalated items untouched | `key.sha256` OK; `envelope.rs`, `matchClient.ts`, `documents.ts`, `matchClient.test.ts` identical; spec/plan frozen | Pass |

## Checks run

- `cargo +1.90.0 test --locked ... -p mini-helix-match-helper` and with `--features test-support`: exit 0 (86 passed, 0 failed across both).
- `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 node --test out/test/unit/matchSelections.test.js`: 23/23, 0 skipped.
- `npm run test:match:oracle`: 141 cases + self-test, 153 PASS, 0 FAIL.
- `npm test` 161/161; `npm run check:keybindings` exit 0.
- Snapshot diffs, `sha256sum -c` (key, evidence file-hashes), baseline comparison: only declared files changed.

## Attribution and scope

Reviewed modified `src/native/protocol.ts`, `session.rs`, `documents/text.rs`, `documents/mod.rs`; new `documents/selection.rs`, `selectionCodec.ts`, `matchSelections.test.ts`, `selection-identity.json`, `evidence/task-07/**`. Excluded supervisor-authored files and `reviews/`. `scripts/**`, `test/feasibility/**` checked by mtime (not newer than snapshot).

## Coverage limits

VS Code behaviour simulated (owned/external event classification unverified until Tasks 8/17); production-helper test may use a feature-unified binary (runtime gate verified, compile gate by reading); worker mutations 2-4 partly contaminated (TS-only rows count); Linux x64 only.

## Non-findings (not accepted)

Async `own()` scopes and mid-scope user events (Task 17 wiring); CR|LF offsets snap left in projection (unreachable per upstream); TS `malformed_utf16` code naming vs `unsupported_text` (controller mapping); primary index above 2^53 error code; "consecutive oracle states" naming (limit stated); upstream `helix-loader` warning.
