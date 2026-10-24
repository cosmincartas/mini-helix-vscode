# Task 8 Initial Review (Claude Code reviewer, task #45)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #13 (plan Task 8); snapshot `pre-task08` → delta list `post-task08/delta-files.txt`. The reviewer reached its turn limit once and was continued in the same context.
Orchestrator filter: no findings; compatibility edits recorded as routine attributed scope items.

## Verdict

Accept, no actionable findings. The carried Task 7 criterion 12 is met through real `evaluate` chains (VS Code simulated; real wiring Task 17).

## Compatibility edits outside the listed scope

| Edit | Needed | Minimal | Weakens a test |
|---|---|---|---|
| `test/unit/matchSelections.test.ts` L405 drops `evaluate` from "stays unsupported" | Yes | Yes | No (`continue`/`cancel` still checked; `matchEvaluate.test.ts` L264-270 checks `evaluate` advertised) |
| `test/unit/matchSync.test.ts` L212 same | Yes | Yes | No |
| `test/unit/matchSync.test.ts` L738 production list gains `evaluate` | Yes | Yes | No (exact equality kept) |
| `test/unit/matchClient.test.ts` L685/L732 `evaluate` → `continue` (in scope) | Yes | Yes | No |
| `tests/protocol.rs` and fixtures `unsupported_method_evaluate.*` → `unsupported_method_continue.*` (in scope) | Yes | Yes | No |

## Coverage by acceptance criterion

| # | Criterion | Evidence | Result |
|---|---|---|---|
| 1 | `textobjects_plain` exists and passes | 6/6; 156 in-scope cases, 178 requests, 17 chains, 210 normalization checks; RED 5/6 failing | Met |
| 2 | words, WORDs, paragraphs, explicit pairs, custom chars, closest pairs | `plaintext-objects-2.json` (114) + 42 earlier; `scope_accounting` L74-96 | Met |
| 3 | Pair tests without a language | planner excludes language/git/failure/queryOverrides/select | Met |
| 4 | Oracle exact output | expected only from fixtures; oracle re-run 267 PASS; provenance present | Met |
| 5 | Whitespace and delimiter aliases | `miw`/`maw` runs, EOF spaces, `mi]`, `ma}`, `mi<gt>`, `mi»` | Met |
| 6 | Empty objects, quote escapes, non-ASCII pairs, EOF quirks | empty pairs/docs; escaped-quote case; guillemet/CJK/Greek/fullwidth/astral/UTF-16; EOF cases incl. lossy chains | Met |
| 7 | Pinned functions with full normalized set | `textobjects.rs` L57-70 vs `commands.rs` L6303-6334 via `Selection::transform` | Met |
| 8 | Count, direction, missing-match per object | `count_of` (none → 1, 0 rejected); `w`/`W` ignore count; forced-count mutation detected; no-op `none` | Met |
| 9 | Final selection invariants | `evaluate/mod.rs` L155 `ensure_invariants` (= `document.rs` L1396-1400); 210 normalization checks | Met |
| 10 | No hard-coded bracket list; unsupported objects | `!ch.is_ascii_alphanumeric()`; `miλ`, `ma日`, `mi“` pass; `miQ`, `mi0`, `miz` no-ops | Met |
| 11 | Replica untouched; freshness; no text in errors | read-only borrow; `replica_view` generation/version; fixed error strings; sentinel | Met |
| 12 | REFACTOR minimal adapter | dispatch/import/export + object table; inventory with pinned lines | Met |
| 13 | Carried consecutive-command criterion | `matchEvaluate.test.ts`: 156 chains through real helper, projection/read-back/retention; 4 lossy states restored | Met (VS Code simulated) |
| 14 | `protocol.ts` typing | `EvaluateParams`, `MatchKey`, `EvaluateProposal`; `tsc` clean | Met |
| 15 | Lock, baseline, escalations untouched | keys OK; 0 deviations; `envelope.rs`, `matchClient.ts`, `documents.ts` identical | Met |
| 16 | Existing case files unchanged | 8 files, README, schemas identical | Met |

## Checks run (each once)

- `cargo +1.90.0 test --locked ... --test textobjects_plain -- --nocapture`: 6 passed (156 in scope / 99 excluded with reasons).
- Crate tests: lib 11, protocol 25, runtime_isolation 4, textobjects_plain 6; with `test-support` also documents 6.
- `npm run test:match:oracle`: 267 PASS, 0 FAIL. `npm run compile`; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test`: 166/166, 0 skipped.
- `npm run check:keybindings` exit 0; `compare-cargo-lock.cjs` no deviations.
- Snapshot diff, `key.sha256` OK, baseline (only `package.json`, pre-dating Task 8), `evidence/task-08/file-hashes.txt` 21 OK; pinned source read (`commands.rs` L6245-6339, `textobject.rs` L60-262, `surround.rs` L155-300, `document.rs` `set_selection`, `input.rs` `KeyEvent::char`).

## Coverage limits

Syntax pass-through not verified with a language document (Task 9); captures and `g` return `object_not_implemented` (Tasks 9/10 pending, not passing); `MatchKey` extra-field rejection not probed; Linux x64; RED and mutation results from worker logs.

## Non-findings (not accepted)

Huge `p` counts loop as upstream does; weak replica-untouched assertion (borrow guarantees it); parameter-before-freshness order; explicit not-implemented errors; duplicated test planners (test-only).
