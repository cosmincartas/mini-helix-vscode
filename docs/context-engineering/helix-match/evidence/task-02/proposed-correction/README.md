# Proposed additional correction: Cargo target-directory consistency

Status: proposal only. The patch has not been applied to either source script.

Verification review of Task 2 found that both scripts build using `CARGO_TARGET_DIR` but read binaries from the default `native/target`. An override can therefore stage a stale binary or fail when that default directory is absent.

The [patch](target-directory.patch) resolves the target directory once, then uses it for Cargo and for binary lookup. Relative overrides resolve from the feasibility workspace, matching Cargo's working directory. The default target directory remains unchanged.

Validation completed on the proposal: shell syntax checks pass for both patched scripts, and `git apply --check` accepts the patch. No production or feasibility source was changed by preparing it.

After approval, the additional batch should apply this patch, verify default, absolute and relative target-directory builds and binary selection, rerun the native assertions and production runtime check, and receive bounded Verification review. The original acceptance contract and replay decision remain unchanged.

Additional boundary verification: the current scripts selected the correct binaries in 2/6 cases (default only), reproducing stale binaries for both override forms. The proposed scripts passed 6/6 cases across both scripts with default, absolute, and relative targets. [Probe data](target-routing-verification.json). This uses a marked fake Cargo output in isolated temporary directories; real Cargo builds remain part of the approval-gated batch.
