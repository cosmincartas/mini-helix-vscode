# Task 1 target build/runtime probes (worker T1-B2)

Scope: honest build and runtime probes of the T1-A feasibility helper (`mini-helix-match-feasibility`, pinned Helix
`ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`) for the approved target matrix (spec "Deployment and feasibility gate": win32-x64, win32-arm64,
darwin-x64, darwin-arm64, linux-x64, linux-arm64, linux-armhf, alpine-x64, alpine-arm64). **Experimental; no production implementation; the
matrix is not reduced.** Anything not executed below is *pending*, not passing. Host: Fedora 44 x86_64, Docker 29.8.0 (no host toolchain
changes; every non-host target ran in containers). Only `native/feasibility/targets/**` and this directory were written. No T1-A file was edited.

## Status per target

"Linked" = the helper executable was produced by the real target linker. "Grammar compiled" = the 5-grammar subset
(rust, markdown, markdown_inline, html, javascript) was compiled for that target. "Loaded" = a packaged grammar library was dlopen/LoadLibrary-ed by
the helper and used (`syntaxState: available`, `mif` through tree-sitter, Markdown -> Rust injection).

| Target | Build mode | Linked? | Grammar compiled? | Runtime executed? | Grammar loaded? | Evidence (`logs/`) | Status |
|---|---|---|---|---|---|---|---|
| linux-x64 (glibc) | host build (Fedora, glibc 2.43) and Debian 12 container build | yes / yes | yes (host gcc 16 via pinned loader; Debian gcc 12 via pinned loader) | yes: host-built helper in clean `debian:stable-slim` (glibc 2.41); Debian-12-built helper in clean `debian:bookworm-slim` (glibc 2.36); full 8-group T1-A probe suite, `--network none` | yes (full suite incl. `mif`, injected, surround, git) | `glibc-host-helper-trixie.txt`, `glibc-bookworm-built-helper-bookworm.txt`, `glibc-*-symbol-versions.txt`, `bookworm-build.summary.txt` | **pass** (limits below: needs distro-matched build for old glibc) |
| alpine-x64 (musl) | `rust:1.90.0-alpine`, `RUSTFLAGS=-C target-feature=-crt-static` (dynamic musl) | yes | yes (Alpine gcc 14.2, pinned `helix_loader::build_grammars`, grammars fetched in container) | yes: clean `alpine:3.22`, `--network none`; full 8-group suite and dedicated grammar-load probe | **yes** (`.so` files mapped in `/proc/<pid>/maps`; `mif`; injection `layer=rust`) | `alpine-dynamic-build.summary.txt`, `alpine-dynamic-grammar-probe.txt`, `alpine-dynamic-full-probes.txt` | **pass** |
| alpine-x64 negative control (static musl, default `crt-static`) | same image, no RUSTFLAGS | yes (`static-pie`) | same grammars | yes | **no**: `open rust` -> `syntaxState: initial_failure`, `mif` degrades, no grammar mapped | `alpine-static-build.summary.txt`, `alpine-static-grammar-probe.txt` | control behaves as predicted (shows static linkage is unusable) |
| win32-x64 | `x86_64-pc-windows-gnu` (mingw-w64 posix, Debian 12 container) | yes (`PE32+ console`, imports only system DLLs) | yes, 5 `.dll` via the pinned loader's compile command replicated by `windows-gnu-stage.sh` (pinned loader's own cross path fails, see limits) | yes, **under Wine 10.0 only** (`debian:stable-slim` + `wine64`) | yes (initialize, `open rust` available, `mif`, injection) | `cross-x86_64-pc-windows-gnu-link.txt`, `cross-x86_64-pc-windows-gnu-grammars.txt`, `windows-gnu-stage.txt`, `windows-gnu-wine-grammar-probe.txt` | **partial**: gnu link + Wine run pass; MSVC build and real Windows run **pending** |
| win32-arm64 | `aarch64-pc-windows-msvc` `cargo check` with stubbed C compiler/archiver | no | no | no | no | `cross-aarch64-pc-windows-msvc-check*.txt` | **pending** (Rust type-check only; C code not compiled) |
| darwin-x64 | `x86_64-apple-darwin` `cargo check`, stubbed C compiler/archiver | no (no SDK/ld64) | no | no | no | `cross-x86_64-apple-darwin-check*.txt` | **pending** (type-check only) |
| darwin-arm64 | `aarch64-apple-darwin` `cargo check`, stubbed C compiler/archiver | no | no | no | no | `cross-aarch64-apple-darwin-check*.txt`, `cross-aarch64-apple-darwin-grammars.txt` | **pending** (type-check only) |
| linux-arm64 | `aarch64-unknown-linux-gnu` cross (Debian 12 gcc 12 + rustup target) | yes (ELF aarch64, glibc symbols <= 2.34) | yes (5 `.so` via the pinned loader with `Some(target)`) | **no** (no qemu/binfmt, `exec format error`) | no | `cross-aarch64-unknown-linux-gnu-*.txt`, `arm-cross-binary-facts.txt`, `arm-emulation-availability.txt` | **partial** (build-probe only; runtime pending) |
| linux-armhf | `armv7-unknown-linux-gnueabihf` cross | yes (ELF32 ARM EABI5 hard-float, glibc <= 2.34) | yes (5 `.so`) | **no** (same) | no | `cross-armv7-unknown-linux-gnueabihf-*.txt`, `arm-cross-binary-facts.txt` | **partial** (build-probe only; runtime pending) |
| alpine-arm64 | not attempted | no | no | no | no | `arm-emulation-availability.txt` | **pending**: needs an aarch64 musl toolchain plus a dynamic aarch64 musl libc sysroot, and an arm64 Alpine runner/emulator to load a grammar |

## Key findings

1. **glibc baseline.** The host-built (Fedora, glibc 2.43) helper requires `GLIBC_2.39` (weak `pidfd_getpid`/`pidfd_spawnp` version nodes from the
   glibc it was linked against); it does **not** start on Debian 12 (`version 'GLIBC_2.39' not found`, `glibc-host-helper-bookworm-negative.txt`).
   The same crates built in `rust:1.90.0-bookworm` need only `GLIBC_2.34` and run in `bookworm-slim`. The grammar `.so` files need `GLIBC_2.2.5`..`2.14`
   (x86_64) / `2.17` (aarch64) / `2.4` (armhf). **Release builds must therefore be produced in an old-glibc build environment (Debian 12 or older sysroot); the minimum
   actually proven by running is glibc 2.36 (bookworm-slim)**. The host Fedora grammar `.so` files list `libstdc++.so.6` in `NEEDED` (g++ driver without
   `--as-needed`), the Debian 12 / Alpine ones only `libc`; packaging must check `NEEDED` per target.
2. **Alpine / musl.** Dynamic musl linkage (`-C target-feature=-crt-static`) loads packaged `.so` grammars and passes all 8 T1-A probe groups with no network;
   the helper needs only `libgcc_s.so.1` (apk `libgcc`) + musl at runtime (`ldd` in `alpine-dynamic-grammar-probe.txt`). The default static build links (static-pie) but cannot load any grammar
   (`initial_failure`). Therefore the Alpine build must set the rustflag explicitly (for example in a `.cargo/config.toml` target section); the default musl target is a trap.
3. **Windows.** `x86_64-pc-windows-gnu` links with Debian's mingw-w64 (posix thread model; `update-alternatives` needed) and the helper imports only
   Windows system DLLs. Under Wine 10.0 the helper + MinGW-built grammar DLLs pass the grammar-load probe. **Wine 8.0 (Debian 12) cannot run it**
   (`bcryptprimitives.dll` missing, needed by Rust 1.90 std). `initialize` under Wine reports `runtimeDirs = ["C:\users\root\AppData\Roaming\helix\runtime", "\\?\Z:\stage\runtime"]`, i.e. confirms T1-A's note that on Windows the
   per-user config runtime root outranks the packaged one (needs a runtime-resolution change in the production helper). MSVC was not built: `cc-rs` needs `cl.exe`/`lib.exe` and the Microsoft CRT/SDK
   (`cargo-xwin` would download it only after accepting Microsoft's licence terms, which this worker did not do). Real Windows (and MSVC) remains pending.
4. **Pinned `helix_loader` limitations for cross grammar builds** (no upstream patch made; only observed):
   * `build_grammars(None, ..)` is hard-wired in the T1-A `grammars` bin, so a scratch driver `native/feasibility/targets/cross-grammars` (separate workspace; Cargo.lock seeded from `native/Cargo.lock`, 121 reused packages + itself, 0 version/checksum deviations) calls the unchanged pinned `build_grammars(Some(target))`.
   * With a non-host target the loader still decides linker flags with `cfg!(unix...)` of the **build host**: for `x86_64-pc-windows-gnu` it appends `-Wl,-z,relro,-z,now` and mingw `ld` fails (`unrecognized option '-z'`, 5/5 grammars). For aarch64/armv7 Linux it works. For `*-apple-darwin` it invokes the host `cc` with `-arch ...`, which fails with no SDK/clang driver (`cross-aarch64-apple-darwin-grammars.txt`).
   * **False-positive trap:** `build_grammars(Some("x86_64-pc-windows-msvc"))` in the image exited 0 but produced **host ELF** `.so` files (no MSVC compiler available; `file` shows ELF). `cross-x86_64-pc-windows-msvc-grammars.txt` is therefore **not** evidence of MSVC feasibility and is counted as such.
   * Output file extension is chosen by the host cfg of the loader (`.so` when run on Linux), so the Windows DLLs had to be renamed to `.dll` (manual replication in `windows-gnu-stage.sh`). Windows and macOS grammar builds should run on native runners with the pinned loader.
5. **macOS / win-arm64 type-check.** The real `cargo check --target {x86_64,aarch64}-apple-darwin` and `*-pc-windows-msvc` fail in dependency build scripts (the `cc` crate finds no usable C compiler/`lib.exe`; see `*-check.txt`).
   With `CC/CXX/AR` replaced by `stub-cc.sh`/`stub-ar.sh` (they `touch` outputs and compile nothing) all four `cargo check --release --locked` runs succeed. That proves only that the Rust code of the helper and its
   dependency graph type-checks for those targets; **no C code (tree-sitter runtime, grammars) was compiled, nothing was linked or run**.
6. **ARM Linux.** `docker run --platform linux/arm64|linux/arm/v7 alpine` fails with `exec format error` and `/proc/sys/fs/binfmt_misc` has no qemu entries. Registering qemu would change host-global kernel binfmt state
   (not done). Both ARM Linux targets were cross-compiled and linked, so only build feasibility (including the pinned loader's cross compile of the grammars) is shown.
7. **Diagnostic gap (helper).** When a grammar cannot be loaded the helper reports only `syntaxState: initial_failure`; the dlopen error text is not surfaced, so the static-musl cause was inferred from the control (grammar libs not mapped in `/proc/<pid>/maps`), not from a message.

## Sizes (informational, 5-grammar subset)

Helper unstripped: host glibc 10,024,408 B; Debian 12 9,985,016 B; Alpine dynamic 9,775,952 B; Alpine static 9,920,216 B; aarch64 9,941,424 B; armhf 8,822,164 B; Windows gnu 11,083,388 B (stripped to external PDB).
Alpine grammar `.so` files carry `debug_info` (rust.so 1,141,464 B); no stripping was attempted. Package size is owned by the packaging worker.

## Reproduce (worktree root; Docker; network needed for builds, not for runtime probes)

```
T=native/feasibility/targets
# images (Containerfile.*) and digests: logs/environment-and-images.txt
docker build -f $T/Containerfile.probe-debian -t hm-t1b2-probe-debian-trixie $T
docker build --build-arg BASE=debian:bookworm-slim -f $T/Containerfile.probe-debian -t hm-t1b2-probe-debian-bookworm $T
docker build -f $T/Containerfile.probe-alpine -t hm-t1b2-probe-alpine $T
docker build -f $T/Containerfile.cross -t hm-t1b2-cross $T ; docker build -f $T/Containerfile.wine -t hm-t1b2-wine $T

# 1 glibc: copy the host stage (native/feasibility/build/stage), run suite with --network none
cp -a native/feasibility/build/stage /tmp/hm-t1b2-glibc/stage
$T/run-probes-container.sh hm-t1b2-probe-debian-trixie   /tmp/hm-t1b2-glibc/stage /tmp/hm-t1b2-glibc/out-trixie            # PASS 8/8
$T/run-probes-container.sh hm-t1b2-probe-debian-bookworm /tmp/hm-t1b2-glibc/stage /tmp/hm-t1b2-glibc/out-bookworm-hosthelper # exit 1: GLIBC_2.39 not found
docker run --rm -e OUT=/out -e HOST_UID=$(id -u) -e HOST_GID=$(id -g) -v $PWD/native:/native:ro -v /tmp/hm-t1b2-bookworm:/out rust:1.90.0-bookworm \
  sh -c 'apt-get update -qq && apt-get install -y -qq --no-install-recommends g++ git file && /native/feasibility/targets/build-in-container.sh'
$T/run-probes-container.sh hm-t1b2-probe-debian-bookworm /tmp/hm-t1b2-bookworm/stage /tmp/hm-t1b2-bookworm/out-bookworm     # PASS 8/8

# 2 alpine (dynamic = proof, static = negative control)
for m in dynamic static; do docker run --rm -e OUT=/out -e MODE=$m -e HOST_UID=$(id -u) -e HOST_GID=$(id -g) -v $PWD/native:/native:ro -v /tmp/hm-t1b2-alpine-$m:/out rust:1.90.0-alpine \
  sh -c 'apk add --no-cache g++ git file bash && bash /native/feasibility/targets/build-in-container.sh'; done
$T/run-grammar-probe-container.sh hm-t1b2-probe-alpine /tmp/hm-t1b2-alpine-dynamic/stage   # 5/5 PASS, --network none
$T/run-grammar-probe-container.sh hm-t1b2-probe-alpine /tmp/hm-t1b2-alpine-static/stage    # 4 FAIL (expected control), exit 2
$T/run-probes-container.sh hm-t1b2-probe-alpine /tmp/hm-t1b2-alpine-dynamic/stage /tmp/hm-t1b2-alpine-dynamic/out   # PASS 8/8

# 3-5 cross probes (mode: link | check | check-stubcc | grammars)
$T/run-cross.sh x86_64-pc-windows-gnu link ; $T/run-cross.sh x86_64-pc-windows-gnu grammars /tmp/hm-t1b2-cross-x86_64-pc-windows-gnu-gr   # grammars: 5/5 FAIL (-z)
# windows stage + Wine run: copy the link output's cargo-target/x86_64-pc-windows-gnu next to the grammars dir, then
docker run --rm -e OUT=/out -v $PWD/native:/native:ro -v /tmp/hm-t1b2-cross-x86_64-pc-windows-gnu-gr:/out hm-t1b2-cross /native/feasibility/targets/windows-gnu-stage.sh
docker run --rm --network none -e HM_WRAPPER=/usr/lib/wine/wine64 -e HM_EXE_SUFFIX=.exe -e HM_GRAMMAR_EXT=.dll -e WINEDLLOVERRIDES="mscoree,mshtml=" -e WINEDEBUG=-all -e XDG_RUNTIME_DIR=/tmp -e WINEPREFIX=/tmp/wineprefix -e HOME=/tmp \
  -v /tmp/hm-t1b2-cross-x86_64-pc-windows-gnu-gr/win-stage:/stage:ro -v $PWD/native/feasibility/helper/probes:/probes:ro -v $PWD/$T:/targets:ro hm-t1b2-wine \
  sh -c 'cd /tmp && python3 -I /targets/grammar-load-probe.py /stage /probes'
for t in aarch64-unknown-linux-gnu armv7-unknown-linux-gnueabihf; do $T/run-cross.sh $t link; $T/run-cross.sh $t grammars /tmp/hm-t1b2-cross-$t-gr; done
for t in x86_64-apple-darwin aarch64-apple-darwin x86_64-pc-windows-msvc aarch64-pc-windows-msvc; do $T/run-cross.sh $t check; $T/run-cross.sh $t check-stubcc; done
```
Scratch outputs live in `/tmp/hm-t1b2-*` (not in the repository). Logs under `logs/` are tails/filtered excerpts of those runs (cargo `Compiling` lines removed). Container probe runs
exclude Rust/Cargo/Helix/compilers from PATH (`tools absent` section in `glibc-host-helper-trixie.txt`); python3 and git are only the probe driver (T1-A probes need them); the Debian/Alpine runtime images are listed with digests in `logs/environment-and-images.txt`
(the locally built probe images derive from the digest-pinned bases, and `debian:bookworm-slim` was pulled implicitly during the build so its digest was not recorded).

## Required helper changes / notes for later tasks (none applied here)

* Production helper must resolve its runtime root without relying on per-user config dirs on Windows (T1-A limit confirmed under Wine).
* Surface the grammar load error text (without document content) in a diagnostic so a missing/incompatible grammar library is distinguishable from a parse failure.
* Release packaging: musl targets need `-C target-feature=-crt-static` in the committed build configuration; glibc targets need an old-glibc build environment (Debian 12 proven to 2.34 symbols); check `NEEDED` of grammar libraries per toolchain.
* Grammar build driver: add an explicit target argument, build Windows/macOS grammars on native (or SDK-equipped) runners; do not rely on the pinned loader's cross path (host-cfg linker flags; silent host-ELF output for msvc).

## Remaining target-matrix work (for plan Task 21 and release engineering)

* win32-x64: build with MSVC (`x86_64-pc-windows-msvc`, MSVC-built grammar DLLs via the pinned loader's `cl` branch) on a real Windows runner and execute the probes natively; verify the runtime-root override.
* win32-arm64: any real build (check-only here with stubbed C), link, grammar compile and run on arm64 Windows.
* darwin-x64 / darwin-arm64: SDK-based build (macOS runner or SDK-equipped cross), link, grammar `.dylib` compile with the pinned loader, run and load a grammar (including code signing/quarantine behavior for downloaded dylibs). Nothing beyond Rust type-check was done.
* linux-arm64 / linux-armhf: run the cross-linked helpers with grammars on real or emulated hardware (qemu-user binfmt or arm runners); until then runtime and grammar load are pending.
* alpine-arm64: whole probe (dynamic musl cross/native build, run in arm64 Alpine, load grammar) is pending.
* linux-x64: produce release binaries in the chosen old-glibc environment and decide the documented minimum glibc; musl: commit the dynamic-linkage configuration; full 301-grammar build/size per target (only the 5-grammar subset was built).
* Windows MSVC `cargo-xwin` route needs an explicit owner decision to accept the Microsoft SDK licence; not attempted.
