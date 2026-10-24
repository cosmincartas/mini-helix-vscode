# Task 1 Initial Review (Claude Code reviewer, task #6)

Provenance: independent read-only `reviewer` agent, session 1833127f-56be-437d-bb5d-d7643ab1afbe, 2026-10-24.
Mode: Initial review of the attributable Task 1 change set (T1-A #1, T1-C #2, T1-B2 #3, T1-B1 #4, T1-D #5).
Pre-review snapshot: `/tmp/helix-match-implementation-khd3bwgf/snapshots/pre-initial-review/` (125 files + `.gitignore`/`.vscodeignore` patch).
The reviewer stopped once at its turn limit and was continued in the same context; the report below is the single complete consolidated report.
Orchestrator filter: all five findings accepted (grounded in plan Task 1 "archive commands, exact inputs, outputs" and the "no unsupported claims" acceptance). No finding was rejected.

## Verdict

Fail, with five filtered findings (one P2, four P3).
None changes a gate decision; all four gate decisions in `report.md` are supported by the archived evidence.

## Findings

| ID | Sev | Location | Short title |
|---|---|---|---|
| IR-1 | P2 | `feasibility/**/*.log` (36 files); `report.md` L48, L67-72 | Evidence the gates cite is in files git ignores |
| IR-2 | P3 | `native/feasibility/helper/probes/__pycache__/hmclient.cpython-314.pyc` | Stray Python bytecode artifact, not ignored |
| IR-3 | P3 | `report.md` L242 | Misstates where `measure.py` does its "mid" insert |
| IR-4 | P3 | `feasibility/native/README.md` L146-148 | Prose numbers not backed by `measurements.json` |
| IR-5 | P3 | `feasibility/editor/README.md` L91, L99 | Misreports the 1.85.2 V4 race result |

### IR-1 [P2] Archived evidence in gitignored `.log` files

- Trigger: `git add docs/` skips all 36 `*.log` evidence files; `git check-ignore -v` matches `.gitignore:5 *.log`
  (examples: `targets/logs/windows-gnu-wine-grammar-probe.log`, `native/final-run.log`).
- Impact: `report.md` cites 13 of them as primary evidence for W1 (`native/final-run.log`), V2 (`package/install.log`),
  V3-V6 (Windows/Wine, macOS stub-cc check, glibc trixie/bookworm, Alpine dynamic grammar load) and gate 3.1.
  V1 is marked "pass" while raw logs otherwise live only in `/tmp`.
- Basis: plan Task 1 Verification "archive commands, exact inputs, outputs, and measurement method"; T1-D "no unsupported claims".
- Suggested fix: rename archived evidence logs to a non-ignored extension (for example `.txt`) and update references, or mark V1 partial.

### IR-2 [P3] Python bytecode not ignored

- Trigger: `git status` lists the `.pyc` as untracked; `git check-ignore` returns nothing.
  Each documented `run_probes.py`/`measure.py` run recreates it (`-I` does not stop bytecode writes for imported `hmclient`).
- Basis: T1-A acceptance ".gitignore (append native build-output lines only)"; this native build output is not covered.
- Suggested fix: delete it and add a native `__pycache__/` line to the appended block, or run with `-B`/`PYTHONDONTWRITEBYTECODE=1`.

### IR-3 [P3] Report misstates the "mid" insertion position

- Trigger: `report.md` L242 says "The 'mid' insertions in `measure.py` were also at byte 0".
- Evidence: `measure.py` L140 start loop inserts at 0; the mid loop (L149) inserts at offset `o` computed at L123-127 inside a function body past the midpoint.
  The scout memo means the 10 start inserts leave the document errored before the mid loop runs.
  The report's conclusion (columns not independent) stays correct; the stated cause is wrong.
- Basis: T1-D acceptance "no unsupported claims".

### IR-4 [P3] Native README prose measurements lack an archived source

- Trigger: `native/README.md` L146-148 quotes 11.1/11.9 ms cold start, 49.8 ms first Rust open, 9.6 ms first `mif`, warm `mif` 0.031/0.034, `maf` 0.030/0.033, `miw` 0.022/0.026, `ms` 0.024/0.028.
- Evidence: `measurements.json` has 11.505/12.492, 53.439, 9.983, 0.033/0.037, 0.033/0.034, 0.025/0.027, 0.028/0.032; no archived output contains the README values.
  `report.md` L223-225 flags this and uses JSON values; the evidence README is still inconsistent.
- Basis: plan Verification (archive outputs and method); T1-A "measurements with method/host".

### IR-5 [P3] Editor README misreports 1.85.2 V4 and overstates `applyEdit` guarding

- Trigger: `editor/README.md` L91 says "250 applyEdit first, edit valid serial" for 1.85.2 V4; L99 says `workspace.applyEdit` is version-guarded on 1.143.1/1.85.2.
- Evidence: `results-1.85.2.json` V4 tally is `editTrueNativeAfter: 250, applyEditResult:true: 250, outcome:applied-before-native (valid serial): 250`;
  per `test/feasibility/editor/probes/staleEdit.ts` L73/L122 the proposal applied first and `applyEdit` then applied and returned true.
  Only 1.143.1 V4 returned false (250/250). The gate rests on `TextEditor.edit` (V6/V7), whose numbers are correct.
- Basis: T1-C acceptance (honest stale-base evidence); "no unsupported claims".

## Coverage by assignment

- T1-A: rebuilt `--locked` into `/tmp/hm-review-target`; binary byte-identical to the stage binary; archive SHA and `diff -rq` upstream identical;
  Cargo.lock 337/245/93 pruned/0 deviations/1 added; protocol, UTF-16 rejection, proposal immutability, `debugDelayMs` read in source and probed (26 checks);
  grammar `.so` hashes 5/5, staged queries identical to upstream; `run_probes.py` re-run 8 groups 124/124; expectations are literal constants (not circular);
  fixture present (`corpus_matrix.py` not re-run); measurement JSON consistent with report, README prose not (IR-4); append-only ignore edits (IR-2 gap).
- T1-C: both result files complete; probe1 A 0/10, C 10/10 (1.85.2 8/10 key-event, 10/10 `insertText`), composition 4/4; probe2 224/224 and 48/48;
  probe3 replay for extension bindings, native/user keys not replayable (escalated, deferred); probe4 225 rows per version;
  probe5 250 per variant, V6/V7 false 250/250 (1.143.1) and 245/249 (1.85.2), 0 applied on changed base; V4 text wrong (IR-5).
- T1-B2: glibc logs present (ignored files, IR-1); Alpine dynamic musl grammar load confirmed via `/proc/<pid>/maps`;
  Wine 10.0 grammar load and `%APPDATA%` runtime root first; darwin stub-cc check only; MSVC false positive disclosed; no host toolchain changes.
- T1-B1: production `package.json`/`.vscodeignore` unchanged; VSIX 4,359,810 B, 1,225 entries; offline run (empty PATH/HOME, `lo` only, ENETUNREACH, 1,201 assets);
  10/10 e2e scenarios with hand-written expectations; race 60/60 + 30/30, 0 stale applied; projection 1979 checks, 7 diffs, 6 transitions;
  retained 1546 used / 0 fallbacks, invalidation 6×5; no TypeScript Helix algorithms.
- T1-D: W1-W14 and V1-V7 mapped (V1 overstated, IR-1); gate decisions supported; numbers match JSON (L242, IR-3); memos verbatim plus provenance.

## Checks run

- `npm run compile` rc=0; `npm test` 77/77.
- `cargo +1.90.0 build --release --locked` (CARGO_TARGET_DIR=/tmp/hm-review-target) rc=0; `cmp` identical to stage binary.
- `python3 -I native/feasibility/helper/probes/run_probes.py native/feasibility/build/stage /tmp/hm-review-probes`: 124/124.
- Archive `sha256sum`, upstream `diff -rq`, lock comparison, grammar hashes, query diff, `languages.toml` hash: all consistent.
- `npx vsce ls`: no `native/**` or `test/**`; only feasibility docs and the progress note added.
- Spec/plan/review hashes equal frozen values; 24/24 baseline hashes match; baseline patch equal; snapshot `sha256sum -c` OK before and after.

## Attribution and scope

Baseline intact; no out-of-scope writes; no commits (HEAD `0b2f3ae`).
`src/vscode/navigation.ts` is a baseline untracked file. The experimental VSIX contains baseline production `out/src` (disclosed).

## Gate-decision assessment

- Build viability: GO on confirmed targets (linux-x64 glibc, alpine-x64 dynamic musl); Windows partial; macOS type-check only, correctly pending and not promised.
- Unicode input: GO for the mechanism (CDP only); real layouts, AltGr, IME pending and not claimed.
- Selection semantics: GO conditional on Task 7 retained metadata (spec L363-364); `c` difference unrelated to projection; oracle pending (Task 18).
- Stale-edit protection: GO; `TextEditor.edit` returns `false` for stale bases; 0 stale applied.

## Coverage limits

No VS Code, container, cross-target, Wine, grammar fetch/build, `corpus_matrix.py`, or `measure.py` re-runs; raw `/tmp` logs checked for existence only.

## Non-findings

One informational always-true check counted in the 124; `debugDelete` is a disclosed feasibility analogue; 1.85.2 V2/V3 timing differences;
deferred items per brief (unconfirmed targets, layouts, 301-grammar build, replay amendment, production retained metadata, Helix-exact `c`, Windows runtime isolation, runtime-hash identity, trust filters).
