# Helix match (TypeScript only): implementation plan

Spec: [spec.md](spec.md) (frozen). This plan replaces the 22-task native Rust plan in [../helix-match/plan.md](../helix-match/plan.md), which is superseded and kept for history only.
The native code is archived at `/home/cosmincartas/work/archives/vscode-extension-helix-match-native-20261024`.

## Tasks

1. **Pure core.** Add `src/core/match.ts` (word, bracket and quote finders, counts, multi-selection results, surround replacement edits) with unit tests in `test/unit/`. No VS Code imports.
2. **Cleanup, archive, docs.** Move the native experiment out of the worktree, drop its npm scripts and ignore entries, delete stale `out/` leftovers, mark the old docs superseded, document the commands in `README.md`.
3. **VS Code controller and bindings.** Add `src/vscode/match.ts` (selection commands, `mr` pending-input controller on the shared `CommandQueue`, one `editor.edit` per `mr`), the generated chord bindings in `scripts/keybindings.cjs` and `package.json`, and integration tests in `test/integration/`.

## Verification

- `npm test` (generated-binding check, compile, unit tests).
- `npm run test:integration` (real keyboard: chords, aliases, counts, cancellation, multi-cursor `mr`, one-step undo).
- `npm run package:vsix` (check that the VSIX has no `native/`, `docs/`, `src/` or test files). Do not publish.
- `grep -rniE "native|rust|cargo|build:match|oracle" src scripts test package.json README.md` shows only VS Code native undo/command wording.
