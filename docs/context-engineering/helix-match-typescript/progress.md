# Helix match (TypeScript only): progress

Updated 2026-10-24. Plan: [plan.md](plan.md). Spec: [spec.md](spec.md).

| Task | Status |
| --- | --- |
| 1. Pure core `src/core/match.ts` and unit tests | done |
| 2. Cleanup, archive, docs | done |
| 3. VS Code controller, generated bindings, integration tests | done |

## Task 1 details

- `src/core/match.ts` is pure TypeScript text scanning with no `vscode` import.
- Unit tests: `test/unit/textObject.test.ts` (26 tests) and `test/unit/surround.test.ts` (14 tests).

## Task 2 details

- Native experiment moved (not copied or deleted) to `/home/cosmincartas/work/archives/vscode-extension-helix-match-native-20261024` (about 16 GB, see its `ARCHIVE.md`). Archived: `native/`, `src/native/`, `scripts/{build-match,check-helix-runtime,test-match-oracle}.cjs`, the four `test/unit/match*.test.ts` files, `test/unit/fixtures/matchClient/`, `test/fixtures/helix-match/`, `test/feasibility/`.
- `package.json`: removed the `build:match`, `check:helix-runtime` and `test:match:oracle` scripts. `.gitignore` native entries removed; `.vscodeignore` now excludes `docs/**` instead of `native/**`.
- Stale `out/` files for the archived sources deleted.
- Old `docs/context-engineering/helix-match/` docs carry a superseded banner.
- `README.md` documents `mi`/`ma`/`mr` and their limitations.

## Task 3 details

- `src/vscode/match.ts` is the pending controller for `mr`; it is wired in `src/extension.ts`.
- `scripts/keybindings.cjs` generates the chord bindings: 1210 bindings total (32 `m` commands, 555 `m` chord noops, 110 pending replacement inputs, 36 pending cancels). Covered by `test/unit/keybindings.test.ts`.
- `test/integration/match.ts` covers text objects and surround replacement, including a deterministic queue-barrier regression.

## Verification and review

- `npm test`: 122/122 passed.
- Full `npm run test:integration` exited 0 with 23 PASS lines, including "PASS match: text objects and surround replacement".
- `npm run package:vsix` produced 25 files (about 56 KB) with no `native/`, `docs/`, `src/` or test files.
- The independent Initial review returned PASS with one P3 documentation finding (F1, the stale task table, now fixed). The final task record is in [tasks.md](tasks.md).
