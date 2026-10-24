# Proposed Task 6 queued-change synchronization correction

Supervisor-authored proposal for escalated VR6-1; **unapplied**. The original Task 6 automatic correction batch was consumed by P6R-1. Applying another correction requires the pending user decision under `/sdd-cc`.

The pre-queue filter in `ensureSynced()` can exclude a document before its in-flight change fails. The later queue guard cannot detect a newly stale replica if no synchronization step was queued. The original change and its sequential test were fixed; this concurrent case was missed by Initial review.

The proposed change removes that outer filter. Every registered document gets a queued check; the existing in-queue guard skips current documents after earlier operations settle. A process-backed regression starts a rejected change without awaiting it, immediately requests synchronization, and compares the exact host and helper text/version. No host keystroke or second action is needed to recover.

`queued-change-sync.patch` passes `git apply --check`. The new test fails against original production source (`queued-change-red.txt`). All 20 synchronization tests pass in an isolated copy with the proposed patch (`sync-tests.txt`). Both helper binaries were copied before the test, and the pinned runtime was shared via symlink; production source/tests remain unchanged (hashes and scratch path in `proposal-state.json`). No independent Verification review or real-worktree application has occurred.
