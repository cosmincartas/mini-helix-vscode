# Task 12: propose surround additions (worker #17)

Plan Task 12 (FR-4, FR-7, FR-8, NFR-2). `evaluate` now answers the action `add` (`ms`) with one proposal: the sorted edits of ONE upstream transaction
(base-document UTF-16 coordinates) and the post-edit semantic selections. Nothing is committed: the proposal never updates the replica; the native `change`
event for the applied edits is the only commit input. No Helix algorithm is written here.

## Design
- `evaluate/surround_add.rs`: adapter for upstream `surround_add` (below). Reads the one callback key like upstream (`event.char()` whatever the modifiers; Enter with any
  modifiers; any other key does nothing), builds all insertions with `Transaction::change` and the resulting ranges with `Range::new(offs + from, offs + to + surround_len).with_direction(..)`.
  The count is not read (`ms3` is the character `3`; a count typed before `ms` has no effect, as upstream).
- `evaluate/edits.rs`: wire export of a changeset with the pinned `ChangeSet::changes_iter` (document order; `ChangeSet::insert` already merges the close of one range and the open of the next
  when they are at one offset, so an offset never carries two inserts - the `change` request treats those as ambiguous); only char -> UTF-16 conversion against the BASE rope is local.
- `evaluate/mod.rs`: `Outcome.changes: Option<ChangeSet>`; `evaluate` applies the changeset to a CLONE of the replica rope, runs `Selection::ensure_invariants` and the export on the POST-edit rope
  (upstream `Document::apply` installs the transaction selection with `ensure_invariants` on the new text) and returns the base edits. Dispatcher arm `Action::Add`.
- `documents/mod.rs`: `ReplicaView.eol` (the configured EOL from `open`/`snapshot`/`configure`) - Enter uses it, never the text's own line endings.

## Proposal wire shape (`result` of `evaluate`, action `add`)
```json
{"kind":"proposal","documentId":"w","generation":1,"baseVersion":1,"selectionGeneration":3,"sessionId":7,
 "edits":[{"start":0,"end":0,"text":"("},{"start":2,"end":2,"text":")"},{"start":3,"end":3,"text":"("},{"start":5,"end":5,"text":")"}],
 "ranges":[{"anchor":0,"head":4},{"anchor":5,"head":9}],"primary":1,"status":{"category":"none"}}
```
`edits`: `{start,end,text}` (the `change` request shape), zero-based UTF-16 code units of the base document, sorted, non-overlapping, never two inserts at one offset (touching ranges give one `")("` insert).
`ranges`/`primary`: complete canonical selection set in the POST-edit document (UTF-16), primary index into it. A non-character, non-Enter callback key answers `edits: []` and the normalized unchanged selection.
`src/native/protocol.ts` already typed `EvaluateProposal.edits: TextEdit[]`; only the documentation comments changed.

## Adapter inventory (pinned ba40e547426b0f9896c8bdc699a4ab11f2b37dbc, tree `native/upstream/helix`; same table in `evaluate/surround_add.rs`)
| Upstream symbol | file:line | Use |
|---|---|---|
| `surround_add` (`on_next_key`, `event.char()`, Enter branch, `changes`/`ranges`/`offs`, `Transaction::change(..).with_selection(..)`) | helix-term/src/commands.rs:6374-6417 | `surround_add::surround_add` (key in the request; transaction returned, not applied) |
| `doc.apply` selection install (`ensure_invariants` on the post-edit text) | helix-view/src/document.rs:1467-1471 | `evaluate` (post-edit rope) |
| `exit_select_mode` | helix-term/src/commands.rs:6416 | not needed (no SELECT mode for match commands; `selections-eol/select-mode-ms` excluded and accounted) |
| `autoinfo` / `Info` popup | helix-term/src/commands.rs:6376, 6419+ | not needed (UI) |
| `KeyEvent::char`, `KeyCode::Enter` | helix-view/src/input.rs:73; commands.rs:6388 | `MatchKey::character`, `MatchKey::Enter` |
| `match_brackets::get_pair`, `PAIRS` | helix-core/src/match_brackets.rs:223, :27 | called unchanged (so `m` is a literal) |
| `LineEnding::as_str`, `len_chars` | helix-core/src/line_ending.rs:37, :29 | called unchanged, on the replica's configured EOL |
| `Transaction::change`, `ChangeSet::from_changes`, `Transaction::with_selection`, `ChangeSet::changes_iter`, `ChangeSet::apply` | helix-core/src/transaction.rs:658, :532, :589, :523 | called unchanged |
| `Range::new`, `Range::with_direction`, `Selection::new`, `Selection::ensure_invariants` | helix-core/src/selection.rs | called unchanged |

## Tests
- Fixtures: `test/fixtures/helix-match/cases/surround-add.json`, 112 cases, `expected` written ONLY by `npm run test:match:oracle -- --update --filter surround-add`; the 11 pre-existing case files are byte-identical (sha256sum -c: all OK, logs/fixtures-unchanged.txt).
  Coverage: 22 ASCII characters and bracket aliases (`( ) [ ] { } <lt> <gt> " ' ` | * _ / ~ $ - space . @ \`); literals `m w i a s Z 0 7`; 15 Unicode surround characters (guillemets, curly quotes, full-width, e-acute, CJK, non-BMP
  emoji and math-bold, NBSP, ZWJ, combining acute, regional indicator, variation selector, hangul jamo); grapheme-alignment documents (combining mark closing next to text, flag join, decomposed text); UTF-16 selection input over non-BMP text (single, multi, reversed);
  Enter (LF; CRLF; LF text in a CRLF document; CRLF text in an LF document; Ctrl/Alt Enter; EOF without final newline; single char document; touching ranges); multiple selections (primary middle/last, mixed reversed, unsorted input, touching, cursors on each line, five-range
  offset accumulation, overlapping merge, spanning lines, EOF without newline, whole document, empty document, reversed cursor); callback semantics (`ms<C-x>`, `<A-x>`, `<C-A-x>`, `<C-(>`, `ms3`, `2ms(`, `3ms5`, non-characters `tab left up backspace C-left home`, Escape, cancel/non-char then next command);
  chains (nested add, add then `mi(`/`ma"`, three adds, multi-add then inside, add then `d`, count after add, `msm` then `mim`); syntax (rust, rust CRLF, rust string quote, markdown fence injection, json, initial-parse failure, incremental-parse failure after the add).
  Task 9's two excluded incremental-parse `ms` cases (`syntax-failure/incremental-*`) and the `ms` cases of `surround`, `counts-pending`, `selections-eol` are replayed too (127 cases in scope; `selections-eol/select-mode-ms` excluded: SELECT mode).
- `native/match-helper/tests/surround_add.rs` (6 tests; plain build 124 cases / 3 skipped needing injection, `--features test-support` 127 cases / 0 skipped, on the test-only helper):
  every case is replayed through a real helper process; for each `ms` request: edits sorted and non-overlapping (no two inserts at one offset), applying the edits to the base text (UTF-16) equals the oracle text, ranges + primary equal the oracle snapshot (UTF-16, direction, primary), status category equal,
  the same request evaluated twice returns the same proposal (replica untouched; the test-support build additionally observes replica text and version), the proposal edits are then mirrored as the native `change` (ack length equals the oracle length) and the proposal selection feeds the next request;
  syntax state equals the oracle's after every step (incl. parser failure injection after the `ms` edit). Plus exact wire shape, Enter EOL (document vs text, `configure`), callback-character semantics for all modifier sets and non-characters, and request rejection (keys, freshness, selection validity) with no replica change and no document text in diagnostics.
- `tests/common/keys.rs`: `<ret>` with modifiers, `<tab>/<left>/<right>/<up>/<down>/<backspace>/<home>/<end>` as `other` keys. `tests/common/oracle.rs`: new `Scope::Surround` (the Syntax scope plus the `ms` command; `g` is a surround character there).
  The Plaintext and Syntax scopes are unchanged, so Tasks 8 and 9 still exclude `ms` cases as before.

## Compatibility edits to existing files (minimal)
- `native/match-helper/tests/textobjects_plain.rs`: `add` removed from the list of actions that must answer `action_not_implemented` (now `brackets replace delete`).
- `test/unit/matchEvaluate.test.ts`: the `action_not_implemented` probe uses `replace` instead of `add`.
- `native/match-helper/src/evaluate/textobjects.rs`: `Outcome` literals gain `changes: None` (the only change).
- `src/native/protocol.ts`: documentation comments only.

## Verification (logs/)
RED `red-1-add-not-implemented.txt` (5 of 6 tests fail: the pre-Task-12 dispatcher answers `action_not_implemented`); `final-*.txt`; mutation `mutation-enter-ignores-eol.txt` (Enter ignoring the document EOL: `enter_uses_the_documents_configured_line_ending_not_the_texts` and the oracle replay fail; source restored by SHA-256).
Baseline: 24 files hashed (logs/baseline-hashes.txt): only `package.json` differs, as already recorded before this task (not touched here).

## Notes
- First test-support run failed in the test (not the helper): `test_observe` is a test-support method and the first version of the test used the production helper for non-failure cases; the test now uses the test-only helper for every case in that build.
- A count before `ms` is carried by the request and ignored (upstream does not read it); the planner of the future client decides whether to forward it.
