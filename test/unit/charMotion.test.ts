import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveHorizontally, moveVertically, textLines } from '../../src/core/charMotion';
import { Count, MAX_COUNT } from '../../src/core/count';
import { graphemeWidth } from '../../src/core/unicodeWidth';
import { WordMotionText } from '../../src/core/wordMotion';
import { Case, countLifetime, counted, horizontal, vertical } from './charMotionCases';
import { normalize, ordered, parse, print, Session } from './helix';

function check(cases: Case[]): void {
  for (const [input, keys, helix] of cases) {
    const session = Session.from(input).keys(keys);
    const actual = ordered(normalize(session.document));
    const expected = ordered(normalize(parse(helix)));
    const message = `${JSON.stringify(input)} ${keys} gave ${JSON.stringify(print(actual))}`;
    assert.equal(actual.text, expected.text, message);
    assert.deepEqual(actual.ranges, expected.ranges, message);
  }
}

test('h and l move the block cursor by graphemes, across lines', () => check(horizontal));
test('j and k keep the visual column, and remember it between vertical moves', () => check(vertical));
test('a count repeats word motions', () => check(counted));
test('the next key uses the count; unbound keys and Escape clear it', () => check(countLifetime));

test('an empty VS Code selection behaves as the block cursor over the next grapheme', () => {
  let rerun = 0;
  for (const [input, keys, helix] of [...horizontal, ...vertical, ...counted, ...countLifetime]) {
    const document = parse(input);
    const prepared = new WordMotionText(document.text);
    if (!document.ranges.every(range => prepared.after(range.anchor)?.end === range.head)) { continue; }
    const carets = document.ranges.map(range => ({ anchor: range.anchor, head: range.anchor }));
    check([[print({ text: document.text, ranges: carets }), keys, helix]]);
    rerun++;
  }
  assert.ok(rerun >= 60, `only ${rerun} cases use single-grapheme cursors`);
});

test('CRLF and CR line breaks behave like Helix\'s LF', () => {
  const crlf = 'abc\r\ndef\r\n';
  const text = new WordMotionText(crlf);
  // l from the line end steps over the whole CRLF pair, and h back onto it.
  assert.deepEqual(moveHorizontally(text, { anchor: 3, head: 3 }, 'forward', 1), { anchor: 5, head: 5 });
  assert.deepEqual(moveHorizontally(text, { anchor: 5, head: 5 }, 'backward', 1), { anchor: 3, head: 3 });
  const down = moveVertically(textLines(crlf), { anchor: 2, head: 2 }, 'forward', 1, 4);
  assert.deepEqual(down.range, { anchor: 7, head: 7 });
  // A line break is a column of its own; the next line's start is not.
  assert.deepEqual(moveVertically(textLines('abcd\r\nab\r\nabcd'), { anchor: 3, head: 3 }, 'forward', 1, 4).range,
    { anchor: 8, head: 8 });
  assert.deepEqual(moveVertically(textLines('ab\rcd'), { anchor: 1, head: 1 }, 'forward', 1, 4).range,
    { anchor: 4, head: 4 });
  // The block cursor of a selection ending after a CRLF is on that CRLF.
  assert.deepEqual(moveVertically(textLines(crlf), { anchor: 0, head: 5 }, 'forward', 1, 4).range,
    { anchor: 8, head: 8 });
});

test('j and k use the editor tab size', () => {
  const lines = textLines('abcdefgh\n\tx\n');
  assert.deepEqual(moveVertically(lines, { anchor: 3, head: 3 }, 'forward', 1, 4).range, { anchor: 9, head: 9 });
  assert.deepEqual(moveVertically(lines, { anchor: 4, head: 4 }, 'forward', 1, 4).range, { anchor: 10, head: 10 });
  assert.deepEqual(moveVertically(lines, { anchor: 4, head: 4 }, 'forward', 1, 8).range, { anchor: 9, head: 9 });
  assert.deepEqual(moveVertically(lines, { anchor: 1, head: 1 }, 'forward', 1, 2).range, { anchor: 9, head: 9 });
  assert.deepEqual(moveVertically(lines, { anchor: 2, head: 2 }, 'forward', 1, 2).range, { anchor: 10, head: 10 });
});

test('grapheme widths follow Helix (unicode-width 0.1.12)', () => {
  assert.equal(graphemeWidth('a'), 1);
  assert.equal(graphemeWidth('\u0000'), 1);
  assert.equal(graphemeWidth('パ'), 2);
  assert.equal(graphemeWidth('ｱ'), 1);
  assert.equal(graphemeWidth('é'), 1);
  assert.equal(graphemeWidth('é́'), 1);
  assert.equal(graphemeWidth('👋'), 2);
  // Width is summed over code points, so a skin tone modifier adds two more.
  assert.equal(graphemeWidth('👋🏽'), 4);
  assert.equal(graphemeWidth('❤'), 1);
  assert.equal(graphemeWidth('❤️'), 2);
  assert.equal(graphemeWidth('​'), 1);
  assert.equal(graphemeWidth('\u{20000}'), 2);
});

test('counts start with 1-9, continue with any digit, and stop growing past Helix\'s limit', () => {
  const changes: (number | undefined)[] = [];
  const count = new Count(value => changes.push(value));
  count.digit(0);
  assert.equal(count.pending, undefined, '0 does not start a count');
  count.digit(1);
  count.digit(0);
  assert.equal(count.pending, 10);
  assert.equal(count.take(), 10);
  assert.equal(count.pending, undefined);
  assert.equal(count.take(), 1, 'no count means 1');
  for (const digit of '1000000000') { count.digit(Number(digit)); }
  assert.equal(count.pending, MAX_COUNT);
  count.clear();
  count.clear();
  assert.deepEqual(changes, [1, 10, undefined, 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, undefined]);
});
