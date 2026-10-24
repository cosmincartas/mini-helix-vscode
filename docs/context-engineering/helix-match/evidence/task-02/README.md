# Task 2 evidence: lock a complete native runtime build

Plan Task 2 (FR-9, FR-13, NFR-1, NFR-2, NFR-4, NFR-6, NFR-7). Host: AMD Ryzen 9 7900X3D (24 threads), Fedora 44, glibc 2.43, gcc 16.2.1,
`rustc 1.90.0 (1159e78c4 2025-09-14)`, Node 26. Target built: `linux-x64` = `x86_64-unknown-linux-gnu`. Other targets are not built in this task.
Raw outputs are in `logs/` (`*.txt`; large per-grammar fetch lists filtered out, nothing else edited). File checksums: `file-hashes.txt`.

## Result

| Requirement | Status | Evidence |
|---|---|---|
| `npm run build:match` then `npm run check:helix-runtime` give a complete current-host runtime | pass | `logs/final-build-match-and-check.txt` (build 13.9 s with warm sources, check 1.3 s) |
| Corrupting/removing/adding an asset makes the check fail | pass (10 scenarios) | `logs/tamper-and-ambient-run.txt`, script `logs/tamper-and-ambient-run.sh.txt` |
| Ambient `.helix`, user runtime, `HELIX_RUNTIME` do not change resolution | pass | Rust integration test + check section 3 (6 variants x workspace `.helix` + exe-sibling decoy runtime); whole check re-run under hostile `HOME`/`XDG_CONFIG_HOME`/`HELIX_RUNTIME`/cwd `.helix` passes unchanged |
| 342 languages / 303 grammar definitions / 158 textobject files / 301 selected, `wren` and `gemini` excluded | pass | `native/helix-lock.json` `counts`, `grammars.excluded`; builder asserts the counts and fails otherwise |
| All 301 selected grammars fetched at pinned revisions, built, loaded | pass (301/301, 0 failures) | `logs/build-3-fresh.txt` (fresh re-fetch of all 301 repos), check loads every library through the pinned loader |
| Reproducibility | pass on this host | three builds (`logs/build-1b`, `build-2-rebuild-libs` = libraries recompiled from the same sources, `build-3-fresh` = all sources re-fetched) give identical runtime hash `fd5ee12c...ffbea2b`, manifest SHA-256 `1adc4aa0...a568b`, inventory SHA-256 `a77c2da1...570c5`. Later builds ran without `--update-lock`, so they were compared against the lock. Same host, compiler and path only |
| `npm test` 77/77; `vsce ls` has no `native/**`; 24 baseline files | pass | `logs/npm-test-vsce-git-status.txt`, `logs/vsce-ls.txt` (diff to baseline = new `docs/**` files only); baseline hashes match (package.json differs only by the 2 allowed script lines) |

Commands (from the worktree root): `npm run build:match` (first time: `node scripts/build-match.cjs --update-lock`), `npm run check:helix-runtime`,
`cargo +1.90.0 build --locked --manifest-path native/Cargo.toml -p mini-helix-match-helper`, `cargo +1.90.0 test --locked --manifest-path native/Cargo.toml -p mini-helix-match-helper` (4 integration tests pass; `logs/cargo-build-test-locked.txt`).

## RED (recorded before GREEN)

* `logs/red-1-check-without-lock-or-runtime.txt`: the new check fails without lock/runtime (`missing native/helix-lock.json`).
* `logs/red-2-cargo-test-unisolated-resolver.txt`: with the pinned loader unpatched, `ambient_helix_state_does_not_change_runtime_resolution` fails; the search list was
  `[<HOME>/.config/helix/runtime, <exe dir>/runtime]`, not the packaged root.
* The tamper classes (altered/missing/stray asset, checksum, lock mismatch) were implemented together with the verifier, so their unit tests were green on first run; their failing behavior is demonstrated against the real runtime in `logs/tamper-and-ambient-run.txt` instead of as a separate RED run.

## Layout

* `native/helix-lock.json`: compatibility identity `342b08d1...c6e405`, revision, archive/source-tree checksums (unpatched `d898768c...`, patched `84267efb...`), toolchain, `Cargo.lock` SHA-256 `01b15f23...508615`, 2 patches with symbols, 301 selected grammars (git, rev, `checkedOutCommit`, license files) and 2 exclusions, inventory checksum, notices, per-target artifacts (`targets.linux-x64`: runtime hash, manifest hash, 1799 assets, 260,793,551 B, 301 libraries, build host/compiler).
  The identity hashes only target- and host-independent inputs (revision, archive, upstream lock, `languages.toml`, patch checksums, selected grammar sources, query tree hash); runtime hashes and library checksums are per target.
* `native/helix-inventory.json` (1.2 MB, referenced from the lock by SHA-256): per language entry name, grammar, grammar state (`selected` / `excluded-by-use-grammars` / `no-grammar-definition`), injection regex, file types, shebangs, per query type own-file presence, inheritance chain (with absent files), effective checksum, text-object captures after inheritance, and reference compile outcomes; 303 grammar definitions with selection; query directory inventory (summary: `inventory-summary.json`).
* `native/upstream/`: `fetch-source.cjs` (download or `--archive`, SHA-256 verify, extract, `git apply` patches, tree hash stamp, `--verify`), `patches/*.patch`, `patches.json` (patch inventory with symbols). Extracted tree `native/upstream/helix/` is gitignored.
* `native/match-helper/` (`mini-helix-match-helper`): `lib.rs` (`init_isolated_runtime`, `assert_isolated`, `resolve_report`), `manifest.rs` (shared manifest/hash/identity generation for all targets), `verify.rs` (`verify_runtime`, `LockView`, `load_selected_grammars`; reusable by Task 4 `initialize`), `inventory.rs`, `main.rs` (`check-runtime`, `resolve-report`, `version`; no protocol dispatcher), `bin/runtime_builder.rs` (`fetch`, `build --target`, `assemble`, `inventory`).
* `scripts/build-match.cjs`, `scripts/check-helix-runtime.cjs`, `native/runtime/compare-cargo-lock.cjs`; outputs under gitignored `native/runtime/out/<target-id>/runtime/` (`grammars/`, full `queries/`, `licenses/`, `manifest.json`).

## Upstream patch inventory (`native/upstream/patches.json`)

| Patch | File / symbols | Effect |
|---|---|---|
| `0001-packaged-runtime-root` | `helix-loader/src/lib.rs`: `prioritize_runtime_dirs` (modified), `RUNTIME_DIRS` initializer, new `PACKAGED_RUNTIME_ROOT`, new `initialize_packaged_runtime_root` | the only runtime directory is the packaged root (given root, else `<exe dir>/runtime`); `CARGO_MANIFEST_DIR`, user config dir (incl. Windows Known-Folder/`%APPDATA%`), `HELIX_RUNTIME`, `HELIX_DEFAULT_RUNTIME` never consulted |
| `0002-grammar-builder-builtin-languages` | `helix-loader/src/grammar.rs`: `get_grammar_configs` | builder reads the pinned built-in `languages.toml` only (no user/workspace `languages.toml`); build-time only |

Everything else is byte-identical to the archive (`diff -rq` vs the verified extraction shows only these 2 files). Not patched and relied on: `fetch_grammars`/`build_grammars(Some(target), true)` (explicit target), `HELIX_NIX_BUILD_REV` + `GIT_CEILING_DIRECTORIES` instead of patching `helix-loader/build.rs`.

## Inventory counts and compatibility outcomes

* 342 language entries: 334 `selected` (all compile their syntax config), 2 `excluded-by-use-grammars` (`wren`, `gemini`: intentional reference exclusions, not missing libraries), 6 `no-grammar-definition` (`mint`, `llvm-mir-yaml`, `idris`, `cabal`, `bovex`, `qmv`: the pinned config names no grammar for them; reference plaintext behavior).
* 303 grammar definitions, 301 selected, 301 libraries built and loaded.
* 341 query directories (5 include-only dirs without a language entry: `ecma`, `_javascript`, `_jsx`, `_typescript`, `_gjs`); file counts: highlights 341, injections 232, indents 150, locals 100, rainbows 91, tags 77, folds 39, textobjects 158 (154 compile; 3 sit in include-only dirs `ecma`, `_jsx`, `_typescript`; 1 belongs to the excluded `wren`, whose textobject query is therefore not compiled). All files retained verbatim (full tree, 1,087,532 B). 180 query entries inherit; 26 inherit chains reference an absent file (empty, upstream behavior, recorded as `filePresent:false`).
* Text-object captures after inheritance (languages having `<object>.inside|around`): comment 145, function 107, parameter 104, class 80, entry 77, test 28, xml-element 8; absent captures stay absent.
* Reference query-compile failures of unchanged pinned queries: **0** for syntax (highlights/injections/locals), textobjects, indents, tags, rainbows. The classification path is exercised on a corrupted copy of the runtime (`logs/query-failure-demo-corrupted-copy.json.txt`): textobjects failure => `text-objects` disabled; highlights failure => `root-syntax`, `text-objects`, `injected-layer` disabled, propagating to languages that inherit the broken file; rainbows => `rainbow-brackets-only`; each record carries query path, inheritance chain paths, error message. Outcomes come from the pinned `LanguageData::compile_*` functions (same as helix-term and `xtask query-check`); an independent `hx` oracle comparison belongs to Task 3.

## Notices (lock `notices`)

Helix: MPL-2.0 `LICENSE` copied to `licenses/helix/LICENSE` (SHA-256 `1f256eca...f1d5`). Grammars: 291/301 have a license file in the pinned source, copied to `licenses/grammars/<grammar>/` with SHA-256 in the lock; text-heuristic SPDX tags: MIT 240, Apache-2.0 21, GPL-family 7, ISC 6, Creative-Commons 5, BSD-style 4, MPL-2.0 3, Unlicense 3, unknown 8 (`gitcommit perl pkl pod twig wast wat wesl`). **No license file in source (recorded explicitly):** `adl eex groovy hyprlang lpf p ptx slint supercollider xwiki`. Whether GPL-family and missing-license grammars may be redistributed is a release/legal decision for Task 21, not resolved here. Rust dependency notices: pending (Task 21).

## Measurements

Runtime 260,793,551 B in 1799 assets: grammars 258,825,056 B (301 unstripped `-O3` libraries from the pinned loader; largest `systemverilog` 21.8 MB, `verilog` 18.2 MB, `lean` 15.7 MB), queries 1,087,532 B, licenses 880,963 B, manifest 332 KB. Release helper 3.6 MB (2.8 MB stripped), builder 6.5 MB. Timings: fetch of 301 shallow repos 13.8 s, compile of 301 grammars 11.7 s (parallel), assemble + inventory (loads all grammars, compiles all queries) 6.8 s, fresh end to end 34.8 s, cached `build:match` 13.9 s (peak RSS 590 MB), check 1.3 s.

## Deviations and findings

1. **`native/feasibility/helper` is no longer a member of the `native` Cargo workspace.** Two path copies of Helix (Task 1 unpatched, production patched) define the same package names and versions and cannot coexist in one `Cargo.lock` ("package collision in the lockfile"). `native/Cargo.toml` now has `members = ["match-helper"]` and `exclude = ["feasibility", "upstream/helix"]`; `native/feasibility/**` is untouched. Task 1's `Cargo.toml` and `Cargo.lock` (SHA-256 `f282abcf...231294c4b`) are preserved in `task1-workspace-snapshot/`; rebuilding the feasibility helper needs its own workspace root. That root now exists (correction P2R-1): `native/feasibility/Cargo.toml` (members `["helper"]`, same profile) with `native/feasibility/Cargo.lock` (the preserved Task 1 lock) and the Task 1 scripts run cargo there; evidence in `correction/`.
2. `native/Cargo.lock`: 0 version/checksum deviations from the pinned upstream lock (337 upstream pairs, 146 used, 192 pruned, 1 added: the path package `mini-helix-match-helper`); `logs/cargo-lock-compare.txt`. New direct deps (`sha2 0.11`, `toml 1.1`, `tree-house 0.4`, `anyhow`, `serde`, `serde_json`, dev `tempfile`) all resolve to already-locked versions.
3. Some pinned grammar revisions (e.g. `embedded-template`) are annotated tag objects: `git checkout` detaches at the peeled commit, so verification compares `rev^{commit}` with HEAD and the lock records `checkedOutCommit` (first build failed on a naive HEAD comparison).
4. Grammar libraries are unstripped (258.8 MB). Stripping would change the runtime hash; it is a packaging decision (Task 21) and must then be recorded as a build step in the lock.
5. Reproducibility proven only for the same host, compiler (gcc 16.2.1) and checkout path. A different compiler may legitimately change library checksums; `build:match` then fails against the lock until the difference is reviewed and `--update-lock` is used.
6. The `check-runtime` command never loads libraries when static verification already failed (loading a tampered shared object executes it).
7. Windows (`%APPDATA%` Known-Folder root), macOS and musl resolution is covered by the same patch but not exercised in this task; the tests only run on linux-x64 (they seed `APPDATA`/macOS-style decoys, which are inert here). Target builds remain Task 21 work.
8. The patched `helix-loader` emits `warning: unused import: path` (cosmetic, caused by patch 0001).
9. `VERSION_AND_GIT_HASH` from `helix-loader` is informational only; builds started without `GIT_CEILING_DIRECTORIES`/`HELIX_NIX_BUILD_REV` (plain `cargo build`) embed this repository's HEAD there. It affects no runtime behavior and is not part of the identity, so the helper's `version` output prints only the pinned revision constant.
10. Themes, tutor and grammar sources are deliberately not packaged (`runtimeLayout.omitted`).
11. `.gitignore` gained only native build-output lines; `package.json` gained only `build:match` and `check:helix-runtime`.

## Remaining

* Task 4 must call `init_isolated_runtime` + `verify::verify_runtime` (with the lock's identity and target entry) from `initialize`; no protocol exists yet.
* Other targets (win32, darwin, musl, arm), old-glibc build environment, stripped/packaged layout, Rust dependency notices, license redistribution decision: Task 21 / release.
* Independent confirmation of query-compile outcomes and plaintext/no-grammar behavior against a real `hx`: Task 3.
