# Task 6 Initial Review (Claude Code reviewer, task #41)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #40 (plan Task 6); snapshots `pre-task06` → `post-task06`.
Excluded (not worker changes): `supervisor-proposals/**`, `evidence/task-0{2,4,5}/proposed-correction/**`, `task-05/supervisor-context/**`, `reviews/**`.
Orchestrator filter: P6R-1 accepted (spec Private process protocol "snapshot replaces the replica when any version gap or unsupported change occurs"; Recovery; plan Task 6 GREEN). Non-findings not accepted. Scope exception recorded for user decision.

## Verdict

Changes required: one P2 finding; all other criteria met; one scope exception needs a user decision.

## Findings

| ID | Sev | Location | Title |
|---|---|---|---|
| P6R-1 | P2 | `src/native/documents.ts:183-210`, `:274-293` (filter L279) | Rejected change leaves the replica stale until another host event; `ensureSynced()` skips it |

P6R-1: when the helper rejects a change with an error other than `resync_required` (`overlapping_edits` incl. two inserts at one offset, `edit_inside_surrogate_pair`, `unsupported_text`, `request_too_large`, `no_snapshot_source`), `guard()` sets `needsSnapshot = true` (L323-325) and `change()` rethrows (L206); nothing is sent until the next host event. `ensureSynced()` selects only `syncedEpoch !== ready.epoch` (L279), skipping `needsSnapshot` entries on the current epoch.
Probe (`/tmp/hm-p6r-probe/p2.cjs`): two inserts at offset 1 → `invalid_request/overlapping_edits`; `ensureSynced()` returned `synchronized: []`, 0 failures; `test_observe` replica version 1 `"abc\n"` while host version 2 `"aXYbc\n"`, `needsSnapshot: true`. Existing test (matchSync L270-275) covers only recovery after a later event.
Impact: explicit match action reports success with a stale replica; requests fail until the next edit.
Suggested fix: include `needsSnapshot` entries in `ensureSynced()` and `resync(entry, ready, true)`; optionally resync immediately after such a rejection; add a matchSync case (rejected event → `ensureSynced()` → `assertReplica`).

## Scope-exception assessment

`test/unit/matchClient.test.ts` L685, L732 `'open'` → `'evaluate'`: necessary (`open` implemented; real helper now returns `invalid_params`), minimal (two tokens; assertions, SENTINEL check, client-side stale-epoch `'open'` at L730 unchanged), does not weaken Task 5 intent. `evaluate` becomes implemented in Task 8, so the lines will need the same change again. Outside the assigned write scope; retaining needs a user decision. `unsupported_method.response.json` (open) is now unused (disclosed).

## Coverage per acceptance criterion

| Criterion | Status | Evidence |
|---|---|---|
| RED tests | Met | `matchSync.test.ts` (18); RED log |
| One changeset against base snapshot | Met | `mod.rs:427-467`; probe CR/LF split + reordered edits |
| Overlap incl. same-offset inserts | Met (helper); client follow-up P6R-1 | probe + tests |
| UTF-16 → scalar; surrogate boundaries rejected | Met | `text.rs:95-105` |
| Exact CRLF/Unicode; malformed UTF-16 → `unsupported_text`, no replacement | Met | `text.rs:33-85`; probes for lone high/low surrogates |
| Pinned old/new rope syntax update | Met | `mod.rs:470-481` vs upstream `document.rs` ~L1513-1524 |
| `syntaxState` acknowledged | Met | ack fields; unit test |
| Update failure sticky through changes, snapshots, restarts | Met | `mod.rs:391-392`; client `retained()`; tests L483-531 |
| Initial failure unavailable and sticky | Met | `build_syntax`; test L533-545 |
| Retained state validated | Met | `retained_failure` `mod.rs:280-286`; test L547-563 |
| `configure` resets only on language change | Met | `mod.rs:497-509`; test L460-467 |
| Snapshots after missed events/restarts | Partial | P6R-1 |
| Close releases; old generations rejected | Met | `mod.rs:528-538`; probes |
| No duplicate application | Met | client `ignored`; helper `version_mismatch` |
| Test observation gated | Met | feature + per-session flag; 0 symbols in production binary; production probe `unsupported_method` |
| REFACTOR ownership | Met | `DocumentSync` in `MatchClient` |
| Versions/hashes agree each event | Met | `assertReplica` |
| NFR-3 | Met | static messages; stderr fixed fields; SENTINEL |
| NFR-5 | Met (scope) | async client, per-document queue |
| No TS Helix algorithms | Met | bookkeeping only |
| VR5-1 / VR4-1 unchanged | Met | teardown/state logic untouched; `envelope.rs` identical |
| Lock files unchanged | Met | SHA-256 equal to pre-task |

## Checks run

- Spec/plan hashes frozen; baseline 24 files (only `package.json`, unchanged by this task).
- `cargo +1.90.0 build --locked ... -p mini-helix-match-helper` and `--features test-support --bin mini-helix-match-helper-test` OK.
- `cargo +1.90.0 test --locked ...`: 8 + 25 + 4; with `test-support`: 8 + 6 + 25 + 4.
- `npm run compile`; strict `matchSync` 18/18; `matchClient` 42/42; `npm test` 137/137; `check:keybindings` exit 0; `compare-cargo-lock.cjs` no deviations; `check:helix-runtime` OK (`fd5ee12c…bea2b`).
- Manual probes (`/tmp/hm-p6r-probe/probe.cjs`, `p2.cjs`) as above; `evidence/task-06/file-hashes.txt` verified.

## Coverage limits

Linux x64 only; VS Code same-offset change events not checked (P6R-1 independent of it); Task 9/8-15/14/17+ and non-Linux deferred; release binary predates Task 6 (debug builds used).

## Non-findings (not accepted)

Retained identity stamped with current helper identity (`documents.ts:349`, not triggerable); `retainedSyntaxApplied` presence/comment mismatch (unused); same-Helix-language ID change differs between `snapshot` and `configure` (Task 9); two empty no-op inserts rejected as overlapping; shared target dir for `test-support` (runtime gate still blocks).
