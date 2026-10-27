import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Case } from './charMotionCases';
import { firstNonWhitespace, fileStart, lastLine, lineEnd } from './gotoMotionCases';
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

test('gs goes to the first non-whitespace character of the block cursor line', () => check(firstNonWhitespace));
test('gl goes to the last grapheme of the block cursor line', () => check(lineEnd));
test('gg goes to the start of the file, or to line <n>', () => check(fileStart));
test('ge goes to the start of the last line that is not a final empty line', () => check(lastLine));

test('an empty VS Code selection behaves as the block cursor over the next grapheme', () => {
  let rerun = 0;
  for (const [input, keys, helix] of [...firstNonWhitespace, ...lineEnd, ...fileStart, ...lastLine]) {
    const document = parse(input);
    if (!document.ranges.every(range => Math.abs(range.head - range.anchor) <= 1)) { continue; }
    const carets = document.ranges.map(range => {
      const at = Math.min(range.anchor, range.head);
      return { anchor: at, head: at };
    });
    check([[print({ text: document.text, ranges: carets }), keys, helix]]);
    rerun++;
  }
  assert.ok(rerun >= 30, `only ${rerun} cases use single-grapheme cursors`);
});
