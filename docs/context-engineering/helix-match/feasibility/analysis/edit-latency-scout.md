> Provenance: read-only scout memo, session 1833127f, 2026-10-24. Copied verbatim from /tmp/helix-match-implementation-khd3bwgf/evidence/scout-edit-latency.md.

# Scout: T1-A edit latency root cause (read-only, 2026-10-24)

Conclusion: (b) inherent to pinned Helix ba40e547 + tree-house 0.4.0 path; confidence ~85% (Rust case).
- Helper change path engine.rs:239-287 mirrors helix-view/src/document.rs:1460-1464,1514-1525 (Syntax::update with old/new slices + changeset; on error syntax=None). helix-core/src/syntax.rs:518-538, PARSE_TIMEOUT 500 ms. Syntax::new only at open (engine.rs:183).
- tree-house 0.4.0 parse.rs:11-66 re-parses root layer and runs injection/local queries on touched layers; injection query runs over whole root tree (injections_query.rs:360-375).
- Growth is driven by the probe's edit: 'x' inserted at byte 0 makes `xfn f0` (invalid Rust) → error-recovery reparse dominates (~97%). Valid edits: Rust 10k ~7-14 ms, 100k ~150 ms; Markdown 100k 283-426 ms (valid).
- Measurement caveat: measure.py's 10 consecutive inserts all at byte 0, so "mid" numbers are on an already-errored document.
- Product implication (matches upstream): a large file + syntax-breaking edit near top can exceed 500 ms and disable syntax until reopen.
- Gaps: error-recovery explanation inferred from timings; 100k invalid case not re-run; host load 18-27 during runs (absolute numbers ±2x).
- Scratch: /tmp/hm-scout-latency/ (instrumented copies); worktree unchanged.
