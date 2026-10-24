# Task 11 Initial Review (Claude Code reviewer, task #51)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #16 (plan Task 11), plus a separately attributed focused review of the supervisor-authored fixture-schema alignment (`evidence/supervisor-schema-compatibility/`). The reviewer reached its turn limit once and was continued in the same context.
Orchestrator filter: no findings (worker or supervisor item).

## Verdict

Worker change set: pass, no findings. Supervisor schema item: pass, no findings.

## Upstream overflow quirk (`match_brackets.rs:154`)

Real: in `find_pair`, `pos_ - node_start` goes negative for a whitespace-only document with the cursor in leading whitespace; debug builds panic (oracle exit 101), release wraps and yields "no match" (worker's no-overflow oracle: selection unchanged `(1,2)`, status none). Shipped helper is built `--release` (`scripts/build-match.cjs:72`) without `overflow-checks`, so it returns "no match" without the guard; the `catch_unwind` guard (`brackets.rs:53`, documented L29-34) aligns debug builds with release Helix. Risk noted (not a finding): in release it would also mask any other panic inside `find_matching_bracket_fuzzy` that would otherwise reach the server catch (`server.rs:97`, `internal_error`); no such input found. No oracle fixture possible; helper test checks ranges for the first request, `edits` for the second.

## Coverage by acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED cursors inside/on/outside | Met | `tests/brackets.rs`; RED 6/7 failing; `scope_accounting` names |
| Same syntax/plaintext branch | Met | `brackets.rs:50-54` vs `commands.rs` `match_brackets`; replica syntax `None` after failures/no grammar (spec L501-507); forced-plaintext mutation fails 3 |
| Reference cursor placement | Met | `range.cursor`, `put_cursor(…, false)` |
| Full-set normalization | Met | `Selection::transform` + `ensure_invariants` |
| Count handling | Met | validated, not read; `plain-count-*`, `rust-count-ignored`, `failure-initial-count` |
| Status | Met | always `none` |
| REFACTOR boundary reuse | Met | shared `selection::import`/`export`; no custom matching |
| Nested syntax, strings, comments, malformed, absent | Met | 266 cases, ~20 languages incl. injections |
| Reversed and multiple selections | Met | 6 backward, 23 multi-selection cases |
| `m` runs immediately (spec L582-587) | Met | `oracle.rs:167-173`; `plain-mm-after-cancelled-m`, `plain-count-after-m` |
| NFR-2 adapter inventory | Met | module doc + README |
| Oracle-derived expectations | Met | 266 `brackets/*` PASS on re-run |
| Existing fixtures unchanged | Met | 13 case files and `result.schema.json` identical |
| Lock, baseline, escalations untouched | Met | hashes OK; only pre-existing `package.json` diff |
| No TS Helix algorithm | Met | doc comment only |
| Supervisor schema: minimal | Met | two schema lines + two README sentences; hashes match provenance |
| Supervisor schema: corpus valid | Met | ajv: 14/14 valid; pre-change schema rejects `selection-identity.json` `/cases/0/tags/0` |
| Supervisor schema: negatives rejected | Met | 7/7 broken copies rejected |
| Supervisor schema: matches oracle/runner | Met | oracle iterates `input.steps` (`main.rs:569`); tags are metadata |

## Checks run (each once)

- `--test brackets`: 7 passed (253 replayed, 14 skipped; 273 requests); with `test-support`: 7 passed (267, 0 skipped; 291 requests; 225 moved selection; 10 mirrored edits).
- Full crate tests with and without feature: all pass.
- `npm run test:match:oracle` exit 0; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `check:keybindings`; `compare-cargo-lock.cjs` no deviations; `check:helix-runtime` (`fd5ee12c…ffbea2b`, 1799 assets).
- `npx --yes ajv-cli@5 validate --spec=draft7 -s case-file.schema.json -r result.schema.json -d cases/*.json` (scratch): 14 valid; negative controls rejected.
- Snapshot key, comparisons, baseline hashes as above.

## Attribution and scope

Worker: `evaluate/{brackets.rs,mod.rs}`, `tests/brackets.rs`, `tests/common/oracle.rs`, `tests/textobjects_plain.rs`, `src/native/protocol.ts` (doc), `cases/brackets.json`, `evidence/task-11/**`. Supervisor: `schema/case-file.schema.json`, fixtures `README.md`. Excluded: progress note, reviews, proposals.

## Limits

Files outside the 375-file snapshot checked by mtime; release behaviour of the overflow case inferred (debug helper tested); no-overflow oracle build not re-run; deferred items not reviewed.

## Non-findings (not accepted)

`keys` must be empty for `brackets` (documented; upstream reads none); `is_select` always false (SELECT excluded) and a module-doc wording inaccuracy; `brackets.json` 1.4 MB (excluded from package); schema relaxation applies to all groups (required fields and unknown-property rules unchanged).
