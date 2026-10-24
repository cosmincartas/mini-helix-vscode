import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveWord, WordMotionTarget, WordMotionText } from '../../src/core/wordMotion';

type Case = [text: string, from: [anchor: number, head: number], to: [anchor: number, head: number]];

function check(target: WordMotionTarget, cases: Case[]): void {
  for (const [text, [anchor, head], expected] of cases) {
    const result = moveWord(new WordMotionText(text), { anchor, head }, target);
    assert.deepEqual([result.anchor, result.head], expected, `${JSON.stringify(text)} from ${anchor},${head}`);
  }
}

// Helix's own movement.rs cases are in helixMovement.test.ts; these cover
// what they do not.
test('W, B, and E treat punctuation and word characters as one WORD', () => {
  check('nextLongWordStart', [['foo.bar(baz)  next', [0, 0], [0, 14]]]);
  // Whitespace still separates WORDs, and other categories still form boundaries.
  check('nextLongWordStart', [['a.b 😀😀 c', [0, 0], [0, 4]]]);
});

test('motions never split grapheme clusters or CRLF line endings', () => {
  // e + combining acute, a skin-toned emoji, and a CRLF pair. CRLF and CR
  // behave like Helix's LF; Helix itself would stop between `\r` and `\n`.
  check('nextWordStart', [
    ['cafe\u0301 bar', [0, 0], [0, 6]],
    ['hi 👋🏽 there', [0, 3], [3, 8]],
    ['one\r\ntwo', [0, 0], [0, 3]],
    ['one\r\ntwo', [0, 3], [5, 8]],
    ['one\rtwo', [0, 3], [4, 7]],
  ]);
  check('prevWordStart', [
    // At a line start, b crosses the line ending and selects the previous word.
    ['one\r\ntwo', [5, 5], [3, 0]],
    ['bar cafe\u0301', [9, 9], [9, 4]],
  ]);
  check('nextWordEnd', [['👋🏽👋🏽 x', [0, 0], [0, 8]]]);
});

test('moving forward from the end of the text keeps the selection', () => {
  check('nextWordStart', [['end', [0, 3], [0, 3]]]);
  check('nextWordEnd', [['end', [1, 3], [1, 3]]]);
});
