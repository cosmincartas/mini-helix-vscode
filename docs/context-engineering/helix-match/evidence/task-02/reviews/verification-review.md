# Task 2 Verification Review (Claude Code reviewer, task #29)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after the single correction batch (task #30), bounded to P2R-1 and correction regressions.
Inputs: [initial review](initial-review.md); pre-correction snapshot `snapshots/post-task02/tree.tar` + `snapshots/post-extract/`; delta `snapshots/task02-correction-delta.md`.

## Verdict

P2R-1 resolved; no P0-P2 regressions. One P3 correction-caused defect (VR2-1), escalated by the orchestrator because the single correction allowance is consumed.

## P2R-1: resolved

- From `native/feasibility` with the `stage-helper.sh` environment and `CARGO_TARGET_DIR=/tmp/hm-p2vr-target`: `cargo build --release --locked -p mini-helix-match-feasibility` exit 0 (12.7 s).
- `native/feasibility/Cargo.lock` unchanged by the build; byte-identical to `task1-workspace-snapshot/Cargo.lock.txt` (`f282abcf…231294c4b`).
- Rebuilt binary with staged runtime: `run_probes.py` 8 probes, 0 failed.
- Scripts now resolve the feasibility workspace; toolchain 1.90.0 still picked up; `cross-grammars` keeps its own workspace; no binary name collisions in shared `native/target`.
- Rebuilt binary hash `07b1a78c…` differs from staged `63ad0231…`; no Task 1 deliverable claims byte-identical rebuilds (only source extraction). Not a regression.

## Later findings

### VR2-1 [P3] `CARGO_TARGET_DIR` override documented but not honored (origin: correction-caused)

- Location: `native/feasibility/grammars/stage-helper.sh:6,10`; `native/feasibility/grammars/build-grammars.sh:22-27`; `docs/context-engineering/helix-match/feasibility/native/README.md:56`.
- Trigger: `CARGO_TARGET_DIR=/tmp/x native/feasibility/grammars/stage-helper.sh` builds into `/tmp/x` but line 10 copies `$native/target/release/mini-helix-match-feasibility`, silently staging an older binary (or failing if absent). `build-grammars.sh` fixes `bin` to `$native/target/release/grammars`.
- Basis: the correction's own documentation claims an override the scripts do not implement; the documented default command works.
- Suggested fix: use `target="${CARGO_TARGET_DIR:-$native/target}"` for the copy/bin paths, or drop the override wording from README line 56.

Non-findings: Task 1 docs still describing `native/Cargo.toml`/`native/Cargo.lock` as the feasibility workspace (stale since Task 2 itself, explained by the new README note); non-byte-identical rebuild.

## Correction regressions (clean)

- Production `native/Cargo.toml` (`64368d50…`), `native/Cargo.lock` (`01b15f23…`), `native/helix-lock.json` (`0e9b8538…`) match the post-task02 snapshot; only the 4 scripts and `evidence/task-02/README.md` differ among Task 2 files.
- Doc edits limited to the stated notes.
- `cargo +1.90.0 build --locked ... -p mini-helix-match-helper` exit 0; `npm run check:helix-runtime` exit 0 (1799 assets, 301 grammars, runtimeHash `fd5ee12cf7562458cc18a3c419f829aa100abafd3c685bc5b4680206dffbea2b`).
- `npm test` 77/77; `bash -n` OK; no new unignored build output; baseline 24 files (only `package.json` differs); spec and plan hashes frozen.

## Coverage and limits

Linux x64 only; `stage-helper.sh`, `build-grammars.sh`, and container scripts not executed (would overwrite the stage or need network); equivalent cargo command executed; warm cargo cache.
