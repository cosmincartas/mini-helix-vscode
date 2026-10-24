import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { Count } from '../../src/core/count';
import { blockRange, changeSelection, deleteSelection } from '../../src/core/editing';
import { normalizeSelections, SelectionSet, transformLineSelection } from '../../src/core/lineSelection';
import { OffsetRange, WordMotionText } from '../../src/core/wordMotion';
import { applyEdits, HELIX_INDENT } from './helix';

interface OracleDocument extends SelectionSet { readonly text: string }
interface OracleStep extends OracleDocument { readonly keys: string }
interface OracleCase { readonly id: string; readonly keys: string; readonly input: OracleDocument; readonly steps: readonly OracleStep[] }
interface OracleCorpus { readonly cases: readonly OracleCase[] }
const oracle = require('../../../scripts/helix-line-oracle.cjs') as {
  validateCorpus(value: unknown): OracleCorpus;
  characterOffset(text: string, offset: number): number;
  utf16Offset(text: string, offset: number): number;
};
const corpus = oracle.validateCorpus(JSON.parse(readFileSync(path.resolve(__dirname, '../../../test/fixtures/line-selection-oracle.json'), 'utf8')));

/** Drives exported production transforms and edits; snapshots come only from Rust Helix. */
class Replay {
  private readonly count = new Count();
  private history: OracleDocument[] = [];
  private insert = false;
  private changedInInsert = false;
  constructor(public document: OracleDocument) {}

  keys(keys: string): OracleDocument {
    for (const [key] of keys.matchAll(/<[^>]+>|[\s\S]/gu)) {
      if (/^[0-9]$/.test(key)) { this.count.digit(Number(key)); continue; }
      const times = this.count.take();
      const prepared = new WordMotionText(this.document.text);
      if (key === 'x' || key === 'X') {
        assert.equal(this.insert, false);
        this.document = { text: prepared.text, ...transformLineSelection(prepared, this.document, key, times) };
      } else if (key === 'd' || key === 'c') {
        assert.equal(this.insert, false);
        this.history.push(this.document);
        const edit = key === 'd' ? deleteSelection(prepared, this.primaryFirst()) : changeSelection(prepared, this.primaryFirst(), '\n', HELIX_INDENT);
        this.document = { text: applyEdits(prepared.text, edit.edits), ranges: edit.selections, primaryIndex: 0 };
        this.insert = key === 'c';
        this.changedInInsert = this.insert;
      } else if (key === 'u') {
        assert.equal(this.insert, false);
        const previous = this.history.pop();
        if (previous) { this.document = previous; }
      } else if (key === '<esc>') {
        this.insert = false;
        this.changedInInsert = false;
      } else { throw new Error(`Unsupported oracle replay command ${key}`); }
      // Helix keeps block ranges in NORMAL and over the opened newline during
      // change-selection INSERT. The adapter's caret represents that same block.
      if (key !== 'x' && key !== 'X' && (!this.insert || this.changedInInsert)) {
        const text = new WordMotionText(this.document.text);
        this.document = { text: text.text, ...normalizeSelections(this.document.ranges.map(range => blockRange(text, range)), this.document.primaryIndex) };
      }
    }
    return this.document;
  }

  private primaryFirst(): readonly OffsetRange[] {
    return [this.document.ranges[this.document.primaryIndex], ...this.document.ranges.filter((_, index) => index !== this.document.primaryIndex)];
  }
}

for (const item of corpus.cases) {
  test(`pinned Helix oracle: ${item.id}`, () => {
    const replay = new Replay(item.input);
    for (const step of item.steps) {
      const { keys, ...expected } = step;
      assert.deepEqual(replay.keys(keys), expected, `${item.id}, after ${keys}`);
    }
  });
}

test('oracle coordinates convert Unicode scalar indices explicitly and reject surrogate interiors', () => {
  assert.equal(oracle.characterOffset('a😀b', 3), 2);
  assert.equal(oracle.utf16Offset('a😀b', 2), 3);
  assert.throws(() => oracle.characterOffset('a😀b', 2), /Invalid UTF-16 gap/);
  assert.throws(() => oracle.utf16Offset('a😀b', 5), /Invalid Helix character gap/);
});

test('oracle validator rejects malformed schema, ranges, primary indices and steps', () => {
  const valid = JSON.parse(readFileSync(path.resolve(__dirname, '../../../test/fixtures/line-selection-oracle.json'), 'utf8'));
  const invalid = (mutate: (copy: any) => void) => {
    const copy = structuredClone(valid);
    mutate(copy);
    assert.throws(() => oracle.validateCorpus(copy));
  };
  invalid(copy => { copy.revision = 'other-revision'; });
  invalid(copy => { copy.coordinates = 'characters'; });
  invalid(copy => { copy.cases[0].input.ranges = []; });
  invalid(copy => { copy.cases[0].input.primaryIndex = 100; });
  invalid(copy => { copy.cases[0].input.ranges[0].anchor = -1; });
  invalid(copy => { copy.cases[0].input.ranges[0].head = 1.5; });
  invalid(copy => { copy.cases[0].steps[0].ranges[0].head = 99999; });
  invalid(copy => { copy.cases[0].keys = 'xx'; });
  invalid(copy => { copy.cases.push(copy.cases[0]); });
});
