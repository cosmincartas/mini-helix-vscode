#!/usr/bin/env node
/* Independent oracle: invokes pinned Helix's real integration event loop.
 * Helix source is MPL-2.0; generated harness uses its public test helpers.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REVISION = 'ba40e547426b0f9896c8bdc699a4ab11f2b37dbc';
const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'test/fixtures/line-selection-oracle.json');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error) { throw result.error; }
  if (result.status !== 0) { throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout || ''}${result.stderr || ''}`); }
  return result.stdout;
}

/** Offsets at surrogate interiors are invalid rather than silently rounded. */
function characterOffset(text, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length ||
      (offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]))) {
    throw new Error(`Invalid UTF-16 gap ${offset} in ${JSON.stringify(text)}`);
  }
  return Array.from(text.slice(0, offset)).length;
}

function utf16Offset(text, offset) {
  const chars = Array.from(text);
  if (!Number.isInteger(offset) || offset < 0 || offset > chars.length) { throw new Error(`Invalid Helix character gap ${offset}`); }
  return chars.slice(0, offset).join('').length;
}

function validateDocument(document, id) {
  if (typeof document.text !== 'string' || !Array.isArray(document.ranges) || !document.ranges.length ||
      !Number.isInteger(document.primaryIndex) || document.primaryIndex < 0 || document.primaryIndex >= document.ranges.length) {
    throw new Error(`Invalid oracle document: ${id}`);
  }
  for (const range of document.ranges) { characterOffset(document.text, range.anchor); characterOffset(document.text, range.head); }
}

function validateCorpus(corpus) {
  if (corpus.schemaVersion !== 1 || corpus.revision !== REVISION || corpus.coordinates !== 'utf16-gap' || !Array.isArray(corpus.cases) || !corpus.cases.length) {
    throw new Error('Invalid oracle schema, revision, or coordinates');
  }
  const ids = new Set();
  for (const item of corpus.cases) {
    if (typeof item.id !== 'string' || ids.has(item.id) || typeof item.keys !== 'string' || !Array.isArray(item.steps) || !item.steps.length) {
      throw new Error(`Invalid or duplicate oracle case: ${item.id}`);
    }
    ids.add(item.id);
    validateDocument(item.input, item.id);
    for (const step of item.steps) { validateDocument(step, item.id); }
    if (item.steps.map(step => step.keys).join('') !== item.keys) { throw new Error(`Incomplete oracle steps: ${item.id}`); }
  }
  return corpus;
}

function splitSteps(keys) {
  const steps = [];
  let digits = '';
  for (const key of keys.match(/<[^>]+>|[\s\S]/gu) || []) {
    if (/^[0-9]$/.test(key)) { digits += key; }
    else { steps.push(digits + key); digits = ''; }
  }
  if (digits) { throw new Error(`Unused count: ${keys}`); }
  return steps;
}

/** Inputs only. Every output is obtained from Helix, never from the TS port. */
function matrix() {
  const cases = [];
  const add = (id, text, ranges, keys, primaryIndex = 0) => {
    const input = { text, ranges: ranges.map(([anchor, head]) => ({ anchor, head })), primaryIndex };
    validateDocument(input, id);
    cases.push({ id, keys, input, commands: splitSteps(keys) });
  };
  const shapes = [
    ['empty', '', [[0, 0]]],
    ['single', 'alpha', [[2, 2]]],
    ['lf', 'one\ntwo\nthree\n', [[1, 1]]],
    ['no-final-eol', 'one\ntwo\nthree', [[1, 1]]],
    ['blank', '\none\n\ntwo\n\n', [[0, 0]]],
    ['consecutive-blank', 'one\n\n\ntwo\n', [[4, 4]]],
    ['indent', '  one\n    two\nthree\n', [[3, 3]]],
    ['crlf', 'one\r\ntwo\r\nthree\r\n', [[3, 3]]],
    ['crlf-no-final', 'one\r\ntwo', [[6, 6]]],
    ['cr', 'one\rtwo\rthree\r', [[5, 5]]],
    ['astral', '😀 a\n𐐀 b\nlast\n', [[2, 3]]],
    ['combining', 'é a\nq́ b\nlast\n', [[0, 0]]],
    ['emoji', '👩‍💻 a\n🇷🇴 b\nlast\n', [[0, 0]]],
  ];
  for (const [name, text, ranges] of shapes) {
    for (const keys of ['x', 'xx', 'X', 'XX', 'xX', 'Xx', '2x', 'x2x', '2Xx', '12x', '100000000x', '1000000009x']) {
      add(`${name}/${keys}`, text, ranges, keys);
    }
  }
  const rangeShapes = [
    ['partial', [[1, 3]]], ['reversed', [[3, 1]]], ['whole-line', [[0, 4]]],
    ['whole-line-reversed', [[4, 0]]], ['two-lines', [[0, 8]]],
    ['next-line-start', [[2, 4]]], ['next-line-start-reversed', [[4, 2]]],
    ['eof-point', [[14, 14]]], ['eof-block', [[12, 14]]],
    ['eof-pair', [[0, 14], [14, 14]]],
    ['unsorted', [[9, 10], [1, 2], [5, 6]]],
    ['overlapping', [[0, 5], [3, 8], [6, 10]]],
    ['nested', [[0, 10], [3, 5]]], ['duplicate', [[1, 3], [1, 3]]],
    ['touching', [[0, 4], [4, 8]]],
    ['mixed-directions', [[4, 0], [3, 8], [10, 6]]],
    ['transitive', [[0, 3], [5, 8], [2, 6]]],
    ['start-point', [[0, 0], [0, 4]]], ['end-point', [[0, 4], [4, 4]]],
  ];
  for (const [name, ranges] of rangeShapes) {
    for (let primary = 0; primary < ranges.length; primary++) {
      for (const keys of ['x', 'X', 'xx', 'XX']) { add(`${name}/primary-${primary}/${keys}`, 'one\ntwo\nthree\n', ranges, keys, primary); }
    }
  }
  for (const keys of ['xd', 'xc<esc>', 'xdu', 'xc<esc>u', 'Xd', 'Xc<esc>u', 'dx']) {
    add(`follow-on/${keys}`, 'one\ntwo\nthree\n', [[1, 2]], keys);
  }
  for (const keys of ['2<esc>x', '2Xx', '02x']) { add(`count-lifecycle/${keys}`, 'one\ntwo\nthree\n', [[1, 2]], keys); }
  return cases;
}

const HARNESS = String.raw`
#[path = "test/helpers.rs"]
mod helpers;
use helix_core::{Range, Selection, Transaction};
use serde_json::{json, Value};
use std::cell::RefCell;

#[tokio::test(flavor = "multi_thread")]
async fn mini_helix_line_oracle() -> anyhow::Result<()> {
    let input = std::fs::read_to_string(std::env::var("MINI_HELIX_ORACLE_INPUT")?)?;
    let cases: Vec<Value> = serde_json::from_str(&input)?;
    let mut results = Vec::new();
    for case in cases {
        let input = &case["input"];
        let ranges = input["ranges"].as_array().unwrap().iter().map(|r| Range::new(r["anchor"].as_u64().unwrap() as usize, r["head"].as_u64().unwrap() as usize)).collect();
        let selection = Selection::new(ranges, input["primaryIndex"].as_u64().unwrap() as usize);
        let mut config = helpers::test_config();
        // Per-document global word-index hooks survive a test Application. They
        // are unrelated to commands and must not compose across fresh documents.
        config.editor.word_completion.enable = false;
        // These synchronous commands need no user-idle delay; retain the
        // upstream idle-event boundary without waiting 250 ms per snapshot.
        config.editor.idle_timeout = std::time::Duration::from_millis(1);
        let mut app = helpers::AppBuilder::new().with_config(config).build()?;
        let (view, doc) = helix_view::current!(app.editor);
        let initial = doc.selection(view.id).clone();
        let text = input["text"].as_str().unwrap();
        let transaction = Transaction::change_by_selection(doc.text(), &initial, |_| (0, doc.text().len_chars(), Some(text.into()))).with_selection(selection);
        doc.apply(&transaction, view.id);
        let snapshots = RefCell::new(Vec::new());
        let inspect = |app: &helix_term::application::Application| {
            let (view, doc) = helix_view::current_ref!(app.editor);
            let selection = doc.selection(view.id);
            snapshots.borrow_mut().push(json!({
                "text": doc.text().to_string(),
                "ranges": selection.iter().map(|r| json!({"anchor": r.anchor, "head": r.head})).collect::<Vec<_>>(),
                "primaryIndex": selection.primary_index()
            }));
        };
        let commands: Vec<&str> = case["commands"].as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
        let steps = commands.iter().map(|keys| (Some(*keys), Some(&inspect as &dyn Fn(&helix_term::application::Application)))).collect();
        helpers::test_key_sequences(&mut app, steps, false).await?;
        results.push(json!({"id":case["id"],"steps": snapshots.into_inner()}));
        if results.len() % 50 == 0 { eprintln!("oracle: {} cases captured", results.len()); }
    }
    std::fs::write(std::env::var("MINI_HELIX_ORACLE_OUTPUT")?, serde_json::to_string_pretty(&results)?)?;
    Ok(())
}
`;

function generate(helixRoot) {
  const revision = run('git', ['-C', helixRoot, 'rev-parse', 'HEAD']).trim();
  if (revision !== REVISION) { throw new Error(`Expected Helix revision ${REVISION}, got ${revision}`); }
  // Archive the exact commit: local edits, installed configuration and test
  // modifications in the supplied checkout cannot influence expected values.
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-helix-line-oracle-'));
  try {
    const archive = path.join(temporary, 'source.tar');
    run('git', ['-C', helixRoot, 'archive', '--format=tar', `--output=${archive}`, REVISION]);
    const source = path.join(temporary, 'source');
    fs.mkdirSync(source);
    run('tar', ['-xf', archive, '-C', source]);
    const cases = matrix();
    const characterCases = cases.map(item => ({ ...item, input: { ...item.input, ranges: item.input.ranges.map(range => ({ anchor: characterOffset(item.input.text, range.anchor), head: characterOffset(item.input.text, range.head) })) } }));
    const input = path.join(temporary, 'input.json');
    const output = path.join(temporary, 'output.json');
    fs.writeFileSync(input, JSON.stringify(characterCases));
    fs.writeFileSync(path.join(source, 'helix-term/tests/mini_helix_line_oracle.rs'), HARNESS);
    const config = path.join(temporary, 'config');
    fs.mkdirSync(config);
    run('cargo', ['test', '--locked', '-p', 'helix-term', '--features', 'integration', '--profile', 'integration', '--test', 'mini_helix_line_oracle', 'mini_helix_line_oracle', '--', '--nocapture', '--test-threads=1'], {
      cwd: source,
      env: { ...process.env, CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR || path.join(os.homedir(), '.cache/helix-oracle/target'), HELIX_DISABLE_AUTO_GRAMMAR_BUILD: '1', HELIX_RUNTIME: path.join(source, 'runtime'), XDG_CONFIG_HOME: config, MINI_HELIX_ORACLE_INPUT: input, MINI_HELIX_ORACLE_OUTPUT: output },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    const results = JSON.parse(fs.readFileSync(output, 'utf8'));
    const corpus = { schemaVersion: 1, revision: REVISION, coordinates: 'utf16-gap', cases: cases.map((item, index) => {
      const result = results[index];
      if (result.id !== item.id || result.steps.length !== item.commands.length) { throw new Error(`Incomplete Helix result: ${item.id}`); }
      return { id: item.id, keys: item.keys, input: item.input, steps: result.steps.map((step, stepIndex) => ({ keys: item.commands[stepIndex], text: step.text, ranges: step.ranges.map(range => ({ anchor: utf16Offset(step.text, range.anchor), head: utf16Offset(step.text, range.head) })), primaryIndex: step.primaryIndex })) };
    }) };
    return validateCorpus(corpus);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

module.exports = { REVISION, matrix, validateCorpus, characterOffset, utf16Offset, splitSteps };
if (require.main === module) {
  try {
    const rootIndex = process.argv.indexOf('--helix-root');
    if (rootIndex < 0 || !process.argv[rootIndex + 1]) { throw new Error('Usage: node scripts/helix-line-oracle.cjs --helix-root /path/to/pinned/helix [--check]'); }
    const corpus = generate(path.resolve(process.argv[rootIndex + 1]));
    const serialized = JSON.stringify(corpus, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(CORPUS, 'utf8') !== serialized) { throw new Error('Helix oracle differs from checked-in corpus; regenerate and review the differences'); }
      console.log(`Helix ${REVISION}: ${corpus.cases.length} cases exactly match checked-in results.`);
    } else {
      fs.mkdirSync(path.dirname(CORPUS), { recursive: true });
      fs.writeFileSync(CORPUS, serialized);
      console.log(`Generated ${corpus.cases.length} cases from Helix ${REVISION}.`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
