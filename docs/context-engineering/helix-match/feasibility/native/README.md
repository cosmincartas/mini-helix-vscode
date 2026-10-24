# Task 1 native feasibility evidence (worker T1-A)

Scope: experimental helper `mini-helix-match-feasibility` built against the exact pinned Helix source. Disposable; **no production
implementation, no keybindings, no spec/plan changes.** Editor probes, packaging and target (musl/Windows/macOS) probes belong to other
workers and are marked *pending (other worker)* below. Host: AMD Ryzen 9 7900X3D (12 cores / 24 threads), 62 GiB RAM, Fedora 44,
Linux 7.2.5, glibc 2.43, gcc 16.2.1, `rustc 1.90.0 (1159e78c4 2025-09-14)`, `cargo +1.90.0`.

## Status

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Pinned source verified, extracted, no patches | pass | `fetch-source.sh`; archive SHA-256 `c5e35c68...d08d23`; `diff -rq` against the verified extraction is empty (`final-run.txt`) |
| 2 | Cargo.lock seeded from upstream; `--locked` build with 1.90.0 | pass | 0 version/checksum deviations (below); `cargo build --release --locked` ok |
| 3 | Helper process (JSON Lines, UTF-16 wire) | pass | protocol section; `probe-results.json` |
| 4 | Grammar subset built with pinned `helix-loader` code, runtime staged | pass | `runtime-manifest.json`; subset: rust, markdown, markdown_inline, html, javascript |
| 5 | `miw` / `maw` (and `miW`, `mip`) plaintext | pass | probe `plaintext-objects` |
| 6 | `mif` / `maf` Rust (+ upstream EOF quirk, absent captures) | pass | probe `rust-function` |
| 7 | Object through injected layer | pass | `injected-object`: markdown fenced rust (layer `rust`) and html `<script>` javascript (inherited `ecma` queries; layer `javascript`); controls outside the fence are no-ops |
| 8 | Surround `ms` (ASCII, alias, `m` literal, non-BMP 😀, `«`, `§`, `é`, Enter LF/CRLF, multi-selection) | pass | probe `surround` |
| 9 | `mr` preview + continuation + final transaction, failed lookup, cancel key, single use, expiry on change | pass | probe `surround` (failed `mr{` returns `reference_error` "Surround pair not found around all cursors", no continuation) |
| 10 | `md` delete (incl. count, failure) | pass | probe `surround` |
| 11 | Git hunk `mig`/`mag` (modified line, pure deletion, no-hunk no-op, baseline refresh on HEAD change, unsaved replica, untracked/path-less unavailable) | pass | probe `git-hunk` (temp git repo; disk file equals HEAD while replica differs; diff settled before observing) |
| 12 | CRLF/EOF/Unicode corpus, normalized ranges in char + UTF-16, projection determination | pass (determination below) | `crlf-eof-unicode-fixture.json.gz` (full, 1108 transitions / 455 chains), `crlf-eof-unicode-examples.json` (46 representative) |
| 13 | Stale protocol handling (`resync_required`, `stale_continuation`), delay option, in-flight proposal race | pass | probe `protocol-stale-delay` |
| 14 | Frame limit / malformed input / lone-surrogate -> `unsupported_text` | pass | probe `protocol-stale-delay` |
| 15 | Runtime isolation without upstream patch (unix) | pass with limits | probe `runtime-isolation` (decoy XDG/HELIX_RUNTIME/CARGO_MANIFEST_DIR ignored; `--ambient` negative control picks the decoy up) |
| 16 | Works without Rust/Helix on PATH/HOME | pass (local) | probe `offline-runtime`; full offline VSIX proof = *pending (other worker, package)* |
| 17 | Measurements | pass (5-grammar subset only) | `measurements.json`, tables below |
| 18 | `npm test` 77/77; `npx vsce ls`; `git status --short` | pass | below |
| 19 | Native edit vs `TextEditor.edit` race, stale base rejection | pending (other worker T1-C) | protocol-level race only here |
| 20 | Modified-character routing / ordinary-input replay in VS Code | pending (other worker); helper side: modifiers ignored on char keys, failed `mr` returns a reference error without continuation | probe `surround` |
| 21 | VS Code replay of the CRLF/EOF fixture (touching ranges, EOF zero-width) | pending (other worker) | fixture |
| 22 | Windows/macOS/glibc-arm/musl/Alpine target builds, grammar load in Alpine | pending (other worker) | not attempted here |
| 23 | Full 301-grammar build/size, `helix-lock.json`, runtime-hash identity check in `initialize`, repository-trust filter probe, non-UTF-8 baseline encodings | pending (Task 2 / later) | not attempted |

Probe totals: 8 probe groups, 0 failures (`probe-results.json`, 124 assertions with exact expected/actual; full exchanges in
`probe-transcript.jsonl.gz`). Expected values come from selected **text**/upstream query files, not helper output. Where the first
version of an expectation was wrong (e.g. `mif` with the cursor on `fn` is a no-op because the cursor is outside `function.inside`;
`md(` maps the original selection through the deletions; « is a bracket pair `« »`, § a same-char pair; markdown paragraph layer is
`markdown.inline`) the expectation was corrected to the upstream semantics, never the helper bent to the guess.

## Reproduce (all from the worktree root)

```
native/feasibility/fetch-source.sh /tmp/hm-src-ba40e547/helix-ba40e547.tar.gz   # verifies SHA-256, extracts to native/feasibility/upstream/helix (gitignored)
native/feasibility/grammars/build-grammars.sh      # pinned helix-loader fetch+build, isolated XDG dirs, subset only (network: github)
python3 -I native/feasibility/grammars/stage-runtime.py   # build/stage/runtime/{grammars,queries,manifest.json}
native/feasibility/grammars/stage-helper.sh         # cargo +1.90.0 build --release --locked; copies helper next to runtime/
python3 -I native/feasibility/helper/probes/run_probes.py native/feasibility/build/stage <outdir>
python3 -I native/feasibility/helper/probes/corpus_matrix.py native/feasibility/build/stage <outdir>/fixture.json
python3 -I native/feasibility/helper/probes/measure.py native/feasibility/build/stage <outdir>/measurements.json
```
Builds set `GIT_CEILING_DIRECTORIES=native/feasibility/upstream` and `HELIX_NIX_BUILD_REV=<pinned rev>` so upstream's `helix-loader`
build script reports the pinned revision instead of this repository's HEAD (no source patch). Raw logs: `/tmp/hm-t1a-logs/`
(`cargo-build-stub.log`, `grammars-build.log`, `stage-runtime.log`, `final-run.log`, `measure.stdout`, `npm-test.log`, `vsce-ls.txt`).
The build scripts run cargo in the feasibility workspace root `native/feasibility/Cargo.toml` (lock: `native/feasibility/Cargo.lock`, the Task 1 `Cargo.lock` restored byte-for-byte; target dir `native/target`, overridable via `CARGO_TARGET_DIR`); `native/Cargo.toml` is the Task 2 production workspace and excludes `feasibility`.

## Dependency lock

`native/Cargo.lock` = upstream `Cargo.lock` (sha256 `d05931bb...ed9321d`) pruned by cargo to the crates reachable from the helper, plus
the new package `mini-helix-match-feasibility`. Result (`final-run.txt`): 337 upstream (name,version) pairs, 245 here, 93 unused pairs
pruned, **0 version or checksum deviations**, 1 added package. `native/Cargo.lock` sha256 `f282abcf...1294c4b`. Direct additions to
the helper crate (`anyhow`, `serde`, `serde_json`, `tokio`, `tempfile` dev) all resolve to the
versions already in the upstream lock.

## Upstream patch inventory

**None.** `native/feasibility/upstream/helix` is byte-identical to the verified extraction. Runtime isolation is achieved without a patch
on unix by sanitising the process environment before the first `helix_loader::runtime_dirs()` use (it is a `LazyLock`):
remove `CARGO_MANIFEST_DIR` and `HELIX_RUNTIME`, point `XDG_CONFIG_HOME/XDG_DATA_HOME/XDG_CACHE_HOME` at an empty scratch dir, and
rely on the lowest-priority `<exe dir>/runtime`. `initialize` reports `runtimeDirs` = [empty scratch `helix/runtime`, `<stage>/runtime`].
`HELIX_RUNTIME` alone is indeed insufficient (higher-priority config dir and `CARGO_MANIFEST_DIR` entries exist). Limits that a
production runtime-resolution patch must remove: (a) Windows `etcetera` resolves the config dir from the Known-Folder API, not env
vars, so the user's `%APPDATA%\helix\runtime` would remain a higher-priority root; (b) mutating process env is process-global and
order-sensitive; (c) macOS/Windows not exercised. Language configuration uses `helix_core::config::default_lang_loader()` (built-in
`languages.toml` only; user/workspace config never read). `--ambient` (debug flag) disables the sanitisation for the negative control.

## Adapter inventory (copied/adapted upstream symbols; everything else is a direct call into pinned crates)

| Feasibility symbol (`helper/src/engine.rs`) | Upstream source (pinned) | Notes |
|---|---|---|
| `Engine::select_textobject` | `helix-term/src/commands.rs` `select_textobject` L6262-6335 (closure body) | single closure re-stated; calls `textobject_word/paragraph/pair_surround(_closest)/treesitter` and `DiffHandle::hunk_at/nth_hunk` from helix-core/helix-vcs |
| `surround_add` | `commands.rs` `surround_add` L6374-6412 | Enter uses replica EOL as upstream |
| `Engine::evaluate` "replace" + `continue_` | `commands.rs` `surround_replace` L6425-6485 | callback split into preview + continuation; `surround::get_surround_pos`, `get_pair` direct |
| `Engine::surround_delete` | `commands.rs` `surround_delete` L6496-6520 | |
| `debugDelete` action | `commands.rs` `delete_selection_impl` L3003-3005 | feasibility-only edit analogue (no registers) |
| `apply_computed` | `helix-view/src/document.rs` `apply_impl` L1470-1503 + `apply_inner` explicit selection | selection after a transaction = explicit selection or old selection `.map(changes)`, then `ensure_invariants` |
| `input_selection` | `Document::set_selection` L1396-1403 | `Selection::new(..).ensure_invariants(text)` |
| `Engine::open` (syntax) / `change` (update) | `Document::set_language` L1360-1377, `apply_impl` L1513-1531 | `Syntax::new` / `Syntax::update` direct; failure -> `update_failure`, syntax dropped, never retried |
| `load_base`, `make_diff` | `Document::set_diff_base` L1993-2003 | base decoded as UTF-8 with replacement instead of `from_reader` (BOM/other encodings not exercised); `DiffProviderRegistry::get_diff_base` direct |
| `settle` | none (new) | waits until `Diff::doc()/diff_base()` equal the replica/baseline ropes; replaces upstream's render-lock mechanism |
| `WireKey::as_char_opt` | `helix-view` `KeyEvent::char()` semantics | modifiers ignored on char keys |
| `bin/grammars.rs` | `helix_loader::grammar::{fetch_grammars, build_grammars}` | unchanged upstream functions |

No Helix algorithm is re-implemented; there is no TypeScript port.

## Experimental protocol (for the package worker's TypeScript driver)

Reference client: `native/feasibility/helper/probes/hmclient.py`. UTF-8 JSON Lines, one object per line, stdout protocol only, stderr
structured logs (`{"log":"request","method","ok","code","ms"}`, never document text). Max frame 32 MiB (`MAX_FRAME_BYTES`): larger
frames are skipped without buffering and answered `invalid_request`; documents are never truncated. Run
`HM_FEASIBILITY_DEBUG_ERRORS=1` to include serde detail in validation errors (off by default because serde may quote values).
Executable resolves its runtime from `<exe dir>/runtime` (layout in `runtime-manifest.json`); flags: `--ambient` (debug only).

Request: `{"protocolVersion":1,"requestId":N,"helperEpoch":"<from initialize>","method":"...","params":{...},"debugDelayMs":optional}`
(`helperEpoch` omitted for `initialize`; `debugDelayMs` sleeps before the helper processes the request, capped at 30 s; it blocks
later requests because processing is strictly in order). Response: `{"protocolVersion","requestId","helperEpoch","ok":true,"result":{...}}`
or `{...,"ok":false,"error":{"code","message"}}`. Codes used: `invalid_request`, `resync_required`, `stale_continuation`,
`unsupported_text`, `runtime_unavailable` (wrong expected Helix revision), `internal_error` (panics are caught).

Offsets are zero-based UTF-16 code units; ranges `{"anchor","head"}` + `primary` (index); Rust converts to scalar indices and rejects
offsets beyond the document or inside a surrogate pair (`invalid_request`). Offsets inside CRLF are accepted and normalised by Helix.

| Method | Params | Result |
|---|---|---|
| `initialize` | `expectedHelixRevision?` | `helixRevision, helperEpoch, runtimeDirs, languageCount, capabilities, timingsMs` |
| `open` | `documentId, generation, version, languageId, text, eol("LF"/"CRLF"), path?, uri?, trusted?` | `version, selectedLanguage, syntaxState, diffState, timingsMs.syntaxNew`. `languageId` is a pinned language id (`rust`, `markdown`, `html`, ...); unknown/`plaintext` -> `no_language`. With a local `path` the HEAD baseline is loaded through helix-vcs |
| `change` | `documentId, baseVersion, nextVersion, edits:[{start,end,text}]` (against the base snapshot) | `version, syntaxState, timingsMs.syntaxUpdate`; wrong base -> `resync_required`; overlapping/out-of-bounds -> `invalid_request` |
| `evaluate` | `documentId, version, sessionId, ranges, primary, action(inside\|around\|add\|replace\|delete\|debugDelete), count?, keys:[{kind:"char",value,modifiers}\|{kind:"enter"}\|{kind:"other",code}], selectionGeneration?` | proposal: `status(proposal\|no_op\|reference_error\|reference_unavailable\|preview\|...), baseVersion, selectionGeneration, sessionId, edits[{start,end,text}] (base UTF-16), selections (post-edit UTF-16), primary, message?, debug{selectionChars, editChars, layerLanguage}`; replace returns `status:"preview"`, `originalSelections`, `continuation` |
| `continue` | `documentId, version, token, key` | proposal (char key) or `status:"restored"` (non-char key); expired/unknown/used token or changed version -> `stale_continuation` |
| `cancel` / `close` / `debugStats` / `shutdown` | `token`/`sessionId` / `documentId` / - / - | released count / `{}` / `rssKb, peakRssKb, documents` / `{}` |

Proposals and previews never mutate the helper replica; only `change` does. Evaluate against a version other than the replica's returns
`resync_required`. A `char` key value must be exactly one Unicode scalar (e.g. `e` + combining acute is rejected).

## CRLF / EOF / Unicode projection determination

Corpus: empty doc, EOF with and without final newline, LF-only lines, CRLF lines (with/without final EOL, blank lines, only CRLF),
combining marks, non-BMP emoji, ZWJ emoji sequence. For every UTF-16 cursor offset (plus all ranges for docs of <= 8 units and several
two-range selections) and three command chains (`miw,d,miw,ms(,d`; `maw,ms-Enter,mip,d,maw`; `ms[,md[,miw`; edits applied to the
client text between steps) the helper's normalized result is analysed in char and UTF-16 coordinates (1108 distinct transitions).
Result (`analysis` in the fixture): **no reachable normalized result** has an endpoint inside CRLF or a surrogate pair or a grapheme
cluster, an end beyond the document, a zero-width range away from EOF, or overlapping ranges; all endpoints round-trip through
(line, character) positions; feeding the projected selection (primary first) back reproduces the identical normalized selection
(0 mismatches). Observed reachable shapes: zero-width cursor at EOF (163 results), range covering exactly one CRLF (149) or one LF (44),
multi-range results with primary not first in canonical order (152), and **touching** non-overlapping ranges (44), e.g. text `" "` with
ranges `(0,1)` and zero-width `(1,1)` after deleting two words. Helix normalizes input too: a cursor between `\r` and `\n` becomes the
whole CRLF range (58 such inputs), mid-cluster inputs are widened (21).

Determination: from the helper side, `{anchor, head}` UTF-16 pairs plus canonical order and primary identity suffice (no CRLF shadow
ranges needed); order/primary are the only extra semantic metadata, as the spec already allows. **Not decidable here and handed to the
editor worker (fixture replay):** whether VS Code keeps touching ranges and a zero-width EOF range next to a width-1 range distinct, and
how it displays/echoes CRLF-spanning and EOF selections. A reproduced loss there would block parity.

## Measurements (method: single helper process per scenario; client `perf_counter` around one JSON Lines round trip; 1000 warm samples; peak RSS = `VmHWM`)

Cold: spawn -> `initialize` response p50 11.505 ms / p95 12.492 ms (n=20; loader of 342 language configs ~10.7 ms inside the helper). First
Rust `open` (grammar dlopen + query compile + parse) 53.439 ms; first `mif` 9.983 ms (textobjects query compile); second Rust doc open 0.105 ms.
Warm round trip p50/p95 (ms): `mif` 0.033/0.037, `maf` 0.033/0.034, `miw` 0.025/0.027, `ms` 0.028/0.032 on tiny documents (values from `measurements.json` `coldStart` / `warm`).

| Corpus | Lines / bytes | open (parse) ms | `mif` p50 ms | char insert p50 ms start / mid | state after edits | peak RSS MiB |
|---|---|---|---|---|---|---|
| Rust | 1k / 13 KB | 2.0 | 0.86 | 24.4 / 24.3 | available | 17.1 |
| Rust | 10k / 136 KB | 20.5 | 7.9 | 219.8 / 219.1 | available | 29.1 |
| Rust | 100k / 1.4 MB | 210.2 | 83.9 | first edit = 500 ms | **`update_failure`** (upstream 500 ms parse timeout; syntax disabled, never retried) | 96.7 |
| Markdown + fenced Rust (injection) | 1k / 6.7 KB | 3.3 | 0.03 | 0.95 / 1.0 | available | 18.8 |
| Markdown + fenced Rust (injection) | 10k / 70 KB | 35.3 | 0.03 | 9.0 / 9.1 | available | 33.2 |
| Markdown + fenced Rust (injection) | 100k / 727 KB | 337.8 | 0.03 | 156.5 / 159.2 | available | 193.6 |

(`mif` on the injection corpus runs against the small injected tree, so it is cheap; Rust cost grows with the whole-file tree because
upstream `capture_nodes` queries the layer root. Edit latency is parse update through `Syntax::update` and is not analysed further here (cause not investigated); no latency threshold is
proposed. The 100k-line Rust result is an honest finding: the pinned 500 ms policy disables syntax for that document after the first
edit.)

Measurements were taken with the helper before removing the unused `unicode-segmentation` dependency (10,024,472 B; the final stage binary is 10,024,408 B, behaviour identical, probes re-run: 8/8 pass). Sizes (5-grammar subset only): helper unstripped 10,024,472 B / stripped 7,946,640 B; grammars rust 1,140,656, markdown 409,136,
markdown_inline 404,376, javascript 431,576, html 33,880; queries (full pinned `runtime/queries`, all 158 textobject files) 1,087,532 B;
staged runtime 3,510,000 B; stage dir with unstripped helper 13,534,472 B; zip of it 4,623,853 B. Full 301-grammar size: pending.

## Checks run

* `npm test`: exit 0, 77 pass / 0 fail (`/tmp/hm-t1a-logs/npm-test.log`).
* `npx vsce ls` vs `baseline-checks/vsce-ls.txt`: no `native/**` entries; the only additions are new files under `docs/` (this
  directory's files plus other workers' `implementation-progress.md` and `feasibility/editor/*`).
* `git status --short`: baseline modifications unchanged; new untracked `native/`, `docs/`, other workers' `test/feasibility/`; this
  worker additionally modified `.gitignore` and `.vscodeignore` (append-only).

## Other notes / limits

* Helper is single-threaded (strict request order) with a 2-thread tokio runtime only for the upstream diff worker.
* Diff updates use `update_document(..., block=true)` (1 ms debounce) instead of upstream's document path (`block=false`, 96 ms debounce); the
  `settle` step makes observations deterministic.
* Language selection here is by pinned language id only; the VS Code alias table, extension/shebang detection, trust-gated filters and
  `helix-lock.json` are not part of this experiment.
* `ms` with a multi-scalar key is rejected as `invalid_request`; Helix's own `KeyEvent` can only carry one `char` so this is not a
  reference behaviour change.
