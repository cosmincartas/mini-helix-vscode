# Task 6 evidence: exact document replica synchronization (worker #40)

Plan Task 6 (FR-9, FR-12, FR-14, NFR-5). Entry point: `MatchClient.documents` (`src/native/documents.ts:DocumentSync`) and the helper methods
`open`, `change`, `snapshot`, `configure`, `close`. Logs: `logs/`. Hashes: `file-hashes.txt`. Status: `STATUS.md`.

## Files
Helper (`native/match-helper/`):
- `src/documents/mod.rs`: replica store (`Documents`), typed params, handlers, syntax lifecycle, test-support methods (feature-gated).
- `src/documents/text.rs`: JSON string literal decoding with lone-surrogate detection, UTF-16 offset -> scalar index conversion.
- `src/documents/language.rs`: VS Code language ID -> pinned Helix language (documented initial mapping).
- `src/protocol/session.rs`: method table rows, typed `Request<'a>` variants, dispatch; `src/lib.rs`: `pub mod documents`.
- `src/bin/test_helper.rs`, `Cargo.toml` (feature `test-support`, bin `mini-helix-match-helper-test` with `required-features`).
- `tests/documents.rs` (6 process tests, feature-gated), `tests/protocol.rs` + `tests/fixtures/protocol/{constants.json,initialize.response.json}` updated, new fixtures
  `unsupported_method_evaluate.{request,response}.json`.
Client: `src/native/documents.ts` (new), `src/native/protocol.ts` (typed shapes), `src/native/matchClient.ts` (`documents`, `requestTyped`, `readyNow`, `documentSource` option; the
state/teardown/shutdown logic, including the escalated VR5-1 behaviour, is untouched). Tests: `test/unit/matchSync.test.ts`.
Also: `test/unit/matchClient.test.ts` lines 685 and 732 (see Deviations).

## Protocol additions (all params camelCase, `deny_unknown_fields`; text fields are decoded from raw JSON literals)
| method | params | result | errors |
|---|---|---|---|
| `open` | documentId, uri, localPath?, generation, version, languageId, text, eol (`lf\|crlf`), trust (`trusted\|untrusted`), retainedSyntax? | `{documentId, generation, version, language, syntaxState, utf16Length, retainedSyntaxApplied}` | `unsupported_text/lone_surrogate`; `invalid_request`: `already_open`, `invalid_document_id`, `value_too_long`, `value_out_of_range`, `invalid_params` |
| `change` | documentId, generation, baseVersion, version, edits[{start,end,text}] (UTF-16 offsets into the BASE snapshot, any order) | ack (no `retainedSyntaxApplied`) | `resync_required`: `unknown_document`, `version_mismatch` (data.actual); `invalid_request`: `stale_generation`, `invalid_version`, `overlapping_edits` (overlap, or two inserts at one offset), `edit_range_inverted`, `edit_out_of_range`, `edit_inside_surrogate_pair`; `unsupported_text` |
| `snapshot` | documentId, generation, version (>= replica), languageId, text, eol, trust, retainedSyntax? | ack | as above plus `stale_version` |
| `configure` | documentId, generation, version (== replica), languageId, eol, trust | ack + `eol`, `trust` | `resync_required` on version mismatch |
| `close` | documentId, generation | `{documentId, released}` (idempotent) | `stale_generation` |
Rules: all edits of an event are validated against the base rope (offsets converted to scalar indices there, sorted, non-overlap checked), then applied as ONE
`Transaction::change`/`ChangeSet` and the syntax is updated with the pinned `Syntax::update(old rope, new rope, changeset)`. A rejected request never changes a replica; its version
protects later requests. An unknown document is `resync_required`; a different generation of a known ID is `invalid_request/stale_generation` and has no effect. Text is exact (CRLF/LF/CR kept;
EOL is metadata only). Malformed UTF-16 (lone surrogate escape) is `unsupported_text`, never replaced. `evaluate`, `continue`, `cancel` remain `unsupported_method`.
Capabilities now list `initialize shutdown open change snapshot configure close` (`constants.json` implementedMethods updated).

### syntaxState semantics
`no_language` (plaintext/unknown), `no_grammar` (language known, grammar library absent from the packaged runtime, e.g. reference-excluded `gemini`), `available`,
`initial_failure` (`Syntax::new` failed, 500 ms upstream timeout preserved), `update_failure` (`Syntax::update` failed: syntax set to none as `Document::apply_impl` does).
Failure states are sticky: later changes, snapshots and recovery never retry. They end only with a language change = upstream `set_language` (a `configure`/`snapshot` whose VS Code languageId differs from the
document's current one rebuilds the syntax; EOL/trust changes do not). The client retains the state per generation and sends it as `retainedSyntax {state, language (Helix id), compatibilityIdentity}` with `open`/`snapshot`;
the helper honours it only for a failure state, the same resolved language and its own compatibility identity (otherwise `retainedSyntaxApplied:false`, fresh parse).

## Client (`MatchClient.documents`)
`open(snapshot)`, `change({documentId, generation, version, edits})`, `configure(...)`, `close(id, generation)`, `ensureSynced()`, `state(id)`; the host supplies text through
`MatchClientOptions.documentSource.snapshot(id)` (the client keeps no text). Results `{status: applied|resynced|ignored|unsynced, ack?}`:
`ignored` = version not newer than the replica's (a duplicate or late event is never applied twice); a version gap (`!= acked+1`), a previous rejection, `resync_required` or an epoch
change send a complete `snapshot`/`open` from the host snapshot; `unsynced` = no helper running (nothing is spawned by a document event); `ensureSynced()` (the explicit match action) starts one helper if needed
and opens every registered document with its retained syntax state. One promise queue per document keeps operations in order; `close` unregisters at once, releases the replica after queued work, and a reopen waits for it.
Old generations are rejected client-side (`stale_generation`) without sending. `MatchClient.request` stays loose for the Task 5 transport tests; exact shapes are `DocumentMethods`/`TestMethods` via `requestTyped`.

## Observation method gating (test-only)
`test_observe {documentId, includeText?}` (version, UTF-16 length, scalar count, SHA-256 of the exact text, text, EOL, trust, syntax state, open replica count) and `test_inject_syntax_failure
{kind: update_parse|initial_parse, documentId?}` (one-shot, deterministic: the next real syntax update/initial parse fails) exist only when (1) the cargo feature `test-support` is compiled in AND (2) the session was created
with `Session::with_test_support()`, which only `src/bin/test_helper.rs` (`mini-helix-match-helper-test`, `required-features`) calls. The production `serve` path (`main.rs`) never enables it; the
production binary built without the feature contains none of the code (`logs/production-binary-strings.txt`: 0 occurrences of the method names vs the test binary). Even a production binary built WITH the feature answers them
`unsupported_method` and does not list them (asserted in `tests/protocol.rs` and in the TS "production helper" test). Build: `cargo +1.90.0 build --locked --manifest-path native/Cargo.toml -p mini-helix-match-helper --features test-support --bin mini-helix-match-helper-test`.
The extension never packages or spawns it.

## Language mapping decision (Task 9 must complete)
Order: `plaintext` = explicit no language; documented alias table `ALIASES` in `language.rs` (16 entries, e.g. `javascriptreact->jsx`, `typescriptreact->tsx`, `shellscript->bash`, `csharp->c-sharp`, `makefile->make`, `bat->batch`; every target is
verified to exist in the pinned loader by a unit test); pinned `Loader::language_for_name`; then pinned `language_for_filename` (local path, else URI path, no percent-decoding) and `language_for_shebang`; else no language.
Task 9 must: complete/verify the VS Code id table against the pinned `languages.toml` (ambiguous ids, e.g. `jsonc`, `ignore`, `dockercompose`, `terraform`), decide the `plaintext`-with-known-extension and untitled cases against the reference,
verify percent-decoded/Windows URIs, `content_regex`/glob conflict resolution (upstream TODO), and test file extensions, shebangs, untitled files and language changes end to end.

## RED
The TypeScript client and Rust handlers were written before the RED run was archived (the work crossed a turn limit), so RED is retroactive and honest: `logs/red-matchsync-test.txt` runs the final test file against the
pre-Task-6 helper (`native/target/release/mini-helix-match-helper`, built 04:48, no document methods): 16 of 18 tests fail (the 2 client-only tests pass), e.g. `open` -> `unsupported_method`, capabilities lack the document methods.
The first green attempt also failed 3 tests because of test-fixture mistakes (fixed, not behaviour changes); `change()` initially threw synchronously for unknown documents instead of rejecting (found by the client-only test, fixed).

## Verification (logs/)
- `green-matchsync-run1..3.txt`: `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 node --test out/test/unit/matchSync.test.js` (3 consecutive runs; counts in STATUS/report).
- `cargo-test-plain.txt` and `cargo-test-test-support.txt`: `cargo +1.90.0 test --locked ...`; the second adds `tests/documents.rs`.
- `lock-impact.txt`, `check-helix-runtime.txt`, `npm-test.txt`, `check-keybindings.txt`, `baseline-check.txt`, `mutation-checks.txt`, `latency-release.json` (+ `measure-sync-latency.cjs`), `production-binary-strings.txt`.
- Sentinel: TS test "never puts document text into helper diagnostics or error details" (client diagnostics, error message/detail/data) and Rust `diagnostics_on_stderr_never_contain_document_text_uri_or_ids` (raw helper stderr, every line JSON, sentinel in text/URI/path/ID/language across accepted and rejected requests).
- Mutation checks (`mutation-checks.txt`): snapshot re-enabling syntax (first run missed it because client-retained state masked it; direct-snapshot assertion added, then killed), generation unchecked, lossy surrogate, sequential edits, client duplicate-apply, client retained state not sent: each fails named tests.
- Lock: `native/Cargo.lock` and `native/helix-lock.json` byte-identical (no new dependency; only a feature and a bin target in `Cargo.toml`); `compare-cargo-lock` 0 deviations; `check:helix-runtime` OK, runtimeHash fd5ee12c...ffbea2b.

## Measurements (`logs/latency-release.json`, release test helper, Node v26.8.2, linux-x64, 30 rounds, single inserted char mid-document, client round trip incl. acknowledgement; no threshold claimed)
| doc | open ms | change median ms | syntaxState |
|---|---|---|---|
| plaintext 1k/10k/100k lines | 10.7 / 2.2 / 26.7 | 0.054 / 0.046 / 0.058 | no_language |
| rust 1k lines | 61.8 | 1.81 | available |
| rust 10k lines | 49.3 | 16.5 | available |
| rust 100k lines (3.1 MB) | 467 | 218 | available |
Helper startup incl. runtime verification (release): 158 ms. All replicas matched the host text hash. Syntax update cost grows with document size (upstream `Syntax::update` on a flat file of 100k items);
the work runs in the helper process, so the extension host is not blocked, but the acknowledgement waits for it. Debug-build latencies are far higher (4.3 s helper start) and not reported as measurements.

## Deviations, limits, pending
- `test/unit/matchClient.test.ts` (Task 5's file, outside the stated write scope) was edited minimally: lines 685 and 732 used `request('open', ...)` against the REAL helper expecting `unsupported_method`; implementing `open` makes that impossible, so they now use `evaluate`
  (still unsupported). Needs supervisor acceptance (original saved as /tmp/hm-p6-matchClient.test.ts.orig). Fixture `unsupported_method.request.json` (method `open`) is kept for the TS frame-format test; the Rust round trip uses new `unsupported_method_evaluate.*`;
  `unsupported_method.response.json` is now unused.
- A rejected `change`/`snapshot` leaves the replica untouched (spec: the client sends a snapshot); safety relies on version checks, not on dropping the replica.
- `src/native/documents.ts` and `matchClient.ts` import each other (type-safe; `MatchClientError` is used only at call time).
- Only linux-x64 verified. Retained-state compatibility identity is the Task 2 manifest identity. Diff state (`configure` "clears incompatible diff state") does not exist yet (Task 14). Windows `file:` URI path detection and percent-decoding: Task 9.
- The activation wiring (`src/extension.ts`) is untouched; VS Code event adapters (mapping `TextDocumentChangeEvent` to `DocumentChange`, versions, generations) are a later task.
- Baseline: only `package.json` differs from baseline hashes (pre-existing, concurrent Task 3 work; not touched here).

## Correction (task #42, finding P6R-1)
Finding: after the helper rejected a change with an error other than `resync_required` (for example two inserts at one offset -> `overlapping_edits`), `needsSnapshot` was set but `ensureSynced()` only selected entries with `syncedEpoch !== ready.epoch`, so the replica stayed stale (version 1 `abc\n` vs host version 2 `aXYbc\n`) and the explicit match action reported success with no failure.
Fix (`src/native/documents.ts`, `ensureSynced()` only): entries are also selected when `needsSnapshot` is set on the current epoch and are resynchronized with a complete host snapshot (`resync(entry, ready, preferSnapshot = true)` -> helper `snapshot`, falling back to `open` on `resync_required`). They are reported in `synchronized` on success and in `failures` otherwise (for example a host snapshot with a lone surrogate -> `unsupported_text`/`lone_surrogate`; the document stays `needsSnapshot` and the replica untouched). `change()` is unchanged (still rethrows the helper's error; no immediate snapshot, per the spec's "next explicit match action"). No change to `matchClient.ts`, the helper envelope or protocol.
Test (`test/unit/matchSync.test.ts`, 19 tests now): "resynchronizes a replica left stale by a rejected event at the next ensureSynced, and reports an unsupported host snapshot as failed": overlapping inserts rejected -> replica stale -> `ensureSynced()` -> `synchronized: [id]`, `assertReplica` equals host, second `ensureSynced()` has nothing to do; then a lone-surrogate host snapshot -> `failures` with `unsupported_text`, `needsSnapshot` still true, replica unchanged; repaired host -> synchronized again.
Evidence (`correction/`): `green-matchsync-run1..3.txt` (19/19 each), `reviewer-probe-after-fix.txt` (reviewer's /tmp/hm-p6r-probe/p2.cjs: now `synchronized ["d"]`, replica version 2 `aXYbc\n` equals host, needsSnapshot false), `mutation-check.txt` (compiled filter reverted: the new test fails, `actual: []` vs `expected: ['doc-1']`; compiled output restored afterwards), `matchclient-test.txt` (42/42), `npm-test.txt` (138 pass, exit 0), `check-keybindings.txt` (exit 0), `baseline-check.txt` (24 checked, only the pre-existing `package.json` difference).
The two pending-decision lines of `test/unit/matchClient.test.ts` are untouched.
