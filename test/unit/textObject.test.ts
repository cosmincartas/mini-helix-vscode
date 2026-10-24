import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cursorOffset, delimiterPair, findPair, replacementPair, selectTextObjects, TextObjectKind } from '../../src/core/match';
import { OffsetRange, WordMotionText } from '../../src/core/wordMotion';

/**
 * Test notation: `|` marks the cursor (an empty selection before the next
 * character) and is removed from the text. The result shows the selected
 * range in `«»`, or `∅` when there is no match.
 */
function select(source: string, kind: TextObjectKind, target: string, count = 1): string {
  const offset = source.indexOf('|');
  const text = source.replace('|', '');
  const [range] = selectTextObjects(new WordMotionText(text), [{ anchor: offset, head: offset }], kind, target, count);
  if (range.anchor === offset && range.head === offset) { return '∅'; }
  return `${text.slice(0, range.anchor)}«${text.slice(range.anchor, range.head)}»${text.slice(range.head)}`;
}

const inside = (source: string, target: string, count = 1) => select(source, 'inside', target, count);
const around = (source: string, target: string, count = 1) => select(source, 'around', target, count);

test('cursorOffset follows the block cursor convention', () => {
  const text = new WordMotionText('a😀bc');
  assert.equal(cursorOffset(text, { anchor: 2, head: 2 }), 2);
  assert.equal(cursorOffset(text, { anchor: 4, head: 1 }), 1);
  assert.equal(cursorOffset(text, { anchor: 1, head: 3 }), 1);
  assert.equal(cursorOffset(text, { anchor: 0, head: 1 }), 0);
  assert.equal(cursorOffset(text, { anchor: 1, head: 4 }), 3);
});

test('delimiterPair maps delimiters and aliases', () => {
  for (const [char, open, close] of [
    ['(', '(', ')'], [')', '(', ')'], ['[', '[', ']'], [']', '[', ']'], ['{', '{', '}'], ['}', '{', '}'],
    ['<', '<', '>'], ['>', '<', '>'], ['"', '"', '"'], ["'", "'", "'"],
  ]) {
    assert.deepEqual(delimiterPair(char), { open, close });
  }
  for (const char of ['', 'w', '*', '()', ' ', 'toString', '__proto__']) {
    assert.equal(delimiterPair(char), undefined, JSON.stringify(char));
  }
});

test('replacementPair accepts delimiters, aliases and single printable graphemes', () => {
  assert.deepEqual(replacementPair('('), { open: '(', close: ')' });
  assert.deepEqual(replacementPair('}'), { open: '{', close: '}' });
  assert.deepEqual(replacementPair('*'), { open: '*', close: '*' });
  assert.deepEqual(replacementPair('x'), { open: 'x', close: 'x' });
  assert.deepEqual(replacementPair('é'), { open: 'é', close: 'é' });
  assert.deepEqual(replacementPair('👨‍👩‍👧'), { open: '👨‍👩‍👧', close: '👨‍👩‍👧' });
  for (const char of ['', ' ', '\t', '\n', '\r\n', '\u0000', ' ', 'ab', '**', '​']) {
    assert.equal(replacementPair(char), undefined, JSON.stringify(char));
  }
});

test('word: inside selects the run of the cursor category', () => {
  assert.equal(inside('foo |bar baz', 'w'), 'foo «bar» baz');
  assert.equal(inside('foo b|ar baz', 'w'), 'foo «bar» baz');
  assert.equal(inside('foo ba|r baz', 'w'), 'foo «bar» baz');
  assert.equal(inside('foo|_1 x', 'w'), '«foo_1» x');
  assert.equal(inside('a |+= b', 'w'), 'a «+=» b');
  assert.equal(inside('a|, b', 'w'), 'a«,» b');
  assert.equal(inside('|a, b', 'w'), '«a», b');
  assert.equal(inside('a|   b', 'w'), 'a«   »b');
  assert.equal(inside('a \t|\t b', 'w'), 'a« \t\t »b');
  assert.equal(inside('x|  \ty', 'w'), 'x«  \t»y');
  assert.equal(inside('a (|b)', 'w'), 'a («b»)');
});

test('word: unknown category and unicode graphemes', () => {
  assert.equal(inside('a |\u{1F600}\u{1F600} b', 'w'), 'a «\u{1F600}\u{1F600}» b');
  assert.equal(inside('a \u{1F600}|\u{1F600} b', 'w'), 'a «\u{1F600}\u{1F600}» b');
  assert.equal(inside('ab |éé cd', 'w'), 'ab «éé» cd');
  assert.equal(inside('héllo wörld|', 'w'), '∅');
  assert.equal(inside('héllo |wörld', 'w'), 'héllo «wörld»');
  assert.equal(inside('日本語 |テスト', 'w'), '日本語 «テスト»');
});

test('word: around takes trailing whitespace, else leading, else the run', () => {
  assert.equal(around('foo |bar baz', 'w'), 'foo «bar »baz');
  assert.equal(around('foo ba|r  \tbaz', 'w'), 'foo «bar  \t»baz');
  assert.equal(around('foo |bar', 'w'), 'foo« bar»');
  assert.equal(around('foo   |bar', 'w'), 'foo«   bar»');
  assert.equal(around('foo\n|bar', 'w'), 'foo\n«bar»');
  assert.equal(around('|foo', 'w'), '«foo»');
  assert.equal(around('foo |bar\nbaz', 'w'), 'foo« bar»\nbaz');
  assert.equal(around('|foo\nbaz', 'w'), '«foo»\nbaz');
  assert.equal(around('|a, b', 'w'), '«a», b');
  assert.equal(around('a|, b', 'w'), 'a«, »b');
  assert.equal(around('x  |\ty', 'w'), 'x«  \t»y');
  assert.equal(around('|a\n  b', 'w'), '«a»\n  b');
});

test('word: line ends, end of document and empty document give no match', () => {
  assert.equal(inside('foo|\nbar', 'w'), '∅');
  assert.equal(around('foo|\r\nbar', 'w'), '∅');
  assert.equal(inside('foo|\rbar', 'w'), '∅');
  assert.equal(inside('foo|', 'w'), '∅');
  assert.equal(around('|', 'w'), '∅');
  assert.equal(inside('|\n', 'w'), '∅');
  assert.equal(inside('foo\r\n|bar', 'w'), 'foo\r\n«bar»');
});

test('word: count is ignored', () => {
  assert.equal(inside('foo |bar baz', 'w', 5), 'foo «bar» baz');
  assert.equal(around('foo |bar baz', 'w', 3), 'foo «bar »baz');
});

test('brackets: nested pairs and the first enclosing pair', () => {
  assert.equal(inside('a (b (c| d) e) f', '('), 'a (b («c d») e) f');
  assert.equal(around('a (b (c| d) e) f', '('), 'a (b «(c d)» e) f');
  assert.equal(inside('a (b| (c d) e) f', ')'), 'a («b (c d) e») f');
  assert.equal(inside('[a, [b|], c]', '['), '[a, [«b»], c]');
  assert.equal(around('x{ y| }z', '}'), 'x«{ y }»z');
  assert.equal(inside('f(a, g(b), |c)', '('), 'f(«a, g(b), c»)');
});

test('brackets: cursor on a delimiter makes that pair the first enclosing pair', () => {
  assert.equal(inside('a |(b (c) d) e', '('), 'a («b (c) d») e');
  assert.equal(inside('a (b (c) d|) e', '('), 'a («b (c) d») e');
  assert.equal(inside('a (b |(c) d) e', '('), 'a (b («c») d) e');
  assert.equal(inside('a (b (c|) d) e', ')'), 'a (b («c») d) e');
  assert.equal(inside('a (b |(c) d) e', '(', 2), 'a («b (c) d») e');
  assert.equal(inside('a (b (c|) d) e', '(', 2), 'a («b (c) d») e');
  assert.equal(around('|(x)', '('), '«(x)»');
  assert.equal(around('(x|)', '('), '«(x)»');
});

test('brackets: multi-line pairs', () => {
  assert.equal(inside('fn {\n  a|;\n  b;\n}', '{'), 'fn {«\n  a;\n  b;\n»}');
  assert.equal(around('fn {\r\n  a|;\r\n}', '{'), 'fn «{\r\n  a;\r\n}»');
  assert.equal(inside('(\n|)', '('), '(«\n»)');
});

test('brackets: empty pair gives a caret between the delimiters', () => {
  const text = new WordMotionText('f()');
  assert.deepEqual(selectTextObjects(text, [{ anchor: 1, head: 1 }], 'inside', '(', 1), [{ anchor: 2, head: 2 }]);
  assert.deepEqual(selectTextObjects(text, [{ anchor: 1, head: 1 }], 'around', '(', 1), [{ anchor: 1, head: 3 }]);
});

test('brackets: unbalanced or missing pairs give no match', () => {
  assert.equal(inside('a (b| c', '('), '∅');
  assert.equal(inside('a b| c)', '('), '∅');
  assert.equal(inside('plain| text', '('), '∅');
  assert.equal(inside('( (a|)', '(', 2), '∅');
  assert.equal(inside('(a|', '('), '∅');
  assert.equal(inside('a) (b|', '('), '∅');
  assert.equal(inside('a) (b|)', '('), 'a) («b»)');
  assert.equal(inside('(a)|', '('), '∅');
  assert.equal(inside('|', '('), '∅');
});

test('brackets: count selects the n-th enclosing pair', () => {
  const source = 'a (b (c| d) e) f';
  assert.equal(inside(source, '(', 1), 'a (b («c d») e) f');
  assert.equal(inside(source, '(', 2), 'a («b (c d) e») f');
  assert.equal(around(source, '(', 2), 'a «(b (c d) e)» f');
  assert.equal(inside(source, '(', 3), '∅');
  assert.equal(inside('((a|) b) (c)', '(', 2), '(«(a) b») (c)');
  assert.equal(inside('(a (b) c| (d) e)', '(', 1), '(«a (b) c (d) e»)');
});

test('brackets: a huge count is fast and gives no match', () => {
  const text = new WordMotionText('('.repeat(2000) + 'x' + ')'.repeat(2000));
  const start = performance.now();
  assert.equal(findPair(text, 2000, { open: '(', close: ')' }, 100_000_000), undefined);
  assert.deepEqual(findPair(text, 2000, { open: '(', close: ')' }, 2000), { open: 0, close: 4000 });
  assert.ok(performance.now() - start < 500);
});

test('brackets: angle brackets count like any others', () => {
  assert.equal(inside('Vec<Option<T|>>', '<'), 'Vec<Option<«T»>>');
  assert.equal(inside('Vec<Option<T|>>', '>', 2), 'Vec<«Option<T>»>');
  assert.equal(around('a <b| c>', '<'), 'a «<b c>»');
  assert.equal(inside('a -> b| c', '<'), '∅');
});

test('quotes: cursor inside, on either quote, or between pairs', () => {
  assert.equal(inside('say "he|llo" now', '"'), 'say "«hello»" now');
  assert.equal(around('say "he|llo" now', '"'), 'say «"hello"» now');
  assert.equal(inside('say |"hello" now', '"'), 'say "«hello»" now');
  assert.equal(inside('say "hello|" now', '"'), 'say "«hello»" now');
  assert.equal(inside('say "hello"| now', '"'), '∅');
  assert.equal(inside('"a" |b "c"', '"'), '∅');
  assert.equal(inside('"a" b "c|"', '"'), '"a" b "«c»"');
  // The apostrophe pairs with the next quote, so the cursor lies between pairs.
  assert.equal(inside("it's 'a|b'", "'"), '∅');
  assert.equal(inside("it's 'a|b' c'd", "'"), '∅');
});

test('quotes: pairs left to right, unmatched trailing quote', () => {
  assert.equal(inside('"a" "b|" "c', '"'), '"a" "«b»" "c');
  assert.equal(inside('"a" "b" "c|', '"'), '∅');
  assert.equal(inside('"a" "b" |"c', '"'), '∅');
  assert.equal(inside("'a|' \"b\"", '"'), '∅');
});

test('quotes: escaped quotes are skipped', () => {
  assert.equal(inside('"a \\"q|\\" b" c', '"'), '"«a \\"q\\" b»" c');
  assert.equal(inside('"a \\\\|" c', '"'), '"«a \\\\»" c');
  assert.equal(inside('"a \\\\\\"|b" c', '"'), '"«a \\\\\\"b»" c');
  assert.equal(inside('x \\"a|" y', '"'), '∅');
});

test('quotes: pairing is line-local for every line ending', () => {
  assert.equal(inside('"a\n"b|"\n', '"'), '"a\n"«b»"\n');
  assert.equal(inside('"a\r\n"b|"', '"'), '"a\r\n"«b»"');
  assert.equal(inside('"a\r"b|"', '"'), '"a\r"«b»"');
  assert.equal(inside('"a|\n"b"', '"'), '∅');
  assert.equal(inside('"a\r\n|"b"', '"'), '"a\r\n"«b»"');
  assert.equal(inside('"a\n|\nb"', '"'), '∅');
});

test('quotes: a count of 2 or more gives no match', () => {
  assert.equal(inside('"a|"', '"', 1), '"«a»"');
  assert.equal(inside('"a|"', '"', 2), '∅');
  assert.equal(inside('"a "b|" c"', '"', 2), '∅');
  assert.equal(inside("'a|'", "'", 100_000_000), '∅');
});

test('quotes: empty pair gives a caret between the quotes', () => {
  const text = new WordMotionText('x ""');
  assert.deepEqual(selectTextObjects(text, [{ anchor: 2, head: 2 }], 'inside', '"', 1), [{ anchor: 3, head: 3 }]);
  assert.deepEqual(selectTextObjects(text, [{ anchor: 3, head: 3 }], 'around', '"', 1), [{ anchor: 2, head: 4 }]);
});

test('direction: reversed input gives reversed output, otherwise forward', () => {
  const text = new WordMotionText('f(abc) x');
  const result = (range: OffsetRange) => selectTextObjects(text, [range], 'inside', '(', 1)[0];
  assert.deepEqual(result({ anchor: 3, head: 3 }), { anchor: 2, head: 5 });
  assert.deepEqual(result({ anchor: 2, head: 3 }), { anchor: 2, head: 5 });
  assert.deepEqual(result({ anchor: 4, head: 3 }), { anchor: 5, head: 2 });
  const word = selectTextObjects(text, [{ anchor: 3, head: 2 }], 'inside', 'w', 1)[0];
  assert.deepEqual(word, { anchor: 5, head: 2 });
});

test('forward non-empty selections use the last grapheme as the cursor', () => {
  const text = new WordMotionText('(a) (b)');
  // `a)` is selected forward: the cursor is the `)` at 2, so the first pair matches.
  assert.deepEqual(selectTextObjects(text, [{ anchor: 1, head: 3 }], 'inside', '(', 1), [{ anchor: 1, head: 2 }]);
  // `a) ` ends before the second pair: the cursor is the space at 3, between pairs.
  assert.deepEqual(selectTextObjects(text, [{ anchor: 1, head: 4 }], 'inside', '(', 1), [{ anchor: 1, head: 4 }]);
});

test('multiple selections are handled independently and keep their order', () => {
  const text = new WordMotionText('(a) b (c) [d]');
  const ranges: OffsetRange[] = [
    { anchor: 7, head: 7 }, // c
    { anchor: 4, head: 4 }, // b: no match
    { anchor: 12, head: 11 }, // reversed, on d
    { anchor: 1, head: 1 }, // a
  ];
  assert.deepEqual(selectTextObjects(text, ranges, 'inside', '(', 1), [
    { anchor: 7, head: 8 },
    { anchor: 4, head: 4 },
    { anchor: 12, head: 11 },
    { anchor: 1, head: 2 },
  ]);
  assert.deepEqual(selectTextObjects(text, ranges, 'around', ']', 1), [
    ranges[0], ranges[1], { anchor: 13, head: 10 }, ranges[3],
  ]);
});

test('an unknown target leaves the ranges unchanged', () => {
  const text = new WordMotionText('(a)');
  const ranges = [{ anchor: 1, head: 1 }];
  for (const target of ['x', '', 'W', '((']) {
    assert.deepEqual(selectTextObjects(text, ranges, 'inside', target, 1), ranges);
  }
});
