# Task 13 Initial Review (Claude Code reviewer, task #52)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #18 (plan Task 13); snapshot `pre-task13` → delta list `post-task13/delta-files.txt`.
Orchestrator filter: no findings.

## Verdict

Accept; no actionable findings; all checks pass. Disclosed deviations (post-implementation RED; debug panic → `PairNotFound`) judged non-findings.

## Compatibility-edit assessment

| Edit | Needed | Minimal | Intent kept |
|---|---|---|---|
| `constants.json`, `initialize.response.json` gain `continue`/`cancel` | Yes (`IMPLEMENTED_METHODS`) | Yes | Yes |
| `unsupported_method_continue.*` → `continue_stale.*` | Yes | Yes (valid frame, `stale_continuation/continuation_unknown`; unsupported coverage remains) | Yes |
| `tests/protocol.rs` | Yes | Yes | Yes |
| `tests/textobjects_plain.rs` (only `delete` not implemented) | Yes | One line | Yes |
| `test/unit/matchEvaluate`, `matchSelections`, `matchSync` capability assertions | Yes | Yes | Yes (exact advertised set) |
| `test/unit/matchClient.test.ts` (2 places) `unsupported_method` → `invalid_params` | Yes | Yes | Yes (remote-error, no-text, stale-epoch paths kept) |
| `src/native/protocol.ts` `FrameParams` + interfaces | Typing only | Yes | No runtime change; `tsc` passes |
| `tests/common/oracle.rs` `Scope::Replace` | Yes | Yes | Yes |

Escalated items (`envelope.rs`, `matchClient.ts`, `documents.ts`) untouched.

## Coverage per acceptance criterion

| Criterion | Evidence | Status |
|---|---|---|
| RED: pairs, primary, closest, cancellation, invalid tokens | `tests/surround_preview.rs` (8); 214 oracle cases; RED 7/8 failing | Pass (RED timing non-finding) |
| Syntax-aware lookup root and injected | `rust-closest-in-string-with-brackets`, `rust-closest-in-comment`, `markdown-injected-rust-{closest,paren}`, `html-script-js-closest`; 25 multi-layer cases | Pass |
| Pinned first phase, exact intermediate selections | `surround_replace.rs:64-83` = `commands.rs:6425-6452`; `ensure_invariants` like `set_selection` | Pass |
| Opaque continuation binding (spec L392-395) | `continuation.rs:44-62`: document, generation, version, session, count, normalized original, delimiters; truncated SHA-256 token | Pass |
| Release on cancel/change/close/restart/supersession | `session.rs` arms after acceptance; `initialize` resets; `create` supersedes; lifecycle test + mutation log | Pass |
| REFACTOR shared ownership validation | binding check then `Documents::replica_view` | Pass |
| Intermediate selections = oracle after `mr<old>` | differential vs `autoinfoTitle == "Replace with a pair of"`; oracle 214/214; 14 existing files identical | Pass |
| Cancellation restores without edits | Escape/non-char restore oracle post-cancel state; token consumed | Pass |
| Wrong-version tokens never authorize | binding checked before any action incl. character path; change releases; unknown → `stale_continuation` | Pass |
| Lookup failure: no callback, reference error | `category: error`, exact upstream message, no token | Pass (replay Task 17) |
| NFR-3 | static messages; sentinel and token absent from errors/stderr | Pass |
| User rules | spec/plan hashes; keys; baseline (only pre-existing `package.json`) | Pass |

## Checks run

`--test surround_preview` 8 passed (± `test-support`); crate plain 93 passed, with feature 101 passed; `npm run test:match:oracle` OK (1154 cases + self-tests); `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `check:keybindings`, `compare-cargo-lock.cjs`, `check:helix-runtime` exit 0. Snapshot diffs, `key.sha256`, baseline, `find -newer` (no writes outside `target/`, `out/`), upstream `commands.rs:6425-6460`, `surround.rs:15-28`, `:305-330` read.

## Attribution and scope

Recomputed delta equals `delta-files.txt`; same-content case-file rewrites are not changes; reviews and progress note excluded; all files within worker scope.

## Coverage limits

Release-build `catch_unwind` path not observed; no TS test drives preview/`continue`/`cancel` (Tasks 16-18); `count`/`delimiters` usage unobservable until Task 14.

## Non-findings (not accepted)

Post-implementation RED (correct failure shown); character-key `continue` not implemented (Task 14); guard covers whole `get_surround_pos`; no continuation cap; token not cryptographically random (authorization rests on binding); duplicated binding/freshness comparisons.
