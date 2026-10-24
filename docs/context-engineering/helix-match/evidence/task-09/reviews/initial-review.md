# Task 9 Initial Review (Claude Code reviewer, task #46)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #14 (plan Task 9); snapshot `pre-task09` → delta list `post-task09/delta-files.txt`. The reviewer reached its turn limit once and was continued in the same context.
Orchestrator filter: P9R-1 (spec L487-489) and P9R-2 (plan Task 9 GREEN/Verification, spec L507, user rule) accepted. Non-findings not accepted.

## Verdict

Changes requested: 1 P2, 1 P3. Capture-object code matches pinned upstream; all required checks pass.

## Findings

| ID | Sev | Title | Location |
|---|---|---|---|
| P9R-1 | P2 | `plaintext` documents skip the pinned file and content detection | `native/match-helper/src/documents/language.rs:130-132` |
| P9R-2 | P3 | Exact unavailable syntax state not asserted; `initial_failure` for root-config failures never checked | `native/match-helper/tests/textobjects_syntax.rs:95-102` |

P9R-1: VS Code sends `languageId: "plaintext"` with a path for every file type it does not recognize (e.g. `/w/main.zig`, `.nix`, `.gleam`, `Cargo.lock`); `resolve()` returns `None` before detection, so capture objects no-op and pairs use plaintext, while pinned `Document::detect_language_config` (helix-view document.rs:1212) detects the language and `mif` selects the body. Worker tests used `x-unknown`, an ID VS Code never sends.
Basis: spec L487-489 "Use pinned file and content detection when no alias applies. Unknown languages use reference plaintext behavior." Task 6 handover (`evidence/task-06/README.md:59`) assigned this decision to Task 9, which locked it in (`language.rs:221-222`, `textobjects_syntax.rs:478-480`, README).
Suggested fix: remove the `PLAINTEXT` early return so `plaintext` goes through name lookup then path/shebang detection (untitled still resolves to nothing); update assertions, module doc, README. Escalate an explicit-Plain-Text reading as a contract question instead of deciding it in the worker.

P9R-2: `state_matches` accepts any of `initial_failure`, `update_failure`, `no_grammar` whenever the oracle reports `unavailable`; a regression acknowledging root highlights/injections/locals failures as `no_grammar`/`update_failure`, or incremental failures as `initial_failure`, would pass. `initial_failure` appears only in `tests/documents.rs:288-290` (Task 6 injection). Current code does produce `initial_failure` (verification gap, not behaviour defect).
Basis: plan Task 9 GREEN "acknowledge root configuration failure as `initial_failure`" and Verification; spec L507; missing evidence is pending.
Suggested fix: derive expected state from the case input (root query overrides or `initial-parse` → `initial_failure`; after `incremental-parse` → `update_failure`; excluded grammars → `no_grammar`) and assert exactly.

## Scope-item assessment

| Item | Necessary | Minimal | Intent | Verdict |
|---|---|---|---|---|
| `tests/textobjects_plain.rs` L258 (only `g` not implemented) | Yes | Yes | covered elsewhere | OK |
| `test/unit/matchEvaluate.test.ts` L395 `f` → `g` | Yes | Yes | keeps path covered | OK |
| `test/unit/matchSync.test.ts` L497-501 shebang with path; untitled → null | Yes | Yes | matches upstream | OK |
| `src/native/protocol.ts` comment | Yes | Yes | typing unchanged | OK |
| Untitled behaviour change | — | — | — | Correct: `detect_language_config` starts with `language_for_filename(self.path.as_ref()?)`, so no path → no shebang detection |

## Incident verification

`native/runtime/out/linux-x64/runtime/manifest.json` SHA-256 `1adc4aa0…a568b` equals lock `manifestSha256` (L5364), link count 1, unchanged after review runs; `npm run check:helix-runtime` OK (1799 assets, 301 grammars, `fd5ee12c…`). Overlay (`tests/common/mod.rs` `overlay_runtime`) hard-links only `grammars/`, `licenses/` (never written), copies `queries/`, writes a fresh manifest in `native/target/tmp/hm-overlay-*`; temp dirs removed afterwards.

## Coverage per acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED: 7 families, inherited queries, aliases, injected boundaries | Met | 246 + 39 oracle cases; RED 5/8 failing (language.rs refinements had no own RED — disclosed process gap) |
| RED: syntax-backed `mi(`/`ma(`/`mim`/quotes root and injected | Met | `rust-mim-with-syntax`, `rust-mi-paren-inside-string`, `pair-rust-double-quote`, `inj-md-rust-pairs`, 29 root + 60+ injected |
| RED: failure injection | Met | 4 initial-parse, 5 incremental + control, overlay textobjects/root/injected |
| Named target | Pass | 9/9 with feature; 8/8 without (11 skipped, listed) |
| Pinned loader/syntax APIs for f/t/a/c/T/e/x | Met | `CAPTURE_OBJECTS` vs `commands.rs:6308-6314`, closure 6273-6279, `textobject.rs:258` |
| Map language IDs explicitly | Partly met | P9R-1 |
| Absent captures no-op; broken assets distinguished | Met | toml `mic`; 1098-request sweep; `runtime_isolation.rs:172` |
| Parser state after edits / language changes | Met | 24 mirrored edits; `language_changes_rebuild…` |
| 500 ms timeout; permanent disable | Met | pinned `PARSE_TIMEOUT` (real timeout unexercised, spec L512); `update_failure_disables_syntax_for_good…` |
| Failure by query type | Behaviour met; state unasserted | P9R-2 |
| REFACTOR shared detection | Met | no per-language branches beyond alias table |
| Capture inventory incl. no-query languages | Met | 342 = inventory; 154 query / 180 none / 8 no grammar; 2156 pairs |
| Embedded results before/after edits | Met | `edit-md-rust-fence-edit-in-layer`, `incremental-failure-markdown-embedded` |
| Unavailable fallback and recovery via injection | Met (see P9R-2) | test-support helper + overlays |
| Oracle-derived expectations | Met | provenance `mini-helix-match-oracle`; oracle 552 PASS |
| Test-support hooks gated | Met | `cfg(feature)` + `with_test_support()` |
| `check:helix-runtime` | Pass | — |

## Checks run

- `cargo +1.90.0 test --locked ... --test textobjects_syntax --features test-support -- --nocapture`: 9 passed (315 cases, 722 evaluates, 543 changed, 24 edits); without feature 8 passed (304, 11 skipped).
- Crate tests with feature: lib 14, documents 6, protocol 25, runtime_isolation 4, textobjects_plain 6, textobjects_syntax 9; without feature all pass.
- `npm run check:helix-runtime` OK; `compare-cargo-lock.cjs` no deviations; `npm run test:match:oracle` 552 PASS; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `check:keybindings` exit 0.
- Integrity: spec/plan frozen; lock, `Cargo.lock`, inventory, `envelope.rs`, `matchClient.ts`, `documents.ts` identical to pre-task; 9 case files identical; baseline only `package.json` (unchanged since pre-task); evidence hashes 13/13.

## Coverage limits

Real 500 ms timeout not exercised; oracle `layersAtPrimary` not compared (behaviour via selections); two pre-existing incremental cases using `ms` excluded (Task 12); `percent_decode`/Windows/UNC forms read only (wiring Task 17).

## Non-findings (not accepted)

Capture arm order differs (equivalent); VS Code IDs without Helix languages go through detection (matches reference); `configure` to another ID re-enables syntax (matches `set_language`); cosmetic comment at `textobjects_syntax.rs:540`; deferred items.
