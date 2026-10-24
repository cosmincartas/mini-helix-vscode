import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Direction, moveHorizontally, moveVertically, textLines } from '../../src/core/charMotion';
import { moveWord, OffsetRange, WordMotionTarget, WordMotionText } from '../../src/core/wordMotion';

/**
 * A port of helix-core's `movement.rs` tests (Helix 25.07.1) for the motions
 * bound here. Not ported: `selection_extending_moves_in_single_line_text`
 * (extend mode is not implemented), the `nonsensical_ranges_panic_*` debug
 * assertions, and the sub-word, previous-word-end, and paragraph tables,
 * whose motions are not bound.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** helix-core's `coords_at_pos`: line and grapheme column. */
function coords(text: string, offset: number): [number, number] {
  const lines = textLines(text);
  const line = lines.at(lines.indexAt(offset));
  return [lines.indexAt(offset), Array.from(segmenter.segment(text.slice(line.start, offset))).length];
}

const point = (offset: number): OffsetRange => ({ anchor: offset, head: offset });

type Axis = 'H' | 'V';

/** Applies moves in order, keeping each vertical move's column for the next one, like a Helix range. */
function checkMoves(text: string, moves: [Axis, Direction, number, [number, number]][]): void {
  const prepared = new WordMotionText(text);
  const lines = textLines(text);
  let range = point(0);
  let column: number | undefined;
  for (const [axis, direction, count, expected] of moves) {
    if (axis === 'H') {
      range = moveHorizontally(prepared, range, direction, count);
      column = undefined;
    } else {
      ({ range, column } = moveVertically(lines, range, direction, count, 4, column));
    }
    assert.deepEqual(coords(text, range.head), expected, `${axis} ${direction} ${count}`);
    assert.equal(range.head, range.anchor);
  }
}

const SINGLE_LINE_SAMPLE = 'This is a simple alphabetic line';
const MULTILINE_SAMPLE = 'Multiline\ntext sample\nwhich\nis merely alphabetic\nand whitespaced\n';
const MULTIBYTE_CHARACTER_SAMPLE = 'パーティーへ行かないか\nThe text above is Japanese\n';

test('test_vertical_move', () => {
  const text = 'abcd\nefg\nwrs';
  const { range } = moveVertically(textLines(text), point(4), 'forward', 1, 4);
  assert.deepEqual(coords(text, range.head), [1, 3]);
});

test('horizontal_moves_through_single_line_text', () => {
  checkMoves(SINGLE_LINE_SAMPLE, [
    ['H', 'forward', 1, [0, 1]],
    ['H', 'forward', 2, [0, 3]],
    ['H', 'forward', 0, [0, 3]],
    ['H', 'forward', 999, [0, 32]],
    ['H', 'forward', 999, [0, 32]],
    ['H', 'backward', 999, [0, 0]],
  ]);
});

test('horizontal_moves_through_multiline_text', () => {
  checkMoves(MULTILINE_SAMPLE, [
    ['H', 'forward', 11, [1, 1]],
    ['H', 'backward', 1, [1, 0]],
    ['H', 'backward', 5, [0, 5]],
    ['H', 'backward', 999, [0, 0]],
    ['H', 'forward', 3, [0, 3]],
    ['H', 'forward', 0, [0, 3]],
    ['H', 'backward', 0, [0, 3]],
    ['H', 'forward', 999, [5, 0]],
    ['H', 'forward', 999, [5, 0]],
  ]);
});

test('vertical_moves_in_single_column', () => {
  checkMoves(MULTILINE_SAMPLE, [
    ['V', 'forward', 1, [1, 0]],
    ['V', 'forward', 2, [3, 0]],
    ['V', 'forward', 1, [4, 0]],
    ['V', 'backward', 999, [0, 0]],
    ['V', 'forward', 4, [4, 0]],
    ['V', 'forward', 0, [4, 0]],
    ['V', 'backward', 0, [4, 0]],
    ['V', 'forward', 5, [5, 0]],
    ['V', 'forward', 999, [5, 0]],
  ]);
});

test('vertical_moves_jumping_column', () => {
  checkMoves(MULTILINE_SAMPLE, [
    // Places cursor at the end of line
    ['H', 'forward', 8, [0, 8]],
    // First descent preserves column as the target line is wider
    ['V', 'forward', 1, [1, 8]],
    // Second descent clamps column as the target line is shorter
    ['V', 'forward', 1, [2, 5]],
    // Third descent restores the original column
    ['V', 'forward', 1, [3, 8]],
    // Behaviour is preserved even through long jumps
    ['V', 'backward', 999, [0, 8]],
    ['V', 'forward', 4, [4, 8]],
    ['V', 'forward', 999, [5, 0]],
  ]);
});

test('multibyte_character_wide_column_jumps', () => {
  checkMoves(MULTIBYTE_CHARACTER_SAMPLE, [
    // Places cursor at the fourth kana.
    ['H', 'forward', 4, [0, 4]],
    // Descent places cursor at the 8th character.
    ['V', 'forward', 1, [1, 8]],
    // Moving back 2 characters.
    ['H', 'backward', 2, [1, 6]],
    // Jumping back up 1 line.
    ['V', 'backward', 1, [0, 3]],
  ]);
});

type Scenario = [count: number, begin: [anchor: number, head: number], end: [anchor: number, head: number]];

function check(target: WordMotionTarget, tests: [sample: string, scenario: Scenario[]][]): void {
  for (const [sample, scenario] of tests) {
    for (const [count, [anchor, head], expected] of scenario) {
      const range = moveWord(new WordMotionText(sample), { anchor, head }, target, count);
      assert.deepEqual([range.anchor, range.head], expected, `Case failed: [${sample}] ${count} from ${anchor},${head}`);
    }
  }
}

test('w: test_behaviour_when_moving_to_start_of_next_words', () => {
  check('nextWordStart', [
    ['Basic forward motion stops at the first space', [[1, [0, 0], [0, 6]]]],
    [' Starting from a boundary advances the anchor', [[1, [0, 0], [1, 10]]]],
    ['Long       whitespace gap is bridged by the head', [[1, [0, 0], [0, 11]]]],
    ['Previous anchor is irrelevant for forward motions', [[1, [12, 0], [0, 9]]]],
    ['    Starting from whitespace moves to last space in sequence', [[1, [0, 0], [0, 4]]]],
    ['Starting from mid-word leaves anchor at start position and moves head', [[1, [3, 3], [3, 9]]]],
    ['Identifiers_with_underscores are considered a single word', [[1, [0, 0], [0, 29]]]],
    ['Jumping\n    into starting whitespace selects the spaces before \'into\'', [[1, [0, 7], [8, 12]]]],
    ['alphanumeric.!,and.?=punctuation are considered \'words\' for the purposes of word motion', [[1, [0, 0], [0, 12]], [1, [0, 12], [12, 15]], [1, [12, 15], [15, 18]]]],
    ['...   ... punctuation and spaces behave as expected', [[1, [0, 0], [0, 6]], [1, [0, 6], [6, 10]]]],
    ['.._.._ punctuation is not joined by underscores into a single block', [[1, [0, 0], [0, 2]]]],
    ['Newlines\n\nare bridged seamlessly.', [[1, [0, 0], [0, 8]], [1, [0, 8], [10, 14]]]],
    ['Jumping\n\n\n\n\n\n   from newlines to whitespace selects whitespace.', [[1, [0, 9], [13, 16]]]],
    ['A failed motion does not modify the range', [[3, [37, 41], [37, 41]]]],
    ['oh oh oh two character words!', [[1, [0, 0], [0, 3]], [1, [0, 3], [3, 6]], [1, [0, 2], [1, 3]]]],
    ['Multiple motions at once resolve correctly', [[3, [0, 0], [17, 20]]]],
    ['Excessive motions are performed partially', [[999, [0, 0], [32, 41]]]],
    ['', [[1, [0, 0], [0, 0]]]],
    ['\n\n\n\n\n', [[1, [0, 0], [5, 5]]]],
    ['\n   \n   \n Jumping through alternated space blocks and newlines selects the space blocks', [[1, [0, 0], [1, 4]], [1, [1, 4], [5, 8]]]],
    ['ヒーリクス multibyte characters behave as normal characters', [[1, [0, 0], [0, 6]]]],
  ]);
});

test('b: test_behaviour_when_moving_to_start_of_previous_words', () => {
  check('prevWordStart', [
    ['Basic backward motion from the middle of a word', [[1, [3, 3], [4, 0]]]],
    ['    Jump to start of a word preceded by whitespace', [[1, [5, 5], [6, 4]]]],
    ['    Jump to start of line from start of word preceded by whitespace', [[1, [4, 4], [4, 0]]]],
    ['Previous anchor is irrelevant for backward motions', [[1, [12, 5], [6, 0]]]],
    ['    Starting from whitespace moves to first space in sequence', [[1, [0, 4], [4, 0]]]],
    ['Identifiers_with_underscores are considered a single word', [[1, [0, 20], [20, 0]]]],
    ['Jumping\n    \nback through a newline selects whitespace', [[1, [0, 13], [12, 8]]]],
    ['Jumping to start of word from the end selects the word', [[1, [6, 7], [7, 0]]]],
    ['alphanumeric.!,and.?=punctuation are considered \'words\' for the purposes of word motion', [[1, [29, 30], [30, 21]], [1, [30, 21], [21, 18]], [1, [21, 18], [18, 15]]]],
    ['...   ... punctuation and spaces behave as expected', [[1, [0, 10], [10, 6]], [1, [10, 6], [6, 0]]]],
    ['.._.._ punctuation is not joined by underscores into a single block', [[1, [0, 6], [5, 3]]]],
    ['Newlines\n\nare bridged seamlessly.', [[1, [0, 10], [8, 0]]]],
    ['Jumping    \n\n\n\n\nback from within a newline group selects previous block', [[1, [0, 13], [11, 0]]]],
    ['Failed motions do not modify the range', [[0, [3, 0], [3, 0]]]],
    ['Multiple motions at once resolve correctly', [[3, [18, 18], [9, 0]]]],
    ['Excessive motions are performed partially', [[999, [40, 40], [10, 0]]]],
    ['', [[1, [0, 0], [0, 0]]]],
    ['\n\n\n\n\n', [[1, [5, 5], [0, 0]]]],
    ['   \n   \nJumping back through alternated space blocks and newlines selects the space blocks', [[1, [0, 8], [7, 4]], [1, [7, 4], [3, 0]]]],
    ['ヒーリクス multibyte characters behave as normal characters', [[1, [0, 6], [6, 0]]]],
  ]);
});

test('e: test_behaviour_when_moving_to_end_of_next_words', () => {
  check('nextWordEnd', [
    ['Basic forward motion from the start of a word to the end of it', [[1, [0, 0], [0, 5]]]],
    ['Basic forward motion from the end of a word to the end of the next', [[1, [0, 5], [5, 13]]]],
    ['Basic forward motion from the middle of a word to the end of it', [[1, [2, 2], [2, 5]]]],
    ['    Jumping to end of a word preceded by whitespace', [[1, [0, 0], [0, 11]]]],
    ['Previous anchor is irrelevant for end of word motion', [[1, [12, 2], [2, 8]]]],
    ['Identifiers_with_underscores are considered a single word', [[1, [0, 0], [0, 28]]]],
    ['Jumping\n    into starting whitespace selects up to the end of next word', [[1, [0, 7], [8, 16]]]],
    ['alphanumeric.!,and.?=punctuation are considered \'words\' for the purposes of word motion', [[1, [0, 0], [0, 12]], [1, [0, 12], [12, 15]], [1, [12, 15], [15, 18]]]],
    ['...   ... punctuation and spaces behave as expected', [[1, [0, 0], [0, 3]], [1, [0, 3], [3, 9]]]],
    ['.._.._ punctuation is not joined by underscores into a single block', [[1, [0, 0], [0, 2]]]],
    ['Newlines\n\nare bridged seamlessly.', [[1, [0, 0], [0, 8]], [1, [0, 8], [10, 13]]]],
    ['Jumping\n\n\n\n\n\n   from newlines to whitespace selects to end of next word.', [[1, [0, 8], [13, 20]]]],
    ['A failed motion does not modify the range', [[3, [37, 41], [37, 41]]]],
    ['Multiple motions at once resolve correctly', [[3, [0, 0], [16, 19]]]],
    ['Excessive motions are performed partially', [[999, [0, 0], [31, 41]]]],
    ['', [[1, [0, 0], [0, 0]]]],
    ['\n\n\n\n\n', [[1, [0, 0], [5, 5]]]],
    ['\n   \n   \n Jumping through alternated space blocks and newlines selects the space blocks', [[1, [0, 0], [1, 4]], [1, [1, 4], [5, 8]]]],
    ['ヒーリクス multibyte characters behave as normal characters', [[1, [0, 0], [0, 5]]]],
  ]);
});

test('W: test_behaviour_when_moving_to_start_of_next_long_words', () => {
  check('nextLongWordStart', [
    ['Basic forward motion stops at the first space', [[1, [0, 0], [0, 6]]]],
    [' Starting from a boundary advances the anchor', [[1, [0, 0], [1, 10]]]],
    ['Long       whitespace gap is bridged by the head', [[1, [0, 0], [0, 11]]]],
    ['Previous anchor is irrelevant for forward motions', [[1, [12, 0], [0, 9]]]],
    ['    Starting from whitespace moves to last space in sequence', [[1, [0, 0], [0, 4]]]],
    ['Starting from mid-word leaves anchor at start position and moves head', [[1, [3, 3], [3, 9]]]],
    ['Identifiers_with_underscores are considered a single word', [[1, [0, 0], [0, 29]]]],
    ['Jumping\n    into starting whitespace selects the spaces before \'into\'', [[1, [0, 7], [8, 12]]]],
    ['alphanumeric.!,and.?=punctuation are not treated any differently than alphanumerics', [[1, [0, 0], [0, 33]]]],
    ['...   ... punctuation and spaces behave as expected', [[1, [0, 0], [0, 6]], [1, [0, 6], [6, 10]]]],
    ['.._.._ punctuation is joined by underscores into a single word, as it behaves like alphanumerics', [[1, [0, 0], [0, 7]]]],
    ['Newlines\n\nare bridged seamlessly.', [[1, [0, 0], [0, 8]], [1, [0, 8], [10, 14]]]],
    ['Jumping\n\n\n\n\n\n   from newlines to whitespace selects whitespace.', [[1, [0, 9], [13, 16]]]],
    ['A failed motion does not modify the range', [[3, [37, 41], [37, 41]]]],
    ['oh oh oh two character words!', [[1, [0, 0], [0, 3]], [1, [0, 3], [3, 6]], [1, [0, 1], [0, 3]]]],
    ['Multiple motions at once resolve correctly', [[3, [0, 0], [17, 20]]]],
    ['Excessive motions are performed partially', [[999, [0, 0], [32, 41]]]],
    ['', [[1, [0, 0], [0, 0]]]],
    ['\n\n\n\n\n', [[1, [0, 0], [5, 5]]]],
    ['\n   \n   \n Jumping through alternated space blocks and newlines selects the space blocks', [[1, [0, 0], [1, 4]], [1, [1, 4], [5, 8]]]],
    ['ヒー..リクス multibyte characters behave as normal characters, including their interaction with punctuation', [[1, [0, 0], [0, 8]]]],
  ]);
});

test('B: test_behaviour_when_moving_to_start_of_previous_long_words', () => {
  check('prevLongWordStart', [
    ['Basic backward motion from the middle of a word', [[1, [3, 3], [4, 0]]]],
    ['    Jump to start of a word preceded by whitespace', [[1, [5, 5], [6, 4]]]],
    ['    Jump to start of line from start of word preceded by whitespace', [[1, [3, 4], [4, 0]]]],
    ['Previous anchor is irrelevant for backward motions', [[1, [12, 5], [6, 0]]]],
    ['    Starting from whitespace moves to first space in sequence', [[1, [0, 4], [4, 0]]]],
    ['Identifiers_with_underscores are considered a single word', [[1, [0, 20], [20, 0]]]],
    ['Jumping\n    \nback through a newline selects whitespace', [[1, [0, 13], [12, 8]]]],
    ['Jumping to start of word from the end selects the word', [[1, [6, 7], [7, 0]]]],
    ['alphanumeric.!,and.?=punctuation are treated exactly the same', [[1, [29, 30], [30, 0]]]],
    ['...   ... punctuation and spaces behave as expected', [[1, [0, 10], [10, 6]], [1, [10, 6], [6, 0]]]],
    ['.._.._ punctuation is joined by underscores into a single block', [[1, [0, 6], [6, 0]]]],
    ['Newlines\n\nare bridged seamlessly.', [[1, [0, 10], [8, 0]]]],
    ['Jumping    \n\n\n\n\nback from within a newline group selects previous block', [[1, [0, 13], [11, 0]]]],
    ['Failed motions do not modify the range', [[0, [3, 0], [3, 0]]]],
    ['Multiple motions at once resolve correctly', [[3, [19, 19], [9, 0]]]],
    ['Excessive motions are performed partially', [[999, [40, 40], [10, 0]]]],
    ['', [[1, [0, 0], [0, 0]]]],
    ['\n\n\n\n\n', [[1, [5, 5], [0, 0]]]],
    ['   \n   \nJumping back through alternated space blocks and newlines selects the space blocks', [[1, [0, 8], [7, 4]], [1, [7, 4], [3, 0]]]],
    ['ヒーリ..クス multibyte characters behave as normal characters, including when interacting with punctuation', [[1, [0, 8], [8, 0]]]],
  ]);
});

test('E: test_behaviour_when_moving_to_end_of_next_long_words', () => {
  check('nextLongWordEnd', [
    ['Basic forward motion from the start of a word to the end of it', [[1, [0, 0], [0, 5]]]],
    ['Basic forward motion from the end of a word to the end of the next', [[1, [0, 5], [5, 13]]]],
    ['Basic forward motion from the middle of a word to the end of it', [[1, [2, 2], [2, 5]]]],
    ['    Jumping to end of a word preceded by whitespace', [[1, [0, 0], [0, 11]]]],
    ['Previous anchor is irrelevant for end of word motion', [[1, [12, 2], [2, 8]]]],
    ['Identifiers_with_underscores are considered a single word', [[1, [0, 0], [0, 28]]]],
    ['Jumping\n    into starting whitespace selects up to the end of next word', [[1, [0, 7], [8, 16]]]],
    ['alphanumeric.!,and.?=punctuation are treated the same way', [[1, [0, 0], [0, 32]]]],
    ['...   ... punctuation and spaces behave as expected', [[1, [0, 0], [0, 3]], [1, [0, 3], [3, 9]]]],
    ['.._.._ punctuation is joined by underscores into a single block', [[1, [0, 0], [0, 6]]]],
    ['Newlines\n\nare bridged seamlessly.', [[1, [0, 0], [0, 8]], [1, [0, 8], [10, 13]]]],
    ['Jumping\n\n\n\n\n\n   from newlines to whitespace selects to end of next word.', [[1, [0, 9], [13, 20]]]],
    ['A failed motion does not modify the range', [[3, [37, 41], [37, 41]]]],
    ['Multiple motions at once resolve correctly', [[3, [0, 0], [16, 19]]]],
    ['Excessive motions are performed partially', [[999, [0, 0], [31, 41]]]],
    ['', [[1, [0, 0], [0, 0]]]],
    ['\n\n\n\n\n', [[1, [0, 0], [5, 5]]]],
    ['\n   \n   \n Jumping through alternated space blocks and newlines selects the space blocks', [[1, [0, 0], [1, 4]], [1, [1, 4], [5, 8]]]],
    ['ヒーリ..クス multibyte characters behave as normal characters, including  when they interact with punctuation', [[1, [0, 0], [0, 7]]]],
  ]);
});
