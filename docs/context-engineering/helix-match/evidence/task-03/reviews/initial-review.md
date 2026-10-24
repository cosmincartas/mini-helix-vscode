# Task 3 Initial Review (Claude Code reviewer, task #35)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of worker task #31 (plan Task 3), delta vs `snapshots/pre-task03-04` → `post-task04`.
Orchestrator filter: P3R-1, P3R-2, P3R-3 accepted (grounded in spec L477-479, L516-530, L700 and plan Task 3). Non-findings not accepted.

## Verdict

Changes requested. Real `helix-term` dispatch, adapter independence, identity, RED, and lock checks hold; two oracle defects block valid reference states and one evidence claim is misstated.

## Findings

| ID | Sev | Title | Location |
|---|---|---|---|
| P3R-1 | P2 | Diff settle assumes raw HEAD text; converted baselines never settle | `native/oracle/src/main.rs:358-388` (check L370-373) |
| P3R-2 | P3 | Oracle rejects intentionally excluded grammars (wren, gemini) | `native/oracle/src/main.rs:492-499` |
| P3R-3 | P3 | Evidence says lone CR and mixed EOL cannot be represented by the reference | `docs/context-engineering/helix-match/evidence/task-03/README.md:54` |

P3R-1: `settle_diff` requires `d.diff_base().len_chars() == head.chars().count()` (raw fixture HEAD). Upstream decodes/converts the baseline (`Document::set_diff_base`, helix-vcs), so a length-changing conversion never settles.
Reproduced: `head: "﻿a\nb\nc\n"`, `text: "a\nB\nc\n"`, `steps: ["mig"]` → exit 2 after 15.04 s, "diff did not settle within 15 s".
Upstream publishes `doc`, `diff_base`, hunks together under one lock (`helix-vcs/src/diff/worker.rs` `apply_hunks`), so `d.doc() == doc.text()` is sound; only the length check is wrong.
Basis: spec Git baseline contract L516-530 (compare with HEAD baseline after upstream conversions; oracle settles async diffs); plan Task 3 "settle parser and diff work before observations".
Suggested fix: derive the expected baseline through the same upstream path, or treat as settled once `d.doc() == doc.text()` and the worker signalled completion after the base was set.

P3R-2: guard bails "produced no syntax tree without an injected failure" when `doc.syntax` is `None`; for wren/gemini that is the reference state (manifest `excludedGrammars`).
Reproduced: `language: "wren"` / `"gemini"` → exit 2.
Basis: spec L477-479 "Preserve that selection in both the package and oracle... An intentionally excluded grammar is reference configuration, not a broken installation."
Suggested fix: skip the guard for grammars listed in the manifest `excludedGrammars`; record `parser.syntax: "unavailable"`.

P3R-3: only the `eol` preference is limited to lf/crlf; `text` accepts any string and loads exactly.
Reproduced: `"ab\rcd\nef\r\ngh\n"` + `mip` exit 0, final [0,13]; `"x (a\rb) y\r\n"` (crlf) + `mi(` exit 0, [3,6].
Basis: spec L700 "Test mixed EOL and lone CR through helper/oracle fixtures".
Suggested fix: say only a lone-CR EOL preference cannot be expressed; mixed-EOL/lone-CR text is supported and deferred.

## Coverage per acceptance criterion

| Criterion | Status | Basis |
|---|---|---|
| RED: dispatch change fails | Met | `--mutate dispatch` exit 1, 40 fail / 66 pass; self-test (b) |
| RED: expected change fails | Met | `--mutate expected` exit 1, 106 fail |
| Built from pinned source | Met | patched tree hash 84267efbebf5… checked; `cargo build --locked` |
| Real dispatch and handlers | Met | `parse_macro` → `KeyEvent` → `Application::event_loop_until_idle`, default keymap |
| Exports text, selections, primary, preview, status | Met | per-step and final snapshots incl. UTF-16, mode, count, popup, status; `mr(` previews |
| In-memory text, EOL, no implicit newline | Met | buffer replaced by transaction; loaded text verified |
| Parser and diff settled | Partial | parsing synchronous; diff settle defective (P3R-1) |
| Parser lifecycle and deterministic failure injection | Met | `syntax = None` equals upstream post-failure state (`document.rs:1366`, `apply_impl` L1516-1524); `queryOverrides` cause real compile failures |
| Identity and provenance | Met | lock reference block embedded; manifest vs lock; 1799 assets re-hashed; provenance in all 7 groups |
| No production adapter import | Met | `cargo tree` and dep-info: 0 match-helper/feasibility |
| Adapter-only mutation leaves results | Met (structural) | independence result; worker log `independence-2` |
| Checked cases incl. quirk | Met | 106/106 incl. EOF `mif`/`maf` and injected-comment `mic`/`mac` |
| Runtime isolation, use-grammars | Partial | packaged root only, ambient overridden, built-in languages; excluded grammars mishandled (P3R-2) |
| Lock 0 deviations | Met | `native/oracle/Cargo.lock` 9e7b2a73… |
| Fixture schema | Met | schemas require snapshot fields, reject unknown props; spot checks consistent |

Spot checks (oracle output, consistent with pinned behaviour): `miw` [6,11]; `mr(` previews [2,3],[10,11] then `[` → "x [a [b] c] y"; `m3i{`/`3mi{` [3,18], `2m3i{` no-op; `mig` [6,12], pure deletion 1-wide point, untracked "Diff is not available in current buffer"; broken injected highlights → `mif` no-op vs control [20,29]; multi-selection `mr(` 6 points, primary 1 → 2.

## Checks run

- `npm run test:match:oracle` exit 0 (106 cases + self-test, 118 PASS).
- `node scripts/test-match-oracle.cjs --no-build --mutate dispatch` exit 1; `--mutate expected` exit 1.
- `cargo +1.90.0 build --locked` (cwd `native/oracle`) exit 0; `cargo tree --locked --offline` + dep-info grep 0/0.
- Direct oracle runs: mixed EOL, lone CR, wren, gemini, BOM baseline (results above).
- `npm test` 77/77; `npx vsce ls` clean; spec/plan hashes frozen; baseline only `package.json` differs (Task 2 + Task 3 scripts); evidence `file-hashes.txt` OK.

## Coverage limits

No JSON-schema validator run (relied on worker ajv log); scratch-tree adapter mutation not repeated; Linux only; ~25 of 106 expected results spot-checked.

## Non-findings (not accepted)

Grammar-build flag applies only from `native/oracle` cwd or runner (documented); self-test (a) trivially true (RED met otherwise); `--update` + `--mutate` caught by stored `keymapOverrideSha256`; broken injected highlights keeps layer listed (upstream behaviour, flagged for Task 9); `docs/**` packaged at baseline; deferred items.
