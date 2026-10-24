# Helix Match Design Review

Date: 2026-10-24.

## Scope

The requested review covers [spec.md](spec.md) and [plan.md](plan.md).
The reference is Helix revision `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.
The review examines exact match behavior, maintainability, extensibility, integration boundaries, and implementation-task completeness.
It does not establish native build viability or implemented feature parity.

Claude Code reviewed both documents through the read-only `reviewer` runtime profile.
The initial review identified five P2 findings and three P3 findings, with no P0 or P1 finding.
The table below records every actionable finding and its correction.
Claude Code completed a follow-up review and identified four additional integration gaps.
Those corrections are recorded below and passed the final bounded verification.
The exact reports are archived as [initial review](reviews/claude-initial.md) and [follow-up review](reviews/claude-followup.md).
The [final verification](reviews/claude-final.md) confirms D-1 through D-4 are resolved.
It reported one additional P3 finding, V-1, addressed after that pass as recorded below.

## Claude Code Findings and Dispositions

| ID | Severity | Finding | Correction |
|---|---|---|---|
| C-1 | P2 | Modified characters and non-character callbacks differed from Helix. | Preserve full logical keys. Capture callback characters regardless of modifiers; consume other keys by phase. Tasks 16 and 19 verify this. |
| C-2 | P2 | Counts could be consumed at the initial `m`. | Consume at the action key. Test digits after `m`, count extension, `m0`, and callback digits. |
| C-3 | P2 | Failed previews could lose buffered keys; Escape could cancel completed commands. | Replay failed-preview keys through NORMAL dispatch. Keep completed commands queued. Test `mr(d` and delayed `miw<Escape>`. |
| C-4 | P2 | Pair objects and old-surround lookup lacked syntax-aware coverage. | Limit Task 8 pairs to plaintext. Add syntax and injection cases to Tasks 9, 13, and 15. |
| C-5 | P2 | Query and parser failures were treated as installation failures. | Preserve reference query fallback, the 500 ms parser timeout, and persistent syntax-disable state. Carry acknowledged state through recovery. |
| C-6 | P3 | Editor text normalization and CRLF metadata needed a clearer domain. | Compare VS Code's exposed text. Keep mixed EOL and lone CR in helper fixtures. Require evidence before extra projection metadata. |
| C-7 | P3 | Alpine compilation did not prove shared grammar loading. | Require dynamic musl linkage and runtime grammar-load checks inside Alpine, including both release architectures. |
| C-8 | P3 | The referenced review file did not yet exist during inspection. | Create this file and validate all companion links. |

C-2 and C-8 were already being corrected while the initial review inspected earlier draft snapshots.
Their final content still receives the same verification as other corrections.

The optional review suggestions also received explicit treatment:

- Alt-`.` remains excluded; repeated explicit match commands remain included.
- Focus loss alone preserves pending input, matching the reference.
- Git comparisons use identical baseline identities despite explicit refresh before evaluation.
- Target packages exclude `native/target/**` and other targets' build output.

### Follow-up Corrections

| ID | Severity | Finding | Correction |
|---|---|---|---|
| D-1 | P2 | Native NORMAL Escape could clear a completed selection at a different helper speed. | Explicitly adopt Helix's selection-preserving NORMAL Escape and clear counts through ordered dispatch. Record this existing-input behavior change in scope. |
| D-2 | P2 | Infrastructure preview failure could accidentally replay a destructive buffered key. | Replay only reference lookup errors. Discard buffered keys on infrastructure failure, stale results, or cancellation. Add a faulted `mr(d` case. |
| D-3 | P3 | Task 19 broadly overrode digits despite counts remaining active after `m`. | Specify digit routing by action-menu versus callback phase in both documents. |
| D-4 | P3 | Different query files have different reference failure behavior. | Distinguish missing text-object queries, failed root syntax configuration, and missing injected layers. Record failing query paths. |

The follow-up marked its verification incomplete because it lacked prior snapshots and the full initial report.
The final verification received both archived reports, a saved pre-correction snapshot, and the exact correction diff.
This preserves the distinction between design review and implemented parity evidence.

### Final Verification Correction

**V-1, P3:** An unconditional idle NORMAL Escape binding could prevent native popup dismissal.
The specification and Task 19 now exclude native popup contexts from that idle binding.
They require hover, peek, and diagnostic-navigation dismissal tests, while pending match callbacks retain their own Escape rules.
This narrow correction received author consistency checks after the completed Claude Code verification.
It did not receive a fourth Claude Code pass.

All reported document findings have an explicit correction.
No unresolved document finding remains in this review record.
The implementation feasibility and release checks remain unexecuted.

Claude Code confirmed the core object mapping, count maximum, two-phase replacement, runtime-isolation need, and pinned WASM limitation.
It supported the independent oracle, proposal-only replica model, bound continuations, native edit-result checks, and feasibility gate.

## Review Limits

The reviewer inspected pinned keymaps, command handlers, input routing, selections, syntax, surrounds, runtime loading, and Git baseline trust.
It also inspected the repository's command, count, queue, presentation, packaging, and test boundaries.
It ran no builds, tests, or packaging.
It did not establish every diff-hunk detail, injection edge case, oracle-build path, cross-compilation result, or VS Code API behavior.
Task 1 and later verification tasks retain those checks.

## Author Checks

Source inspection identified and corrected these details during drafting:

| Finding | Correction |
|---|---|
| Count input continues after the initial `m`. | Snapshot the count at the action key. Include `m3i{` and `2m3i{` fixtures. |
| Replacement exposes intermediate delimiter selections. | Specify bound continuations, exact previews, and owned cancellation restoration. |
| Ordinary runtime lookup can shadow packaged assets. | Require an isolated runtime resolver; `HELIX_RUNTIME` alone is insufficient. |
| Default grammar selection excludes `wren` and `gemini`. | Inventory intentional exclusions separately from broken grammar assets. |
| Deleted working files can retain a HEAD baseline. | Use upstream lookup results instead of forcing unavailable behavior by file class. |
| Input-state verification needs real command-dispatch fixtures. | Make Task 16 depend on the independent oracle. |
| Editor ordering tests need a functioning plaintext evaluator. | Make Task 17 depend on Task 8. |
| Concurrent work added navigation and test changes. | Record the moving baseline and require execution-time source inspection. |
| Concurrent work later queued existing motions and added `Count.presses`. | Update repository facts and make Task 17 extend that queue instead of rebuilding it. |
| VS Code 1.85 carries document versions into native edit application. | Confirm the source-level guard and retain a real concurrent-edit probe in Task 1. |
| VS Code 1.85 normally normalizes buffer EOLs. | Ground the host-text domain in primary source; keep helper-only raw-EOL cases separate. |

Artifact checks cover requirement identifiers, task dependencies, task fields, coverage mappings, local links, and Markdown fences.
Final source hashing follows review corrections.

## Remaining Verification Boundaries

No production code, dependency, project configuration, or test was changed by this documentation task.
No native build or implementation test ran during planning.
Existing uncommitted work belongs to other concurrent activity and remains preserved.

The implementation starts with a feasibility gate.
That gate covers native builds, arbitrary Unicode input, semantic selection projection, stale-edit rejection, and resource measurements.
A failed gate requires design review before dependent implementation.
The complete parity claim requires the final audited runtime, target, keyboard, and differential-test matrices.
