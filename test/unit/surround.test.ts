import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Edit } from '../../src/core/editing';
import { replaceSurround } from '../../src/core/match';
import { OffsetRange, WordMotionText } from '../../src/core/wordMotion';

/**
 * `|` marks each cursor (an empty selection before the next character) and is
 * removed from the text. Returns the document after applying the edits, or
 * `undefined` when the command makes no edit.
 */
function surround(source: string, old: string, replacement: string, count = 1): string | undefined {
  const ranges: OffsetRange[] = [];
  let text = '';
  for (const char of source) {
    if (char === '|') { ranges.push({ anchor: text.length, head: text.length }); } else { text += char; }
  }
  const edits = replaceSurround(new WordMotionText(text), ranges, old, replacement, count);
  if (!edits) { return undefined; }
  return apply(text, edits);
}

function apply(text: string, edits: readonly Edit[]): string {
  return [...edits].reverse().reduce((result, edit) =>
    result.slice(0, edit.from) + edit.text + result.slice(edit.to), text);
}

test('mr replaces parentheses with brackets', () => {
  assert.equal(surround('a (te|xt) b', '(', '['), 'a [text] b');
  assert.equal(surround('a (text|) b', '(', '['), 'a [text] b');
  assert.equal(surround('a |(text) b', '(', '['), 'a [text] b');
});

test('mr accepts closing aliases for both the old and the new pair', () => {
  assert.equal(surround('a (te|xt) b', ')', ']'), 'a [text] b');
  assert.equal(surround('a [te|xt] b', ']', '('), 'a (text) b');
  assert.equal(surround('a {te|xt} b', '}', '<'), 'a <text> b');
  assert.equal(surround('a <te|xt> b', '>', '}'), 'a {text} b');
});

test('mr replaces quotes with brackets and back', () => {
  assert.equal(surround('say "he|llo" now', '"', '('), 'say (hello) now');
  assert.equal(surround("say 'he|llo' now", "'", '['), 'say [hello] now');
  assert.equal(surround('say (he|llo) now', '(', '"'), 'say "hello" now');
  assert.equal(surround('say "he|llo" now', '"', "'"), "say 'hello' now");
  assert.equal(surround('say `he|llo` now', '`', '"'), 'say "hello" now');
  assert.equal(surround('say "he|llo" now', '"', '`'), 'say `hello` now');
});

test('mr uses a symmetric pair for other printable characters', () => {
  assert.equal(surround('"x|"', '"', '*'), '*x*');
  assert.equal(surround('(x|)', '(', '_'), '_x_');
  assert.equal(surround('(x|)', '(', 'q'), 'qxq');
  assert.equal(surround('(x|)', '(', '😀'), '😀x😀');
});

test('mr count selects the n-th enclosing pair', () => {
  assert.equal(surround('a (b (c|) d) e', '(', '[', 2), 'a [b (c) d] e');
  assert.equal(surround('a (b (c|) d) e', '(', '[', 1), 'a (b [c] d) e');
  assert.equal(surround('a (b (c|) d) e', '(', '[', 3), undefined);
  assert.equal(surround('"a|"', '"', '*', 2), undefined);
});

test('mr works across lines and with a huge count', () => {
  assert.equal(surround('f {\r\n  a|;\r\n}', '{', '('), 'f (\r\n  a;\r\n)');
  assert.equal(surround('(a|)', '(', '[', 100_000_000), undefined);
});

test('mr makes no edit when any selection has no match', () => {
  assert.equal(surround('(a|) b|', '(', '['), undefined);
  assert.equal(surround('x| (a|)', '(', '['), undefined);
  assert.equal(surround('plain| text', '(', '['), undefined);
  assert.equal(surround('(a|', '(', '['), undefined);
  assert.equal(surround('"a|"  "b', '"', '*'), '*a*  "b');
  assert.equal(surround('"a|" "b|', '"', '*'), undefined);
});

test('mr makes no edit for an invalid old or replacement character', () => {
  assert.equal(surround('(a|)', 'w', '['), undefined);
  assert.equal(surround('(a|)', '*', '['), undefined);
  assert.equal(surround('(a|)', '', '['), undefined);
  for (const replacement of ['', ' ', '\t', '\n', '\u0000', 'ab', '**']) {
    assert.equal(surround('(a|)', '(', replacement), undefined, JSON.stringify(replacement));
  }
});

test('mr reduces several cursors in the same pair to one replacement', () => {
  const text = new WordMotionText('(abc def)');
  const ranges = [{ anchor: 2, head: 2 }, { anchor: 6, head: 6 }, { anchor: 3, head: 5 }];
  assert.deepEqual(replaceSurround(text, ranges, '(', '[', 1), [
    { from: 0, to: 1, text: '[' },
    { from: 8, to: 9, text: ']' },
  ]);
  const withDelimiter = [{ anchor: 0, head: 0 }, { anchor: 8, head: 8 }, { anchor: 4, head: 4 }];
  assert.equal(replaceSurround(text, withDelimiter, ')', '{', 1)?.length, 2);
});

test('mr replaces nested distinct pairs with four sorted edits', () => {
  const text = new WordMotionText('(a (b) c)');
  const edits = replaceSurround(text, [{ anchor: 4, head: 4 }, { anchor: 1, head: 1 }], '(', '[', 1);
  assert.deepEqual(edits, [
    { from: 0, to: 1, text: '[' },
    { from: 3, to: 4, text: '[' },
    { from: 5, to: 6, text: ']' },
    { from: 8, to: 9, text: ']' },
  ]);
  assert.equal(apply(text.text, edits ?? []), '[a [b] c]');
});

test('mr edits each replace one delimiter character, even for astral replacements', () => {
  const text = new WordMotionText('"a" "b"');
  const edits = replaceSurround(text, [{ anchor: 1, head: 1 }, { anchor: 5, head: 5 }], '"', '😀', 1);
  assert.deepEqual(edits, [
    { from: 0, to: 1, text: '😀' },
    { from: 2, to: 3, text: '😀' },
    { from: 4, to: 5, text: '😀' },
    { from: 6, to: 7, text: '😀' },
  ]);
});

test('mr results do not depend on selection order', () => {
  const text = new WordMotionText('[a] (b)');
  const a = replaceSurround(text, [{ anchor: 1, head: 1 }, { anchor: 1, head: 1 }], '[', '(', 1);
  assert.deepEqual(a, [{ from: 0, to: 1, text: '(' }, { from: 2, to: 3, text: ')' }]);
  const reversed = replaceSurround(new WordMotionText('(a) (b)'), [{ anchor: 5, head: 5 }, { anchor: 1, head: 1 }], '(', '<', 1);
  assert.deepEqual(reversed?.map(edit => edit.from), [0, 2, 4, 6]);
});

test('mr makes no edit when the replacement pair equals the old pair', () => {
  assert.deepEqual(replaceSurround(new WordMotionText('(a)'), [{ anchor: 1, head: 1 }], '(', '(', 1), []);
  assert.deepEqual(replaceSurround(new WordMotionText('(a)'), [{ anchor: 1, head: 1 }], '(', ')', 1), []);
  assert.deepEqual(replaceSurround(new WordMotionText('"a"'), [{ anchor: 1, head: 1 }], '"', '"', 1), []);
  assert.deepEqual(replaceSurround(new WordMotionText('(a)'), [{ anchor: 1, head: 1 }], ')', '(', 1), []);
});

test('mr uses the block cursor of non-empty selections', () => {
  const text = new WordMotionText('(a) (b)');
  // A forward selection `a)` has its cursor on `)`, inside the first pair only.
  assert.equal(surround('(a|) (b)', '(', '['), '[a] (b)');
  assert.deepEqual(replaceSurround(text, [{ anchor: 1, head: 3 }], '(', '[', 1)?.map(edit => edit.from), [0, 2]);
  assert.deepEqual(replaceSurround(text, [{ anchor: 6, head: 5 }], '(', '[', 1)?.map(edit => edit.from), [4, 6]);
});
