# Pinned Helix line-selection imports

Source revision: `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.
Upstream project: [Helix](https://github.com/helix-editor/helix).
The imported algorithms and test cases are from Helix contributors, licensed
under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/).
Their source files remain available at the immutable links below. TypeScript
ports retain this license; other existing repository files are unaffected.

| Upstream source and group | Imported assertions/cases | Destination |
|---|---:|---|
| [helix-core/src/selection.rs — test_overlaps](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-core/src/selection.rs#L975) | All 31 original overlap assertions | `test/unit/lineSelection.test.ts`: upstream test_overlaps |
| [helix-core/src/selection.rs — test_line_range](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-core/src/selection.rs#L1236) | All 18 original CRLF range assertions | `test/unit/lineSelection.test.ts`: upstream test_line_range |
| [helix-core/src/selection.rs — test_create_normalizes_and_merges](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-core/src/selection.rs#L894) | Both original inputs/results, including the transitive-primary assertion | `test/unit/lineSelection.test.ts`: upstream test_create_normalizes_and_merges |
| [helix-core/src/selection.rs — test_create_merges_adjacent_points](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-core/src/selection.rs#L936) | The complete original five-range input and result | `test/unit/lineSelection.test.ts`: upstream test_create_merges_adjacent_points |
| [helix-term/tests/test/commands.rs — test_extend_line](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-term/tests/test/commands.rs#L324) | Both `x2x` and `2x` cases, unchanged annotated text/results | `test/unit/lineSelection.test.ts`: upstream test_extend_line |

No imported case is skipped or assigned a changed expected result. Additional
assertions check primary identity where the original test only checks ranges.

`test/unit/upstreamHelix.ts` ports
[helix_core::test::print](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-core/src/test.rs#L36),
including display-newline skipping, sorting/merging, and primary tracking.
Coordinates are converted to UTF-16 by constructing the exact text while parsing.
It intentionally does not change the existing round-trip parser in `helix.ts`.

`src/core/lineSelection.ts` ports `Range::line_range`, `Range::overlaps`,
`Range::merge`, `Selection::normalize`, and selection invariants from selection.rs,
and `extend_line_impl` (Below) / `extend_to_line_bounds` from
[helix-term/src/commands.rs](https://github.com/helix-editor/helix/blob/ba40e547426b0f9896c8bdc699a4ab11f2b37dbc/helix-term/src/commands.rs#L2813).
The pinned Cargo configuration disables Ropey's default line-ending features;
lone CR is content, while LF and CRLF delimit lines. This differs from VS Code's
lone-CR document interpretation, so the core uses LF-only access in that case.
