# Pending implementation approvals

Supervisor index. No user approval has been received. This page does not amend the frozen specification or task contracts.

## Additional correction batches

The original assignments have consumed the one automatic correction batch allowed by `/sdd-cc`. These proposals remain unapplied:

- [VR2-1: use the selected Cargo target directory consistently](../task-02/proposed-correction/README.md). Isolated routing proof improves from 2/6 to 6/6 cases; real Cargo rerun and independent Verification review still required.
- [VR4-1: reject unknown protocol versions despite duplicate metadata fields](../task-04/proposed-correction/README.md). Added regression tests fail against original source; all 27 native protocol tests pass in an isolated copy with the patch. Independent Verification review still required.
- [VR5-1: report stopped after shutdown during startup](../task-05/proposed-correction/README.md). Added process-backed regression fails against original source; all 43 client tests pass in an isolated copy with the patch. Independent Verification review still required.

- [VR6-1: wait for queued changes before checking synchronization state](../task-06/proposed-correction/README.md). Added process-backed regression fails against original source; all 20 synchronization tests pass in an isolated copy with the patch. Independent Verification review still required. This P2 finding was missed by Initial review.

## Task 6 test-scope attribution (resolved as routine compatibility work)

[Two-line compatibility patch](task-06-compatibility-tests.patch), extracted from the worker's changes. The worker changed two existing real-helper test requests from `open` to `evaluate` to continue testing the unsupported-method error after `open` was implemented. These changes are already in the implementation worktree and were reported as outside the worker's narrower assigned file scope. The supervisor initially escalated this, then determined it is routine compatibility work already authorized by the user's request to finish the full implementation plan, whose required checks include preserving the existing passing tests after adding `open`. There is no product behavior change or specification amendment in this two-line patch. It is retained and attributed, without claiming a new user approval. This follows the supervising developer instruction to resolve routine implementation choices within existing authorization rather than automatically escalating exceptions from local skill files. The Task 6 synchronization suite now has 19 passing cases; its original finding is verified fixed; VR6-1 remains escalated. This determination does not waive the explicit correction-batch limit for VR2-1, VR4-1, VR5-1, or VR6-1.

## Separate product-contract decision

[Failed-replacement replay limitation](../../feasibility/analysis/replay-gap-oracle.md). Task 16 is held: supported VS Code APIs cannot replay arbitrary native/user/other-extension shortcuts. The specification has not been weakened. Approving the correction batches above does not approve a replay limitation or change the parity contract.

## Current-worktree application check

All four patches pass `git apply --check` after the Task 10 dependency update. No patch was applied. [Recorded checks and target hashes](current-applicability.json). The prior scratch test logs remain dated evidence; actual application still needs approval and fresh independent verification against the then-current worktree.
