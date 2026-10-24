> **SUPERSEDED (2026-10-24), historical only.** The user switched to a TypeScript-only implementation; see [../../helix-match-typescript/spec.md](../../helix-match-typescript/spec.md). Native code archived at /home/cosmincartas/work/archives/vscode-extension-helix-match-native-20261024.

# Helix Match Task 1 Feasibility Evidence

Start with [report.md](report.md), the single go/no-go report.
Each folder below has its own README with host details, commands, results, and limits.
All evidence is experimental and disposable; missing evidence is marked pending, not passing.

| Folder | Content | Entry |
|---|---|---|
| [native](native/) | Pinned-source helper, 8 probe groups (124 assertions), CRLF/EOF/Unicode fixture, measurements, runtime manifest | [native/README.md](native/README.md) |
| [editor](editor/) | VS Code 1.143.1 and 1.85.2 probes: Unicode input, modified routing, replay, selection projection, stale edit | [editor/README.md](editor/README.md) |
| [targets](targets/) | Build and runtime probes: glibc, Alpine musl (dynamic and static control), Windows gnu and Wine, macOS and win-arm64 type-check, ARM cross link | [targets/README.md](targets/README.md) |
| [package](package/) | Experimental linux-x64 VSIX, offline runtime proof, installed-extension e2e, race, projection round trip, retained-metadata follow-up | [package/README.md](package/README.md) |
| [analysis](analysis/) | Read-only memos: edit-latency scout and replay-gap oracle | [edit-latency-scout.md](analysis/edit-latency-scout.md), [replay-gap-oracle.md](analysis/replay-gap-oracle.md) |

Related sources outside this folder (not documentation of record, listed for reproduction): `native/Cargo.toml`, `native/feasibility/**`, `test/feasibility/**`.
Large raw logs are kept outside the repository (`/tmp/hm-t1a-logs/`, `/tmp/hm-t1c-logs/`, `/tmp/hm-t1b1-results*`) and are summarized by the folder READMEs.
