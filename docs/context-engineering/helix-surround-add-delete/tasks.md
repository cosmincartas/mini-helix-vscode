# Helix Surround Add and Delete Task Record

## Run 2026-10-24

- **Plan:** `plan.md` (validated). Before execution, the spec SHA-256 `1ef60714d78bf3afafd7181a76f117c06f33f7e9f0ffc0dfcc9f2e238db1337c` and the intent SHA-256 `224025c672fe0fe9a3fc2db0a6cb67d676237ebcd959ceeb6bf0cde777531d47` both matched.
- **Baseline:** commit `13511e6` with a clean tree. The working-tree prerequisite was met: the backtick and open-line work were committed. At baseline, `npm test` passed 453/453 and `npm run test:integration` exited 0.
- **Execution order:** serial, 1 → 2 → 3 → 4 (Initial review) → 5 (correction) → 4 (Verification review). The tasks share files and compile output.

| ID | Role | Status | Assignment | Outcome | Verification | Review |
|---|---|---|---|---|---|---|
| 1 | worker | completed | Plan Tasks 1 and 2: `addSurround` and `deleteSurround` in `src/core/match.ts`, plus tests | Both functions have the spec signatures. A private `collectPairs` is shared with `replaceSurround`, whose behavior is unchanged. 19 new tests include the ported upstream `(#[\|  ]#)` `md(` case. | RED confirmed (TS2305). `npm test` 472/472. | Pass (task 4) |
| 2 | worker | completed | Plan Tasks 3 and 4: bindings for `m s` and `m d <delimiter>`, the commands, the `Match` session kind, the shared `apply` step, unit and integration tests | `SurroundAction` is a union of replace and add, and both start through `begin()`. `delete(target)` runs in the queue. `apply()` serves `ms`, `md` and `mr`. Enter and Space are pending input. | RED confirmed (4 unit failures). `npm test` 473/473. Integration exit 0 (26 PASS). | Pass (task 4) |
| 3 | worker | completed | Plan Task 5: README (FR-13) | Every FR-13 item is present, plus accurate bullets for FR-9, FR-10 and FR-11. | `npm test` 473/473. | F1 raised, then fixed by task 5 |
| 5 | worker | completed | Correction batch for F1 | Reworded the `ms<char>` row at README.md:356. Only that line changed. | `npm test` 473/473. | Pass (Verification review) |
| 4 | reviewer | completed | Initial review of the full change set, then Verification review of the F1 correction | Initial review: one finding (F1). The code met FR-1 to FR-12, NFR-1, UI-1 and F-1 to F-5. Verification review: F1 resolved, no later findings. | Initial: `npm test` 473/473, `npm run test:integration` exit 0 with `PASS match: text objects and surround replacement`. Verification: `npm test` 473/473. | **Pass** |

### Finding ledger

- **F1:** resolved.
  - Problem: the README `ms<char>` row said only `(` and `)` pair, which implied that `ms[` gives `[text[`. The code gives `[text]`.
  - Basis: FR-1 and FR-13.
  - Fix: task 5. The Verification review confirmed it.

### Recorded deviations

- **D1:** plan Task 2 listed a unit test for "a delimiter shared by two different pairs gives `undefined`". That test was not written.
  - The worker brute-forced short strings and found the state unreachable under the `mr` pairing rules.
  - The reviewer confirmed this: bracket matching is one global nesting, and quote pairing is a deterministic left-to-right pass on each line.
  - The guard stays in `collectPairs`, as in the original `replaceSurround`.

### Correction batches

One was used, by task 5 for F1.

### Not executed

- The plan's manual check in an installed VSIX: `npm run package:vsix`, install the extension, then check that UI-1 shows. UI-1 was verified from source only.

### Nonblocking reviewer notes

These do not meet the finding bar.

- The new read-only integration checks (`2ms(` then `i`, and `2md(` then `i`) would pass even if the count were not cleared, because `i` is not bound in read-only editors. The unit tests cover count clearing through the `miniHelix.noop` bindings.
- `apply` reveals the primary selection before `history.commit`, while the spec lists reveal after commit. Nothing observable differs.
