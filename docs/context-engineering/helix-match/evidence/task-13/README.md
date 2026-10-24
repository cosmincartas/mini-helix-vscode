# Task 13: replacement preview and cancellation (worker #18)

Plan Task 13 (FR-5, FR-7, FR-8, FR-12, FR-14). `evaluate` now answers the action `replace` (`mr<old>`, the old-surround key) with a replacement PREVIEW:
the reference's intermediate selections, the original semantic selections and an opaque continuation token the helper keeps. `continue` with a non-character
key restores the original selection; `cancel` releases a continuation. The replacement transaction itself (a character key) is Task 14. No Helix algorithm is written here.

## Wire shapes (all UTF-16 gap endpoints; `status.category` always present)
- `evaluate` request: as for other actions, `action: "replace"`, `keys: [oldKey]` (exactly one; `m` = closest pair), optional `count` (the nth surround).
- Preview (lookup succeeded): `{kind:"preview", documentId, generation, baseVersion, selectionGeneration, sessionId, originalRanges, originalPrimary, ranges, primary, status:{category:"none"}, continuationToken}`.
  No `edits`. `ranges`/`primary` = oracle's selections after `mr<old>` (two points per original range, primary doubled, `Document::set_selection` invariants applied). Token: 32 lowercase hex, opaque.
- No callback (lookup failure or non-character old key): a normal `proposal` (`edits: []`, the normalized selection unchanged, `status` = reference status: `error` + the exact upstream message, e.g. `Surround pair not found around all cursors`; `none` for a non-character key). No token exists; the client replays the following keys as ordinary input (reference lookup failure) .
- `continue` request: `{documentId, generation, version, sessionId, selectionGeneration, continuationToken, key}`.
  Non-character key (Escape, Enter, arrows...): `{kind:"restored", documentId, generation, baseVersion, selectionGeneration, sessionId, ranges, primary, status:{category:"none"}}` (the original semantic selections, no edits; the token is released).
  Character key: validated, then `invalid_request/continuation_replacement_not_implemented`; the token is NOT consumed (Task 14 replaces this answer).
- `cancel` request: exactly one of `{sessionId}` or `{continuationToken}` (`invalid_request/invalid_cancel_target` otherwise). Answer `{released:false}` or `{released:true, restored:{documentId, generation, baseVersion, sessionId, ranges, primary}}` (idempotent; the client applies `restored` only while it still owns the editor).
- Errors: unknown/released/forged/other-helper token `stale_continuation/continuation_unknown`; bound-field mismatches `stale_continuation/continuation_{document,generation,version,session}_mismatch`; replica no longer the bound snapshot `stale_continuation/continuation_document_changed` (defensive, also releases); malformed token `invalid_request/invalid_continuation_token`; invalid key `invalid_key` (checked before ownership). Errors never contain document text or the token.

## Continuation binding and lifecycle (src/continuation.rs)
Binding (helper-held, never client-supplied): document ID, generation, exact version, session ID, normalized original selection, flat delimiter positions (`get_surround_pos`), count. A token authorizes a request only when every bound field equals the request's AND the replica is still at the bound version.

| Event | Effect |
|---|---|
| `evaluate replace`, lookup succeeds | creates a continuation; the same session's earlier one is released (one waiting callback per session) |
| rejected request (stale, malformed, wrong owner, invalid key) | nothing changes |
| `continue`, non-character key | releases; answers restored original selections |
| `continue`, character key | validated; answered not-implemented; NOT consumed (Task 14: replacement proposal, release on success = single use) |
| `cancel` (token or session) | releases (idempotent) |
| accepted `change` / `snapshot` / `configure` of the document | releases every continuation of that document |
| accepted `close` | releases every continuation of that document (a reopened document does not inherit it) |
| helper restart / `initialize` | store starts empty; old tokens are `continuation_unknown`; the new helper epoch also rejects the old client epoch |
| other document's change | no effect |

Ownership validation is shared with the freshness gate of every versioned request (`Documents::replica_view`); the binding check comes first so a foreign token is always `stale_continuation`.

## Adapter inventory (pinned revision ba40e547426b0f9896c8bdc699a4ab11f2b37dbc; native/upstream/helix)
Authoritative copy with the same rows: header of `native/match-helper/src/evaluate/surround_replace.rs`.

| Upstream symbol | Location | Here |
|---|---|---|
| `surround_replace` first phase (`cx.count()`, `on_next_key`, `event.char()`: `Some('m') => None`, `Some(ch)`, `None => return`) | helix-term/src/commands.rs:6425-6433 | `surround_replace::first_phase` |
| `surround::get_surround_pos(doc.syntax(), text, selection, surround_ch, count)` and `Err(err) => set_error(err.to_string()); return` | commands.rs:6438-6445 | called unchanged; error text becomes the proposal's `error` status |
| `selection.clone()` kept for cancellation | commands.rs:6447 | `Replacement::original` / `Continuation::original` |
| `Range::point` per `change_pos`, `Selection::new(ranges, primary_index * 2)` | commands.rs:6448-6452 | `first_phase` (preview), invariants in `evaluate::preview` |
| `doc.set_selection` invariants | helix-view/src/document.rs:1396 | `Selection::ensure_invariants` in `evaluate::preview` |
| nested `on_next_key` callback (captures `change_pos`, `selection`, count) | commands.rs:6454 | `continuation::Continuation` |
| callback `None => return doc.set_selection(view.id, selection)` | commands.rs:6457-6460 | `continuation::continue_replacement` (non-character key) |
| `KeyEvent::char` | helix-view/src/input.rs:73 | `MatchKey::character` |
| `get_surround_pos`, `find_nth_closest_pairs_pos`, `find_nth_pairs_pos`, `Error` + `Display` | helix-core/src/surround.rs:305, :41, :160, :15-28 | called unchanged |
| UI only (`autoinfo`, `Info`) | commands.rs:6428, 6455, 6484-6487 | not needed |
The second phase (commands.rs:6461-6481, replacement transaction) is Task 14.

## Fixtures and coverage
- `test/fixtures/helix-match/cases/surround-replace-preview.json`: 214 cases, inputs from `generate-cases.cjs` (this directory), expected ONLY by `npm run test:match:oracle -- --filter surround-replace-preview --update --no-build`. The 14 earlier case files are byte-identical (`logs/fixtures-unchanged.txt`, 14/14 OK).
- Groups: every pair and alias (`( ) [ ] { } < >`), same-char delimiters (`" ' \` |`, cursor inside/on opener/on closer: ambiguous-pair errors), literal self-pairing chars, `m` closest (nested, count, selections), nested/count/over-count, cursor on delimiters, EOF/empty text, multi-selection (primary first/middle/last, mixed, reversed, merged, overlap error, one failing selection), lookup failures, non-character and modified old keys, cancelling keys (Escape, Tab, Enter, arrows, Ctrl-arrow, Backspace, Home), commands after cancel, replacement characters (observed at the preview only), Unicode (non-BMP, guillemets, CJK, fullwidth, ZWJ, combining) and CRLF/lone CR, syntax-aware lookup in root and injected languages (rust incl. quotes in strings/comments/char literals/lifetimes, markdown with injected rust and prose/link/code span, html with injected javascript/css/attributes, javascript, json, toml, python, c, typescript), failed initial parse falling back to plaintext.
- `tests/surround_preview.rs` replays 219 cases (the 5 `surround/mr-*` cases of the earlier fixture plus the new group) in the test-support build (216 plain; 3 failure-injection cases skipped): 168 previews equal to the oracle's intermediate observation, 48 lookup failures with the exact reference message and no continuation, 4 callback-less non-character keys, 25 restores equal to the oracle's post-cancel state, 9 replacement keys stopped at the preview (Task 14), 3 ordinary-input stops after a failed lookup, 27 idle Escapes, 1 command after a cancel. Each preview is also evaluated twice (same answer, new token, first token superseded) and the test-support build observes the replica unchanged.
- Hand-written tests: exact wire shapes; binding rejection (document, generation, version, session, forged, foreign document, malformed tokens, invalid key, params) with the token surviving every rejection; not-implemented replacement keeps the token; lifecycle (cancel by token/session, change, rejected change/snapshot/configure, other document's change, snapshot, configure, supersession, close + reopen, restart); bad replace requests create nothing; whitespace-only/empty rust documents (see deviations).

## Compatibility edits to existing tests and files
- `native/match-helper/tests/fixtures/protocol/constants.json`, `initialize.response.json`: `implementedMethods`/capabilities list `continue`, `cancel`.
- Fixtures `unsupported_method_continue.{request,response}.json` removed (they asserted `continue` unsupported); replaced by `continue_stale.{request,response}.json` (`continue` with a never-issued token answers `stale_continuation/continuation_unknown`). Genuinely unsupported examples remain (`unsupported_method` fixture, `no_such_method`, the test-only methods in the production binary).
- `tests/protocol.rs`: fixture names, capabilities list, the unsupported-method test no longer lists `continue`/`cancel`.
- `tests/textobjects_plain.rs`: only `delete` stays `action_not_implemented` (`replace` is answered).
- `test/unit/matchEvaluate.test.ts`, `matchSelections.test.ts`, `matchSync.test.ts`: `continue`/`cancel` are now asserted advertised; `matchSync.test.ts:748` capability list; `matchEvaluate.test.ts` uses `delete` for the not-implemented example. `matchClient.test.ts` (2 places): `client.request('continue', {documentId})` now answers `invalid_params` (its fields are required) instead of `unsupported_method`.
- `tests/common/oracle.rs`: `Scope::Replace` (planner; the key after `mr<old>` is the pseudo-action `replace-key`, never sent to the helper).
- `src/native/protocol.ts`: typing only (`EvaluatePreview`, `EvaluateResult`, `ContinueParams`, `RestoredSelections`, `CancelParams`, `CancelResult`, `ContinuationMethods` in `TypedMethods`; `RequestFrame` params through a `FrameParams` helper because the union became too complex for tsc). `MatchMethods.continue/cancel` stay loose rows; use `requestTyped`.

## Deviations, notes
- Timing of RED: the implementation was written before the tests were first run. RED (`logs/red-1-replace-not-implemented.txt`) was produced afterwards by reversing the helper edits (restored and verified by sha256, `logs/red-restore-hashes.txt`; `continuation.rs` later received a doc-wording edit only). 7 of 8 tests failed there (`scope_accounting` passes by design: it reads the fixtures).
- Debug-build overflow (same root cause as Task 11, match_brackets.rs:154) can be reached by the syntax-aware lookup; the lookup is wrapped in `catch_unwind` and a panic is `PairNotFound` (the release outcome). No oracle expected can exist for that input; `a_syntax_lookup_that_panics_in_a_debug_build...` asserts the release behaviour and that the helper survives.
- One npm test failure on the first strict run (`matchSync.test.ts:748` exact capability list); fixed, rerun green (`logs/npm-test-first-run-1-failure-matchSync-capabilities-list.txt`).
- No continuation cap was added: one per session plus release on any document state change bounds it in practice; a hostile client minting many session IDs is not modeled (local trusted pipe).
- Not done: a TypeScript test that drives preview/continue/cancel through `MatchClient.requestTyped` (outside the write scope list); the TS types are checked by `tsc` only, the wire shape by the Rust tests.

## Pending for Task 14
- Implement the character-key branch of `continue_replacement` (marked `TASK 14`): build the transaction from `Continuation::delimiters` and the key (commands.rs:6461-6481: sorted `(pos, open|close)` replacements of one char each, `doc.set_selection(original)` then apply), answer the replacement proposal with the Task 12 export path, release the token on success (single use), keep it on failure.
- `Continuation::count` is bound but not used by the second phase.
- The client (Tasks 17-18) must replay keys after a lookup-failure proposal and must apply `restored` only while it owns the editor.

## Logs (all .txt)
red-1-replace-not-implemented, red-restore-hashes, final-surround_preview-{plain,test-support,counters-test-support}, final-crate-{plain,test-support}, final-oracle, final-npm-test (+ the first failing run), final-check-keybindings, final-compare-cargo-lock, final-check-helix-runtime, baseline-hashes (24 baseline files: only `package.json` differs, pre-existing), fixtures-unchanged, mutation-no-release-on-change (the lifecycle test fails; session.rs restored by sha256).
