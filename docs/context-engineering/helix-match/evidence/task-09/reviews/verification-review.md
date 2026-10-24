# Task 9 Verification Review (Claude Code reviewer, task #46)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after the single correction batch (task #47); bounded to P9R-1, P9R-2, and correction regressions.
Inputs: [initial review](initial-review.md); snapshot `snapshots/post-task09/precorrection.tar`; delta `snapshots/task09-correction-delta.md`.

## Verdict

Pass. Both IDs resolved; no later findings.

## Per-ID status

- P9R-1 [P2] resolved. `language.rs` `resolve` (L130-137): alias → `language_for_name` → `document_path(...)?` → `language_for_filename` (glob, extension) → `language_for_shebang`, matching pinned `Document::detect_language_config` (helix-view `document.rs:1212`) and loader (`syntax.rs:377-391`). Pinned `languages.toml` has no `plaintext`/`text`/`txt` language and no `.txt` extension, so `plaintext` reaches path detection; untitled and unknown extensions still resolve to none.
  New test `plaintext_with_a_detectable_path_reaches_the_same_objects_as_the_language` passes in both builds. Revert probe (scratch copy): restoring the early return fails `syntax-objects-2/function-zig` (`Null` vs `"zig"`).
- P9R-2 [P3] resolved. `expected_helper_state` covers all 40 failure/override cases (`initial-parse` and root highlights/injections/locals overrides incl. ecma-inherited → `initial_failure`; incremental from `afterStep` → `update_failure`; injected-only and textobjects-only → `available`), asserted with `assert_eq!` at open and every step; coarse oracle comparison kept.
  Mutation probe (scratch copy): `build_syntax` `InitialFailure` → `NoGrammar` fails `syntax-failure-2/query-root-highlights-rust` (`no_grammar` vs `initial_failure`).

## Later findings

None meeting the bar. Class (c) observations: `root_query_directories` omits `_javascript` for javascript/jsx (no fixture overrides it; would fail loudly); `tests/documents.rs` plaintext callers with `.rs` URIs now parse rust (tests check replica/sync/redaction, still pass). Plaintext-dependent tests still get no language (`untitled:` in `textobjects_plain`/`matchEvaluate`; `.txt` in `matchSelections`/`matchSync`; `x.unknown` stays none).
Compatibility edits (`tests/documents.rs`, `matchSync.test.ts`) necessary and minimal.

## Checks run

- Crate tests with `--features test-support`: lib 14, documents 6, protocol 25, runtime_isolation 4, textobjects_plain 6, textobjects_syntax 10 (315 cases, 722 evaluates, 543 changed, 24 edits).
- `--test textobjects_syntax` without feature: 9 passed (304 cases, 11 skipped).
- `npm run test:match:oracle` OK; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `npm run check:helix-runtime` OK (manifest `1adc4aa0…`, link count 1).
- Scope: only the 6 delta files differ among 94 snapshot files; `envelope.rs`, `matchClient.ts`, `documents.ts` identical; evidence hashes 14/14; spec/plan frozen.

## Coverage and limits

`compare-cargo-lock` and `check:keybindings` not re-run (unaffected); VS Code integration tests not run.
