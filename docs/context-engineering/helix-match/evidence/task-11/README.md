# Task 11 evidence: match brackets (`mm`) through syntax and plaintext

Plan Task 11 (FR-3, FR-7, NFR-2). Entry point: native `evaluate` action `brackets`. Host: linux-x64, `cargo +1.90.0`. Raw outputs in `logs/*.txt`; hashes in `file-hashes.txt`.

## Result

| Check | Result | Log |
|---|---|---|
| RED: `cargo test --locked -p mini-helix-match-helper --test brackets` with the arm unimplemented | 6 of 7 fail with `action_not_implemented` (`scope_accounting` passes: it only checks planning of the fixtures, stated not hidden) | `red-1-brackets-not-implemented.txt` |
| GREEN, without / with `--features test-support` | 7 passed / 7 passed. Differential: 253 cases replayed (14 parser-failure cases need test-support) / 267 replayed, 273 / 291 `evaluate` requests | `final-green-brackets.txt`, `final-green-brackets-test-support.txt` |
| full crate tests, without / with `--features test-support` | all pass (rc=0 both) | `final-crate-plain.txt`, `final-crate-test-support.txt` |
| `npm run test:match:oracle` | OK, 940 cases + self-test (674 -> 940 with the 266 new cases) | `final-oracle.txt` |
| `npm run compile && HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` | 166 pass, 0 fail, 0 skipped | `final-npm-compile-test.txt` |
| `npm run check:keybindings` | rc=0 | `final-check-keybindings.txt` |
| `node native/runtime/compare-cargo-lock.cjs` | rc=0; `native/Cargo.lock` SHA-256 unchanged `f9ca4e5d...fd65b21` (no dependency change) | `final-compare-cargo-lock.txt` |
| `npm run check:helix-runtime` | OK, runtimeHash `fd5ee12c...ffbea2b` unchanged | `final-check-helix-runtime.txt` |
| 24 baseline files | 23 identical; `package.json` differs (pre-existing, from earlier tasks' scripts; not touched here, mtime older than this task) | `baseline-hashes.txt` |
| existing oracle fixtures | the 13 pre-existing case files are byte-identical before and after (only `brackets.json` added) | `fixtures-before-sha256.txt`, `oracle-update-brackets.txt` |
| mutation: plaintext branch forced even when syntax is available | 3 tests fail (`every_in_scope_...` at `brackets/rust-inside-body`, the alias replay, `syntax_and_plaintext_documents_answer_independently`); source restored, SHA-256 `9eedb4e3...ad8c` identical before/after, restored run green | `mutation-force-plaintext.txt`, `post-mutation-restored-green-brackets.txt` |

## Design

* `evaluate/brackets.rs` (new): `match_brackets(text, syntax, selection) -> Outcome`. `Selection::transform` over the complete set; per range `range.cursor(text)`, then `find_matching_bracket_plaintext` when the replica has no syntax tree and `find_matching_bracket_fuzzy` otherwise (the same condition as upstream's `doc.syntax().map_or_else`); a match gives `range.put_cursor(text, pos, false)`, no match leaves the range. `evaluate` applies `Selection::ensure_invariants` (the `Document::set_selection` step) and exports; status is always `none`.
* `evaluate/mod.rs`: the `Brackets` arm of `dispatch`. `mm` reads no key: `keys` must be empty (`invalid_request/invalid_keys` otherwise, never silently ignored). The count is validated like every action and not read (the pinned handler does not read it). A request never touches the Git baseline.
* Syntax lifecycle (spec "Syntax lifecycle"): the replica's syntax is `None` after a failed initial parse, a failed update, a failed root configuration (root `highlights/injections/locals`, including inherited `ecma` queries) or a language without a grammar, so those documents follow the plaintext branch with no extra code; a failing `textobjects.scm` or an injected layer's failing configuration keeps syntax available and still matches through the tree. All of it is asserted against the oracle's own parser state and results.

### Adapter inventory (pinned revision ba40e547426b0f9896c8bdc699a4ab11f2b37dbc, patched tree `native/upstream/helix`)
Also recorded in the module doc of `native/match-helper/src/evaluate/brackets.rs`.

| Symbol | Location | Where adapted |
|---|---|---|
| `match_brackets` (selection transform, `range.cursor`, syntax / plaintext branch, `put_cursor`, `set_selection`) | helix-term/src/commands.rs:5895-5914 | `brackets::match_brackets`; `evaluate` applies `ensure_invariants` |
| `is_select = cx.editor.mode == Mode::Select` | helix-term/src/commands.rs:5897 | constant `false`: no SELECT mode for match commands (oracle select-mode cases are excluded and recorded) |
| `doc.syntax()` | helix-view/src/document.rs:2018 | the replica's `syntax` (Task 6) |
| `match_brackets::find_matching_bracket_fuzzy` (`find_pair`) | helix-core/src/match_brackets.rs:73 (:77) | called unchanged |
| `match_brackets::find_matching_bracket_plaintext` | helix-core/src/match_brackets.rs:169 | called unchanged |
| `Range::cursor`, `Range::put_cursor` | helix-core/src/selection.rs:335, :353 | called unchanged |
| `Selection::transform`, `Selection::ensure_invariants` | helix-core/src/selection.rs:636, :662 | called unchanged |

## Fixture coverage (`test/fixtures/helix-match/cases/brackets.json`, 266 cases + the existing `plaintext-objects/mm-jump-bracket`)

Inputs: `oracle-case-input-generator.cjs.txt` (offsets computed by needle search). `expected` produced only by `npm run test:match:oracle -- --update --filter brackets/` (`logs/oracle-update-brackets.txt`).

* Plaintext documents (about 80): cursor on opener and closer of `() [] {} <>`, round trip, inside between, before, after, EOF, empty document; nested, unbalanced, mismatched and interleaved types; quotes and `|` are not brackets; brackets in strings counted; multi-line, CRLF, lone CR; `MAX_PLAINTEXT_SCAN` boundary (found at exactly 10000, lost at 10001, both directions); Unicode (accents, CJK, astral, combining mark, ZWJ family, fullwidth brackets); counts `3mm`, `12mm`, `m4m`, count not leaking; forward, backward and extended ranges, multiple ranges, primary first/middle/last, mixed matches and no-ops, ranges that swap ends, merge or touch; escape-cancelled `m`; `mm` then `mi(`; language without a grammar (wren).
* Syntax documents (about 110): rust (on, inside, outside; nested macros and closures; generics; strings, raw strings, char literals, line and block comments, doc and TODO comments with the comment injection layer; malformed text: unclosed, extra, mismatched, ERROR nodes, unterminated string and comment; empty, comment-only, no brackets; Unicode before and inside; reversed, forward and multiple selections, merge by shared scope, primary not first), javascript (templates, regex, JSX via tsx, generics), python, json, toml, c, html (attributes, injected script and style), markdown (prose, inline code, links, injected rust fence, unknown and missing fence language, ranges across layers), lua, go, bash, css, yaml, latex, nix.
* Syntax unavailable (about 30): initial parse failure (rust, markdown fence, html script, count, several cursors), incremental failure before and after the edit and never re-enabled, root `highlights/injections/locals` failures (rust, inherited ecma, markdown), injected layer failure, `textobjects.scm` failure (syntax stays); incremental updates feeding the next `mm` (edit, insert, edit inside a markdown fence).
* Helper tests outside the oracle set (`tests/brackets.rs`): exact proposal wire shape (UTF-16, ranges, primary, status, empty edits), `keys` must be empty, count/freshness/selection validation shared with `evaluate`, evaluation does not touch the replica (same request answers the same; test-support build observes the replica), no document text in diagnostics, syntax-versus-plaintext on the same text, VS Code language aliases reach the same answers (`shellscript`, `tex`, `typescriptreact`), a whitespace-only document (below).
* Statistics (test-support build): 291 `evaluate` requests, 225 matched a bracket (53 by the syntax-aware branch from a cursor not on a bracket, 80 by the plaintext branch), 166 cases answered with syntax, 103 without, 10 mirrored `change` events.

## Findings and deviations

1. **Upstream debug-build overflow, not in the fixtures.** helix-core `match_brackets.rs:154` computes `pos_ - node_start` for a childless root node that starts after the cursor. Reproduced by a whitespace-only rust document (`"  \n\n"`) with the cursor in the leading whitespace: the debug oracle panics (`attempt to subtract with overflow`), so no oracle `expected` can exist for it. The release arithmetic wraps and the result is no match: shown by building the oracle with `CARGO_PROFILE_DEV_OVERFLOW_CHECKS=false` into `/tmp/hm-p11-oracle-nocheck` (selection `(1,2)` unchanged, status none; `logs/whitespace-only-debug-vs-no-overflow-checks.txt`, `logs/oracle-nocheck-build.txt`). The helper guards the one syntax-aware call with `catch_unwind` and treats a panic as no match, so debug and release builds both answer the release reference result, and `tests/brackets.rs::a_whitespace_only_syntax_document_is_a_no_match_and_the_helper_survives` asserts it (helper alive, sanitized diagnostics). In a release helper the guard never triggers. The panic is only a deviation from the debug oracle. Supervisor attention: the guard hides any other panic of that call as a no-match; it records the location through the sanitized hook.
2. `is_select` is always false (no SELECT mode for match commands, as for `ms`).
3. `keys` for `brackets` must be empty (the contract leaves the key list for this action unspecified; `mm` takes no callback key). Rejecting a key is stricter than the other actions' "exactly one key" checks and lets Task 13's client send `keys: []`.
4. The new fixture is 1.4 MB: four boundary cases carry 10 000-character documents (the plaintext scan limit) in every snapshot.

## Compatibility edits to existing files

* `native/match-helper/tests/textobjects_plain.rs`: `brackets` removed from the list of actions asserted to answer `action_not_implemented` (now `replace`, `delete`).
* `native/match-helper/tests/common/oracle.rs`: new `Scope::Brackets` (everything of `Syntax` plus `mm` planned as `Event::Evaluate { action: "brackets" }`); no existing scope changed.
* `src/native/protocol.ts`: documentation comment of `EvaluateParams` only (no type change; `brackets` was already in `MatchAction`).
* `native/match-helper/src/evaluate/mod.rs`: module doc, `pub mod brackets`, the `Brackets` arm.
No TypeScript test needed an edit (`test/unit/matchEvaluate.test.ts` asserts `replace` for the not-implemented error).

## Pending

None for Task 11. Not in scope and still pending: `mr`/`md` (Tasks 13-15), VS Code wiring and key dispatch (Task 17+), other target builds.
