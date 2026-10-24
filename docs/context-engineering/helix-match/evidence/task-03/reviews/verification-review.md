# Task 3 Verification Review (Claude Code reviewer, task #35)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Verification review after correction task #36; bounded to P3R-1..P3R-3 and correction regressions.
Inputs: [initial review](initial-review.md); snapshot `snapshots/post-task04/tree.tar`; delta `snapshots/task03-correction-delta.md`.

## Verdict

Pass. All three accepted findings resolved; no correction-caused regressions; no new findings.

## Per-ID status

- P3R-1 [P2] resolved. `upstream_diff_base` (`native/oracle/src/main.rs` L357-368) runs the `Editor::open` trust query (`editor.rs:2121-2126`), `diff_providers.get_diff_base(path, trust_full)`, and decodes with `from_reader(..., Some(doc.encoding()))` as `Document::set_diff_base` (`document.rs:1993-2002`).
  `settle_diff` (L374-399) waits for `d.diff_base() == expected_base && d.doc() == doc.text()`; worker publishes base, doc, hunks under one lock (`helix-vcs/src/diff/worker.rs:72-80`); empty default handle (`diff.rs:53`) cannot falsely settle except the trivially equal empty case.
  `git-hunks/mig-bom-baseline` passed 6 consecutive runs (~2 s); `baseChars` 6, one hunk [1,2]/[1,2], `mig` [2,4] = `B\n`.
- P3R-2 [P3] resolved. Skip applies only to grammars in runtime `manifest.json` `excludedGrammars` (gemini, wren; matches pinned `use-grammars`). Negative control: runtime copy without `rust.so` → rust case exit 2 ("produced no syntax tree"); real runtime exit 0; wren exit 0 in both.
  New cases: `excluded-wren-miw` [0,5], `excluded-gemini-miw` [8,13], both `mif` no-ops; all `parser.syntax: "unavailable"`.
- P3R-3 [P3] resolved. Evidence README L54 and fixtures README L31 now state only the `eol` preference is lf/crlf-limited; lone-CR and mixed-EOL text covered.
  `lone-cr-mip` [0,13]; `crlf-pref-lone-cr-mi-paren` [3,6] = `a\rb`. All 7 new cases carry oracle/reference provenance with the existing identity hashes.

## Later findings

None.

## Checks run

- `cargo +1.90.0 build --locked` (cwd `native/oracle`) ok; `Cargo.lock` `9e7b2a73…34900f3` unchanged.
- `npm run test:match:oracle` exit 0: 113 cases plus self-test.
- `--no-build --mutate dispatch` exit 1 (43); `--mutate expected` exit 1 (113).
- 106 original cases unchanged vs snapshot; exactly 7 added.
- Filtered runs (`bom` ×6, `excluded`, `lone-cr`) and missing-grammar negative control as above.
- `correction/file-hashes.txt` verified; spec/plan hashes frozen; `npm test` 77/77.

## Coverage and limits

Linux x64 only; no `.gitattributes`-converted CRLF baseline case (schema cannot express it; upstream decoding path should cover it, unrun); ajv not re-run (relied on `correction/schema-validation.txt`).
