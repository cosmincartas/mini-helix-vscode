# Pinned Helix line-selection oracle

Expected values in `line-selection-oracle.json` are captured from the real
Helix `Application` event loop at revision
`ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`. They are not calculated by the
extension's TypeScript implementation. The checked-in corpus lets ordinary
`npm test` run without Rust, a Helix installation, or network access.

Exact VS Code replay requires `editor.multiCursorMergeOverlapping=false`.
VS Code's default merges a valid Helix EOF cursor touching another range;
that configuration cannot demonstrate complete selection-set parity. The
extension never changes the setting automatically. Host tests use an isolated
profile and demonstrate both settings; consult the delivery task record for
the exact executed host versions and results.

## Regenerate and verify

Install a Rust toolchain satisfying the pinned Helix manifest and its native
build prerequisites. Supply a Git checkout at the exact revision:

```sh
git clone https://github.com/helix-editor/helix.git /tmp/helix-line-source
git -C /tmp/helix-line-source checkout ba40e547426b0f9896c8bdc699a4ab11f2b37dbc
node scripts/helix-line-oracle.cjs --helix-root /tmp/helix-line-source
node scripts/helix-line-oracle.cjs --helix-root /tmp/helix-line-source --check
npm test
```

Generation rejects a different checkout HEAD. It archives the pinned Git commit
into a fresh temporary directory, so uncommitted checkout modifications do not
change expected values. It adds a temporary Rust integration target that uses
the pinned `helix-term/tests/test/helpers.rs::test_key_sequences`, drives real
key events and records document text, directed ranges, and the primary index
after each command. Count digits are grouped with the command they prefix.
It disables word-completion indexing in test configuration because global
per-document hooks otherwise survive between fresh Applications with reused
document IDs; this does not replace or alter the line commands. It disables
automatic tree-sitter grammar downloads/builds, which plain-text cases do not
need, uses a 1 ms idle-event delay instead of the interactive 250 ms delay for
these synchronous commands, and isolates Helix's config directory. It preserves the supplied source
checkout and removes the generation directory after completion or failure.

Rust's build cache defaults to `~/.cache/helix-oracle/target`. Set
`CARGO_TARGET_DIR` to choose another cache. The initial build can take time;
ordinary extension tests never run the generator.

## Schema and coverage

Schema version 1 records `revision`, `coordinates: "utf16-gap"`, and cases with
an identifier, input document, complete key sequence and ordered command
snapshots. Each document contains text, directed `{anchor, head}` ranges, and
an explicit `primaryIndex`. The generator converts UTF-16 input gaps to Helix
Unicode scalar indices, then converts actual Helix output back to UTF-16.
Validation rejects malformed schemas, out-of-bounds or surrogate-interior
offsets, empty range sets, invalid primary indices, duplicate IDs, and incomplete
command snapshots. Unit tests exercise those validation failures.

The input matrix lives in `scripts/helix-line-oracle.cjs::matrix`. It covers
empty and single-line text; LF, CRLF and lone CR; missing final newline and
final empty lines; indentation and consecutive blanks; astral, combining and
emoji graphemes; partial, full-line, reversed and multiline input; repeated and
mixed `x`/`X`; counted and saturated input; unsorted, overlapping, nested,
duplicate, touching and transitive selections; every possible primary for
normalization cases; EOF points touching ranges; count cancellation; and
`xd`, `xc<esc>`, `xdu`, `xc<esc>u`, `Xd`, `Xc<esc>u`, and `dx`.

The pure replay imports the production line core and existing edit core, and
compares every recorded command snapshot. Its edit replay maps the host's empty
caret representation back to Helix block ranges; undo restores the pre-edit
document/selection snapshot. Real VS Code tests own native undo, queue ordering,
keyboard dispatch, input contexts, read-only state and configuration behavior.
Host-state cases are not simulated by Rust. See `helix-selection-upstream.md`
for the separately imported upstream unit-test inventory.

## Source and attribution

Helix contributors, [Helix editor](https://github.com/helix-editor/helix),
[MPL-2.0 license](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/LICENSE).
Pinned sources used by generation:

- `helix-term/src/commands.rs`: `extend_line_impl`, `extend_to_line_bounds`, and follow-on edit commands.
- `helix-term/src/keymap/default.rs`: default `x` and `X` bindings.
- `helix-core/src/selection.rs`: input normalization and range invariants.
- `helix-term/tests/test/helpers.rs`: the real integration event loop and test application configuration.

The oracle supplements the two upstream `test_extend_line` cases, especially
for `X`, which has no dedicated upstream command fixture at the pinned revision.
No expected result is derived from a current-main source or another revision.
