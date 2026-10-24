# Task 14 Initial Review (Claude Code reviewer, task #53)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #19 (plan Task 14); snapshot `pre-task14` → delta list `post-task14/delta-files.txt`.
Orchestrator filter: no findings.

## Verdict

Accept; no actionable defects. Second phase matches pinned upstream; token consumed once; shared export reproduces previous `evaluate` output; all checks pass.

## Second phase vs pinned upstream (`commands.rs:6455-6481`)

`match_brackets::get_pair(to)` unchanged (unpaired chars incl. `m` pair with themselves, spec L578); delimiter pairs built and sorted as upstream into one `Transaction::change`; delimiters from the stored continuation, count stored but unread (as upstream). Upstream has no `with_selection` here: it restores the original selection then applies the transaction, which in `Document::apply_impl` (`document.rs:1484-1490`) maps the selection and applies invariants; the worker maps the stored original (`surround_replace.rs:115`) and `evaluate::proposal` applies invariants (`mod.rs:274`). Non-char restore unchanged from Task 13. Pinned `get_surround_pos` rejects duplicates (`surround.rs:323`), so edits cannot overlap.

## Token lifecycle (`continuation.rs:203-235`)

Key checked, then ownership, then stored document version; release only after `evaluate::proposal(...)?` succeeds; rejected requests keep the token for its owner; replay or cancel of a used token → `stale_continuation/continuation_unknown` or `released:false`. Matches spec L392-395; replica untouched.

## Shared export (REFACTOR)

`evaluate::proposal` builds every proposal; `ms`, preview, and differential suites pass. Edits via pinned `ChangeSet::changes_iter` in base UTF-16; adjacent delimiters merge (e.g. `{2,4,"[]"}`) as upstream changesets do; sorted, non-overlapping.

## Compatibility edits

`tests/surround_preview.rs`: two Task 13 assertions superseded by the Task 14 contract; replay cancels unused token; renamed test asserts proposal, single use, invalid-key and wrong-owner rejection; replica check moved to `surround_replace.rs:618-643`; 8/8 pass — acceptable. `src/native/protocol.ts`: typing only (`ContinueResult`), `tsc` passes. `tests/common/mod.rs`: `pub mod replace;`.

## Coverage per acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED nested pairs | Covered | `nested_pairs_give_sorted_edits…` (`:423`); 18 `nested-*` cases |
| RED aliases | Covered | 41 `old-*` cases |
| RED literal new `m` | Covered | `:450-453`; 3 `new-m-*` cases |
| RED non-char cancellation | Covered | 43 restores; Enter/arrow `:471-476` |
| RED duplicate use | Covered | `:207-208`, `:480-502`, preview suite |
| RED evidence | Covered | `red-1-continue-not-implemented.txt` (7/8 failed) |
| Second phase, sorted edits, restored mapping | Covered | 201/201 replacements match oracle text, selections, primary, status |
| Replica unchanged | Covered | checked after every replacement (test-support); test `:618` |
| Token consumed once | Covered | `continuation.rs:224-227`; mutation log 3 failures |
| Shared export | Covered | `evaluate::proposal`; `surround_add` 6/6 |
| Oracle comparison | Covered | 433 cases, 0 excluded, 0 skipped; oracle 214/214 `surround-replace/` |
| Replays/stale tokens fail safely | Covered | every release event and ownership mismatch; no text or token in errors |
| FR-12 / NFR-2 / NFR-3 | Covered (helper) | pinned code unchanged; no TS algorithm; marker absent from stderr/errors |
| Provenance; existing files unchanged | Covered | 15 earlier case files identical |
| Lock, baseline, escalations | Covered | hashes equal pre-task; only pre-existing `package.json`; escalated files identical |

## Checks run (each once)

`--test surround_replace` 8 passed; with `test-support` 9 passed; `--test surround_preview` 8, `--test surround_add` 6 (test-support); crate plain 101 passed (15 binaries), test-support 110 passed (16 binaries); `npm run test:match:oracle` OK; `npm run compile` exit 0; `HELIX_MATCH_REQUIRE_REAL_HELPER=1 npm test` 166/166; `check:keybindings` exit 0; `compare-cargo-lock.cjs` no deviations; `check:helix-runtime` OK; run statistics: 433 cases, 378 previews, 201 replacements, 43 restores, 58 lookup failures. Snapshot, baseline, fixture, evidence hashes and spec/plan SHA-256 verified.

## Attribution and scope

Exactly the 6 modified and 23 new files in `delta-files.txt`, all in worker scope; nothing written to `native/runtime/out`.

## Coverage limits

Linux only; VS Code application, undo, same-character no-op edits (18 cases) deferred to Tasks 17-18; no TS test sends `continue`; worker mutation not re-run.

## Non-findings (not accepted)

Evidence README wording ("14 earlier case files" vs 15; "200/201" ambiguous; select-mode "excluded" vs 0 excluded); count stored but unread (upstream); no `catch_unwind` in second phase (inputs cannot panic); same-character no-op edits deferred.
