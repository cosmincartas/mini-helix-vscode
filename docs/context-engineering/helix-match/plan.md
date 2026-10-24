---
schema_version: 1
artifact: implementation-plan
status: validated
subject: helix-match
spec: spec.md
spec_sha256: ca7f9e8365d069cffddab142f0b48d02d42fc2238db85a8497406d12e83a9776
repository_baseline: 0b2f3aea685204fc48b509392664ad08e4996106
working_tree: Existing concurrent motion, count, navigation, and test changes; preserve them.
created: 2026-10-24
updated: 2026-10-24
---

# Helix Match Implementation Plan

## Source and Execution Boundaries

Implement only the included requirements in [spec.md](spec.md).
Resolve its path against this folder and verify its exact SHA-256 before execution.
The specification records conversation-supplied intent; its `intent_sha256` is `not applicable`.
No local supporting file adds binding design beyond the specification.

Recheck the current repository against the baseline and all uncommitted changes before starting.
This plan is documentation only. No implementation, native build, or test execution occurred during planning.
Task completion and execution state belong to the implementer.

The target is complete pinned NORMAL match-command parity, not complete Helix editor emulation.
NORMAL Escape must preserve selections and clear counts, matching Helix instead of the current native Escape fall-through.
This explicit integration change makes completed match behavior independent of helper timing.
Keep the source revision, runtime, supported input domain, and rendering limitations explicit in release documentation.
Do not lower the parity target when a feasibility check fails.

## Supporting Sources

None beyond `spec.md`.
The companion `review.md` records review evidence and corrections; it does not add implementation requirements.
External source URLs and the research archive checksum are recorded in the specification.

## Implementation Discretion

Preserve required behavior, ownership, protocol fields, selection invariants, and commit rules.
Choose private helpers and class structure within those constraints.
Trace downstream from each entry point; task entries are not exhaustive file lists.
Reuse current `Count`, `CommandQueue`, `UndoHistory`, presentation, and keyboard-test facilities.
Do not add a second word, surround, syntax, or diff algorithm in TypeScript.
Keep required upstream patches narrow and reviewable.

New native test targets and npm scripts below are planned facilities, not existing commands.
Each task names the task that creates its prerequisites.
Use the named public process method, command, or exported reducer as the test boundary.
Do not test private helpers solely to mirror their implementation.

## Correction Rules

Stop dependent work when scope, acceptance, architecture, input behavior, or contracts require a material change.
Review the affected specification section before updating this plan.
Do not refresh the specification hash to hide unreviewed source changes.
Recheck downstream task coverage after every approved specification correction.
Task ordering or grouping can change within the approved dependency constraints.
Private refactoring requires passing verification, not another architecture approval.

## Approval Record

- **Decision:** Validated under the limited documentation delegation after artifact checks and Claude Code review.
- **Evidence:** The user requested design documents, an implementation plan, and Claude Code review on 2026-10-24.
- **Delegation:** The `quickie` workflow supplies routine documentation gates for the discussed bundled-helper design.
- **Limits:** No claim of direct user review. No implementation or release authorization is inferred from this document.
- **Review:** Three Claude Code passes; corrections and remaining implementation checks are recorded in `review.md`.

## Repository Findings

| Evidence | Finding and planning effect |
|---|---|
| `src/extension.ts:activate` | Registers current counts, modes, word motions, history, and interactive jumps. Add match lifecycle here. |
| `src/core/count.ts:Count` | Reuse pending count, `take()`, and the current maximum. Do not implement counts again. |
| `src/core/registerMotion.ts:registerMotion` | Concurrent work added queue support, now supplied by activation. Task 17 must extend existing ordering and ownership guards. |
| `src/motions/hjkl.ts:CharMotions` | Current character motions need the same ordering review as words. |
| `src/vscode/navigation.ts:registerNavigation` | Concurrent native navigation work exists. Include it in the ordering and cancellation review. |
| `src/vscode/queue.ts:CommandQueue` | Existing edit/history queue catches failures and keeps later tasks runnable. Reuse it. |
| `src/vscode/editing.ts:SelectionEdits` | Native edits coordinate `UndoHistory.hold()` and `commit()`. Preserve that revision contract. |
| `src/vscode/wordJump.ts:WordJump` | Existing transient-input lifecycle gives cancellation and coexistence evidence. |
| `src/vscode/presentation.ts:Presentation` | Existing named status item displays mode and count. Extend it for pending match state. |
| `scripts/keybindings.cjs:createKeybindings` | Generated ordering determines blockers, digits, motion keys, and temporary label ownership. |
| `test/unit/helix.ts` | Extension-only reference sessions cannot certify independent Helix parity. |
| `test/integration/keyboard.ts:Keyboard` | Real renderer input exists; extend its key vocabulary for symbols and Unicode. |
| `test/runIntegration.ts:main` | Uses isolated profiles and optional `VSCODE_EXECUTABLE_PATH`; Linux requires a display. |
| `.vscodeignore` and `package.json` | Current VSIX packaging has no native runtime or target pipeline. |

Existing commands are `npm run check:keybindings`, `npm run compile`, `npm test`, `npm run test:integration`, and `npm run package:vsix`.
Existing integration tests use `@vscode/test-electron`, CDP, and `ws`.
No production runtime dependency is currently declared.

The initial working tree changed `package.json`, keybindings, activation, integration tests, and word-motion test helpers.
It also contained untracked movement tests.
During planning, native navigation and additional motion test files appeared from concurrent work.
The final recheck found shared queues in word and character motions and a new `Count.presses` key counter.
Reuse these changes; do not reimplement queue support or replace vertical-motion memory handling.
Do not overwrite these changes or assume that README limitations describe the latest working code.
Re-read those files at execution time.

Baseline verification: read-only source inspection and upstream source comparison only.
No build, unit test, integration test, or package check was executed during planning.
No baseline failure is established by this plan.
The implementer must record current failures before attributing failures to match work.

## Tasks

### Task 1: Establish native feasibility evidence

- **Requirements:** FR-1, FR-4, FR-7, FR-9, FR-10, FR-12, FR-13, NFR-2, NFR-5.
- **Design references:** Deployment and feasibility gate; UI-2; selection identity; freshness and commit contract.
- **Entry point:** New `native/Cargo.toml` and a disposable feasibility test executable.
- **Depends on:** none.
- **Outcome:** Produce one go/no-go report with reproducible evidence for the selected architecture.
- **TDD:** This is an experimental feasibility task. Assertions validate the experiment; no production implementation is accepted here.
- **Work:** Build a minimal helper against the exact pinned source and runtime.
  Demonstrate `miw`, `mif`, an injected object, surround editing, a Git hunk, and arbitrary Unicode surround input.
  Demonstrate modified-character routing and ordinary-input replay after a failed replacement lookup.
  Demonstrate CRLF and EOF selection projection through consecutive match and edit commands.
  Determine whether reachable normalized selections need extra projection metadata before implementing such metadata.
  Delay helper results and race a real native edit against `TextEditor.edit`.
  Establish whether the supported edit API rejects a stale base version.
  If a different supported API is necessary, review the contract before dependent implementation.
  Measure cold startup, warm requests, parsing, memory, and package size with corpus sizes and host details.
- **Verification:** Run the experiment on the current host and archive commands, exact inputs, outputs, and measurement method.
  Confirm one local package works without a Rust or Helix installation at runtime.
  Confirm representative Windows, macOS, glibc, and musl build feasibility through build probes before promising those targets.
  Run the dynamically linked musl helper inside Alpine and actually load a grammar.
  Record remaining target-matrix work explicitly.
- **Prerequisites:** Rust 1.90.0, Node development environment, a C/C++ grammar toolchain, pinned source, runtime assets, VS Code, and Git fixtures.
- **Gate:** Stop dependent work if build viability, Unicode input, selection semantics, or stale-edit protection fails.
  Seek design review; do not substitute approximations.

### Task 2: Lock a complete native runtime build

- **Requirements:** FR-9, FR-13, NFR-1, NFR-2, NFR-4, NFR-6, NFR-7.
- **Design references:** Runtime and language contract; deployment; upstream upgrades.
- **Entry point:** New `native/helix-lock.json`.
- **Depends on:** Task 1.
- **RED:** Add a runtime verification command that fails for a missing grammar, altered query, or ambient runtime override.
  Proposed command: `npm run check:helix-runtime`.
- **GREEN:** Create the lock manifest, pinned source layout, Rust workspace, runtime builder, and isolated runtime resolver.
  Inventory all language entries, grammar revisions, query inheritance, capture availability, targets, and required notices.
  Preserve the pinned `use-grammars` exclusions for `wren` and `gemini`; distinguish them from unexpected missing libraries.
  Record each upstream patch and its exact source symbol.
  Record unchanged query failures reproduced in the reference as compatibility outcomes, separately from package corruption.
  Record the query path and whether it disables text objects, root syntax, or an injected layer.
  Retain full match assets; do not prune injection or bracket queries as unused highlighting data.
- **REFACTOR:** Share build metadata generation across targets without changing the compatibility identity.
- **Verification:** `npm run build:match` followed by `npm run check:helix-runtime` must produce a complete current-host runtime.
  Corrupting or removing an asset must make the check fail.
  Ambient `.helix`, user runtime, and `HELIX_RUNTIME` values must not change asset resolution.
- **Prerequisites:** Task 1 tools. This task creates both proposed npm commands and the `mini-helix-match-helper` Cargo package.

### Task 3: Establish an independent command oracle

- **Requirements:** FR-1 through FR-10, NFR-1, NFR-2, NFR-6.
- **Design references:** Verification Design; compatibility definition.
- **Entry point:** New test-only upstream `helix-term` harness and `test/fixtures/helix-match/`.
- **Depends on:** Task 2.
- **RED:** Add an oracle self-test that fails when command dispatch or a known expected result is deliberately changed.
  Proposed command: `npm run test:match:oracle`.
- **GREEN:** Build the oracle from pinned source. Drive actual match key dispatch and handlers.
  Export exact input and output text, selections, primary index, preview state, and reference status.
  Load identical in-memory text and EOL preference; settle parser and diff work before observations.
  Capture parser lifecycle state and support deterministic reference failure injection without replacing command orchestration.
  Record upstream identity and fixture provenance.
  The oracle must not import the production command adapter.
- **REFACTOR:** Reuse fixture transport and pinned assets, while keeping command execution independent.
- **Verification:** `npm run test:match:oracle` must reproduce checked upstream cases, including an intentional upstream quirk.
  Injecting an adapter-only mutation must leave oracle results unchanged.
- **Prerequisites:** Task 2 build and runtime. This task creates the proposed oracle command and fixture schema.

### Task 4: Expose a validated helper protocol

- **Requirements:** FR-12, FR-13, FR-14, NFR-1, NFR-3.
- **Design references:** Private process protocol; failure model F-1, F-6, and F-8.
- **Entry point:** New helper stdin/stdout dispatcher in `native/match-helper/`.
- **Depends on:** Task 2.
- **RED:** Add process-level `initialize` tests. Wrong protocol or runtime identity must fail explicitly.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test protocol`.
- **GREEN:** Implement JSON Lines framing, request identity, handshake, stable errors, bounded buffers, and shutdown.
  Declare frame and timeout policy without truncating valid input.
  Keep stdout free of logs and document contents out of diagnostics.
- **REFACTOR:** Consolidate boundary validation while preserving typed error results.
- **Verification:** Run the same Cargo test target with fragmented frames, malformed JSON, oversized frames, and EOF.
  The process must fail safely without hangs or leaked children.
- **Prerequisites:** Task 2 workspace. This task creates the `protocol` integration test target.

### Task 5: Manage the packaged process lifecycle

- **Requirements:** FR-13, FR-14, NFR-3, NFR-5.
- **Design references:** Process client; recovery; failure model F-6 and F-9.
- **Entry point:** New `src/native/matchClient.ts:MatchClient`.
- **Depends on:** Task 4.
- **RED:** Add public-client tests for handshake failure, process exit, pending-request rejection, and explicit restart.
  Command: `npm run compile && node --test out/test/unit/matchClient.test.js`.
- **GREEN:** Resolve the target helper under the installed extension root and spawn it without a shell.
  Track the helper epoch, typed requests, process exit, timeouts, and bounded stderr diagnostics.
  Reject pending promises on failure. Restart only under the recovery policy.
  Dispose listeners, pipes, and the child process.
- **REFACTOR:** Share process cleanup paths without adding an independent process manager framework.
- **Verification:** Run the test command against controlled process fixtures and the real current-host helper.
  Confirm no listening port, no runtime network request, and no document-bearing diagnostics.
- **Prerequisites:** Task 4 helper. This task creates the named unit test.

### Task 6: Synchronize exact document replicas

- **Requirements:** FR-9, FR-12, FR-14, NFR-5.
- **Design references:** Document identity; `open`, `change`, `snapshot`, `configure`, and `close` contracts.
- **Entry point:** New `MatchClient` document synchronization API.
- **Depends on:** Task 5.
- **RED:** Add end-to-end replica tests with multi-edit events, version gaps, reopen generations, undo, and language changes.
  Command: `npm run compile && node --test out/test/unit/matchSync.test.js`.
- **GREEN:** Apply each native event as one base-snapshot changeset.
  Maintain exact host-exposed line endings and Unicode text. Update syntax through the pinned old/new rope API.
  Acknowledge parser availability and preserve reference syntax-disable state through snapshots and helper restarts.
  Send complete snapshots after missed events or process restarts.
  Release closed replicas and reject messages for old document generations.
- **REFACTOR:** Consolidate snapshot and event ownership within the client.
- **Verification:** Run the test command against the helper and compare acknowledged replica text through a test-only observation method.
  Versions and hashes must agree after every event; no duplicate event application is allowed.
- **Prerequisites:** Task 5 client and helper; this task creates the named test and test-only replica observation.

### Task 7: Preserve semantic selection identity

- **Requirements:** FR-7, FR-12.
- **Design references:** Selection identity and projection; compatibility definition.
- **Entry point:** New `src/native/selectionCodec.ts` public boundary and native selection import/export.
- **Depends on:** Task 3, Task 6.
- **RED:** Add round-trip and differential tests for scalars, graphemes, reversed ranges, CRLF, EOF, and primary selection.
  Command: `npm run compile && node --test out/test/unit/matchSelections.test.js`.
- **GREEN:** Convert UTF-16 offsets in Rust, apply upstream invariants, and retain canonical primary identity.
  Project primary-first selections into VS Code. Preserve only semantic metadata required for reachable normalized reference states.
  Do not create CRLF shadow ranges unless Task 1 proves a reachable information loss that requires them.
  Invalidate metadata after external changes.
  Reject malformed UTF-16 and invalid scalar boundaries without replacement characters.
- **REFACTOR:** Centralize conversion and projection; remove duplicate offset interpretations from callers.
- **Verification:** Run the named test and oracle comparisons for touching and overlapping selections.
  Consecutive match commands must preserve semantic state after projection.
- **Prerequisites:** Task 3 oracle and Task 6 replica API. This task creates the named unit test.

### Task 8: Match plaintext inside and around objects

- **Requirements:** FR-1, FR-2, FR-7, FR-8, NFR-2.
- **Design references:** Object inventory; native evaluator; pending input count contract.
- **Entry point:** New native `evaluate` dispatcher for inside and around operations.
- **Depends on:** Task 7.
- **RED:** Add differential process tests for words, WORDs, paragraphs, explicit pairs, custom characters, and closest pairs.
  Use documents without a language for pair tests in this task; syntax-backed pairs belong to Task 9.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test textobjects_plain`.
- **GREEN:** Call pinned text-object and surround algorithms with complete normalized selection sets.
  Preserve object-specific count behavior, direction, missing-match behavior, and final document selection invariants.
- **REFACTOR:** Keep only command dispatch and compatibility conversions in the adapter.
- **Verification:** Run the named target against the oracle's exact output, including whitespace and delimiter aliases.
  Cover empty objects, quote escapes, non-ASCII pairs, and upstream EOF quirks.
- **Prerequisites:** Task 7 boundary and Task 3 fixtures. This task creates the named native test target.

### Task 9: Match syntax objects and injected languages

- **Requirements:** FR-1, FR-2, FR-9, NFR-2, NFR-4, NFR-6.
- **Design references:** Runtime and language contract; syntax object inventory.
- **Entry point:** Native `evaluate` syntax-object dispatch and language selection.
- **Depends on:** Task 8.
- **RED:** Add differential cases for all seven capture families, inherited queries, aliases, and injected-language boundaries.
  Include syntax-backed `mi(`, `ma(`, `mim`, and quote pairs in root and injected languages.
  Inject initial-parse failures, update failures, and reference query-compilation failures.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test textobjects_syntax`.
- **GREEN:** Use pinned loaders and syntax APIs for `f`, `t`, `a`, `c`, `T`, `e`, and `x`.
  Map language IDs explicitly. Preserve absent-capture no-ops and distinguish broken assets.
  Update parser state after native edits and language changes.
  Preserve the upstream 500 ms timeout and permanent per-document disable state after update failures.
  Reproduce failure behavior by query type: text-object queries become unavailable; root syntax-configuration failures disable root syntax.
  Failed injected-language configurations remove only those layers; acknowledge root configuration failure as `initial_failure`.
- **REFACTOR:** Share runtime and language detection rather than adding language-specific procedural selectors.
- **Verification:** Run the named target and `npm run check:helix-runtime`.
  Every configured language must appear in the capture inventory, including languages without text-object queries.
  Compare embedded-language results before and after edits.
  Compare syntax-unavailable fallback and disabled-state recovery using deterministic failure injection.
- **Prerequisites:** Task 8 evaluator and Task 2 full runtime. This task creates the named native test target.

### Task 10: Match change hunks against HEAD

- **Requirements:** FR-1, FR-2, FR-10, NFR-2, NFR-4.
- **Design references:** Git baseline contract; failure model F-7 and F-10.
- **Entry point:** Native Git-object evaluator using `helix-vcs`.
- **Depends on:** Task 9.
- **RED:** Add temporary-repository cases for modified, staged, untracked, deleted, and unsaved text.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test textobjects_git`.
- **GREEN:** Load upstream HEAD baselines with worktree conversions and the current trust state.
  Compute pinned diff hunks and use upstream hunk lookup and selection conversion.
  Refresh changed baseline identities and return reference unavailability when no baseline exists.
- **REFACTOR:** Reuse upstream diff workers and isolate baseline metadata from generic document state.
- **Verification:** Compare `mig` and `mag` to settled oracle results.
  Cover pure removals, CRLF conversion, symlinks, linked worktrees, HEAD changes, and missing repositories.
  Verify untrusted repository filters cannot execute; use harmless marker fixtures.
- **Prerequisites:** Task 9 helper, Task 3 Git-capable oracle, and local Git fixture setup.
  This task creates the named native test target.

### Task 11: Match brackets through syntax and plaintext

- **Requirements:** FR-3, FR-7, NFR-2.
- **Design references:** Native evaluator; pinned `match_brackets` command.
- **Entry point:** Native `evaluate` action `brackets`.
- **Depends on:** Task 9.
- **RED:** Add `mm` differential cases with cursor positions inside, on, and outside brackets.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test brackets`.
- **GREEN:** Use the same syntax-aware or plaintext matching branch as pinned Helix.
  Apply the reference cursor placement and full-selection normalization.
- **REFACTOR:** Reuse the common selection boundary without sharing custom matching logic.
- **Verification:** Run the target across nested syntax, strings, comments, malformed text, and absent matches.
  Compare reversed and multiple selections to the oracle.
- **Prerequisites:** Task 9 syntax support and Task 3 oracle. This task creates the named native test target.

### Task 12: Propose surround additions

- **Requirements:** FR-4, FR-7, FR-8, NFR-2.
- **Design references:** Surround behavior; proposal contract.
- **Entry point:** Native `evaluate` action `add`.
- **Depends on:** Task 8.
- **RED:** Add process cases for bracket aliases, literal `m`, Unicode pairs, Enter, and multiple selections.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test surround_add`.
- **GREEN:** Adapt pinned `surround_add` orchestration and return one sorted transaction with post-edit semantic selections.
  Use document EOL for Enter. Leave the authoritative replica unchanged until a native event arrives.
- **REFACTOR:** Reuse upstream changeset and selection mapping facilities.
- **Verification:** Compare proposed post-edit text and selections to real Helix.
  Evaluating the same proposal twice must not modify the helper replica.
- **Prerequisites:** Task 8 evaluator and Task 3 oracle. This task creates the named native test target.

### Task 13: Expose replacement preview and cancellation

- **Requirements:** FR-5, FR-7, FR-8, FR-12, FR-14.
- **Design references:** Continuation model; `mr` preview behavior; failure model F-1 and F-2.
- **Entry point:** Native `evaluate` action `replace` before the new-character key.
- **Depends on:** Task 9.
- **RED:** Add process tests for selected delimiter pairs, primary selection, closest-pair lookup, cancellation, and invalid tokens.
  Cover syntax-aware old-surround lookup in root and injected languages.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test surround_preview`.
- **GREEN:** Adapt the first pinned replacement phase and return its exact intermediate selections.
  Bind an opaque continuation to the document, session, original selections, and delimiter positions.
  Release it on cancel, change, close, restart, or completion.
- **REFACTOR:** Share ownership validation with other versioned requests.
- **Verification:** Compare intermediate selections to the oracle after `mr<old>`.
  Cancellation must return original semantic selections without text edits.
  Wrong-version tokens must never authorize a transaction.
- **Prerequisites:** Task 9 evaluator and Task 3 intermediate oracle observations. This task creates the named native test target.

### Task 14: Propose replacement transactions

- **Requirements:** FR-5, FR-7, FR-12, NFR-2.
- **Design references:** Native `continue`; replacement behavior; proposal commit contract.
- **Entry point:** Native `continue` handler.
- **Depends on:** Task 13.
- **RED:** Add continuation tests for nested pairs, aliases, literal new `m`, non-character cancellation, and duplicate use.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test surround_replace`.
- **GREEN:** Adapt the second pinned replacement phase, including sorted delimiter edits and restored selection mapping.
  Produce a proposal without changing the replica. Consume the token once.
- **REFACTOR:** Reuse native transaction export across add and replace.
- **Verification:** Compare final transactions and selections to the oracle; replay and stale-token calls must fail safely.
- **Prerequisites:** Task 13 continuations and Task 3 oracle. This task creates the named native test target.

### Task 15: Propose surround deletion transactions

- **Requirements:** FR-6, FR-7, FR-8, NFR-2.
- **Design references:** Surround behavior; all-selection failure contract.
- **Entry point:** Native `evaluate` action `delete`.
- **Depends on:** Task 9.
- **RED:** Add differential cases with nested, closest, counted, shared, and unmatched pairs across multiple selections.
  Include syntax-aware and injected-language lookup, plus plaintext fallback after parser failure.
  Command: `cargo test --manifest-path native/Cargo.toml -p mini-helix-match-helper --test surround_delete`.
- **GREEN:** Reuse pinned position lookup and adapt pinned transaction assembly.
  Preserve reference all-selection validation, errors, and resulting selections.
- **REFACTOR:** Share only conversion and result validation with other surround actions.
- **Verification:** Run the target. One invalid selection must produce the reference failure without partial deletion.
- **Prerequisites:** Task 9 evaluator and Task 3 oracle. This task creates the named native test target.

### Task 16: Implement pending match input ownership

- **Requirements:** FR-1 through FR-6, FR-8, FR-12.
- **Design references:** UI-1 and UI-2; pending-input state machine; continuation model.
- **Entry point:** New `src/core/matchInput.ts:MatchInput`.
- **Depends on:** Task 3.
- **RED:** Add exported-reducer tests for every phase, counts, invalid keys, Escape, preview delay, and buffered replacement input.
  Include modified characters, non-character keys, failed-preview replay, and focus loss without editor changes.
  Command: `npm run compile && node --test out/test/unit/matchInput.test.js`.
- **GREEN:** Implement one synchronous owner for session ID, action, count snapshot, phase, and logical keys.
  Preserve mutable counts after the initial `m`; snapshot the count only when its action is accepted.
  Preserve exact key identity in the action menu; callback phases consume character values regardless of modifiers.
  Replay buffered keys through ordinary NORMAL dispatch when old-surround lookup fails.
  Buffer Escape during unresolved lookup; dispatch it only after the resulting callback state is known.
  Discard buffered keys on infrastructure failure, stale results, or cancellation; never replay them as ordinary edits.
  Preserve pending input on focus loss alone; Escape consumes unfinished input, not completed queued operations.
  Keep transitions independent of asynchronous context updates.
  Emit typed operation intents; do not compute text ranges in the reducer.
  Cancel immediately on lifecycle invalidation.
- **REFACTOR:** Share input ownership with existing `gw` through the smallest suitable coordinator.
- **Verification:** Run the named test. Rapid `mr([` must preserve key order while the preview is delayed.
  Compare `m3i{`, `2m3i{`, `mi3`, and `ms3` against real Helix key dispatch.
  Include `m0`, `mi<Alt-w>`, `ms<Ctrl-x>`, callback Tab, and failed `mr(d`.
  A helper failure during buffered `mr(d` must not execute the trailing delete.
  Counts must be consumed once; digits after the action must follow its callback phase.
- **Prerequisites:** Task 1 input feasibility and Task 3 reference input fixtures. This task creates the named unit test.

### Task 17: Preserve command order and reject stale selections

- **Requirements:** FR-7, FR-8, FR-12, NFR-5.
- **Design references:** Architectural flow; freshness contract; pending input and ordering.
- **Entry point:** `src/core/registerMotion.ts:registerMotion` and new `src/vscode/match.ts:MatchController`.
- **Depends on:** Task 8, Task 16.
- **RED:** Add editor-command integration cases for delayed `miw` followed by `d`, word motion, navigation, and mode changes.
  Include `miw<Escape>` during helper work and `mr(d` without a surrounding pair.
  Use temporary test command registrations and bindings until Task 19 supplies the default bindings.
  Proposed command: `npm run test:match:integration`.
- **GREEN:** Preserve existing motion and edit queues; integrate match commands through the same shared queue.
  Complete ordering coverage for other text/selection-dependent extension commands without duplicate queue wrappers.
  Capture execution snapshots inside the queue and preserve input-time editor/session identity.
  Track selection generations and command-owned preview events.
  Cancel invalid ownership on external selection, mode, or editor changes; preserve input on focus loss alone.
  Keep completed queued commands intact when a later Escape consumes ordinary NORMAL input.
  Replay failed-preview buffered keys through the same command dispatcher used by ordinary input.
  Restrict replay to reference lookup failures. Infrastructure errors, stale previews, and cancellation discard buffered input.
  Route NORMAL Escape as a queued count-clearing selection no-op; do not delegate it to native Escape.
  Validate all freshness fields before visible application.
- **REFACTOR:** Remove duplicate queue wrappers without nested waits or queue deadlocks.
- **Verification:** Run the new integration command with delayed helper responses and real renderer input.
  `miwd` must delete the selected word; a mouse move or editor switch must defeat a stale response.
  Delayed `miw<Escape>` must select the word; failed `mr(d` must run the trailing ordinary delete command.
  Fast `miw<Escape>` must also keep the word selected. A failed helper during `mr(d` must never run ordinary delete.
  Existing word motions, character motions, navigation, `gw`, and mode switching must retain behavior.
- **Prerequisites:** Task 7 client/selection boundary and Task 16 reducer.
  This task creates the proposed integration script and its editor-command suite.

### Task 18: Apply native surround edits with existing history

- **Requirements:** FR-4, FR-5, FR-6, FR-7, FR-11, FR-12.
- **Design references:** Freshness and commit contract; surround edits and history.
- **Entry point:** `MatchController` proposal application and `src/vscode/history.ts:UndoHistory` integration.
- **Depends on:** Task 12, Task 14, Task 15, Task 17.
- **RED:** Extend real-editor tests with add, replace, delete, failed commit, concurrent changes, `u`, `U`, and native undo.
  Command: `npm run test:match:integration`.
- **GREEN:** Validate a proposal, apply one supported version-protected native transaction, and honor its success result.
  Observe the actual native event before acknowledging synchronization or installing post-edit selections.
  Coordinate `hold()` and `commit()` so failed edits create no revision.
  Skip stale selection installation after a concurrent post-commit change.
  Ensure `c` and `d` consume match selections correctly across projection boundaries.
- **REFACTOR:** Reuse native edit and history coordination without changing existing INSERT-session behavior.
- **Verification:** Each surround command must undo and redo in one Helix-style revision.
  Concurrent edits must survive. Rejected proposals must never move selections or duplicate text.
  Read-only commands must reject before preview or history changes.
- **Prerequisites:** Native surround proposals, Task 17 controller, and Task 1 validated edit API.

### Task 19: Route real keyboard input and show pending state

- **Requirements:** FR-1 through FR-8, FR-12, NFR-5.
- **Design references:** UI-1 and UI-2; input ownership; deployment minimum VS Code version.
- **Entry point:** `scripts/keybindings.cjs:createKeybindings` and `src/vscode/presentation.ts:Presentation`.
- **Depends on:** Task 10, Task 11, Task 18.
- **RED:** Add real-keyboard cases for all six actions, symbols, Enter, Unicode, counts, Escape, and `gw` coexistence.
  Cover modified characters, non-character callbacks, failed-preview replay, and retained input after focus loss.
  Command: `npm run test:match:integration`.
- **GREEN:** Generate scoped bindings and implement the input mechanism validated in Task 1.
  Route characters by logical value. During callback phases, match input overrides ordinary edit and digit commands.
  During the action-menu phase, digits keep routing to `Count` under the pinned digit rules.
  Capture modified characters during callbacks; keep native shortcut behavior outside pending match input.
  Bind NORMAL Escape explicitly to the queued selection no-op and count clear, including read-only editors.
  Exclude native popup contexts from the idle Escape binding so hover, peek, diagnostics, suggestions, hints, and rename UI can close.
  Verify supported context keys in VS Code source; retain phase-specific Escape ownership during pending match callbacks.
  Add pending and working status text with accessible tooltip content.
  Register and dispose all commands and contexts through activation lifecycle.
- **REFACTOR:** Keep generated bindings and command registration data consistent without a second keymap authority.
- **Verification:** Run `npm run generate:keybindings`, `npm run check:keybindings`, `npm test`, and `npm run test:match:integration`.
  Run keyboard cases on the minimum supported VS Code and current stable.
  Use at least US and a non-US layout, including non-ASCII surround input and composition where supported.
  Confirm INSERT typing, native shortcuts outside pending input, read-only behavior, and status accessibility.
  Open a hover in NORMAL and verify Escape closes it while preserving the match selection.
  Repeat popup-dismissal checks for peek and diagnostic-navigation UI without letting the idle binding steal Escape.
- **Prerequisites:** Task 18 controller and prior native actions. Extend existing `Keyboard` punctuation and Unicode support in this task.

### Task 20: Recover safely from process and runtime failures

- **Requirements:** FR-12, FR-14, NFR-3, NFR-4, NFR-5.
- **Design references:** Recovery; failure model F-1 through F-11.
- **Entry point:** `MatchClient` lifecycle and `MatchController` cancellation handlers.
- **Depends on:** Task 19.
- **RED:** Add fault-injection cases for crash, timeout, invalid frames, missing assets, stale tokens, and epoch reuse.
  Command: `npm run test:match:integration`.
- **GREEN:** Make cancellation release previews and resources according to current ownership.
  Resnapshot after explicit restart; never replay a failed mutation automatically.
  Stop repeated automatic startup attempts and preserve already committed native edits.
  Preserve the acknowledged parser-disable state for each current document generation after restart.
  Keep other extension commands usable while match support is unavailable.
- **REFACTOR:** Unify failure cleanup and sanitized error reporting.
- **Verification:** Kill the helper before preview, before commit, and immediately after a successful commit.
  No test may lose, duplicate, or roll back user text.
  Closing documents and unloading the extension must leave no child process or pending request.
  A slow helper must not block native editor interaction or immediate cancellation.
- **Prerequisites:** Task 19 complete editor flow and test-controlled process faults.

### Task 21: Produce auditable native target packages

- **Requirements:** FR-13, NFR-1, NFR-3, NFR-4, NFR-6, NFR-7.
- **Design references:** Deployment; runtime contract; upstream upgrade procedure.
- **Entry point:** `package.json`, `.vscodeignore`, and new platform build/package workflow.
- **Depends on:** Task 20.
- **TDD:** Distribution verification replaces a behavior RED/GREEN cycle.
- **Work:** Set workspace extension placement and build every declared native target.
  Package the correct helper, ABI-compatible grammar libraries, complete runtime, compatibility manifest, and notices.
  Use dynamic musl linkage for Alpine and exclude `native/target/**` and other targets' build output from each VSIX.
  Create `npm run test:match:package` to inspect and smoke-test a target VSIX.
  Keep source and notice links available according to the dependency audit.
  Prevent runtime installation hooks or downloads.
- **Verification:** Run `npm run check:helix-runtime`, `npm run package:vsix`, and `npm run test:match:package` for each target build.
  Install each VSIX offline on its actual OS, architecture, and libc family.
  Run one plaintext object, one syntax object, an injection, a surround edit, and a Git object.
  Test SSH or container placement and a browser client with a remote Node host.
  A browser-only host must expose unavailable match support without attempting native execution.
  Check executable permissions, shared-library dependencies, paths with spaces, and case-sensitive asset names.
  Load and execute grammar queries inside Alpine on both declared Alpine architectures.
- **Prerequisites:** All feature and recovery tasks; native target runners and required signing or distribution tools where applicable.
  This task creates the package verification command. Publishing is outside this plan.

### Task 22: Certify the complete parity matrix

- **Requirements:** FR-1 through FR-14, NFR-1 through NFR-7.
- **Design references:** Verification Design; compatibility definition; traceability.
- **Entry point:** New differential runner and release evidence under `test/fixtures/helix-match/`.
- **Depends on:** Task 3, Task 10, Task 11, Task 21.
- **RED:** Add a matrix completeness check that fails for one omitted object, grammar, target, or unexplained mismatch.
  Proposed command: `npm run test:match:parity`.
- **GREEN:** Compare real pinned command results with native process results and installed editor results.
  Cover every inventory row, available capture, and required edge family.
  Add deterministic generated multi-selection and transaction cases with saved seeds and minimized failures.
  Track legitimate unsupported captures separately from broken assets.
- **REFACTOR:** Reduce duplicated fixtures while retaining provenance and coverage.
- **Verification:** Run the complete final verification below with zero unexplained semantic mismatches.
  Record resource measurements and the exact tested runtime, platform, VS Code, and input-layout identities.
  Update user documentation with the supported parity domain and operational limits.
  Do not describe finite testing as a mathematical proof of all possible inputs.
- **Prerequisites:** All prior tasks and platform runners. This task creates the proposed parity command.

## Task Order and Gates

Task 1 is the architecture go/no-go gate.
Task 2 establishes a locked source and runtime foundation.
Tasks 3 and 4 can proceed independently after Task 2.
Tasks 5 through 10 build the process, synchronization, selections, and object families.
Task 11 follows syntax support. Tasks 12 through 15 implement native surround behavior.
Task 16 can proceed after Task 3, independently of native object work.
Tasks 17 through 20 integrate ordering, native edits, keyboard input, and recovery.
Tasks 21 and 22 establish distribution and complete parity evidence.

Completed tasks must keep the existing extension buildable and preserve its established behavior.
Do not repair unrelated baseline failures as hidden match work.
Do not release partial language coverage under the complete parity claim.

## Requirement Coverage

| Requirement | Tasks | Observable verification |
|---|---|---|
| FR-1 | Task 8, Task 9, Task 10, Task 19, Task 22 | Inside-object process and real-keyboard differential results. |
| FR-2 | Task 8, Task 9, Task 10, Task 19, Task 22 | Around-object process and real-keyboard differential results. |
| FR-3 | Task 11, Task 19, Task 22 | Syntax-aware and plaintext `mm` comparisons. |
| FR-4 | Task 1, Task 12, Task 18, Task 19, Task 22 | Add-surround output, Unicode input, Enter, and undo. |
| FR-5 | Task 13, Task 14, Task 18, Task 19, Task 22 | Exact preview, continuation, cancellation, and replacement. |
| FR-6 | Task 15, Task 18, Task 19, Task 22 | Delete-surround transaction and all-selection failure. |
| FR-7 | Task 1, Task 7, Task 8, Task 18, Task 22 | Unicode/CRLF projection, normalized ranges, primary selection, and downstream edits. |
| FR-8 | Task 8, Task 16, Task 17, Task 19, Task 22 | Count consumption, pending keys, rapid input, and `gw` coexistence. |
| FR-9 | Task 2, Task 6, Task 9, Task 22 | Complete runtime inventory and updated injection results. |
| FR-10 | Task 1, Task 10, Task 22 | Exact unsaved HEAD-based change objects. |
| FR-11 | Task 18, Task 22 | One-step `u`/`U`, native undo, and no failed revisions. |
| FR-12 | Task 4, Task 6, Task 7, Task 13, Task 17, Task 18, Task 20 | Version, epoch, ownership, continuation, and concurrent-edit rejection. |
| FR-13 | Task 1, Task 2, Task 5, Task 21, Task 22 | Offline target VSIX installations and native-host placement. |
| FR-14 | Task 5, Task 6, Task 13, Task 20, Task 22 | Explicit restart, snapshot recovery, close, and disposal. |
| NFR-1 | Task 2, Task 3, Task 4, Task 21, Task 22 | Locked identity, source provenance, and package manifests. |
| NFR-2 | Task 1, Task 2, Task 3, Task 8 through Task 15, Task 22 | Minimal upstream adapter inventory and independent differential results. |
| NFR-3 | Task 4, Task 5, Task 20, Task 21 | Local pipes, no document logs, no runtime network. |
| NFR-4 | Task 2, Task 9, Task 10, Task 20, Task 21 | Isolated runtime and upstream Git trust behavior. |
| NFR-5 | Task 1, Task 5, Task 6, Task 17, Task 19, Task 20 | Measured asynchronous behavior and immediate invalidation. |
| NFR-6 | Task 2, Task 3, Task 9, Task 21, Task 22 | Complete language, capture, grammar, and target matrices. |
| NFR-7 | Task 2, Task 21, Task 22 | Notices, source availability, and upstream patch audit. |

## Final Verification

The following commands are proposed for execution after their creating tasks.
They were not run during planning.

```sh
npm run check:keybindings
npm test
cargo test --locked --manifest-path native/Cargo.toml --workspace
npm run check:helix-runtime
npm run test:match:oracle
npm run test:match:parity
npm run test:integration
npm run test:match:integration
npm run package:vsix
npm run test:match:package
```

Prerequisites include the locked native build, complete pinned runtime, oracle, VS Code, target runners, Git fixtures, and display facilities.
Use `xvfb-run -a` for Linux editor tests in a headless environment.
Use `VSCODE_EXECUTABLE_PATH` to test a supported installed Electron executable, as the existing runner permits.
Keep the minimum-version and current-stable runs separate in release evidence.

The package script must receive its target through documented build configuration from Task 21.
For every target, retain installation results and helper/runtime compatibility identities.
Do not treat current-host success as evidence for another platform.

Final observable checks:

- Every match command and object code has a comparison against real pinned Helix.
- Every configured language and required grammar appears in the audited inventory.
- Intermediate replacement selections and cancellation match the reference.
- Counts, modified characters, non-character keys, Unicode input, and rapid sequences preserve command order.
- Failed-preview replay and Escape after completed commands match the reference.
- Infrastructure preview failures discard buffered characters without destructive replay.
- Reference parser failures, query failures, and persistent syntax-disable state match the reference.
- Stale results and failed native edits cannot overwrite text or later selections.
- Existing `gw`, motion, mode, edit, navigation, and history tests retain their established results.
- Each successful surround operation undoes and redoes as one revision.
- Offline installed packages run without Rust, Helix, or downloaded grammars.
- Runtime shadowing, untrusted Git execution, process faults, and disposal checks pass.
- Resource measurements and all unexecuted or unavailable checks remain explicit.

Implementation must stop before publication or any separately authorized release action.
