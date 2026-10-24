# Task 14: replacement transactions (`continue` with a character key) - worker #19

Plan Task 14 (FR-5, FR-7, FR-12, NFR-2). The second phase of upstream `surround_replace` is adapted: `continue` with a character key (whatever
its modifiers) answers the replacement PROPOSAL (one transaction), consumes the token, and never touches the replica. The Helix pieces are the pinned
ones (`get_pair`, `Transaction::change`, `Selection::map`, `ensure_invariants`, `ChangeSet::changes_iter`); only the orchestration is adapted. No
TypeScript Helix algorithm.

## Wire shapes (UTF-16 gap endpoints)
- `continue` request (unchanged from Task 13): `{documentId, generation, version, sessionId, selectionGeneration, continuationToken, key}`.
- Success, character key: the same shape as an `evaluate` proposal (the export is shared, `evaluate::proposal`):
  `{kind:"proposal", documentId, generation, baseVersion, selectionGeneration, sessionId, edits:[{start,end,text}...], ranges, primary, status:{category:"none"}}`.
  `edits`: sorted, non-overlapping, base-document UTF-16 coordinates; one one-character replacement per delimiter (adjacent delimiters, an empty pair,
  merge into ONE edit, e.g. `[{start:2,end:4,text:"[]"}]`); `ranges`/`primary`: the original selection mapped through the transaction (pinned
  `Selection::map` + `ensure_invariants`), expressed in the post-edit document. Example: `x (a b) y`, cursor (5,6), `mr(` then `[` =>
  `edits [{2,3,"["},{6,7,"]"}]`, `ranges [{5,6}]`, `primary 0`. No `continuationToken`; the token is consumed.
- Success, non-character key (unchanged): `{kind:"restored", documentId, generation, baseVersion, selectionGeneration, sessionId, ranges, primary, status:{category:"none"}}`; no edits.
- Failure (nothing consumed or edited, the token stays valid for its owner): `invalid_request/invalid_key` (key not exactly one scalar, checked first),
  `invalid_request/invalid_continuation_token` (malformed token), `stale_continuation/continuation_{unknown,document_mismatch,generation_mismatch,
  version_mismatch,session_mismatch,document_changed}`. A duplicate use of a consumed token, or a token released by change/snapshot/configure/close/
  supersession/restart, is `stale_continuation/continuation_unknown`. Errors never contain document text or the token.
- Semantics: the count is bound but unused by the second phase (as upstream); the key `m` is the literal new surround `m`; any other character without a
  pinned pair pairs with itself. A replacement by an identical character yields edits with identical text (upstream does the same; the oracle's text is unchanged).

## Adapter inventory (pinned revision ba40e547426b0f9896c8bdc699a4ab11f2b37dbc; native/upstream/helix)
Authoritative copy: header of `native/match-helper/src/evaluate/surround_replace.rs` (rows added by this task; the first-phase rows are Task 13's).

| Upstream symbol | Location (pinned) | Here |
|---|---|---|
| callback `Some(to) = event.char()`, `None => return doc.set_selection(view.id, selection)` | helix-term/src/commands.rs:6455-6460 | `continuation::continue_replacement` (key in the request) |
| `match_brackets::get_pair(to)` | commands.rs:6461; helix-core/src/match_brackets.rs:223 (`PAIRS` :27) | `surround_replace::second_phase`, called unchanged |
| `sorted_pos` from `change_pos.chunks(2)` as `(p[0], open)`, `(p[1], close)` + `sort_unstable` | commands.rs:6463-6469 | `second_phase` (same construction) |
| `Transaction::change(doc.text(), sorted_pos.iter().map(..(pos.0, pos.0 + 1, Some(Tendril))))` | commands.rs:6471-6478; helix-core/src/transaction.rs:658 | `second_phase`, called unchanged against the bound replica text |
| `doc.set_selection(view.id, selection)`; `doc.apply(&transaction, view.id)` (selection mapped through the changes + invariants on the post-edit text) | commands.rs:6479-6480; helix-view/src/document.rs:1452 (`apply_impl`, `.map` :1487, `.ensure_invariants` :1489) | `second_phase` (`original.clone().map(changes)`) and `evaluate::proposal` (`ensure_invariants` on the post-edit rope); nothing is applied to the replica |
| `exit_select_mode(cx)` | commands.rs:6481 | not needed (no SELECT mode for match commands; the oracle's select-mode case is excluded and recorded) |
| `ChangeSet::changes_iter` | helix-core/src/transaction.rs:523 | `evaluate::edits::export` (shared with `ms`) |

## REFACTOR: shared export
`evaluate::evaluate` built the proposal JSON inline; it is now `pub fn evaluate::proposal(base, outcome, binding, selection_generation)`, used by `evaluate`
(all non-replace actions, `ms` included) and by `continue`. Behaviour of the existing answers is unchanged (every earlier differential test passes).

## Tests (cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test surround_replace)
Differential (oracle): all `mr` cases of `surround`, `surround-replace-preview` and the new `surround-replace` group (433 cases; plain build 428 + 5 failure-
injection cases skipped with a printed count, test-support 433 / 0 skipped): 375/378 previews, 200/201 replacement `continue` calls whose applied edits equal
the oracle's final text, selections, primary and status; 42/43 cancelling keys restored; 56/58 lookup failures; sequences of replacements/commands on the
edited document. Each replacement also checks: edits sorted, non-overlapping and inside the base text; the replica unchanged by the proposal (test-support
build) and committed only by the mirrored `change`; a duplicate `continue` and a `cancel` with the consumed token are stale/`released:false`.
Hand-written: exact wire shape and no leakage; nested pairs with interleaved sorted edits (derived by hand); UTF-16 coordinates with non-BMP text before the
pair and a non-BMP replacement; adjacent delimiters merge; literal new `m`; every modifier set gives the same proposal and non-character keys (Enter, arrows)
restore; single use and per-session isolation and supersession; binding rejection for character keys (document, generation, version, session, forged,
malformed, invalid key) with the token surviving and the owner then succeeding; every release event (change, other document's change, snapshot, configure,
close + reopen, committed replacement, helper restart); replica unchanged / only a mirrored change commits (test-support).
Fixtures: `test/fixtures/helix-match/cases/surround-replace.json`, 214 cases, inputs from `generate-cases.cjs` (this directory), `expected` ONLY from
`npm run test:match:oracle -- --filter surround-replace/ --update`; the 14 earlier case files are byte-identical (`logs/fixtures-unchanged.txt`).
Groups: every old/new key combination of the pairs and aliases (`( ) [ ] { } < >`), identical-delimiter quotes both ways, same-character replacements,
literal self-pairing characters (`* _ / space digit letter`), literal new `m` (after `mrm` and after an explicit pair, multi-selection), modified keys
(`<C-x> <A-[> <C-A-{> <C-lt> <C-space>` and modified old keys), Unicode (non-BMP old/new, guillemet, CJK, fullwidth, lone combining mark, lone ZWJ, clusters next
to delimiters), nested pairs/counts (2mr, 3mr, 2mrm; interleaved multi-selection edits; empty pair; adjacent and touching pairs; multi-line), cursor on/after/
before delimiters, ranges (reversed, covering content, covering the pair), 2-4 selections with the primary first/middle/last, merged and overlapping selections,
lookup errors, eleven cancelling non-character keys, sequences (replace twice, replace then `mi[`/`ms{`, back-and-forth, cancel then replace, outer then inner),
BOF/EOF, CRLF/LF-with-CRLF-config/lone CR, syntax-aware old lookup (rust, markdown with injected rust, html with injected javascript/css, javascript, json, toml,
python, c, typescript) and a failed initial parse (plaintext fallback, test-support only).

## Compatibility edits to existing tests and files
- `native/match-helper/tests/surround_preview.rs`: the doc comment; the replay no longer sends the `continue` that asserted `continuation_replacement_not_implemented`
  (it releases the unused token with `cancel` and stops at the preview, as before; the replacement itself is replayed by `surround_replace.rs`); the test
  `a_replacement_character_is_validated_but_not_implemented_and_does_not_consume_the_token` became `a_replacement_character_is_validated_answered_by_the_proposal_and_consumes_the_token`.
- `native/match-helper/src/continuation.rs`: the lifecycle table row and the `TASK 14` marker; `src/native/protocol.ts`: the not-implemented wording, `ContinueResult`
  (typing only; `ContinuationMethods.continue.result` is now `RestoredSelections | EvaluateProposal`).
- `tests/common/mod.rs` (+ new `tests/common/replace.rs`): shared helper functions of the new test only.
- No other test asserted `continuation_replacement_not_implemented` (grep over native/, src/, test/). No protocol fixture changed: `continue`'s wire request is unchanged.

## Deviations, notes
- Timing of RED: the tests (and fixtures) were written BEFORE the implementation; RED (`logs/red-1-continue-not-implemented.txt`, tail of the cargo output) is genuine: 7 of 8 tests failed with
  `continuation_replacement_not_implemented`, `scope_accounting` passes by design. Two assertions of my own tests were then corrected (a hand-derived UTF-16 offset and the
  assumption that every delimiter is a separate edit; adjacent delimiters merge in the pinned changeset), both before any green claim.
- The 5 plain-build skips are the failure-injection cases (`failure.kind = initial-parse`); they run, and pass, in the test-support build.
- `Document::apply` has an early branch for empty changesets; a replacement transaction is never empty, so it is not reproduced.
- The count bound to the continuation is carried but unused (upstream's second phase does not read it).

## Pending / for later tasks
- Task 17/18: apply the proposal as ONE `TextEditor.edit` with the exact base-version check, then mirror it as a native change event; a same-character replacement
  (`mr(` then `(`; 18 oracle cases) produces edits whose new text equals the old text, which VS Code may report without a content change: the client must still
  advance the replica version for the proposal it applied, or treat "no content change" explicitly. Not decided here.
- The client must also replay ordinary keys after a lookup-failure proposal and apply `restored` only while it owns the editor (unchanged from Task 13).
- No TypeScript test drives `continue` through `MatchClient.requestTyped` (outside the write scope); the TS types are checked by `tsc` only.

## Logs (all .txt)
red-1-continue-not-implemented, final-surround_replace-{plain,test-support}, final-crate-{plain,test-support}, final-oracle, fixtures-unchanged, final-compile,
final-npm-test (HELIX_MATCH_REQUIRE_REAL_HELPER=1, 166/166), final-check-keybindings, final-compare-cargo-lock (0 deviations), final-check-helix-runtime,
baseline-hashes (24 files; only `package.json` differs, pre-existing), mutation-no-release-on-success (3 tests fail) + mutation-restore-hash, post-mutation-restore-tests.
