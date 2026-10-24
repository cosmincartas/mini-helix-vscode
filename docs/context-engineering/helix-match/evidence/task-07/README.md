# Task 7: preserve semantic selection identity (worker #43)

Plan Task 7 (FR-7, FR-12). Evidence for: UTF-16 wire offsets converted to scalar indices in Rust, upstream selection invariants applied by the pinned
helix-core, canonical primary identity retained, primary-first projection into VS Code, retained semantic metadata with invalidation.
No TypeScript Helix algorithm exists: normalization, grapheme alignment, minimum width and merging happen only in `helix_core::Selection`.

## Design

### Wire shapes (`src/native/protocol.ts`, mirrors `native/match-helper/src/documents/selection.rs`)
`WireRange {anchor, head}` (zero-based UTF-16 code-unit gap endpoints; anchor is the fixed end, `anchor > head` is reversed) and
`WireSelection {ranges: WireRange[], primary: number}` (explicit primary index into `ranges`). These are exactly the `ranges` and `primary`
fields of the later `evaluate` request. A helper result is in canonical (upstream) order with the primary index into that order.

### Rust path (native/match-helper/src/documents/selection.rs)
- `import(text, ranges, primary)`: validate (non-empty, primary in range, number <= 2^53-1) -> `text::char_of_utf16` per endpoint (out of range or inside a surrogate
  pair is rejected, never rounded) -> `Range::new(anchor, head)` -> `Selection::new(ranges, primary)` -> `.ensure_invariants(text.slice(..))`.
  This is exactly upstream `Document::set_selection` (helix-view `document.rs`: `selection.ensure_invariants(self.text().slice(..))`) and what the oracle
  does (`native/oracle/src/main.rs`: `Selection::new` then `doc.set_selection`). `ensure_invariants` = `transform(min_width_1 + grapheme_aligned)` + `normalize`
  (sort by `Range::from`, merge `overlaps`, primary follows the merge).
- `export(text, &Selection)`: canonical ranges back to UTF-16 (`text::utf16_of_char`), primary index, plus the scalar view (diagnostics).
- Conversion is centralised in `documents/text.rs` (`char_of_utf16`, new `utf16_of_char`); `selection.rs` is the only caller that interprets selection offsets.
- `Documents::replica_text(id, generation, version)` is the freshness gate every selection-bearing request starts with (unknown document and version mismatch are
  `resync_required`, another generation is `invalid_request/stale_generation`); Task 8 `evaluate` reuses `replica_text` + `import` + `export`.
- Protocol entry: **`test_normalize_selection` is TEST-ONLY** (cargo feature `test-support`, enabled per session by `mini-helix-match-helper-test`). Choice: the spec's method
  table has no selection method outside `evaluate` (Task 8), so no production method is added; the production helper answers it `unsupported_method` (asserted in the test) and
  `IMPLEMENTED_METHODS` is unchanged. Params `{documentId, generation, version, ranges, primary}`; result `{documentId, generation, version, ranges, primary, scalarRanges}`.
- Errors (`invalid_request` details, fixed strings, no text): `selection_empty`, `primary_out_of_range`, `value_out_of_range`, `selection_out_of_range`,
  `selection_inside_surrogate_pair`; mistyped/negative/fractional numbers and unknown fields are `invalid_params`. Malformed UTF-16 document text is refused when the
  document is opened (`unsupported_text`, Task 6), so no replica exists to select in (`unknown_document`).

### TypeScript boundary (`src/native/selectionCodec.ts`; no `vscode` import)
- Structural types (`PositionLike`, `SelectionLike`, `TextDocumentLike`) that `vscode.Position/Selection/TextDocument` satisfy; `selectionDocument(textDocument)` adapts a document.
  Selections are created through a caller factory (`projectSelections(doc, wire, (a, b) => new vscode.Selection(a, b))`).
- `wireFromSelections` (editor order, primary 0, direction kept), `assertScalarBoundary`/`assertWireSelection` (integer, in range, not inside a pair, lone surrogate beside an
  offset = `malformed_utf16`; `SelectionCodecError`, no text), `projectionOrder`/`canonicalIndex` (primary first, rest in canonical order; back-mapping of indices),
  `projectSelections`.
- `RetainedSelection` (one per editor): `retain(key, semantic, installed, readback)`, `resolve(key, doc, editorSelections)`, `own(action)`, `onSelectionEvent(selections)`,
  `invalidate()`, `selectionGeneration`, `tracked`, `retainedIsLossy`. Retained = canonical ranges + primary, document id/generation/version, VS Code read-back (the Task 1 design;
  `test/feasibility/package/editorOps.ts` was a reference only, nothing imported).
  Valid only while: same document id/generation, same version, **no external selection event since `retain`** (events are counted, not compared: equal selections restored
  externally still invalidate), and editor selections equal the retained read-back. Events inside an `own` scope are command-owned: they update `tracked`, do not invalidate and do
  not advance `selectionGeneration`; an external event advances it. Otherwise `resolve` falls back to the editor's own selections (primary index 0) and reports the reason.
- No CRLF shadow ranges (Task 1: none reachable). VS Code cannot place a position inside CRLF; Helix normalization never yields one (oracle: cursor between CR and LF becomes the whole CRLF).

## Oracle fixture
`test/fixtures/helix-match/cases/selection-identity.json`: 28 new cases (UTF-16 input, no steps), expected generated only by `npm run test:match:oracle -- --filter selection-identity --update`.
Existing case files are byte-identical (hashes in file-hashes.txt / unchanged check). Classes: scalars, point cursors, combining marks, astral scalars, ZWJ sequence, reversed, CRLF
(cursor between CR and LF, head/anchor inside, line break range), EOF with and without final newline, empty document, touching ranges, the three touching-EOF-cursor (VS Code lossy) shapes,
overlapping/nested/duplicate, primary not first, zero-width inside range.

## Tests (test/unit/matchSelections.test.ts, 23 tests)
Pure: offsets, lone surrogates, projection/back-mapping, retained metadata (lossy class reproduced against a simulated VS Code model that merges the touching zero-width EOF cursor,
restore, invalidation on version/identity/any external event/differing selections, owned events, nesting). Real helper (strict mode, explicit skip otherwise):
oracle differential of all 28 cases (UTF-16 + scalar view + primary + idempotence), codec round trip of all 28 (primary-first send, projection, simulated VS Code read-back, retained
resolve, helper import = oracle state; editor-only path loses information exactly in the 3 touching-EOF shapes), consecutive-state test, error cases (no document text in diagnostics),
freshness errors, malformed UTF-16 document, edit then select, production helper lacks the method.

### "Consecutive match commands preserve semantic state after projection"
Evaluate does not exist yet (Task 8). Demonstrated instead with ORACLE-generated consecutive states: all 266 normalized states of all 141 oracle cases (113 existing + 28 new) (every `initial`
and every step snapshot, including the `mr` replacement previews) go through codec projection -> simulated VS Code read-back -> `RetainedSelection` -> helper import; the state the
helper receives and exports equals the oracle state (UTF-16, scalar, primary) in all 266; 3 of them are in the lossy class and only the retained metadata restores them. Normalized states are
fixpoints of the helper import (`ensure_invariants` is idempotent), so the codec never changes a reachable state.
**Task 8 must re-verify with the real `evaluate`**: the helper's returned selections after a command are projected and read back by REAL VS Code (not the simulation), the next `evaluate` request
carries the retained state, and `d`/`c`/consecutive `m` results equal the oracle step results; also a real-VS-Code check of `RetainedSelection` event wiring
(`onDidChangeTextEditorSelection` owned/external classification, selection generation) because VS Code behaviour in this task is simulated from the Task 1 probe.

## Deviations / limits
- The "VS Code model" in the unit tests is a simulation of the Task 1 editor probe (lines split at CRLF/CR/LF, no position inside CRLF or surrogate pair, EOF-cursor merge). No real VS Code
  run in this task (VS Code integration tests are outside this task's write scope); Task 1 integration evidence stands for the real behaviour.
- Selections in a document with a lone surrogate are rejected at open (Task 6), so selection import is only reachable for well-formed text.
- `test_normalize_selection` is test-only; the production protocol gains selection fields with `evaluate`.
- No Rust integration test file was added: Rust unit tests in `selection.rs`/`text.rs` plus the TypeScript process-level tests against the real test helper cover the behaviour.
- Mutation checks: logs/mutation-checks.txt (note on contaminated rows 2-4).
