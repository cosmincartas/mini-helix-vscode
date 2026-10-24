import assert from 'node:assert/strict';
import { test } from 'node:test';
import { textLines } from '../../src/core/charMotion';
import { Count, MAX_COUNT } from '../../src/core/count';
import { lineRange, normalizeSelections, overlaps, SelectionSet, transformLineSelection } from '../../src/core/lineSelection';
import { OffsetRange, WordMotionText } from '../../src/core/wordMotion';
import { parseUpstream } from './upstreamHelix';

const range = (anchor: number, head: number): OffsetRange => ({ anchor, head });
const pairs = (ranges: readonly OffsetRange[]) => ranges.map(({ anchor, head }) => [anchor, head]);

// Imported unchanged from helix-core/src/selection.rs at the pinned revision.
test('upstream test_create_normalizes_and_merges: both original assertions and primary', () => {
  const first = normalizeSelections([[10, 12], [6, 7], [4, 5], [3, 4], [0, 6], [7, 8], [9, 13], [13, 14]]
    .map(([a, h]) => range(a, h)));
  assert.deepEqual(pairs(first.ranges), [[0, 6], [6, 7], [7, 8], [9, 13], [13, 14]]);
  assert.equal(first.primaryIndex, 3);
  const second = normalizeSelections([range(0, 2), range(1, 5), range(4, 7)], 2);
  assert.deepEqual(pairs(second.ranges), [[0, 7]]);
  assert.equal(second.primaryIndex, 0);
});

test('upstream test_create_merges_adjacent_points: full original input and result', () => {
  const result = normalizeSelections([[10, 12], [12, 12], [12, 12], [10, 10], [8, 10]]
    .map(([a, h]) => range(a, h)));
  assert.deepEqual(pairs(result.ranges), [[8, 10], [10, 12], [12, 12]]);
  assert.equal(result.primaryIndex, 1);
});

test('upstream test_overlaps: every original directional and point case', () => {
  const cases: [number, number, number, number, boolean][] = [
    [0, 3, 3, 6, false], [0, 3, 6, 3, false], [3, 0, 3, 6, false], [3, 0, 6, 3, false],
    [3, 6, 0, 3, false], [3, 6, 3, 0, false], [6, 3, 0, 3, false], [6, 3, 3, 0, false],
    [0, 4, 3, 6, true], [0, 4, 6, 3, true], [4, 0, 3, 6, true], [4, 0, 6, 3, true],
    [3, 6, 0, 4, true], [3, 6, 4, 0, true], [6, 3, 0, 4, true], [6, 3, 4, 0, true],
    [0, 3, 3, 3, false], [3, 0, 3, 3, false], [3, 3, 0, 3, false], [3, 3, 3, 0, false],
    [1, 4, 1, 1, true], [4, 1, 1, 1, true], [1, 1, 1, 4, true], [1, 1, 4, 1, true],
    [1, 4, 3, 3, true], [4, 1, 3, 3, true], [3, 3, 1, 4, true], [3, 3, 4, 1, true],
    [0, 0, 1, 1, false], [1, 1, 0, 0, false], [1, 1, 1, 1, true],
  ];
  assert.equal(cases.length, 31);
  for (const [a, h, b, k, expected] of cases) {
    assert.equal(overlaps(range(a, h), range(b, k)), expected, `${a}/${h} overlaps ${b}/${k}`);
  }
});

test('upstream test_line_range: all 18 original CRLF assertions', () => {
  const text = new WordMotionText('\r\nHi\r\nthere!');
  const lines = textLines(text.text);
  const cases: [number, number, number, number][] = [
    [0, 0, 0, 0], [1, 1, 0, 0], [2, 2, 1, 1], [3, 3, 1, 1],
    [0, 1, 0, 0], [0, 2, 0, 0], [0, 3, 0, 1], [1, 2, 0, 0], [2, 3, 1, 1], [3, 8, 1, 2], [0, 12, 0, 2],
    [1, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 1], [2, 1, 0, 0], [3, 2, 1, 1], [8, 3, 1, 2], [12, 0, 0, 2],
  ];
  assert.equal(cases.length, 18);
  for (const [a, h, start, end] of cases) {
    assert.deepEqual(lineRange(text, lines, range(a, h)), [start, end], `${a}/${h}`);
  }
});

function replay(notation: string, keys: string): { text: string } & SelectionSet {
  const parsed = parseUpstream(notation);
  const text = new WordMotionText(parsed.text);
  let selection: SelectionSet = parsed;
  const count = new Count();
  for (const key of keys) {
    if (/\d/.test(key)) { count.digit(Number(key)); continue; }
    assert.ok(key === 'x' || key === 'X');
    selection = transformLineSelection(text, selection, key, count.take());
  }
  return { text: text.text, ...selection };
}

test('upstream test_extend_line: x2x and 2x, unchanged display notation', () => {
  assert.deepEqual(replay('#[l|]#orem\nipsum\ndolor\n\n', 'x2x'), parseUpstream('#[lorem\nipsum\ndolor\n|]#\n\n'));
  assert.deepEqual(replay('#[l|]#orem\nipsum\n\n', '2x'), parseUpstream('#[lorem\nipsum\n|]#\n\n'));
});

test('normalization retains every possible primary through unsorted transitive mixed-direction merges', () => {
  const ranges = [range(9, 6), range(3, 0), range(2, 6), range(11, 12), range(7, 5)];
  for (let primary = 0; primary < ranges.length; primary++) {
    const result = normalizeSelections(ranges, primary);
    assert.deepEqual(pairs(result.ranges), [[0, 9], [11, 12]]);
    assert.equal(result.primaryIndex, primary === 3 ? 1 : 0);
  }
  assert.deepEqual(pairs(normalizeSelections([range(4, 1), range(6, 3)]).ranges), [[6, 1]]);
  assert.deepEqual(pairs(normalizeSelections([range(4, 1), range(3, 6)]).ranges), [[1, 6]]);
  assert.throws(() => normalizeSelections([]));
  assert.throws(() => normalizeSelections([range(0, 1)], 1));
});

test('x counts initial expansion once, repeats whole lines, and clamps to EOF arithmetically', () => {
  assert.deepEqual(pairs(replay('a#[|b]#c\ndef\nghi\n', 'x').ranges), [[0, 4]]);
  assert.deepEqual(pairs(replay('a#[|b]#c\ndef\nghi\n', '2x').ranges), [[0, 8]]);
  assert.deepEqual(pairs(replay('#[abc\n|]#def\nghi\n', 'x').ranges), [[0, 8]]);
  assert.deepEqual(pairs(replay('#[|abc\n]#def\nghi\n', 'x').ranges), [[0, 8]]);
  const text = new WordMotionText('a\nb\n');
  assert.deepEqual(pairs(transformLineSelection(text, { ranges: [range(0, 0)], primaryIndex: 0 }, 'x', MAX_COUNT).ranges), [[0, 4]]);
});

test('blank-line carets are blocks before x decides whether to extend', () => {
  assert.deepEqual(pairs(replay('#[|]#\nabc\n', 'x').ranges), [[0, 5]]);
  assert.deepEqual(pairs(replay('#[|]#\n\nabc', 'x').ranges), [[0, 2]]);
  assert.deepEqual(pairs(replay('#[|]#\n\nabc', 'X').ranges), [[0, 1]]);
  for (const keys of ['x', 'xx', 'X', 'XX']) {
    assert.deepEqual(replay('#[|]#', keys), parseUpstream('#[|]#'));
    assert.deepEqual(replay('a\n#[|]#', keys), parseUpstream('a\n#[|]#'));
  }
});

test('X preserves direction and primary; repeated X and consumed counts are idempotent', () => {
  for (const notation of ['a#[bc|]#\ndef\n', 'a#[|bc]#\ndef\n', '#[|]#\nabc', 'abc\n#[|]#']) {
    const once = replay(notation, 'X');
    assert.deepEqual(replay(notation, 'XX'), once);
    assert.deepEqual(replay(notation, '12X'), once);
  }
  assert.deepEqual(pairs(replay('a#[bc|]#\ndef\n', 'X').ranges), [[0, 4]]);
  assert.deepEqual(pairs(replay('a#[|bc]#\ndef\n', 'X').ranges), [[4, 0]]);
  assert.deepEqual(replay('a#[bc|]#\ndef\nghi', '2Xx'), replay('a#[bc|]#\ndef\nghi', 'Xx'));
  assert.deepEqual(pairs(replay('a#(|bc)#\nd#[|ef]#\n', 'X').ranges), [[4, 0], [8, 4]]);
  assert.equal(replay('a#(|bc)#\nd#[|ef]#\n', 'X').primaryIndex, 1);
});

test('line transforms preserve EOF points beside nonempty ranges ending at EOF', () => {
  for (const command of ['x', 'X'] as const) {
    for (const primaryIndex of [0, 1]) {
      const text = new WordMotionText('a\n');
      const selection = { ranges: [range(0, 2), range(2, 2)], primaryIndex };
      assert.deepEqual(transformLineSelection(text, selection, command), selection);
    }
  }
});

test('line transforms align astral, combining and emoji graphemes without mutating inputs', () => {
  const text = new WordMotionText('😀e\u0301👋🏽\r\nlast');
  const selection = { ranges: [range(1, 1)], primaryIndex: 0 };
  const copy = structuredClone(selection);
  assert.deepEqual(pairs(transformLineSelection(text, selection, 'x').ranges), [[0, 10]]);
  assert.deepEqual(pairs(transformLineSelection(text, selection, 'X').ranges), [[0, 10]]);
  assert.deepEqual(selection, copy);
  assert.equal(text.text, '😀e\u0301👋🏽\r\nlast');
});

test('lone CR follows pinned Helix LF-only lines and a missing final newline saturates correctly', () => {
  assert.deepEqual(pairs(replay('a\r#[b|]#\rc\nd', 'x').ranges), [[0, 6]]);
  assert.deepEqual(pairs(replay('a\r#[|b]#\rc\nd', 'X').ranges), [[6, 0]]);
  assert.deepEqual(pairs(replay('a\r#[b|]#\rc\nd', '2x').ranges), [[0, 7]]);
  assert.deepEqual(pairs(replay('a\n#[|b]#c', 'xx').ranges), [[2, 4]]);
});
