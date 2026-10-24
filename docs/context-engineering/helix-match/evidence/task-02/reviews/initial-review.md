# Task 2 Initial Review (Claude Code reviewer, task #29)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #7 (delta `/tmp/helix-match-implementation-khd3bwgf/snapshots/pre-task02` → `post-task02`).
Orchestrator filter: P2R-1 accepted (demonstrable regression of a documented Task 1 reproduction command). Non-findings recorded below, not accepted.

## Verdict

Needs a fix. Every Task 2 acceptance criterion that can run on this host passes; one P2 finding.

## Findings

| ID | Sev | Title | Location |
|---|---|---|---|
| P2R-1 | P2 | Restore a working build path for Task 1's documented reproduction | `native/Cargo.toml` L5-9; callers `native/feasibility/grammars/stage-helper.sh` L6-8, `build-grammars.sh` L23-27, `native/feasibility/targets/build-in-container.sh` L16, `cross-probe.sh` L29-34 |

P2R-1: Task 2 changed `members` to `["match-helper"]` and added `exclude = ["feasibility", "upstream/helix"]`.
The documented Task 1 reproduction (`feasibility/native/README.md` "Reproduce", report §8 / W1) runs `cd native && cargo build --release --locked -p mini-helix-match-feasibility`.
Running it now fails: `error: package ID specification 'mini-helix-match-feasibility' did not match any packages` (exit 101).
The helper `Cargo.toml` has no `[workspace]`; the snapshot `evidence/task-02/task1-workspace-snapshot/` preserves the inputs byte-for-byte but they cannot be built.
Basis: demonstrable regression of Task 1 verification V1 (archived reproducible commands).
Suggested correction: give the feasibility helper its own workspace root (`native/feasibility/Cargo.toml` with `members = ["helper"]`, `exclude = ["upstream"]`, plus `native/feasibility/Cargo.lock` from the snapshot), then point the Task 1 scripts and docs at that root or record the exact replacement command.

## Coverage by acceptance criterion

| Criterion | How checked | Result |
|---|---|---|
| RED: missing grammar | Removed `rust.so` in a scratch copy; `--runtime-root` check | Fails (`missing-grammar-library`, hash mismatches, 1798 vs 1799) |
| RED: altered query | Appended / same-size edit to `queries/rust/textobjects.scm` | Fails (`checksum-mismatch`, runtime/query hash mismatch) |
| RED: ambient override | `check-helix-runtime.cjs` §3; helper under hostile settings; red-2 log | Search list asserted `["<runtime>/"]`; identical under 6 hostile variants; Rust test fails unpatched |
| Extra tamper classes | Removed injections/rainbows query, removed manifest, added `wren.so`, flipped a byte in `python.so` | All fail with expected class |
| GREEN components | Read new Rust/JS; `fetch-source.cjs --verify`; `diff -rq` vs reference extraction | Present; only `helix-loader/src/{lib.rs,grammar.rs}` + stamp differ |
| Inventory 342/303/158/301 | Recomputed from pinned `languages.toml` | All match lock and inventory |
| wren/gemini distinct | Inventory, lock, manifest, verifier | 334 selected, 2 excluded-by-use-grammars, 6 no-grammar-definition |
| Grammar revisions/sources | Lock `grammars.selected[]` | Present |
| Query inheritance and captures | Spot checks (rust, tsx chain, html, markdown) | Correct; absent captures stay absent |
| Patches with exact symbols | `patches.json` vs hunks; patch SHA-256 | 0001 `prioritize_runtime_dirs`, `RUNTIME_DIRS`, `PACKAGED_RUNTIME_ROOT`, `initialize_packaged_runtime_root`; 0002 `grammar::get_grammar_configs`; narrow |
| Windows config/APPDATA ignored | Code reading of patched `lib.rs` | No `config_dir()` or env reads in resolution; not executed on Windows |
| Reference query failures separate | `inventory.rs`; `queryFailures` | 0 failures; records carry path, chain, effects; `hx` comparison is Task 3 |
| No pruning | Pinned `runtime/queries` vs manifest by SHA-256 | 1193/1193, 0 missing/extra/mismatch |
| Lock fields (spec L474) | Recomputed hashes | Revision, archive SHA, tree SHAs, toolchain, `cargoLockSha256`, runtime hash, manifest, inventory, grammar sources, `targets.linux-x64` correct |
| REFACTOR shared metadata | `manifest.rs` `IdentityInputs` | Target-independent identity; per-target runtime hash |
| build:match → check | Ran both | Build exit 0 (13.8 s); check OK, 1799 assets, 301 grammars loaded |
| Ambient `.helix`, user runtime, `HELIX_RUNTIME` | Decoys; `env -i` vs hostile runs | `resolve-report` byte-identical; full check OK under hostile env |
| Package and npm commands | `Cargo.toml`, `package.json` | Present |
| Cargo.lock vs pinned lock | `compare-cargo-lock.cjs` | 0 deviations; 1 added path package |

## Checks run

- `cargo +1.90.0 build --locked ... -p mini-helix-match-helper` exit 0 (one disclosed unused-import warning); `cargo +1.90.0 test --locked ...` 4/4.
- `npm run build:match` exit 0; `npm run check:helix-runtime` OK, runtimeHash `fd5ee12cf756…ffbea2b`.
- Tamper scenarios on reflink copies: pristine passes, 8/8 tampered fail.
- `cd native && cargo +1.90.0 build --release --locked -p mini-helix-match-feasibility` exit 101 (P2R-1).
- `fetch-source.cjs --verify` verified; `sha256sum -c evidence/task-02/file-hashes.txt` OK.
- `npm test` 77/77; `npx vsce ls` 0 `native/` entries; baseline 23/24 unchanged, `package.json` differs only by the two scripts; spec/plan hashes match.

## Attribution and scope

All modified files (`.gitignore`, `native/Cargo.toml`, `native/Cargo.lock`, `package.json`) and 36 new files are within Task 2 scope; build outputs are gitignored; no spec/plan edits; no TypeScript Helix logic.

## Coverage limits

Linux x64 only; Windows/macOS isolation by code reading; cached rebuild only (no full 301-grammar re-fetch); lock tampering covered by Rust test and code reading; 0 query failures confirmed only through pinned `LanguageData::compile_*`.

## Non-findings (not accepted)

- `check-helix-runtime.cjs` §3 `resolve-report` loads libraries for 6 languages even after static verification failed (hardening note for Task 4).
- Lock `targets` entry lacks the helper binary checksum (spec ambiguous; packaging is Task 21).
- `cargoLockSha256`/source checksums verified only during `build:match`, not in the runtime check (not required).
- Deferred: other targets, unstripped libraries, Rust dependency notices, GPL/unknown license decision, Task 2 evidence packaged under `docs/**` (baseline behaviour).
