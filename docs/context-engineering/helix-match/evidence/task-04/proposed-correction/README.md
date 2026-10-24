# Proposed additional correction: VR4-1 duplicate-field version priority

Status: proposal only. The patch has not been applied to the working-tree source.

Task 4 Verification review found that a version-2 frame with duplicate `helperEpoch` fields reaches a derived preliminary deserializer error before the required fatal version rejection. The same preliminary parsing issue also affects duplicated request IDs.

The [patch](duplicate-field-version.patch) makes the preliminary metadata probe duplicate tolerant while borrowing raw values and skipping method parameters. Unknown integer protocol versions remain fatal even when unrelated metadata is duplicated. Strict version-1 duplicate rejection remains in place, and duplicate identity fields are treated as ambiguous rather than echoed. Existing session-epoch fallback behavior is preserved.

Validation in a scratch copy: **27 protocol tests passed**, including the existing 25 and two new regression tests. [Test output](protocol-tests.txt). `git apply --check` accepts the patch against the current source. [Source hashes and scratch command](proposal-state.json) confirm the working-tree files remain unchanged.

After approval, apply the patch in an explicitly approved additional batch, run the required checks in the real worktree, and obtain bounded Verification review. This proposal does not amend the specification or approve the separate replay limitation.

Additional before/after evidence: [the added regression tests fail against the unchanged current implementation](protocol-red-regression.txt), then the same scratch tree with the proposal passes all 27 protocol tests. No production source or tests were modified.
