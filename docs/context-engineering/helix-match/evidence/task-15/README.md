# Task 15 evidence: surround deletion transactions (`evaluate` action `delete`, `md<char>`)

Worker #20. Production code is the Rust helper only (plus TypeScript typing). Not committed. All commands run from the worktree root.

## Result

`evaluate` with `action: "delete"`, `keys: [<one surround key>]` and the typed count answers a `proposal`. The pinned
`surround::get_surround_pos` looks the pair of EVERY selection up (syntax-aware through the replica's tree, plaintext after a parser or
root-query failure); when it succeeds the delimiter positions are sorted and become ONE pinned `Transaction::change` of one-character
removals, and the selection after the command is the original selection mapped through it. When it fails for any selection (no pair, a
pair of another kind, two selections sharing a delimiter, a count beyond the nesting) NOTHING is edited: the proposal has `edits: []`,
the unchanged normalized selection and `status: {category: "error", message: <reference text>}`. A non-character key consumes the callback
(no edits, status `none`). A character key is the character whatever its modifiers; `m` is the closest pair.

### Wire shape (tests/surround_delete.rs `proposal_has_the_exact_wire_shape_for_delete`)

Request: `{documentId, generation, version, sessionId, selectionGeneration, ranges, primary, action: "delete", count?, keys: [MatchKey]}`.
Response (pre-existing `proposal`, no new fields): `{kind: "proposal", documentId, generation, baseVersion, selectionGeneration, sessionId,
edits: [{start, end, text: ""}...] (sorted, non-overlapping, base UTF-16), ranges, primary, status}`. Example (two selections, `mdm`):
`edits: [{0,1,""},{3,4,""},{5,6,""},{8,9,""}]`. No continuation token, no `baselineIdentity` (a `baselineIdentity` parameter is
`invalid_request/baseline_identity_not_applicable`). The replica is never changed by the proposal.

## Adapter inventory (pinned revision ba40e547426b0f9896c8bdc699a4ab11f2b37dbc, patched tree `native/upstream/helix`)

Also recorded in the module docs `native/match-helper/src/evaluate/surround_delete.rs` and `surround_lookup.rs`.

| Upstream symbol | Location at the pinned revision | Here |
|---|---|---|
| `surround_delete`: `let count = cx.count()` | helix-term/src/commands.rs:6497 | `count` of the request |
| `cx.on_next_key`, `event.char()`, `Some('m') => None`, `Some(ch) => Some(ch)`, `None => return` | helix-term/src/commands.rs:6498-6504 | `surround_lookup::lookup` (shared with `mr` first phase) |
| `surround::get_surround_pos(doc.syntax(), text, selection, surround_ch, count)`, `Err(err) => set_error(err.to_string()); return` | helix-term/src/commands.rs:6508-6515; helix-core/src/surround.rs:305 | called unchanged (`surround_lookup::lookup`); error text becomes the status |
| `change_pos.sort_unstable()` | helix-term/src/commands.rs:6516 | `surround_delete::surround_delete` |
| `Transaction::change(doc.text(), change_pos.into_iter().map(\|p\| (p, p + 1, None)))` | helix-term/src/commands.rs:6517-6518; helix-core/src/transaction.rs:658 | `surround_delete::surround_delete` |
| `doc.apply(&transaction, view.id)` (`Selection::map` then `ensure_invariants` on the post-edit text) | helix-term/src/commands.rs:6519; helix-view/src/document.rs:1452 (`.map` :1487, `.ensure_invariants` :1489) | `Selection::map` in `surround_delete`; `evaluate::proposal` applies `ensure_invariants` |
| `exit_select_mode`, `autoinfo`/`Info` | helix-term/src/commands.rs:6520, 6499, 6523 | not needed (no SELECT mode for match commands; UI only) |
| `get_surround_pos`, `find_nth_closest_pairs_pos`, `find_nth_pairs_pos`, `Error` texts | helix-core/src/surround.rs:305, :160, :41, :15-28 | called unchanged |
| `ChangeSet::changes_iter` | helix-core/src/transaction.rs:523 | `evaluate::edits::export` (shared with `ms`, `mr`) |
| `KeyEvent::char` | helix-view/src/input.rs:73 | `MatchKey::character` |

Refactor (shared only conversion and result validation): `surround_lookup::lookup` holds the key conversion, the pinned lookup call (with the
existing debug-only overflow guard, formerly inline in `surround_replace::first_phase`) and the error status; `mr` first phase now calls it.
Transaction assembly is not shared.

## Files (SHA-256 in file-hashes.txt)

Created: `native/match-helper/src/evaluate/surround_delete.rs`, `.../surround_lookup.rs`, `native/match-helper/tests/surround_delete.rs`,
`test/fixtures/helix-match/cases/surround-delete.json` (243 cases, `expected` generated only by the oracle), `generate-cases.cjs` (inputs only).
Modified: `native/match-helper/src/evaluate/mod.rs` (modules, `Delete` arm), `.../surround_replace.rs` (first phase calls the shared lookup),
`native/match-helper/tests/common/oracle.rs` (`Scope::Delete`, planner understands `md`), `native/match-helper/tests/textobjects_plain.rs` and
`test/unit/matchEvaluate.test.ts` (compatibility: they asserted `delete` was `action_not_implemented`; no action is left unimplemented, an unknown
action is already tested as `invalid_params`; they now assert `delete` is answered, and `keys: []` is `invalid_keys`), `src/native/protocol.ts`
(doc-comment typing only). `native/Cargo.lock` unchanged (logs/cargo-lock-unchanged.txt). Existing fixture files byte-identical (logs/fixtures-unchanged.txt).

## Fixture coverage (243 oracle cases + 5 earlier `md` cases = 248 replayed)

Pairs and aliases (open/close key, `m`) for `() [] {} <>`, quotes `" ' \` |`, self-pairing literals and no-pair errors; nested and closest (`mdm`),
counted (`2md(`, `3md(`, `10md(`, `2mdm`, count too large, `99md(`); selections (cursor on opener/closer, ranges, backward ranges, primary index,
overlap merge); SHARED pairs (reference `Cursors overlap...`, `Cursor on ambiguous surround pair`); MIXED success/failure across several selections
(first, middle, last selection without a pair: reference error, no partial deletion); modifier keys (`<C-(>`, `<A-)>`, `<C-m>`...) and 12 non-character keys
plus Escape cancel; Unicode (non-BMP and ZWJ/combining text and surround characters); LF/CRLF; sequences (`md` twice, `ms` then `md`, failed then successful
`md`); syntax-aware lookup in rust, markdown (injected rust, root prose, link urls), html (script/style injections), javascript, tsx, jsx, bash, c-sharp,
json, toml, python, c, typescript; plaintext fallback after an initial parse failure, a root `highlights`/`injections`/`locals` query failure and an
incremental parse failure after a first `md`; `textobjects.scm` and injected-language query failure that keep syntax available; the debug overflow guard
(whitespace-only rust document). Language-id aliases replay (`csharp`, `javascriptreact`, `shellscript`, `typescriptreact`).
Reference error texts exercised: `Surround pair not found around all cursors`, `Cursor on ambiguous surround pair`, `Cursors overlap for a single surround pair range`,
`Cursor range exceeds text length`.

## Verification (logs/ holds the raw outputs)

| Check | Result |
|---|---|
| RED (tests written before the helper arm; `delete` answered `action_not_implemented`) | `logs/red-1-delete-not-implemented.txt`: 7 of 7 tests failed (4 with `action_not_implemented`; `scope_accounting`, the aliases test and the bad-request test on test-side details fixed in the same session) |
| `cargo +1.90.0 test --locked --manifest-path native/Cargo.toml -p mini-helix-match-helper --test surround_delete` | `logs/surround-delete-plain.txt`: 7 passed; 236 cases replayed, 12 skipped (parser-failure injection needs test-support); 239 `md` requests (161 deleted, 64 failed of which 21 with several selections, 14 non-character keys) |
| same with `--features test-support` | `logs/surround-delete-test-support.txt`: 7 passed; 248 cases replayed, 0 skipped; 254 `md` requests; replica unchanged by every proposal (`test_observe`) |
| full crate tests plain / test-support | `logs/crate-tests-plain.txt`, `logs/crate-tests-test-support.txt`: all result lines ok, exit 0 |
| `npm run test:match:oracle` | `logs/oracle-full.txt`: exit 0, all fixture cases match including the self-test |
| `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` | `logs/npm-test-strict-2.txt`: 166/166 pass, 0 skipped. `logs/npm-test-strict-1-before-compat-edit.txt` is the earlier run that failed ONLY on the stale `action_not_implemented` assertion in test/unit/matchEvaluate.test.ts (fixed, see above) |
| `npm run check:keybindings`, `node native/runtime/compare-cargo-lock.cjs`, `npm run check:helix-runtime` | exit 0 each (`logs/check-keybindings.txt`, `logs/compare-cargo-lock.txt`, `logs/check-helix-runtime.txt`) |
| baseline | `logs/baseline-hashes.txt`: 24 checked, only `package.json` differs (pre-existing difference, also recorded by Task 14; untouched here) |
| mutation: when the lookup fails, delete the pairs of the selections that have one (partial deletion) | `logs/mutation-partial-deletion.txt`: 4 of 7 tests fail (exact wire shape, no-partial-deletion test, oracle replay, alias replay); restored by SHA-256 (`logs/mutation-restore-hash.txt`), `logs/post-mutation-restore-tests.txt`: 7 passed |

## Deviations and pending

- None to the contracts. VS Code application and history of the proposal is Task 18 (not in scope); the client never sends `md` yet.
- The two new modules are not exercised by a TypeScript client test beyond `matchEvaluate.test.ts` (typing and one `delete` proposal through the real helper).
