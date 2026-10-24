# Task 9: match syntax objects and injected languages (worker #14)

Plan Task 9 (FR-1, FR-2, FR-9, NFR-2, NFR-4, NFR-6). `evaluate` now answers the seven capture objects (`t f a c T e x`, inside and around)
through the pinned `textobject_treesitter`, with the language, injection layers and query cache of the replica's pinned `Loader`. No Helix
algorithm is written here. `g` (Git hunk) stays `object_not_implemented` (Task 10).

## Design
- `evaluate/textobjects.rs`: `Environment` gains the `Loader`; `CAPTURE_OBJECTS` is the table `t f a c T e x` -> `class function parameter comment test entry xml-element`;
  one `treesitter` closure (as upstream) returns the range unchanged without syntax. No per-language code.
- `documents/mod.rs`: `ReplicaView.loader`; `pub mod language`.
- `documents/language.rs`: completed mapping (below).
- Failure behaviour is the pinned code's own, reached through the shared lazily-compiled `Loader` (`LanguageData::syntax_config` / `textobject_query`): a broken
  `textobjects.scm` -> `textobject_query` is `None` (objects no-op, syntax and pairs stay available); a broken root `highlights/injections/locals.scm` -> `Syntax::new`
  fails -> `initial_failure` (objects no-op, pairs plaintext); a broken injected-language config -> only that layer is affected. 500 ms `PARSE_TIMEOUT` is the pinned
  constant (helix-core syntax.rs:518) used by `Syntax::new/update`; the helper never passes another timeout. Update failure stays sticky (Task 6 code, re-tested end to end).

## Adapter inventory (pinned ba40e547426b0f9896c8bdc699a4ab11f2b37dbc, tree `native/upstream/helix`; same table in `evaluate/textobjects.rs`)
| Upstream symbol | file:line | Use |
|---|---|---|
| `textobject_treesitter` closure in `select_textobject` | helix-term/src/commands.rs:6273-6279 | `treesitter` closure (adapted: `doc.syntax()`/`syn_loader` come from the replica) |
| object table rows `t f a c T e x` | helix-term/src/commands.rs:6308-6314 | `CAPTURE_OBJECTS` |
| `textobject::textobject_treesitter` | helix-core/src/textobject.rs:258 | called unchanged |
| `Loader::textobject_query` | helix-core/src/syntax.rs:415 | reached through the above |
| `Syntax::new` / `Syntax::update`, `PARSE_TIMEOUT` | helix-core/src/syntax.rs:518/521/526 | called by `documents` (Task 6) |
| `Document::detect_language_config` | helix-view/src/document.rs:1212 | mirrored by `language::resolve` (path required, glob/extension, then shebang) |
| `:set-language text` / `DEFAULT_LANGUAGE_NAME` | helix-term/src/commands/typed.rs:2420 | NOT the basis for VS Code `plaintext` (corrected: `plaintext` is detected like an unknown id; see Correction) |
| `Loader::language_for_filename/for_shebang/for_name` | helix-core/src/syntax.rs:339/377/391 | called unchanged |
| `textobject_change` (`g`) | commands.rs:6281-6301 | NOT YET (Task 10) |

## Language mapping (documented decisions)
Order: (1) alias table; (2) pinned `language_for_name`; (3) pinned detection with a path: `language_for_filename` (glob, longest wins; then extension), then `language_for_shebang`; (4) none. `plaintext` is not special-cased (corrected, see Correction): VS Code sends it for files it does not recognise, so it goes through steps 1-3 like any unknown id; only an untitled plaintext buffer (no path) resolves to no language. An untitled buffer has no path: upstream
`detect_language_config` returns before the shebang lookup, so none is done (changed from Task 6, which detected shebangs on untitled buffers; see compat edits). Paths: client local path, else the
percent-decoded URI path (`/c:/x` -> `c:/x`, `file://host/share` -> UNC, `untitled:` none); Windows drive/UNC backslashes become `/`. `content_regex` does not exist in the pinned
`languages.toml` (0 occurrences) nor in the loader (TODO at syntax.rs:381), so there is no conflict rule beyond the pinned glob/extension order.

Alias table (26 rows, every target checked against the loader; no key is a Helix name; every Helix LSP `language-id` that differs from the name is a row):
javascriptreact->jsx, typescriptreact->tsx, shellscript->bash, csharp->c-sharp, makefile->make, dockercompose->docker-compose, dockerbake->docker-bake, bat->batch, terraform->hcl,
terraform-vars->tfvars, ignore->git-ignore, restructuredtext->rst, jade->pug, cuda-cpp->cpp, tex->latex, github-actions-workflow->github-action, qmd->quarto, rmd->rmarkdown,
robotframework->robot, proto3->protobuf, django-html->htmldjango, go.mod->gomod, go.work->gowork, ocaml.interface->ocaml-interface, dotenv->env, nushell->nu.
Ambiguous ids tested: jsonc (exact name), ignore, dockercompose, terraform, terraform-vars; id beats file name (`json` on tsconfig.json stays json; unknown id on tsconfig.json -> jsonc by glob).

## Tests (all differential expectations come from oracle fixtures)
`native/match-helper/tests/textobjects_syntax.rs` (+ `common/{mod,oracle}.rs`): 8 tests without, 9 with `--features test-support`.
- every in-scope oracle case with a language or a capture key (plain build 304 cases, 687 evaluate requests, 525 selection-changing, 18 mirrored `change` edits; test-support build 315 / 722 / 543 / 24) is replayed:
  selections, primary, status category, text after each edit step, and the helper syntax state vs the oracle parser state after every step. Edit/motion steps (`d`, inserts) are mirrored as one `change` event computed from the oracle text.
- Failure injection by query type uses a runtime overlay (hard-linked grammars, copied queries, regenerated manifest so integrity verification passes; the unchanged pinned compilation fails): textobjects.scm (rust, inherited ecma, `_jsx`; own and in a markdown fence / html script), root highlights/injections/locals (rust; ecma-inherited; markdown root), injected rust/ecma/css configs (markdown fence, html script/style) incl. edits afterwards, empty and capture-less textobjects.scm. Parser failures: initial-parse (4 cases) and update failure after an edit (5 cases + control) via the test-support helper (11 cases skipped, and printed, in a build without the feature); sticky/recovery test `update_failure_disables_syntax_for_good_and_only_a_language_change_recovers`.
- Results: textobjects.scm failure -> objects unavailable, syntax available, pairs syntax-backed (oracle `available`, string-aware pairs). Root highlights/injections/locals failure -> `initial_failure`, objects and pairs as plaintext (all 3 + ecma/markdown inheritance). Injected-language failure -> markdown prose pairs still syntax-backed, fence objects as the oracle reports (membership/behaviour compared through objects; layer lists are in the fixtures). All equal to the oracle.
- Language mapping: `language_mapping_end_to_end` (all 26 aliases, ambiguous ids, extensions/globs, shebangs with a path, untitled, plaintext with a detectable path (zig, nix, Cargo.lock, shebang), plaintext untitled/unknown extension, percent-decoded and Windows URIs, local path vs URI, wren no_grammar), `language_changes_rebuild_the_syntax_and_objects_follow` (configure plaintext<->rust<->typescriptreact), plus 6 unit tests in `language.rs`.
- Aliases: `aliases_reach_the_same_objects_as_the_helix_language_id` replays 24 fixture cases with VS Code ids (typescriptreact, javascriptreact, shellscript, csharp, cuda-cpp, dockercompose, dotenv, proto3, terraform).
- Capture inventory: `every_configured_language_is_in_the_capture_inventory_and_the_loader_agrees`: 342 languages == helix-inventory.json names/order; 154 with a compiled textobjects query (all 154 with captures), 180 without a query, 8 without a grammar library; 2156 (language x capture) pairs of the loader equal the inventory (`capture_nodes` availability). `every_language_opens_through_the_protocol_with_the_inventory_state`: all 342 opened by Helix name (334 `available`, 8 `no_grammar`: wren, gemini, mint, llvm-mir-yaml, idris, cabal, bovex, qmv), 1098 capture requests (all listed families, inside and around) accepted as no-ops on an empty document.
- Not covered: 6 languages without a grammar definition cannot be run in the oracle (it requires a tree); they are covered by the protocol sweep only. The real 500 ms timeout is not exercised (host-timing dependent; spec says test separately): only the pinned constant is used. Exhaustive per-language positive fixtures: Task 22.

### Fixture coverage (positive fixtures; language = smallest layer at the primary range)
function 29 (bash c c-sharp cmake cpp dart elixir fish glsl go haskell java javascript jsx julia kotlin lua nix ocaml perl php python ruby rust scala swift tsx typescript zig); class 23 (c c-sharp cpp css dart elixir go haskell java javascript jsx julia kotlin php protobuf python ruby rust scala swift tsx typescript zig);
parameter 19 (bash c c-sharp go haskell java javascript kotlin lua nix ocaml php python ruby rust swift tsx typescript zig); comment 10 (clojure crystal eiffel elm env hocon prisma rust solidity sql);
test 7 (dart elixir go julia python rust zig); entry 20 (bash c css docker-compose git-config graphql hcl java javascript json json5 lua nix python ruby rust toml tsx typescript yaml); xml-element 8 (blade html jsx svelte templ tsx vue xml).
Comment note: in languages with the `comment` injection (most) a cursor inside a comment is in the `comment` layer, which has no textobjects query, so `mic/mac` are no-ops there (the known upstream quirk, generalised); positives use languages without that injection. Absent-capture cases: toml `mic`, bash `mia` around, markdown, `T`/`x` in languages without them.
Pairs: 29 root cases (string/char/comment/regex/raw-string/triple-quote/template delimiters in rust, js, python, c, json, yaml, toml, bash, html, markdown, css, go) and 60+ injected/nested cases (markdown fences rust/js/python/json/toml/yaml/bash/html/tsx, html script/style/attributes, vue/svelte, rust doc/regex/macros, js template/jsdoc/regex, php, yaml, front matter), 17 edit cases.

## Files
See `file-hashes.txt` (SHA-256). New oracle cases: `test/fixtures/helix-match/cases/syntax-objects-2.json` (246) and `syntax-failure-2.json` (39), `expected` produced only by `npm run test:match:oracle -- --filter <group>/ --update`; the 9 pre-existing case files are byte-identical (`logs/fixtures-unchanged.txt`). Scratch generator of the case inputs: `oracle-case-input-generator.cjs.txt`. The oracle was not changed.

## Compatibility edits (outside the primary write scope; minimal)
- `native/match-helper/tests/textobjects_plain.rs` L258: only `g` still answers `object_not_implemented` (capture keys are now no-ops on a plaintext replica).
- `test/unit/matchEvaluate.test.ts` L395: the `object_not_implemented` example key `f` -> `g`.
- `test/unit/matchSync.test.ts` L497-500: shebang detection example uses a path (`file:///w/script`); an untitled buffer with a shebang now resolves to no language (decision above).
- `src/native/protocol.ts`: comment only.

## Verification (logs/)
RED `red-1-capture-arms-disabled.txt`: capture arms temporarily returning `object_not_implemented` -> 5 of 8 tests fail (the mapping and inventory tests were written against the finished language code; there is no separate RED for them: honest). GREEN: `green-textobjects_syntax-{plain,test-support}.txt`; `final-crate-{plain,test-support}.txt` (all pass); `final-check-helix-runtime.txt` OK; `final-oracle.txt` 552 PASS 0 FAIL; `final-compare-cargo-lock.txt` 0 deviations (native/Cargo.lock untouched, no new dependency); `final-check-keybindings.txt`; `final-npm-test.txt` 166/166, 0 skipped (strict real helper). Mutation `mutation-f-to-class.txt`: `f` mapped to `class` -> 3 tests fail (step-by-step, alias, language change), source restored (cmp). Baseline: only `package.json` differs (pre-existing).

## Incident
While writing the overlay helper, the first version hard-linked the whole runtime, including `manifest.json`, and then wrote the overlay manifest through the link, overwriting the REAL `native/runtime/out/linux-x64/runtime/manifest.json`. Detected by a failing run; restored by recomputing the asset checksums from disk: the restored file's SHA-256 equals `manifestSha256` in `native/helix-lock.json` (1adc4aa0...), `check:helix-runtime` OK, `npm run build:match` OK. The overlay now links only grammars and licenses and copies queries and the manifest.

## Pending for Task 22 / later
Exhaustive per-language positive fixtures (this task records which languages have positives); real-timeout test; layer-membership comparison in helper (oracle `layersAtPrimary` is stored but the helper does not expose layers); languages without a grammar definition in the oracle; `g` (Task 10); other platforms (linux-x64 only).

## Correction (task #47: P9R-1 and P9R-2; evidence in `correction/`)
- P9R-1 [P2] `plaintext` early return removed from `documents/language.rs::resolve`: `plaintext` now goes through alias (none), `language_for_name` (none), then the pinned path (glob/extension) and shebang detection exactly as upstream `Document::detect_language_config`; an untitled plaintext buffer has no path and still resolves to no language. Module doc, `PLAINTEXT` doc and the "Language mapping" decision above updated. The earlier rationale (`:set-language text`) was wrong for this client: that command is a user action in Helix, whereas VS Code reports `plaintext` for every unrecognised file.
  Tests: unit `resolution_order_alias_name_path_shebang_plaintext` (plaintext + /w/main.zig -> zig, Cargo.lock -> toml, shebang with a path -> python, unknown extension -> none, untitled -> none, file name before shebang); `textobjects_syntax.rs::language_mapping_end_to_end` (plaintext + main.zig, flake.nix, Cargo.lock, localPath, shebang, unknown extension, extension-less plain text, untitled with/without shebang); new `plaintext_with_a_detectable_path_reaches_the_same_objects_as_the_language` replays the oracle cases `syntax-objects-2/function-zig`, `syntax-objects-2/function-nix`, `syntax-objects/rust-mif` and `syntax-objects-2/function-python` with `languageId: "plaintext"` and a file URI (`.zig`, `.nix`, `.rs`, `.py`): helper selections, status and syntax state equal the oracle at every step, and the oracle's mif/maf changed the selection (so the object really was selected through the detected language). The oracle's input has only a Helix language id (no path), so no new oracle case is needed or possible: the expected values are the existing oracle-generated ones for that language (no fixture changed; `fixtures` untouched).
  Locked-old-behaviour assertions updated: `language.rs` unit test, `textobjects_syntax.rs` L478-480, `test/unit/matchSync.test.ts` (host default URI `.rs` -> `.txt`, because `plaintext` + `.rs` is now rust; the reconfigure test's final `plaintext` on `/w/lib.py` now expects `available`; new zig/untitled assertions), and (outside the listed scope, same class) `native/match-helper/tests/documents.rs::syntax_states_follow_the_upstream_lifecycle`, which opened `plaintext` at a `.rs` path and expected `no_language` (now `available`, plus an untitled plaintext document expecting `no_language`).
- P9R-2 [P3] `state_matches` no longer accepts any of the three unavailable reasons: `expected_helper_state(case, step)` derives the exact state from the case input (no language -> no_language; wren/gemini -> no_grammar; `failure.kind == initial-parse` or a queryOverride of highlights/injections/locals on the root language or a query it inherits (ecma/_jsx/_typescript) -> initial_failure; after an `incremental-parse` failure step -> update_failure; otherwise available, so injected-layer-only and textobjects-only failures stay available), asserted with `assert_eq!` at open and after every step; the oracle's coarse state must still agree. Mutation `correction/mutation-root-failure-no-grammar.txt`: `build_syntax` mapping a failed `Syntax::new` to `NoGrammar` makes the differential test fail on `syntax-failure-2/query-root-highlights-rust` (`no_grammar` vs `initial_failure`); `documents/mod.rs` restored (SHA-256 verified equal to the pre-mutation hash). The previous `state_matches` accepted that mutation.
- Verification (`correction/`): `crate-test-support.txt`, `crate-textobjects_syntax-plain.txt`, `oracle.txt` (OK), `npm-test.txt` (166/166, strict real helper), `check-helix-runtime.txt`, `compare-cargo-lock.txt`, `baseline-hashes.txt` (only the pre-existing `package.json` difference), manifest SHA-256 `1adc4aa0...` unchanged. Updated `file-hashes.txt`.
