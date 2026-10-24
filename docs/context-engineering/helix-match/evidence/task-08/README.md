# Task 8: match plaintext inside and around objects (worker #13)

Plan Task 8 (FR-1, FR-2, FR-7, FR-8, NFR-2). The native `evaluate` method now answers `inside` and `around` for documents without
a language by calling the pinned helix-core object functions. No Helix algorithm is written in this repository.

## Design

### Where things live
- `native/match-helper/src/evaluate/mod.rs`: request/response types and the action dispatcher. One arm per action. The arms of later
  tasks (`brackets`, `add`, `replace`, `delete`) call their own module with the same complete, normalized `Selection`; today they answer
  `invalid_request/action_not_implemented`.
- `native/match-helper/src/evaluate/textobjects.rs`: the adapter for upstream `select_textobject` (object table). Task 9/10 add arms for
  the capture objects (`t f a c T e x`) and `g`; today they answer `invalid_request/object_not_implemented` (never a silent no-op that
  would look like a reference result). `Environment` carries what the object functions read (text, syntax); later tasks add the loader
  (captures) and the diff handle (hunks) there.
- `native/match-helper/src/documents/mod.rs`: `Documents::replica_view` (freshness gate + text + syntax); `replica_text` delegates to it.
- `native/match-helper/src/protocol/session.rs`: method table row, `Request::Evaluate`, `IMPLEMENTED_METHODS` (advertised in `initialize`).
- `src/native/protocol.ts`: exact `evaluate` typing (`EvaluateParams`, `EvaluateProposal`, `MatchKey`, `MatchAction`).

### Wire shapes
Request `evaluate` (`deny_unknown_fields`):
```
{documentId, generation, version, sessionId, selectionGeneration,
 ranges: [{anchor, head}] (UTF-16 gap endpoints, complete ordered set), primary,
 action: "inside"|"around"|"brackets"|"add"|"replace"|"delete",
 count?: positive safe integer (the count the accepted action consumed; absent = none typed),
 keys: [MatchKey] (exactly one for inside/around: the object key)}
MatchKey = {kind:"char", value:<one Unicode scalar>, modifiers:[shift|ctrl|alt|meta]} | {kind:"enter", modifiers} | {kind:"other", code, modifiers}
```
Response (proposal; neither request nor response changes the replica):
```
{kind:"proposal", documentId, generation, baseVersion, selectionGeneration, sessionId,
 edits: [] (against the base document; an object command never edits),
 ranges: [{anchor, head}] (canonical upstream order, UTF-16), primary (index into ranges),
 status: {category: "none"|"hint"|"info"|"warning"|"error", message?}}
```
Errors (all `invalid_request` unless noted; fixed strings, no text): `resync_required/unknown_document|version_mismatch`, `stale_generation`,
`selection_empty|primary_out_of_range|selection_out_of_range|selection_inside_surrogate_pair|value_out_of_range` (Task 7 import),
`invalid_count` (0), `invalid_keys` (not exactly one key), `invalid_key` (character key that is not one scalar), `invalid_params`
(unknown field, mistyped/negative number, unknown action or modifier), `action_not_implemented`, `object_not_implemented`.
Order: cheap parameter checks, then freshness (`replica_view`), then selection import, then dispatch.

### Behaviour preserved from upstream `select_textobject`
- The key is read like `event.char()`: a character key of any modifiers is its character (`mi<C-w>` is `miw`); Enter/other keys do nothing
  (the normalized input is returned unchanged).
- `w`/`W`, `p`, `m`, and every non-ASCII-alphanumeric character (including non-ASCII letters, space, punctuation) call the pinned function with
  `count = cx.count()` (typed count, else 1). ASCII alphanumerics without an object (`z`, `Q`, `0`..`9`) leave every range unchanged.
- A missing pair/object is a successful no-op (range unchanged); status category stays `none`.
- Whole selection set: `Selection::transform` over the complete normalized set (merging, primary identity), then `ensure_invariants`
  exactly as `Document::set_selection` does, then the Task 7 export.
- Syntax: the replica's syntax (if any) is passed to the pair functions exactly as upstream passes `doc.syntax()`. Only documents WITHOUT a
  language are verified in this task; syntax-backed pairs are verified in Task 9.

### Adapter inventory (pinned revision ba40e547426b0f9896c8bdc699a4ab11f2b37dbc, patched tree `native/upstream/helix`; same table in `evaluate/textobjects.rs`)
| Upstream symbol | File:line | Use |
|---|---|---|
| `select_textobject_around` / `select_textobject_inner` | helix-term/src/commands.rs:6254 / :6258 | `Action::Around`/`Inside` -> `TextObject` |
| `select_textobject` (count, `on_next_key`, `event.char()`, object table, `transform`, `set_selection`) | helix-term/src/commands.rs:6262-6339 | adapted orchestration (`textobjects::select_textobject` + `evaluate::evaluate`) |
| `textobject_treesitter` closure and `textobject_change` closure | helix-term/src/commands.rs:6273-6301 (arms 6308-6313, 6322) | NOT YET (Tasks 9, 10) |
| `KeyEvent::char` | helix-view/src/input.rs:73 | `MatchKey::character` |
| `TextObject` | helix-core/src/textobject.rs:53 | used unchanged |
| `textobject_word` | helix-core/src/textobject.rs:71 | called unchanged (`w`, `W`) |
| `textobject_paragraph` | helix-core/src/textobject.rs:114 | called unchanged (`p`) |
| `textobject_pair_surround` | helix-core/src/textobject.rs:201 | called unchanged (custom characters) |
| `textobject_pair_surround_closest` | helix-core/src/textobject.rs:212 | called unchanged (`m`) |
| `Selection::transform` | helix-core/src/selection.rs:636 | called unchanged |
| `Selection::ensure_invariants` (via `Document::set_selection`, helix-view/src/document.rs:1396) | helix-core/src/selection.rs:662 | called unchanged |
| `Editor::apply_motion` | helix-view/src/editor.rs:1484 | not adapted (only stores `last_motion`) |

## Tests
- `native/match-helper/tests/textobjects_plain.rs` (+ `tests/common/{mod,keys,oracle}.rs`): differential process tests against the PRODUCTION helper binary
  (no `test-support` needed). Expected values only from `test/fixtures/helix-match/cases/*.json` (oracle).
  - `every_in_scope_oracle_case_matches_step_by_step_through_evaluate_chains`: 156 in-scope cases, 178 `evaluate` requests, 17 multi-command chains. The selection a response returns is the
    next request's input; after EVERY oracle step the helper state equals the oracle step snapshot (UTF-16 anchors/heads, direction, primary); `edits` is `[]`, status category equals the oracle's;
    the replica is untouched.
  - `evaluate_normalizes_the_input_selection_exactly_like_the_oracle_initial_snapshot`: every plaintext oracle case (210, including the 28 Task 7 selection-identity cases) with an unsupported object key
    returns the oracle's normalized `initial` snapshot (minimum width, grapheme alignment, sorting/merging, primary identity, CRLF, EOF, UTF-16 inputs).
  - `proposal_has_the_exact_wire_shape`, `evaluate_rejects_bad_requests_...` (all error details above, no text in stderr, replica never touched), `non_character_keys_do_nothing_...`, `scope_accounting`
    (every excluded case has an explicit out-of-scope reason; all 114 Task 8 cases and the named plan cases must be in scope).
- `test/unit/matchEvaluate.test.ts` (carried Task 7 criterion 12): the same 156 cases as chains through the real `evaluate` AND the Task 7 TypeScript pipeline: `projectSelections` (primary first) ->
  simulated VS Code read-back (the touching-EOF-cursor merge) -> `RetainedSelection.retain/resolve` -> next request. After every step the state equals the oracle snapshot. 4 projected states are in the lossy class
  (two new cases `chain-lossy-eof-cursor-lf/-crlf`); in all 4 the editor read-back ALONE differs from the oracle state, and the retained semantic state is what the next `evaluate` carries. Also a straight (no projection) 4-command `mim` chain
  and the stable-error contract through `MatchClient.requestTyped`. Real VS Code event wiring (owned/external selection events) remains Task 17.

### Oracle fixture coverage
`test/fixtures/helix-match/cases/plaintext-objects-2.json`: 114 cases, `expected` generated ONLY by `npm run test:match:oracle -- --filter plaintext-objects-2/ --update`; all 141 pre-existing cases are byte-identical
(sha256 of every existing case file unchanged, `logs/fixtures-unchanged.txt`). Generator inputs came from a scratch script; the checked-in file is the oracle's output.

| Class | Cases | Examples |
|---|---|---|
| words / WORDs, whitespace and punctuation, EOF, CRLF, CJK, astral (+ empty-document maw) | 23 | miw on punctuation, whitespace run, newline char; maw leading whitespace at EOF; miW vs miw; count ignored by words; EOF cursor with/without newline |
| paragraphs (+ empty-document map) | 16 | counts 2/9, EOF without newline, whitespace-only separator line, CRLF, blank-run cursor, multi-cursor, reversed |
| explicit pairs, aliases, quotes (+ empty-document `mi(`) | 37 | `[ ] { } < >` open/close aliases, `' "` `` ` ``, escaped quotes, multi-line, unmatched, counts 2 and 9, cursor on delimiter, empty pairs, selection covering the pair, reversed, multi-cursor (merge, partial no-op, primary last), CRLF, EOF, empty document |
| closest pair `m` | 4 | mixed nesting, quotes in brackets, no pair, count 2 |
| consecutive chains | 15 | mim x4, mi( x3, ma( x3, ma then mi, miw maw, maw x3, miw mip, mip map, count then plain, quote then paren, cancelled mi between, multi-cursor, reversed with primary not first, CRLF, astral |
| touching-EOF-cursor lossy class | 2 | LF and CRLF, primary on the EOF cursor |
| custom / non-ASCII characters and modified keys | 17 | guillemet alias, curly quote, Greek letter, CJK char, fullwidth paren, astral count 2, space, `.` `*` `\|`, `<C-w>`, `<A-(>`, unsupported `Q` and `0`, `<ret>`, UTF-16 input offsets |
Of the pre-existing cases, 42 are in scope (23 plaintext-objects, 8 counts-pending, 10 selections-eol, 1 plaintext syntax-objects case); the other 99 are excluded with a printed reason
(`mm`/`ms`/`mr`/`md` commands, languages and Git (Tasks 9/10+), selection-only Task 7 cases, select mode, capture/hunk object keys).

## Compatibility edits outside the task's primary write scope (evaluate is no longer an unsupported method)
Needed because `evaluate` became a production method (advertised in `initialize`); each only replaces `evaluate` as the example of an unsupported method, or adds it to a literal method list:
- `test/unit/matchClient.test.ts` L685 and L732: `evaluate` -> `continue` (the two lines named in the task; nothing else).
- `test/unit/matchSelections.test.ts` L405 and `test/unit/matchSync.test.ts` L212: "stays unsupported" list `['evaluate','continue','cancel']` -> `['continue','cancel']`; `matchSync.test.ts` L738: production capability list gains `'evaluate'`.
- `native/match-helper/tests/protocol.rs`: capability list, the unsupported-method loop (`evaluate` removed), the round-trip fixture name `unsupported_method_evaluate` -> `unsupported_method_continue`.
- `native/match-helper/tests/fixtures/protocol/`: `constants.json` and `initialize.response.json` method lists gain `evaluate`; `unsupported_method_evaluate.{request,response}.json` replaced by `unsupported_method_continue.{request,response}.json` (same shape, method `continue`).
These were not in the list of files named by the task; they are the minimum to keep the previously passing suites green and are listed so the supervisor can judge them.

## Deviations / limits
- `evaluate` rejects the actions and objects of later tasks explicitly (`action_not_implemented`, `object_not_implemented`) instead of faking reference behaviour. Plaintext `mif`/`mig` etc. (reference: unchanged range / "Diff is not available" status) are therefore pending for Tasks 9/10, not passing.
- Syntax-backed pairs: the replica's syntax is passed through, but only plaintext is verified here (Task 9).
- Escape/cancel of a pending object phase is a client state-machine concern (no request); the planner treats it as no request. A direct Escape key sent to `evaluate` is the upstream no-op and is tested.
- No new Rust dependency; `native/Cargo.lock` untouched (0 deviations).
- Real VS Code wiring remains Task 17.

## Pending for Task 9+
Capture objects (`f t a c T e x`), `g` (needs `Environment` diff handle and status "Diff is not available in current buffer"), syntax-backed pairs verification, language alias table; `brackets`, `add`, `replace`/`continue`, `delete` actions; `sessionId`/continuation state (stateless today).

Total 23 + 16 + 37 + 4 + 15 + 2 + 17 = 114.
