# T1-B1 package, offline runtime and editor round-trip evidence (helix-match Task 1)

Experimental evidence only (worker T1-B1): no production `src/**`, keybinding, `package.json`, `.vscodeignore`, spec or plan change, and no second
TypeScript implementation of Helix algorithms (the TypeScript here only spawns the packaged helper, frames JSON Lines, reads/sets VS Code selections,
calls `TextEditor.edit` and compares against helper-only fixtures or hand-derived expectations). Missing evidence is marked pending.
Host: Linux 7.2.5 (Fedora 44), x86_64, glibc 2.43, display `:0`, VS Code **1.143.1** (`.vscode-test/vscode-linux-x64-1.143.1`, extension host Node v24.21.0).
Inputs: T1-A helper `native/feasibility/build/stage/` (Helix `ba40e547...`, 5 grammars), T1-A fixture `feasibility/native/crlf-eof-unicode-fixture.json.gz`,
T1-C editor tooling (`test/feasibility/editor/{cdp,keyWorker,usKeys,results}.ts`, read-only import).

## Files

| File | Purpose |
|---|---|
| `native/feasibility/package/stage-and-build.sh` | stage compiled extension + helper + runtime into `native/target/package-linux-x64/stage` (gitignored), hash assets, build the VSIX with the worktree's `vsce` |
| `native/feasibility/package/run-offline-e2e.sh` | install the VSIX into an isolated profile and run the probe with network disabled and no Rust/Helix |
| `native/feasibility/package/archive-results.py` | copy results into this directory and write `results-summary.json` |
| `test/feasibility/package/{e2e,editorOps,helperClient,projection,retained}.ts` | installed-extension probe (compiled by `npm run compile`); `retained.ts` + `RetainedSelection` in `editorOps.ts` are the follow-up experiment below |
| `e2e-retained-{replay,invalidation,cd}.json`, `run-retained.txt` | follow-up run (retained metadata) |
| `e2e-*.json`, `run.txt`, `install.txt`, `netns-*.txt`, `vsix-contents.txt`, `asset-manifest-summary.txt`, `results-summary.json` | archived outputs of the final run (below) |

## Reproduce (from the worktree root; no other VS Code instance may run)

```
npm run compile
native/feasibility/package/stage-and-build.sh            # -> native/target/package-linux-x64/mini-helix-feasibility-linux-x64.vsix
native/feasibility/package/run-offline-e2e.sh /tmp/hm-t1b1-results    # ~3.5 min; env HM_PARTS=A,B,C HM_RACE_A=60 HM_RACE_B=30
python3 -I native/feasibility/package/archive-results.py /tmp/hm-t1b1-results native/target/package-linux-x64 docs/context-engineering/helix-match/feasibility/package
```

Staging (`stage-and-build.sh`): copies `out/src` (no maps), `README.md`, a **package.json copy** (`version` 0.99.0, `displayName` suffix, `extensionKind: ["workspace"]`,
`scripts` removed; id stays `local.mini-helix`), its own `.vscodeignore` (`**/*.map`, `**/*.ts`), `native/linux-x64/mini-helix-match-feasibility`
(`strip`ped copy of the T1-A binary, mode 755), `native/linux-x64/runtime/{grammars/*.so (5), queries (full pinned runtime, 1,193 files), manifest.json}`,
the Helix MPL-2.0 licence text and a generated `asset-manifest.json` (size + SHA-256 of all 1,201 files). Then, in the staging directory:
`node_modules/.bin/vsce package --target linux-x64 --no-dependencies --allow-missing-repository --skip-license`.
The production `package.json`, `.vscodeignore` and packaging scripts are untouched; `npx vsce ls` in the worktree is not affected (`native/**` stays ignored).

## Package size (linux-x64)

| Item | Bytes |
|---|---|
| VSIX (`mini-helix-feasibility-linux-x64.vsix`, sha256 `bcbfe6375c6b2d81d811eeece0f3f32b0fba1e6b9c727d60a69b64bb6238ae2b`) | **4,359,810** (4.16 MiB) |
| VSIX entries / sum uncompressed / sum compressed | 1,225 / 11,880,792 / 4,095,654 |
| staging dir (`du -sb`) / installed extension dir (`du -sb`) | 11,950,078 / 11,870,829 |
| helper stripped (packaged) / unstripped (T1-A stage) | 7,946,704 (3,254,634 compressed) / 10,024,408 |
| 5 grammar libraries (rust 1,140,656, markdown 409,136, markdown_inline 404,376, javascript 431,576, html 33,880) | 2,419,624 (364,715 compressed) |
| runtime queries, 1,193 files | 1,087,532 (376,887 compressed) |
| `asset-manifest.json` | 188,089 |

Listing: `vsix-contents.txt` (queries summarised as a group); asset hashes: `asset-manifest-summary.txt`. VSIX preserved the executable bits (helper and
grammar libraries `100755` in the zip; installed helper mode 755), so no chmod at runtime is needed. Only the 5-grammar subset is packaged: the full
301-grammar size is **pending** (Task 2). Helper dynamic deps: `libgcc_s`, `libm`, `libc`; the host-built helper requires `GLIBC_2.39`
(see `../targets/README.md`), so this VSIX is only valid for hosts with glibc >= 2.39 until the compatibility-build work (T1-B2/Task 2) is done.

## Offline runtime proof

Method (`run-offline-e2e.sh`):
* install: `ELECTRON_RUN_AS_NODE=1 .vscode-test/vscode-linux-x64-1.143.1/code <dir>/resources/app/out/cli.js --install-extension <vsix> --extensions-dir /tmp/hm-t1b1-run/extensions --user-data-dir /tmp/hm-t1b1-run/profile`, run inside the network namespace below (`install.txt`: "successfully installed"; `list-extensions.txt`: `local.mini-helix@0.99.0`).
* network disabled: `unshare -rn` (user+net namespace). Inside, only `lo` exists (`netns-links-before.txt`: `lo DOWN`); `lo` is brought up for the local CDP port (`netns-addr.txt`: `127.0.0.1/8`).
* environment: `env -i HOME=/tmp/hm-t1b1-run/home PATH=/tmp/hm-t1b1-run/bin XDG_RUNTIME_DIR=... DISPLAY=:0 XAUTHORITY=/run/user/1000/xauth_*` (home and bin are empty directories) plus `HM_*` probe variables.
* launch: `code <ws> --user-data-dir ... --extensions-dir ... --extensionDevelopmentPath=<no-op stub> --extensionTestsPath=<worktree>/out/test/feasibility/package/e2e.js --remote-debugging-port=19333 --no-sandbox --disable-gpu ...`.
  VS Code ignored `--extensionTestsPath` without `--extensionDevelopmentPath`; the development path is an empty stub extension (`local.hm-probe-host`, no main), **not the worktree**. The extension under test is the installed `local.mini-helix` 0.99.0 and the helper is spawned (`child_process.spawn`, no shell) from its `extensionPath`.

Observed inside the host (`e2e-environment.json`, `e2e-helper-init.json`, `e2e-commands.json`):
* `extensionPath` = `/tmp/hm-t1b1-run/extensions/local.mini-helix-0.99.0` (inside the isolated extensions dir; not the worktree); extension active; 31 `miniHelix.*` commands registered.
* PATH contains no `cargo`, `rustc`, `rustup`, `hx`, `helix`, `git`, `gcc`, `cc`; `~/.cargo`, `~/.rustup`, `~/.config/helix`, `~/.helix` do not exist under the probe HOME (host HOME was not visible).
* network: interfaces `["lo"]`; TCP connect to a public IP -> `ENETUNREACH`. Caveat: `dns.lookup` still resolved a name (the host resolver socket is a filesystem unix socket visible from the namespace), so DNS is not proof of disconnection; the TCP failure is.
* SHA-256 and size of all 1,201 packaged asset files matched `asset-manifest.json` (0 mismatches) when read from the installed copy.
* helper `initialize` with `expectedHelixRevision` = `ba40e547...`: ok, 342 languages, spawn -> initialize response **11.1 ms** (cold, this run; 12.7 ms in the first probe-only run).
* `/proc/<helper pid>/maps` after the scenarios: the three grammar libraries that were used (rust, markdown, markdown_inline) are mapped from `<extensionPath>/native/linux-x64/runtime/grammars/` (`grammarsMappedFromPackage: true`); the helper's open-fd list (`helperOpenFileDescriptorTargets`) shows stdio socketpairs plus a few fds inherited from the extension host (log files, snapshot); it was not independently shown that the helper opens no network socket, the empty network namespace is the network proof.
* helper stderr: 5,137 structured log lines whose only keys are `code,log,method,ms,ok`; none contains probe document text (NFR-3 spot check, `stderrContainsDocumentText: false`).
* The git hunk scenario worked with no `git` binary on PATH (the helper uses a Rust git library; `git` was used only by the launcher script to create the fixture repository before launch).

Verdict: **pass (this host, linux-x64)** - one local VSIX works without a Rust or Helix installation and without network at runtime. Limits: same machine that built it (glibc 2.43 >= 2.39), tools exist elsewhere on the host filesystem (hidden from PATH/HOME, not from absolute paths), the helper creates and uses an isolated scratch runtime directory under the temp dir (`runtimeDirs` in `e2e-helper-init.json`, T1-A design), display and `XAUTHORITY` come from the real session.

## Editor e2e through the packaged helper (part A, `e2e-commands.json`: PASS, 10/10 scenarios)

Input path: the extension is put in INSERT mode (`miniHelix.enterInsert`), a temporary session-scoped override of `type`/`replacePreviousChar`/`compositionStart|Type|End`
(mechanism from T1-C) collects characters, and real renderer input is injected over CDP: `Input.dispatchKeyEvent` for ASCII (`m`,`i`,`w`...),
`Input.insertText` for U+1F600 and U+00AB, `Input.imeSetComposition` + `insertText` commit for U+65E5. The first two typed characters select the action (`mi`->inside, `ma`, `ms`->add, `md`, `mr`->replace; fixed key table, not Helix logic), the rest are sent as keys to the helper.
Applying: synchronous `document.version === base` check then `TextEditor.edit` (no `await` between), then selections installed primary-first and read back from the main-thread change event, then `change` sent to the helper. Expected values are hand-derived from the text (not taken from helper output).
Every scenario passed on all repetitions (20 reps for the main ones, 5 for the extra Unicode/control ones).

| Scenario | Input document / selection | Observed (first rep) |
|---|---|---|
| `miw-plaintext` | `foo bar baz`, cursor in `bar` | selection text `bar`, no edit |
| `mif-rust` | Rust, cursor in body of `alpha` | selection = whole `{ ... }` body of `alpha` (function.inside) |
| `mif-injected-markdown-rust` | markdown with a fenced rust block, cursor inside the fenced `fn gamma` | selection = `{\n    3\n}`, layer `rust` (injected object) |
| `mif-injected-control-prose` | same document, cursor in the prose | no-op (width-1 cursor `p`), layer `markdown.inline` |
| `ms-emoji-insertText` | `foo bar`, `bar` selected, `ms` + U+1F600 via CDP `insertText` | text `foo 😀bar😀` through `TextEditor.edit`; selection `😀bar😀`; **one real CDP Ctrl+Z restores `foo bar`** (20/20) |
| `ms-cjk-ime` | `ms` + IME composition に->日 committed | text `foo 日bar日`, exactly one character received (composition rule from T1-C), one Ctrl+Z restores (5/5) |
| `ms-guillemet-insertText` | `ms` + `«` | `foo «bar»` (bracket pair), Ctrl+Z restores (5/5) |
| `md-paren` | `foo (bar) baz`, cursor on `a`, `md(` | `foo bar baz`, cursor stays on `a` |
| `mr-paren-bracket` | same, `mr(` then `[` | preview (no edits) then continuation -> `foo [bar] baz`, cursor on `a` |
| `mig-git-hunk-unsaved` | tracked file in a temp git repo workspace, line 2 edited to `TWO` and line 4 deleted **unsaved** (`isDirty` true, disk still equals HEAD) | selection `TWO\n` (HEAD baseline from the repository, replica text from the editor) |

Latency (in-host, ms; p50 / p95 over the repetitions; method: `performance.now()`; "type event -> applied" starts when the owner receives the final character and ends after the helper round trip, `TextEditor.edit` (when there are edits) and the selection assignment; it excludes CDP/renderer input delay and the post-hoc readback; "first" = first repetition, cold for the process or language):

| Scenario | reps | type event -> applied | helper evaluate | helper evaluate (first) | type->applied (first) | helper `open` (first) |
|---|---|---|---|---|---|---|
| `miw-plaintext` | 20 | 0.87 / 1.56 | 0.10 / 0.21 | 0.12 | 0.93 | 0.14 |
| `mif-rust` | 20 | 0.76 / 10.85 | 0.14 / 10.10 | 10.10 | 10.85 | 53.69 |
| `mif-injected-markdown-rust` | 20 | 0.72 / 0.93 | 0.11 / 0.15 | 0.10 | 0.75 | 6.41 |
| `mif-injected-control-prose` | 5 | 0.64 / 0.83 | 0.06 / 0.11 | 0.08 | 0.64 | 0.29 |
| `ms-emoji-insertText` | 20 | 1.55 / 3.20 | 0.13 / 0.25 | 0.25 | 3.20 | 0.08 |
| `ms-cjk-ime` | 5 | 1.42 / 1.53 | 0.12 / 0.15 | 0.10 | 1.11 | 0.09 |
| `ms-guillemet-insertText` | 5 | 1.31 / 1.50 | 0.10 / 0.15 | 0.10 | 1.41 | 0.08 |
| `md-paren` | 20 | 1.88 / 7.66 | 0.12 / 0.13 | 0.09 | 2.05 | 0.11 |
| `mr-paren-bracket` (continue step; preview not timed separately) | 20 | 1.32 / 3.77 | 0.10 / 0.12 | 0.12 | 1.61 | 0.12 |
| `mig-git-hunk-unsaved` | 20 | 0.91 / 1.45 | 0.38 / 0.74 | 0.38 | 0.80 | 1.20 |

Cold start: spawn -> `initialize` response 11.1 ms; first Rust `open` 53.7 ms (grammar load + parse), first `mif` 10.1 ms (query compile). Helper peak RSS after the whole run (18 documents still open): 19,544 KiB. These are tiny documents; larger corpora are in `../native/README.md`. No latency threshold is proposed.

Limits of this part: characters arrive through the INSERT-mode `type` override (T1-C mechanism); production NORMAL-mode scoped bindings, modified-character routing and ordinary-input replay are T1-C evidence, not re-run here. Only the helper-side `debugDelete` analogue of `d`/`c` exists; `c`'s insert-mode entry is not modelled.

## Delayed helper result vs real native edit (part B, `e2e-race.json`: PASS, 90 trials)

Setup: document `hello world` (INSERT mode, type override not registered, so typing is native), cursor at offset 0, helper `evaluate` (`ms` + `X` on `[6,11)`) issued with `debugDelayMs` = 200 (helper answered after 200-201 ms every time).
* **Variant A, 60 trials**: 20 ms after the request a real CDP key `k` is typed (native edit lands, `versionAtResponse` = +1 in 60/60). When the stale answer arrives the synchronous version check refuses it: **60/60 caught, `TextEditor.edit` never called, final text `khello world` every time, 0 corruption.** In 20 of them the replica was resynchronised with `change` (from the document change event): an evaluate against the stale version returned `resync_required` (20/20) and a fresh evaluate on the new version applied correctly (`khello XworldX`, 20/20). Remaining trials were undone with one native undo back to `hello world` (40/40).
* **Variant B, 30 trials (stale host mirror)**: the helper answer arrives, a key is sent from a worker thread (`KeyWorker`) and the extension-host thread is blocked 10/20/40 ms so the renderer applies the key while the host document mirror still has the old version (`document.version === base` at the check in 30/30, i.e. the synchronous check alone cannot see it). `TextEditor.edit` then **returned `false` in 30/30**, text stayed `khello world`, one native undo restored `hello world` (30/30); 0 corrupted, 0 stale edits applied.
* Total 90 trials: 0 text corruption, 0 stale proposals applied, `edit` never threw. Conclusion: `TextEditor.edit` rejects a stale base the host has not yet seen, and the synchronous version check catches everything the host has seen; both are required. No different edit API is needed (consistent with T1-C probe 5).
Limit: Linux/x64, VS Code 1.143.1 only; VS Code 1.85.2 (engine minimum) was not re-run with the installed package (T1-C ran probe 5 on both).

## CRLF/EOF projection round trip (part C, `e2e-projection.json`)

Method: all 455 chains (1,108 distinct transitions, every one visited: `transitionsVisited` 1108) of the T1-A fixture are replayed through the real editor. Per step: helper
`evaluate` on the selections read from VS Code (primary first, `primary` 0) -> compare status/edits/selections/primary with the fixture transition -> apply the edits with
`TextEditor.edit` (1,097 edits applied, 0 rejected, resulting document text compared with the fixture `textAfter`) -> `change` to the helper -> set the helper's resulting selections
in VS Code (primary first) -> read them back from the main-thread selection event (sentinel-forced, so not the host's unvalidated copy) -> convert to UTF-16 offsets -> compare with what was set -> these
read-back selections are the next command's input. Documents: empty, EOF with/without final newline, LF-only, CRLF lines, CRLF without final EOL, CRLF blank lines, only CRLF, combining marks, non-BMP, ZWJ sequence; chains `miw,d,miw,ms(,d`, `maw,ms-Enter,mip,d,maw`, `ms[,md[,miw` (`d` = helper `debugDelete`). Per-step traces for the CRLF and EOF-without-newline documents are in `e2e-projection.json` -> `traces`.

Results (1,979 result read-backs):

| Reachable result class (T1-A flags) | read-backs | identical to what was set |
|---|---|---|
| plain (single width>=1 ranges) | 1,094 | 1,094 |
| zero-width cursor at EOF | 454 | 447 |
| range covering exactly one CRLF | 254 | 251 |
| range covering exactly one LF | 102 | 100 |
| multi-range (primary not first) | 145 | 138 |
| touching ranges | 46 | 39 |

**7 read-backs (6 distinct reachable transitions) were NOT identical, all the same shape: a zero-width cursor at EOF whose position equals the end of a width>=1 range (touching, primary = the EOF cursor, canonical order [range, cursor]).** VS Code merges the cursor into the range:

| Fixture transition | Document (UTF-16) | Helper result `ranges`, `primary` | VS Code read-back (set primary first `[cursor, range]`) |
|---|---|---|---|
| 95 (also reached twice) | `" "` (eof-no-newline) | `[(0,1),(1,1)]`, primary 1 | `[(0,1)]` |
| 453 | `"\r\n\r\n"` | `[(2,4),(4,4)]`, primary 1 | `[(2,4)]` |
| 567 | `"\r\n\r\n"` (CRLF, no final EOL start) | `[(2,4),(4,4)]`, primary 1 | `[(2,4)]` |
| 771 | `"\r\n"` | `[(0,2),(2,2)]`, primary 1 | `[(0,2)]` |
| 885 | `"\n\n"` | `[(1,2),(2,2)]`, primary 1 | `[(1,2)]` |
| 1103 | `"\n"` | `[(0,1),(1,1)]`, primary 1 | `[(0,1)]` |

(exact rows incl. chain and step: `e2e-projection.json` -> `resultProjection.diffList`.) Every other shape was kept, including non-empty touching ranges (e.g. adjacent `(a,b),(b,c)`), a single zero-width EOF cursor, ranges covering one CRLF/LF, and primary-not-first orders (primary first projection is recoverable because the canonical order is the sorted order).

Effect on subsequent inputs (helper only, from the same state with the helper's exact selection vs VS Code's read-back; `lossConsequences`):

| Next command | Output identical? |
|---|---|
| `miw`, `maw` | **no** (EOF cursor and primary index disappear from the result selection set) |
| `ms(` | **no** (edits differ: `[0,0,"("],[1,1,")()"]` vs `[0,0,"("],[1,1,")"]`; text `( )()` vs `( )`; this is the cause of `textMismatches` = 3 in the replay) |
| `md(` | no (selections/primary differ in the reference-error result) |
| `mip`, debugDelete (`d`/`c` delete step) | yes, for these 6 shapes (deleting the width>=1 range gives the same text and selection) |

Replay summary: 22 next-result mismatches against the helper-only chain: 10 are the merge above (a following command saw one range instead of two), 12 come from **chain starts that the fixture places inside a CRLF** (cursor/anchor between `\r` and `\n`, 58 such inputs): VS Code cannot hold such a position (it reads back at the line end, `0:2` for `ab\r\n`), so these inputs are not constructible in VS Code; they are not helper-reachable results. Other input shapes: zero-width not at EOF 309/279 identical (the 30 differences are the same CRLF-gap inputs), grapheme-cluster-internal inputs 21/21 kept. 92 read-backs were not event-authoritative, all in documents whose text was empty at that moment (every position is the same position, nothing can be lost).

### Determination (no metadata implemented)

* The helper's normalised, reachable selections need **no** CRLF shadow ranges or surrogate/cluster metadata: no result had an endpoint inside CRLF (VS Code cannot represent it) and every CRLF/LF-spanning range, EOF cursor, reversed range and primary-not-first order survived projection.
* **One reachable class loses information through VS Code projection**: a zero-width cursor at EOF touching a preceding width>=1 range (found 6 times in the T1-A corpus after `d` / Enter-surround / paragraph chains on `" "`, `"\n"`, `"\n\n"`, `"\r\n"`, `"\r\n\r\n"`). VS Code merges the pair into the range, the helper then sees one range instead of two (and a different primary), and `miw/maw/ms/md` produce different results. Per the spec ("Projection must preserve subsequent match, `c`, and `d` inputs; a reproduced loss blocks parity") this is a **reproduced loss for match inputs** in these shapes, i.e. the semantic selection state (canonical ranges + primary) must be held outside VS Code's selection list for such states, or the design must be reviewed. `d`/`c` delete outputs were identical for these six shapes only; a general claim for `c`/`d` is not established.
* Conclusion for the gate: selection-semantics risk **is reproduced, narrowly**; it is not a native-feasibility failure but a design-review item (extra projection metadata or a defined policy for EOF-cursor/touching-range states). Deciding and implementing the metadata is out of scope for Task 1.
* Corpus limit: 11 documents x 3 chains x all single cursors plus a few two-range starts; other multi-range touching shapes with an EOF cursor on a reversed range were not generated (VS Code's rule "empty selection at the edge of a range merges" from T1-C suggests they behave the same).

## Follow-up: does the approved retained-metadata mechanism close the loss? (`HM_PARTS=R`)

Experimental, test-only (`RetainedSelection` in `test/feasibility/package/editorOps.ts`; no production code). Mechanism under test (spec "Document and selection identity"): after a helper
result is applied, retain `{semantic helper ranges + primary, document version, the VS Code selections that were set, the VS Code readback}`. Before the next command, use the
retained semantic ranges instead of the readback **only if** the document version is unchanged, `editor.selections` equal the retained readback, and no external
`onDidChangeTextEditorSelection` event happened (events raised while our own edit/selection installation runs are bracketed by `own()` and do not count). Otherwise the metadata is discarded and the readback is sent.

Commands (same launcher; results go to a separate directory, then archived with a 4th argument):
```
npm run compile
HM_PARTS=R native/feasibility/package/run-offline-e2e.sh /tmp/hm-t1b1-results-r      # ~1 min, offline as above
python3 -I native/feasibility/package/archive-results.py /tmp/hm-t1b1-results native/target/package-linux-x64 docs/context-engineering/helix-match/feasibility/package /tmp/hm-t1b1-results-r
```

### 1. Retained-metadata replay of all chains (`e2e-retained-replay.json`)
Same 455 chains / 1,108 transitions (all visited; 2,013 steps, 1,097 edits applied, 0 rejected). 1,546 steps used retained metadata, **0 fallbacks** (so no spurious invalidation in the replay).
Chain starts and resynchronisation starts come from the fixture through VS Code (no retained metadata exists there).

| | readback only (first run) | retained metadata |
|---|---|---|
| next-result mismatches vs helper-only chains | 22 | **12** |
| of which merge-caused (a following command saw one range instead of two) | 10 | **0** |
| of which chain starts the fixture places inside a CRLF (not constructible in VS Code) | 12 | 12 (same inputs: transitions 666,668,671,674,677,680,683,687,691,693 in `crlf-blank-lines`; 762,765 in `only-crlf`) |
| `textAfter` mismatches | 3 | **0** |

The VS Code read-back still merges the lossy shape (14 read-backs, 12 distinct transitions: the 6 `debugDelete` results plus the 6 follow-up no-op results 96, 454, 568, 772, 886, 1104 that the corrected chains now reach), but because the semantic ranges are retained every following command received the helper's exact selection and matched the helper-only chain.
The 12 CRLF-gap starts are helper-only inputs (a cursor between `\r` and `\n`); retention is irrelevant to them. They are classified separately and are not a projection loss of a reachable result.

### 2. Invalidation (`e2e-retained-invalidation.json`: PASS, 6/6 lossy shapes x 5 cases)
For each of the six lossy shapes (transitions 95, 453, 567, 771, 885, 1103; the merge is reproduced in each) the retained state was entered, then:

| Case | Result (all 6 shapes) |
|---|---|
| control, nothing happened | semantic ranges + primary used (`retained`) |
| real CDP ArrowRight (external selection change through the real input path) | discarded, readback used (`external selection event(s): 1`); the sent ranges equal the actual editor selections |
| external ArrowRight, then an external `editor.selections = <same selections as before>` so the selections are **equal** to the retained readback again | discarded (`external selection event(s): 2`): the event counter, not selection equality, invalidates |
| real CDP typing `k` then real Ctrl+Z (text restored, version changed) | discarded (`document version changed`) |
| version-only change (own edit + own selection restore, no external selection event) | discarded (`document version changed`) |

Limit: a real mouse click was not used (needs renderer coordinates); an arrow key is also an external selection change delivered through the real renderer input path.

### 3. Real `d` and `c` on the merged selection (`e2e-retained-cd.json`)
For each lossy state the extension is in NORMAL mode, the helper's projection is installed (VS Code merges it), and the **installed extension's existing `d` / `c` commands are run with real CDP keys**. Expected text = the helper's `debugDelete` on the semantic set, applied to a scratch document with `workspace.applyEdit` (no TS Helix logic). Also reported: selections after the key, whether `c` entered INSERT (typing `k` changed the text), and controls without any merge.

| | result |
|---|---|
| helper `debugDelete` on the semantic set vs on the VS Code readback | identical output on all 6 shapes (edits, selections, primary) |
| real `d`: document text vs helper expectation | **identical, 6/6** (selections after `d` equal the helper's post-delete selections, 6/6) |
| real `c`: document text vs helper expectation | **identical 1/6** (`" "`), **differs 5/6**: the extension's `c` leaves the document unchanged when the selection is the line break of a blank line (`"\r\n\r\n"`, `"\r\n"`, `"\n\n"`, `"\n"`), then enters INSERT; the helper's delete removes it |
| real `c`: INSERT cursor offsets vs start of the helper's post-delete selections (proxy) | equal 6/6; `c` entered INSERT 6/6 |
| no-merge controls (single range, no EOF cursor, so nothing can merge): `abc def`, line breaks mid-document and at EOF (LF/CRLF) | `d` and `c` identical to the helper |
| no-merge controls covering a **blank line's** line break (`x\n\n` (2,3); `\n` (0,1); `\r\n` (0,2)) | `d` identical, **`c` differs 3/3 in the same way** |

Reading: the `c` text difference is reproduced by controls that contain no touching zero-width EOF cursor, and the helper's output is the same for the semantic and merged inputs, so it is **not caused by the projection loss**; it is a pre-existing behaviour of the extension's current `c` on a blank-line break versus Helix delete semantics (a parity item for the implementation tasks, not decided here). `d` does not diverge. Pending: the helper has no `c` action, so Helix-exact INSERT cursor positions and `c` semantics are not available as an oracle without TypeScript Helix logic (only the proxy above); Helix `c` on a multi-range state with the EOF cursor retained vs merged is therefore **not** demonstrated beyond the delete step.

### Determination
* The approved mechanism (retain semantic ranges + primary, version, set selections and readback; invalidate on version change or any external selection event) **closes the reproduced loss in this experiment**: 0 merge-caused mismatches after retention (was 10), 0 text mismatches (was 3), 0 spurious fallbacks across 1,546 retained uses, and it invalidates correctly in all 30 probes (6 shapes x 5 cases), including when selections happen to be equal again.
* Subsequent `d`: no divergence. Subsequent `c`: the extension's current `c` differs from the helper delete on blank-line breaks, independently of the projection (control-proven); no divergence attributable to projection, with the oracle limit above.
* Gate reading: the selection-semantics gate is satisfied **by the retained-metadata design, not by VS Code's selection list alone**. Without retention the loss stays reproduced. What this does not prove: retention under every external actor (other extensions' `setSelections` that restore equal selections emit events and are covered by the event counter only while the listener is live; multi-editor/tab switches, undo of own edits and window reload were not exercised), and it is a test-only holder, not a production design. A real mouse click, non-US layouts and VS Code 1.85.2 were not run for this follow-up.

## Status

| Check | Status |
|---|---|
| Stage + experimental linux-x64 VSIX built from a staging copy; size and contents measured | pass |
| Install into isolated profile and run offline (no network, no Rust/Helix on PATH/HOME) with installed extension and packaged helper | pass (host build, glibc >= 2.39) |
| `miw`, `mif` (Rust), injected object (markdown fenced Rust), `ms` with Unicode via real renderer input + `TextEditor.edit` + native undo, `md`, `mr`, `mig` on unsaved edit in a git workspace | pass |
| Latency per command, cold start, memory | recorded (tiny documents; large corpora in T1-A) |
| Delayed helper race vs real native edit (>= 50 trials), stale proposals never applied | pass (90 trials, 0 corruption) |
| CRLF/EOF projection through consecutive match + edit commands on the full fixture | done; **loss reproduced for EOF-cursor-touching-range** (design review item) |
| Retained-metadata mechanism closes that loss; invalidation; real `d`/`c` on the merged selection | closes the loss in the experiment (0 merge-caused mismatches, 30/30 invalidation probes); `d` identical; `c` differs from the helper delete on blank-line breaks independently of projection; Helix-exact `c` oracle pending |
| Other targets (Windows/macOS/arm/musl/Alpine), non-US layouts/AltGr/real IME, VS Code 1.85.2 installed-package run, full 301-grammar package size, runtime-hash identity check in `initialize`, ordinary-input replay and NORMAL-mode scoped bindings against this package | pending (other workers / later tasks) |

## Other limits

* The packaged extension JavaScript is the current production `out/src` (no helper integration); the probe, not the extension, drives the helper. The VSIX contains the (compiled) production state of the worktree at build time, including other workers' uncommitted `src` changes.
* The experimental package id is the production id `local.mini-helix` with version 0.99.0, used only in an isolated extensions directory.
* The probe uses the real display (`:0`), so a window appears while it runs.
