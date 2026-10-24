> **SUPERSEDED (2026-10-24), historical only.** The user switched to a TypeScript-only implementation; see [../../helix-match-typescript/spec.md](../../helix-match-typescript/spec.md). Native code archived at /home/cosmincartas/work/archives/vscode-extension-helix-match-native-20261024.

# Helix Match Task 1 Feasibility Report

Date: 2026-10-24.
Scope: plan Task 1, "Establish native feasibility evidence".
Paths below are relative to `docs/context-engineering/helix-match/feasibility/` unless they start with `native/`, `test/`, or `/tmp/`.

## 1. Scope, identity, and non-claims

This report is the single go/no-go report for the selected architecture (workspace-hosted native helper, JSON Lines over stdio, `TextEditor.edit` for commits).
It summarizes archived evidence only.
Each evidence folder has its own README with raw method and limits.

| Item | Value |
|---|---|
| Helix revision | `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc` |
| Source archive SHA-256 | `c5e35c68897a0f3793937095d8d9c13340fa18e727a3696ae16fa0edd1d08d23` (equals the spec research checksum; `native/runtime-manifest.json` `sourceArchiveSha256`) |
| `spec.md` SHA-256 | `ca7f9e8365d069cffddab142f0b48d02d42fc2238db85a8497406d12e83a9776` |
| `plan.md` SHA-256 | `3ee44343d1010d8ac4572f9de8e8d99dc261b2467390022d3d2f37ce07e2da28` |
| `review.md` SHA-256 | `5d2ad0595903ba91c3cd76a93a2b430c060be55a782722c3c65e190c5bdd5d07` |
| Toolchain | `rustc 1.90.0 (1159e78c4 2025-09-14)`, `cargo +1.90.0`, `--locked`; host gcc 16.2.1 |
| Current host | AMD Ryzen 9 7900X3D, 24 logical CPUs, 62 GiB RAM, Fedora 44, Linux 7.2.5, glibc 2.43 |
| VS Code | 1.143.1 (current, `native-edit-context`) and 1.85.2 (engine minimum, textarea) |
| Containers | Docker 29.8.0; image digests in `targets/logs/environment-and-images.txt` |
| Repository HEAD | `0b2f3aea685204fc48b509392664ad08e4996106`, branch `feat/helix-match`, no commits made |

The experimental helper is disposable: `native/Cargo.toml`, `native/feasibility/**`, `test/feasibility/**`.
No production behavior, keybinding, `package.json`, spec, plan, or contract was changed for this report.

This report does not claim:

- production parity, a production helper, or completion of any task after Task 1;
- support for any target that is not marked confirmed in section 3.1;
- real non-US layout, AltGr, or OS IME coverage;
- a latency, memory, or size threshold (NFR-8 defers thresholds until measurements support one);
- a Helix-exact oracle for `c` or for ordinary-input replay (Task 3 and Task 18 own those).

Missing evidence is recorded as pending, never as passing.

## 2. Requirement-by-requirement evidence

Status values: pass, fail, partial, pending.
"Native" means `native/README.md`, "Editor" means `editor/README.md`, "Package" means `package/README.md`, "Targets" means `targets/README.md`.

### 2.1 Work items

| # | Plan item | Evidence | Command / method | Result | Status |
|---|---|---|---|---|---|
| W1 | Minimal helper against exact pinned source and runtime | Native; `native/runtime-manifest.json` | `native/feasibility/fetch-source.sh`, `grammars/build-grammars.sh`, `grammars/stage-runtime.py`, `grammars/stage-helper.sh` (section 8) | Archive SHA matches; `diff -rq` against verified extraction is empty (`native/final-run.txt`); `cargo build --release --locked` ok; 0 lock deviations; 0 upstream patches; 5-grammar subset | pass (subset only) |
| W2 | `miw` | `native/probe-results.json` group `plaintext-objects`; Package scenario `miw-plaintext` | `run_probes.py`; installed-extension e2e | 9 checks pass; e2e selection `bar`, 20/20 reps | pass |
| W3 | `mif` | `native/probe-results.json` group `rust-function`; Package `mif-rust` | same | 11 checks pass; e2e selects the whole function body, 20/20 reps | pass |
| W4 | Injected object | `native/probe-results.json` group `injected-object`; Package `mif-injected-markdown-rust`, `mif-injected-control-prose` | same | 10 checks pass; markdown fenced Rust and HTML `<script>` JavaScript resolve to the injected layer; control outside the fence is a no-op | pass |
| W5 | Surround editing | `native/probe-results.json` group `surround` (43 checks); Package `md-paren`, `mr-paren-bracket` | same | `ms`, `mr`, `md` pass, including preview/continuation, failed lookup, count, multi-selection | pass |
| W6 | Git hunk | `native/probe-results.json` group `git-hunk` (13 checks); Package `mig-git-hunk-unsaved` | same; temp git repo, unsaved edit, no `git` binary on PATH | HEAD baseline from repository, replica from editor; pure deletion, no-hunk, baseline refresh, untracked/path-less unavailable | pass |
| W7 | Arbitrary Unicode surround input | Editor probe 1; Package `ms-emoji-insertText`, `ms-cjk-ime`, `ms-guillemet-insertText`; `native/probe-results.json` `surround` | CDP `insertText` / IME composition into the session `type` override | U+1F600, U+00AB, U+65E5 via composition delivered as one scalar; one native undo restores (20/20, 5/5, 5/5) | pass (CDP only; real layouts pending) |
| W8 | Modified-character routing | Editor probe 2; `editor/results-*.json` `probe2` | `runEditorProbes.js --probes 1,2,3,4,5,8` | Callback phase 224/224 via bindings; action phase 48/48 exact modifier strings; same routes on both versions | pass |
| W9 | Ordinary-input replay after failed lookup | Editor probe 3; `editor/results-*.json` `probe3`; `analysis/replay-gap-oracle.md` | 7 scenarios per version | Ordered buffer and replay work for the extension's own bindings; no supported API replays native, user, or other-extension keys | partial: limit determined (section 4.2) |
| W10 | CRLF and EOF projection through consecutive match and edit commands | `native/crlf-eof-unicode-fixture.json.gz` (1108 transitions / 455 chains); `package/e2e-projection.json` | Replay all chains through real editor and installed helper | 1979 read-backs, 7 not identical (6 distinct transitions), one shape (section 3.3) | pass (experiment ran; one reproduced loss) |
| W11 | Decide whether normalized selections need extra metadata | `package/e2e-retained-replay.json`, `package/e2e-retained-invalidation.json`, `package/e2e-retained-cd.json`; `package/results-summary.json` | `HM_PARTS=R` follow-up | Needed for one class; spec-approved retained metadata closes it in the experiment; CRLF shadow ranges not needed | pass (determination made; no production metadata implemented) |
| W12 | Delay helper results; race a real native edit against `TextEditor.edit` | `package/e2e-race.json`; `editor/results-*.json` `probe5` | Package part B (90 trials); Editor probe 5 (7 variants x 250 trials x 2 versions) | 0 stale proposals applied, 0 corruption, `edit` never threw | pass |
| W13 | Does the supported edit API reject a stale base | same as W12 | same | `TextEditor.edit` returns `false` for a base the host has not seen; no different API needed | pass |
| W14 | Measure startup, warm requests, parsing, memory, package size with corpus sizes and host | `native/measurements.json`; `package/results-summary.json` | `measure.py`; installed-package run | Section 5 | pass (5-grammar subset; no thresholds) |

### 2.2 Verification items

| # | Plan item | Evidence | Result | Status |
|---|---|---|---|---|
| V1 | Run on current host; archive commands, inputs, outputs, method | `native/`, `editor/`, `package/` READMEs and JSON; section 8 | Archived with commands; large raw logs live in `/tmp/hm-t1a-logs/`, `/tmp/hm-t1c-logs/`, `/tmp/hm-t1b1-results*` (not in the repository) | pass |
| V2 | One local package works without Rust or Helix at runtime | `package/results-summary.json` `environment`, `package/e2e-environment.json`, `package/install.txt`, `package/netns-links-before.txt` | Installed `local.mini-helix@0.99.0` VSIX under `unshare -rn` with empty PATH/HOME; 1,201 assets match manifest; grammars mapped from the package; helper spawn to initialize 11.09 ms | pass (linux-x64 host build; glibc >= 2.39 only) |
| V3 | Windows build feasibility via probe | `targets/logs/cross-x86_64-pc-windows-gnu-link.txt`, `targets/logs/windows-gnu-wine-grammar-probe.txt` | `x86_64-pc-windows-gnu` links; helper and MinGW grammar DLLs load a grammar under Wine 10.0; MSVC not built; real Windows not run | partial |
| V4 | macOS build feasibility via probe | `targets/logs/cross-x86_64-apple-darwin-check.txt`, `targets/logs/cross-x86_64-apple-darwin-check-stubcc.txt`, `targets/logs/cross-aarch64-apple-darwin-check-stubcc.txt` | `cargo check` with stubbed C compiler only; no C code compiled, nothing linked or run | pending (type-check only) |
| V5 | glibc build feasibility | `targets/logs/glibc-host-helper-trixie.txt`, `targets/logs/glibc-bookworm-built-helper-bookworm.txt`, `targets/logs/glibc-host-helper-bookworm-negative.txt`, `targets/logs/bookworm-build.summary.txt` | Host-built helper runs in `debian:stable-slim` (glibc 2.41); Debian 12 build runs in `bookworm-slim` (glibc 2.36); both 8/8 probes, `--network none`; host-built helper fails on Debian 12 (`GLIBC_2.39`) | pass (needs old-glibc build environment) |
| V6 | musl build feasibility; dynamic helper in Alpine loads a grammar | `targets/logs/alpine-dynamic-grammar-probe.txt`, `targets/logs/alpine-dynamic-full-probes.txt`, `targets/logs/alpine-dynamic-probe-results.json`, `targets/logs/alpine-static-grammar-probe.txt` | Dynamic musl in `alpine:3.22`: 8/8 probes and 5/5 grammar-load checks, `.so` files mapped, `mif` and injection work; static musl control gives `initial_failure` | pass (alpine-x64) |
| V7 | Record remaining target-matrix work | `targets/README.md` "Remaining target-matrix work"; section 3.1 here | Recorded | pass |

## 3. Gate decisions

Plan gate text: "Stop dependent work if build viability, Unicode input, selection semantics, or stale-edit protection fails. Seek design review; do not substitute approximations."
Open Issues (spec): "Do not reinterpret failure as permission to reduce the parity target."

### 3.1 Build viability

Decision: GO for the architecture on the confirmed targets. No build or load failure invalidates the design.
The matrix is not reduced; unconfirmed targets are pending and must not be promised.

| Target | Evidence level | Confirmed? |
|---|---|---|
| linux-x64 (glibc), current host | Built, 8/8 probes, offline VSIX proof, in-host editor e2e | Yes |
| linux-x64 (glibc), Debian 12 build in `bookworm-slim` and host build in `debian:stable-slim` | Built, linked, 8/8 probes each, `--network none` | Yes |
| alpine-x64 (dynamic musl) | Built in `rust:1.90.0-alpine`, run in clean `alpine:3.22`, grammar loaded and used | Yes |
| win32-x64 | `x86_64-pc-windows-gnu` linked; Wine 10.0 grammar load; Wine 8.0 cannot run it; no MSVC build, no real Windows | Partial |
| linux-arm64, linux-armhf | Cross-linked, grammars cross-compiled; no execution (no qemu/binfmt, `exec format error`) | Link only |
| darwin-x64, darwin-arm64, win32-arm64 | Rust `cargo check` with stubbed C compiler/archiver; no C code compiled, nothing linked or run | No (type-check only) |
| alpine-arm64 | Not attempted | No |

Reasoning from plan text:

- The plan requires representative Windows, macOS, glibc, and musl feasibility "before promising those targets".
  Only glibc and musl are fully confirmed.
  Windows is partial and macOS is not confirmed.
  Those targets are not promised by this report.
- The spec states "A failed target must block that target's release; dropping a declared target requires a reviewed scope change."
  No target failed.
  No target is dropped here.
- Findings that constrain later work are in section 6 (old-glibc build environment, `-C target-feature=-crt-static` for musl, Windows runtime-root resolution, pinned-loader cross-build traps, grammar `NEEDED` check).
- The `build_grammars(Some("x86_64-pc-windows-msvc"))` run exited 0 but produced host ELF files.
  It is recorded in `targets/logs/cross-x86_64-pc-windows-msvc-grammars.txt` and is not counted as MSVC evidence.

Remaining matrix work (owner: Task 21 and release engineering):

- win32-x64: MSVC build on a real Windows runner, native probe run, runtime-root override check.
- win32-arm64: real build, link, grammar compile, and run.
- darwin-x64 and darwin-arm64: SDK-based build, link, `.dylib` grammar compile, run and load a grammar, signing/quarantine behavior.
- linux-arm64 and linux-armhf: run the cross-linked helpers with grammars on real or emulated hardware.
- alpine-arm64: whole probe (dynamic musl build, arm64 Alpine run, grammar load).
- linux-x64: release build in the chosen old-glibc environment and a documented minimum glibc (2.36 is the lowest proven by running).
- musl: commit the dynamic-linkage configuration.
- All targets: full 301-grammar build and size (only 5 grammars were built).

### 3.2 Unicode input

Decision: GO for the mechanism, with real-layout evidence pending.

- Scoped keybindings alone fail for non-ASCII: 0/10 on 1.143.1 (characters leak into the document); `editor/results-1.143.1.json` `probe1`.
- A temporary session-scoped override of `type`, `replacePreviousChar`, `compositionStart`, `compositionType`, and `compositionEnd` delivers non-ASCII scalars (10/10 on 1.143.1; 8/10 on 1.85.2) and composition.
  Composition rule: keep only the final composing text and emit it at `compositionEnd`.
  The spec permits this mechanism.
- On 1.85.2 two non-BMP cases fail only via CDP key events (garbled lone surrogate); `Input.insertText` delivers them intact.
  This is treated as a CDP artifact for Chromium 114, not shown with a real keyboard.
  The handler must still validate "exactly one Unicode scalar" (`e` + U+0301 arrives as two scalars and is rejected).
- End to end through the packaged helper: `ms` with U+1F600, U+00AB, and an IME-composed U+65E5 edited the document through `TextEditor.edit`, and one native undo restored it (`package/e2e-commands.json`).
- Pending: real non-US layouts and AltGr cannot be reproduced through CDP; an AltGr emulation reaches no `type` handler and hits `ctrl+alt+<key>` bindings.
  Real OS IME frameworks are also pending.
  Task 19 must cover them before any claim of arbitrary Unicode parity.
- Modified characters in callback phases reach the owner only through bindings (`type` never receives Ctrl combinations).
  The design must therefore use `type` for text and bindings for modified characters and non-text keys.

### 3.3 Selection semantics

Decision: GO, conditional on Task 7 implementing the spec-approved retained semantic metadata (spec L363-364).

- VS Code's raw selection list is not a lossless projection for one reachable class.
  A zero-width cursor at EOF that touches the end of a width >= 1 range is merged into the range.
  Observed in 6 distinct transitions on documents `" "`, `"\n"`, `"\n\n"`, `"\r\n"`, `"\r\n\r\n"` (`package/e2e-projection.json` `resultProjection.diffList`).
  Following `miw`, `maw`, `ms(`, and `md(` then produce different results (`package/results-summary.json` `projection.commandsWhoseOutputDiffers`).
  Without retention the loss is reproduced.
- With retained metadata (semantic ranges and primary, document version, set selections, read-back; invalidated on version change or any external selection event), the experiment closed the loss:
  merge-caused mismatches 10 to 0, `textAfter` mismatches 3 to 0, 1,546 retained uses with 0 fallbacks (`package/e2e-retained-replay.json`).
  Invalidation passed 30/30 probes (6 shapes x 5 cases), including when selections were restored to equal values (`package/e2e-retained-invalidation.json`).
- Determination: Task 7 must implement retained semantic metadata for this class.
  CRLF shadow ranges and surrogate or cluster metadata are not needed: no reachable result had an endpoint inside a CRLF or a surrogate pair, and VS Code cannot represent such a position.
- The 12 remaining replay mismatches are helper-only inputs that place a cursor between `\r` and `\n` (58 such inputs in the corpus).
  VS Code cannot construct them, so they are not a projection loss of a reachable result.
- Real `d` after the merge: text identical to the helper expectation on 6/6.
  Real `c`: identical on 1/6 and different on 5/6 (the blank-line-break cases).
  No-merge controls covering a blank line's break differ in the same way (3/3), and the helper output is the same for the semantic and merged inputs.
  So the existing `c` difference is not projection-caused.
  It is a parity item for the implementing task, and the Helix-exact `c` oracle is pending in Task 18.
- Not exercised: a real mouse click, tab or editor switches, undo of own edits, window reload, other extensions restoring selections, VS Code 1.85.2 for the retained follow-up.
  The retained holder is a test-only construct, not a production design.

### 3.4 Stale-edit protection

Decision: GO. The supported API protects the base version; no contract change is needed.

- Editor probe 5, 7 variants x 250 trials per version.
  1.143.1: forced-stale V6 and V7 returned `false` 250/250 each; `edit` threw 0; edits applied on a changed base 0; corruption 0.
  1.85.2: V6 245/250 and V7 249/250 returned `false` (the rest were legitimately ordered); same zeros.
- Installed-package race: 90 trials, delayed helper `evaluate` of 200 ms against a real CDP key.
  Variant A: 60/60 stale proposals caught by the synchronous version check, `edit` never called.
  Variant B (host thread blocked, stale mirror): `TextEditor.edit` returned `false` 30/30, with the synchronous check unable to see the change (30/30).
  Undo restored the pre-typing text in all trials that were undone (40/40 and 30/30).
- Both guards are required: the synchronous `document.version` check for changes the host has seen, and `TextEditor.edit` rejection for changes it has not.
- Limits: Linux x64 only; the installed-package race ran on 1.143.1 only; multi-document and notebook edits were not tested.

## 4. Other Task 1 items

### 4.1 Modified-character routing

Pass.
See W8.
Ctrl and Alt characters in callback phases are reachable only through bindings (value is the character, modifiers ignored by the owner); the action phase matched exactly one binding with the exact modifier string (48/48).
Outside a pending session, native shortcuts keep working (Ctrl+A, Alt+Down, Ctrl+X) on both versions.

### 4.2 Replay after a failed lookup

Status: determined VS Code limit for native and user-bound keys.
This is not a gate criterion (plan L131-132 name four criteria).
It does require a contract amendment that needs user approval before Task 16; this report does not choose for the user.

Evidence:

- Editor probe 3 (`editor/results-*.json` `probe3`) shows ordered buffering and replay for the extension's own contributed bindings (`d`, `shift+w`, `alt+o`, 14 rapid motions) and delivery to a replacement callback on a successful lookup.
- Keys with no extension binding (`ctrl+d`, native arrows) could not be replayed through `executeCommand`; `left` and `escape` needed a fixture table.
- `analysis/replay-gap-oracle.md` (oracle memo): no supported VS Code 1.85+ mechanism can replay native, user, or other-extension bound keys.
  `spec.md` L596 and L601 cannot be met literally for those keys.
  This triggers the plan L55 material-change rule for Task 16 and its dependents (17-22); Tasks 2-15 are unaffected.

Options recorded by the memo (user decision required):

1. Replay buffered keys in order through the extension's generated NORMAL keymap against extension state; at the first native, user, or other-extension bound key, discard it and all later buffered keys, execute nothing further, and report the discarded input in the status item.
2. Option 1 plus a closed table of default native commands for arrows, Home, End, PageUp, PageDown (wrong for users who rebound them).
3. Rejected by the memo: literal contract (unimplementable) and skip-and-continue (destructive, for example `mr(` then `ctrl+d` then `c`).

Memo risks: end-to-end window size unmeasured (especially on remote hosts); a replayed Escape cannot dismiss popups; user bindings scoped to NORMAL already outrank match capture in every phase.

## 5. Measurements

No threshold is proposed (NFR-8).
All numbers are from the archived JSON files named in each row.

Method: one helper process per scenario; client `perf_counter` around one JSON Lines round trip; 1,000 warm samples; peak RSS is `VmHWM`; release profile (thin LTO).
Host: section 1.
Concurrent cargo builds ran on the host during some runs, so absolute values vary (the scout notes host load 18-27 during its reruns).

| Measure | Value | Source |
|---|---|---|
| Cold start, spawn to `initialize` | p50 11.505 ms, p95 12.492 ms (n=20); first sample 12.275 ms | `native/measurements.json` `coldStart` |
| Cold start, installed package, no Rust/Helix | 11.09 ms | `package/results-summary.json` `helperInit` |
| First Rust `open` (grammar load, query compile, parse) | 53.439 ms; second Rust `open` 0.105 ms | `native/measurements.json` |
| First `mif` | 9.983 ms (textobject query compile) | same |
| Warm round trip p50 / p95, small documents | `mif` 0.033 / 0.037 ms, `maf` 0.033 / 0.034, `miw` 0.025 / 0.027, `ms` 0.028 / 0.032 (n=1000 each) | same `warm` |

Note: `native/README.md` prose previously quoted cold start 11.1 / 11.9 ms, first Rust open 49.8 ms, first `mif` 9.6 ms, and warm `mif` 0.031 / 0.034 ms, which were not in the archived `measurements.json`.
The README was corrected to the `measurements.json` values, which this report uses.

Parse and edit latency (`native/measurements.json` `parse`):

| Corpus | Lines / bytes | open (parse) ms | `mif` p50 ms | Insert at start p50 ms | Insert mid p50 ms | State after edits | Peak RSS MiB |
|---|---|---|---|---|---|---|---|
| Rust | 1,000 / 13,180 | 2.04 | 0.861 | 24.421 | 24.307 | available | 17.1 |
| Rust | 10,000 / 135,780 | 20.51 | 7.904 | 219.83 | 219.112 | available | 29.1 |
| Rust | 100,000 / 1,397,780 | 210.23 | 83.917 | first edit 500 ms | not run | `update_failure` | 96.7 |
| Markdown + fenced Rust | 1,000 / 6,670 | 3.32 | 0.026 | 0.947 | 1.0 | available | 18.8 |
| Markdown + fenced Rust | 10,000 / 69,670 | 35.25 | 0.026 | 9.003 | 9.083 | available | 33.2 |
| Markdown + fenced Rust | 100,000 / 726,670 | 337.83 | 0.03 | 156.527 | 159.23 | available | 193.6 |

Edit-latency caveats (`analysis/edit-latency-scout.md`, scout confidence about 85%):

- The probe inserted `x` at byte 0, which turns `fn f0` into `xfn f0` (invalid Rust).
  Error-recovery reparsing dominates the cost (about 97% by the scout's estimate, inferred from timings).
- The "mid" insertions in `measure.py` are mid-document (offset inside a function body past the midpoint), but they ran after 10 invalid start-of-document inserts, so they measured an already-errored document.
  The start and mid columns are therefore not independent measurements.
- Valid edits measured by the scout: Rust 10k about 7-14 ms and 100k about 150 ms; Markdown 100k 283-426 ms.
  The 100k invalid-edit case was not re-run.
- The 500 ms parse timeout and the resulting syntax disable are inherited from pinned Helix (tree-house 0.4.0 path and `PARSE_TIMEOUT` 500 ms in `helix-core/src/syntax.rs`).
  A large file with a syntax-breaking edit near the top can exceed 500 ms and disable syntax until reopen.
  The helper reproduces that behavior; it is not a helper defect.
  Whether the product keeps the upstream timeout is for the syntax lifecycle task (Task 9) and Task 20; this report does not change the contract.

In-host latency (`package/results-summary.json` `commands`, installed package, 20 reps; method `performance.now()` from the owner receiving the final character to selection assignment, excluding CDP and renderer delay), p50 / p95 ms of "type event to applied":

| Scenario | p50 / p95 |
|---|---|
| `miw-plaintext` | 0.874 / 1.56 |
| `mif-rust` | 0.761 / 10.851 |
| `mif-injected-markdown-rust` | 0.723 / 0.934 |
| `ms-emoji-insertText` | 1.55 / 3.20 (README) |
| `md-paren` | 1.88 / 7.66 (README) |
| `mig-git-hunk-unsaved` | 0.91 / 1.45 (README) |

The full per-scenario table, including helper `evaluate`, is in `package/README.md`.
Helper peak RSS after the whole in-host run (18 documents open): 19,544 KiB (`package/README.md`).

Sizes (linux-x64, 5-grammar subset only; full 301-grammar size is pending, Task 2):

| Item | Bytes | Source |
|---|---|---|
| VSIX `mini-helix-feasibility-linux-x64.vsix` | 4,359,810 (sha256 `bcbfe6375c6b2d81d811eeece0f3f32b0fba1e6b9c727d60a69b64bb6238ae2b`) | `package/results-summary.json` |
| VSIX entries / uncompressed | 1,225 / 11,880,792 | same |
| Helper unstripped / stripped | 10,024,472 / 7,946,640 (stage binary 10,024,408; packaged stripped copy 7,946,704) | `native/measurements.json` `sizes`; `package/README.md` |
| Grammar libraries (rust 1,140,656; markdown 409,136; markdown_inline 404,376; javascript 431,576; html 33,880) | 2,419,624 total | `native/measurements.json` |
| Runtime queries (full pinned set) | 1,087,532 | same |
| Helper unstripped by target | host glibc 10,024,408; Debian 12 9,985,016; Alpine dynamic 9,775,952; aarch64 9,941,424; armhf 8,822,164; Windows gnu 11,083,388 | `targets/README.md` |

## 6. Deviations and inventories

| Item | Detail | Later owner |
|---|---|---|
| Upstream patches | None. `native/feasibility/upstream/helix` is byte-identical to the verified extraction (`native/final-run.txt`). | Task 2 keeps the no-patch policy or records a reviewed patch |
| Adapter symbols | Single-closure and function restatements from `helix-term/src/commands.rs` (`select_textobject`, `surround_add`, `surround_replace` split into preview and continuation, `surround_delete`, feasibility-only `debugDelete`), `helix-view/src/document.rs` (`apply_computed`, `input_selection`, syntax `open`/`change`, `load_base`/`make_diff`), a new `settle`, `WireKey::as_char_opt`. Full table in `native/README.md` "Adapter inventory". No Helix algorithm is reimplemented in TypeScript. | Tasks 3 (oracle), 8-15 |
| Lock deviations | None: 337 upstream (name, version) pairs, 245 here, 93 unused pruned, 0 version or checksum deviations, 1 added package. `native/Cargo.lock` is seeded from upstream `Cargo.lock` (sha256 `d05931bb2132b9e231bb7046a4bd3403bce371b5fc3d9552f10f71244ed9321d`). | Task 2 (complete lock) |
| Environment settings | Builds set `GIT_CEILING_DIRECTORIES=native/feasibility/upstream` and `HELIX_NIX_BUILD_REV=<pinned rev>`; helper sanitizes `CARGO_MANIFEST_DIR`, `HELIX_RUNTIME`, `XDG_*` before first `runtime_dirs()`; `--ambient` and `HM_FEASIBILITY_DEBUG_ERRORS=1` are debug-only; musl needs `RUSTFLAGS=-C target-feature=-crt-static`; Wine runs use `WINEDLLOVERRIDES`, `WINEPREFIX`. | Tasks 2, 5, 21 |
| Runtime isolation limit | Isolation works on unix by process-global env mutation. On Windows the Known-Folder config runtime root (`%APPDATA%\helix\runtime`) outranks the packaged root; confirmed under Wine (`targets/logs/windows-gnu-wine-grammar-probe.txt`). macOS not exercised. Production needs a runtime-resolution change. | Task 2 (runtime resolution), Task 21 |
| Git baseline decoding | Baseline decoded as UTF-8 with replacement, not upstream `from_reader`; BOM and non-UTF-8 encodings not exercised. | Task 10 |
| Diff debounce | Feasibility uses `update_document(..., block=true)` (1 ms) plus a `settle` step, not upstream's `block=false` 96 ms path. | Task 10 |
| Runtime hash identity | Runtime-hash check in `initialize` and `helix-lock.json` not implemented. | Tasks 2 and 4 |
| Repository-trust filter | Not probed. | Task 10 |
| Grammar load diagnostics | Helper reports only `initial_failure`; the dlopen error text is not surfaced. | Tasks 4 and 20 |
| glibc | Host-built helper needs `GLIBC_2.39`; release builds need an old-glibc environment (Debian 12 gave 2.34 symbols; 2.36 proven by running). Grammar `.so` files must be checked for `NEEDED` per toolchain. | Task 21 |
| Pinned-loader cross traps | Host-cfg linker flags break `x86_64-pc-windows-gnu` grammar builds; apple targets need an SDK; a msvc request silently yields host ELF. Grammar build driver needs an explicit target and native runners. | Tasks 2 and 21 |
| Probe-only workarounds | Packaged probe uses the production `out/src` JavaScript plus a staged `package.json` copy (version 0.99.0, id `local.mini-helix`); VSIX contains other workers' uncommitted `src` state at build time. | none (disposable) |
| Existing NORMAL non-ASCII leak | With no session, non-ASCII text typed in NORMAL reaches the document; current blockers cover ASCII only. Baseline finding, not probe-caused. | Task 19 |
| Existing `c` on blank-line break | Extension's `c` leaves the document unchanged for a selected blank-line break; Helix delete removes it. | Task 18 (oracle) |

## 7. Decision

Per criterion:

| Gate criterion | Decision | Basis | Open points |
|---|---|---|---|
| Build viability | GO on confirmed targets | linux-x64 glibc and alpine-x64 dynamic musl pass, offline package proof passes; win32-x64 partial | macOS, win32-arm64, arm runtime, alpine-arm64 not confirmed; MSVC and real Windows pending |
| Unicode input | GO (mechanism) | Session-scoped `type` and composition override proven on 1.143.1 and 1.85.2; scoped bindings alone fail | Real non-US layout, AltGr, OS IME pending (Task 19) |
| Selection semantics | GO, conditional | One reachable loss class reproduced; retained metadata closes it in the experiment | Task 7 must implement retained metadata; Helix-exact `c` pending (Task 18) |
| Stale-edit protection | GO | `TextEditor.edit` rejects stale bases on both versions; 0 stale applied | None for the gate |

Overall: no gate criterion failed, so dependent implementation work is not stopped by the gate.
This is not a claim that Task 1 verification is fully complete.
Two Task 1 verification items are not fully met (V3 partial, V4 pending), and the replay item (W9) is partial.
Dependent work proceeds only with these conditions:

- Targets are promised only where section 3.1 says confirmed.
- Task 7 implements retained selection metadata as determined in section 3.3.
- Tasks 2-15 are unaffected by the replay finding; Task 16 and later are held until the user decides.

Escalation requiring user decision:

- Replay contract amendment (section 4.2).
  The spec contract L596 and L601 cannot be met literally for native, user, or other-extension bound keys.
  The user must approve an amendment (Option 1, Option 2, or another) before Task 16 starts.

Pending items (not passing):

- Real Windows (MSVC), macOS, win32-arm64, linux-arm64 and linux-armhf runtime, alpine-arm64.
- Real non-US layout, AltGr, OS IME.
- Full 301-grammar size per target.
- Installed-package run on VS Code 1.85.2 and the retained-metadata follow-up on 1.85.2.
- Retained metadata under mouse clicks, tab or editor switches, undo of own edits, window reload, and other extensions.
- Helix-exact oracle for `c`, and for ordinary-input replay.
- NFR-8 thresholds (deferred by the spec).
- Runtime-hash identity, repository-trust filter probe, non-UTF-8 Git baseline encodings.

Baseline checks (not new implementation evidence): before any worker change, `npm test` passed 77/77 (`/tmp/helix-match-implementation-khd3bwgf/baseline-checks/npm-test.log`) and `npm run test:integration` printed 22 PASS lines on VS Code 1.143.1 (`.../test-integration.log`).
`native/README.md` records `npm test` 77/77 again after the helper work.

## 8. Reproduction

Run from the worktree root.
Raw logs outside the repository are listed in each folder README.
Full command blocks, including container steps, are in the folder READMEs; the commands below are copied from them.

Native (`native/README.md`):

(The feasibility build uses its own workspace root `native/feasibility/Cargo.toml` with `native/feasibility/Cargo.lock`; `native/Cargo.toml` is the production workspace from Task 2.)

```
native/feasibility/fetch-source.sh /tmp/hm-src-ba40e547/helix-ba40e547.tar.gz
native/feasibility/grammars/build-grammars.sh
python3 -I native/feasibility/grammars/stage-runtime.py
native/feasibility/grammars/stage-helper.sh
python3 -I native/feasibility/helper/probes/run_probes.py native/feasibility/build/stage <outdir>
python3 -I native/feasibility/helper/probes/corpus_matrix.py native/feasibility/build/stage <outdir>/fixture.json
python3 -I native/feasibility/helper/probes/measure.py native/feasibility/build/stage <outdir>/measurements.json
```

Editor (`editor/README.md`):

```
npm run compile
node out/test/feasibility/editor/runEditorProbes.js --version 1.143.1 --probes 1,2,3,4,5,8
node out/test/feasibility/editor/runEditorProbes.js --version 1.85.2 --probes 1,2,3,4,5,8 --startup-wait 0
node out/test/feasibility/editor/summarize.js /tmp/hm-t1c-logs/<v> docs/context-engineering/helix-match/feasibility/editor/results-<v>.json
```

Package (`package/README.md`; no other VS Code instance may run):

```
npm run compile
native/feasibility/package/stage-and-build.sh
native/feasibility/package/run-offline-e2e.sh /tmp/hm-t1b1-results
HM_PARTS=R native/feasibility/package/run-offline-e2e.sh /tmp/hm-t1b1-results-r
python3 -I native/feasibility/package/archive-results.py /tmp/hm-t1b1-results native/target/package-linux-x64 docs/context-engineering/helix-match/feasibility/package /tmp/hm-t1b1-results-r
```

Targets (`targets/README.md`; Docker and network for builds):

```
T=native/feasibility/targets
$T/run-probes-container.sh hm-t1b2-probe-debian-trixie /tmp/hm-t1b2-glibc/stage /tmp/hm-t1b2-glibc/out-trixie
$T/run-grammar-probe-container.sh hm-t1b2-probe-alpine /tmp/hm-t1b2-alpine-dynamic/stage
$T/run-cross.sh x86_64-pc-windows-gnu link
for t in x86_64-apple-darwin aarch64-apple-darwin x86_64-pc-windows-msvc aarch64-pc-windows-msvc; do $T/run-cross.sh $t check; $T/run-cross.sh $t check-stubcc; done
```

Image builds, container builds, Wine run, and ARM cross probes are in `targets/README.md` "Reproduce".

Baseline:

```
npm ci
npm test
npm run test:integration
```

## 9. Evidence index

See [README.md](README.md) for the folder index.
Analysis memos: [edit-latency-scout.md](analysis/edit-latency-scout.md), [replay-gap-oracle.md](analysis/replay-gap-oracle.md).
