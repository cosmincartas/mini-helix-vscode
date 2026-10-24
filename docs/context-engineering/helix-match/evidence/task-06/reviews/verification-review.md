# Task 6 Verification Review (Claude Code reviewer, task #41)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after the single correction batch (task #42); bounded to P6R-1 and correction regressions.
Inputs: [initial review](initial-review.md); snapshot `snapshots/post-task06/precorrection.tar`; delta `snapshots/task06-correction-delta.md`.

## Verdict

Reviewer verdict: pass for P6R-1 and correction regressions. Orchestrator classification: one later P2 finding of origin (b) (VR6-1), escalated; review task stays pending.

## P6R-1: verified

- `/tmp/hm-p6r-probe/p2.cjs`: change rejected `invalid_request overlapping_edits`; `ensureSynced()` → `synchronized: ["d"]`, 0 failures; replica v2 `"aXYbc\n"` equals host; `needsSnapshot` false (before: `[]`, replica v1).
- Unsupported host snapshot: new test `matchSync.test.ts:279-316`; lone surrogate → `unsupported_text` rethrown (`documents.ts:382`), `guard()` resets `needsSnapshot` (L325-326), reported in `failures` (L289-290), replica unchanged.
- Ordering: in-queue check (L284) runs after earlier queued changes; a change that snapshots clears `needsSnapshot` (no double snapshot); snapshot/open choice in queue (L287) with `resync_required` → `open` fallback (L382-383); epoch check (L286) unchanged; helper accepts equal-version snapshot (`mod.rs:373`).

## Later findings

### VR6-1 [P2] `ensureSynced()` filters documents before their queued changes settle (origin: (b) missed by Initial review)

- Location: `src/native/documents.ts:279-292` (filter L281).
- Trigger: a `change()` is in flight (sent, unanswered) and will be rejected with a non-`resync_required` error when an explicit match action calls `ensureSynced()`.
- Evidence: `/tmp/hm-p6vr-probe/race.cjs` (p2.cjs without awaiting the change): `ensureSynced synchronized: [] failures: 0`, then `change rejected: invalid_request overlapping_edits`; replica v1 `"abc\n"` vs host v2; `needsSnapshot: true`.
- Impact: match action reported synchronized while the replica is stale; violates spec Recovery L631 ("synchronize current snapshots") and plan Task 6 GREEN.
- Origin: before the correction the pre-queue filter never selected `needsSnapshot` entries, so the case was hidden inside P6R-1; the Initial review tested only an already-failed change and its suggested fix did not cover an in-flight change. Not correction-caused.
- Suggested fix: queue a step for every registered document and decide inside the queue (existing L284 check); add a test where `change()` is not awaited before `ensureSynced()`.

## Checks run

- `npm run compile` exit 0; strict `matchSync` 19/19 ×2; `matchClient` 42/42; `npm test` 138/138; `check:keybindings` exit 0.
- Delta vs pre-correction: `documents.ts` (4 lines), `matchSync.test.ts` (one test), evidence README/file-hashes, `correction/`; `matchClient.ts`, `matchClient.test.ts` (pending-decision lines), `protocol.ts` byte-identical.
- Correction hashes verified; spec/plan hashes frozen.

## Coverage and limits

Correction #42 only; VR4-1/VR5-1 and the scope exception not reviewed; linux-x64 debug test helper; effect on real match requests not demonstrable before evaluation exists (later task).
