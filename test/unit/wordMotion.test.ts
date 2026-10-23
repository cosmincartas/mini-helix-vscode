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

// Cases below are ported from helix-core's movement.rs tests (count 1).
test('w selects to the start of the next word', () => {
  check('nextWordStart', [
    ['Basic forward motion stops at the first space', [0, 0], [0, 6]],
    [' Starting from a boundary advances the anchor', [0, 0], [1, 10]],
    ['Long       whitespace gap is bridged by the head', [0, 0], [0, 11]],
    ['Previous anchor is irrelevant for forward motions', [12, 0], [0, 9]],
    ['    Starting from whitespace moves to last space in sequence', [0, 0], [0, 4]],
    ['Starting from mid-word leaves anchor at start position and moves head', [3, 3], [3, 9]],
    ['Identifiers_with_underscores are considered a single word', [0, 0], [0, 29]],
    ['Jumping\n    into starting whitespace selects the spaces before \'into\'', [0, 7], [8, 12]],
    ['alphanumeric.!,and.?=punctuation are considered \'words\' for the purposes of word motion', [0, 0], [0, 12]],
    ['...   ... punctuation and spaces behave as expected', [0, 0], [0, 6]],
    ['.._.._ punctuation is not joined by underscores into a single block', [0, 0], [0, 2]],
    ['Newlines\n\nare bridged seamlessly.', [0, 0], [0, 8]],
    ['Newlines\n\nare bridged seamlessly.', [0, 8], [10, 14]],
    ['Jumping\n\n\n\n\n\n   from newlines to whitespace selects whitespace.', [0, 9], [13, 16]],
    ['oh oh oh two character words!', [0, 0], [0, 3]],
    ['oh oh oh two character words!', [0, 1], [0, 3]],
    ['oh oh oh two character words!', [0, 2], [1, 3]],
    ['oh oh oh two character words!', [0, 3], [3, 6]],
    ['', [0, 0], [0, 0]],
    ['\n\n\n\n\n', [0, 0], [5, 5]],
    ['\n   \n   \nJumping through alternated space blocks and newlines selects the space blocks', [0, 0], [1, 4]],
    ['\n   \n   \nJumping through alternated space blocks and newlines selects the space blocks', [1, 4], [5, 8]],
    ['ヒーリクス multibyte characters behave as normal characters', [0, 0], [0, 6]],
  ]);
});

test('b selects back to the start of the previous word', () => {
  check('prevWordStart', [
    ['Basic backward motion from the middle of a word', [3, 3], [4, 0]],
    ['    Jump to start of a word preceded by whitespace', [5, 5], [6, 4]],
    ['    Jump to start of line from start of word preceded by whitespace', [4, 4], [4, 0]],
    ['Previous anchor is irrelevant for backward motions', [12, 5], [6, 0]],
    ['    Starting from whitespace moves to first space in sequence', [0, 4], [4, 0]],
    ['Identifiers_with_underscores are considered a single word', [0, 20], [20, 0]],
    ['Jumping\n    \nback through a newline selects whitespace', [0, 13], [12, 8]],
    ['Jumping to start of word from the end selects the word', [6, 7], [7, 0]],
    ['alphanumeric.!,and.?=punctuation are considered \'words\' for the purposes of word motion', [29, 30], [30, 21]],
    ['', [0, 0], [0, 0]],
    ['Already at the start', [0, 0], [0, 0]],
  ]);
});

test('e selects to the end of the next word', () => {
  check('nextWordEnd', [
    ['Basic forward motion from the start of a word to the end of it', [0, 0], [0, 5]],
    ['Basic forward motion from the end of a word to the end of the next', [0, 5], [5, 13]],
    ['Basic forward motion from the middle of a word to the end of it', [2, 2], [2, 5]],
    ['    Jumping to end of a word preceded by whitespace', [0, 0], [0, 11]],
    ['Previous anchor is irrelevant for end of word motion', [12, 2], [2, 8]],
    ['Identifiers_with_underscores are considered a single word', [0, 0], [0, 28]],
    ['Jumping\n    into starting whitespace selects up to the end of next word', [0, 7], [8, 16]],
    ['alphanumeric.!,and.?=punctuation are considered \'words\' for the purposes of word motion', [0, 0], [0, 12]],
    ['\n\n\n\n\n', [0, 0], [5, 5]],
  ]);
});

test('W, B, and E treat punctuation and word characters as one WORD', () => {
  const text = 'alphanumeric.!,and.?=punctuation are not treated any differently than alphanumerics';
  check('nextLongWordStart', [[text, [0, 0], [0, 33]]]);
  check('nextLongWordEnd', [[text, [0, 0], [0, 32]]]);
  check('prevLongWordStart', [[text, [0, 30], [30, 0]]]);
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
