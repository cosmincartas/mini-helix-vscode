import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Edit, EditResult } from '../../src/core/editing';
import { addSurround, deleteSurround, replaceSurround } from '../../src/core/match';
import { OffsetRange, WordMotionText } from '../../src/core/wordMotion';
import { parseUpstream } from './upstreamHelix';

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

interface Applied { readonly text: string; readonly selections: readonly OffsetRange[] }

function applyResult(text: string, result: EditResult | undefined): Applied | undefined {
  return result && { text: apply(text, result.edits), selections: result.selections };
}

function add(text: string, ranges: OffsetRange[], character: string, eol = '\n'): Applied | undefined {
  return applyResult(text, addSurround(new WordMotionText(text), ranges, character, eol));
}

function remove(text: string, ranges: OffsetRange[], target: string, count = 1): Applied | undefined {
  return applyResult(text, deleteSurround(new WordMotionText(text), ranges, target, count));
}

/** `md` on text with `|` cursors; the document after the edit, or `undefined` for no edit. */
function deleted(source: string, target: string, count = 1): string | undefined {
  const ranges: OffsetRange[] = [];
  let text = '';
  for (const char of source) {
    if (char === '|') { ranges.push({ anchor: text.length, head: text.length }); } else { text += char; }
  }
  return remove(text, ranges, target, count)?.text;
}

test('ms puts the pair around a selection and selects the result', () => {
  const selection = [{ anchor: 2, head: 6 }];
  const expected = (text: string) => ({ text, selections: [{ anchor: 2, head: 8 }] });
  assert.deepEqual(add('a text b', selection, '('), expected('a (text) b'));
  assert.deepEqual(add('a text b', selection, ')'), expected('a (text) b'));
  assert.deepEqual(add('a text b', selection, '*'), expected('a *text* b'));
  assert.deepEqual(add('a text b', selection, ' '), expected('a  text  b'));
  assert.deepEqual(add('a text b', selection, '"'), expected('a "text" b'));
});

test('ms Enter puts the document line ending on both sides', () => {
  const selection = [{ anchor: 0, head: 4 }];
  assert.deepEqual(add('text', selection, '\n', '\n'), { text: '\ntext\n', selections: [{ anchor: 0, head: 6 }] });
  assert.deepEqual(add('text', selection, '\n', '\r\n'), { text: '\r\ntext\r\n', selections: [{ anchor: 0, head: 8 }] });
});

test('ms keeps the direction of each selection', () => {
  assert.deepEqual(add('a text b', [{ anchor: 2, head: 6 }], '('), { text: 'a (text) b', selections: [{ anchor: 2, head: 8 }] });
  assert.deepEqual(add('a text b', [{ anchor: 6, head: 2 }], '('), { text: 'a (text) b', selections: [{ anchor: 8, head: 2 }] });
});

test('ms on a cursor surrounds the grapheme after it', () => {
  assert.deepEqual(add('abc', [{ anchor: 1, head: 1 }], '('), { text: 'a(b)c', selections: [{ anchor: 1, head: 4 }] });
  assert.deepEqual(add('a😀c', [{ anchor: 1, head: 1 }], '['), { text: 'a[😀]c', selections: [{ anchor: 1, head: 5 }] });
});

test('ms at the end of the text inserts and selects an empty pair', () => {
  assert.deepEqual(add('abc', [{ anchor: 3, head: 3 }], '('), { text: 'abc()', selections: [{ anchor: 3, head: 5 }] });
});

test('ms gives adjacent selections their own pairs', () => {
  assert.deepEqual(add('ab', [{ anchor: 0, head: 1 }, { anchor: 1, head: 2 }], '('), {
    text: '(a)(b)',
    selections: [{ anchor: 0, head: 3 }, { anchor: 3, head: 6 }],
  });
});

test('ms returns the selections in input order', () => {
  assert.deepEqual(add('a b c', [{ anchor: 4, head: 5 }, { anchor: 0, head: 1 }, { anchor: 3, head: 2 }], '*'), {
    text: '*a* *b* *c*',
    selections: [{ anchor: 8, head: 11 }, { anchor: 0, head: 3 }, { anchor: 7, head: 4 }],
  });
});

test('ms makes no edit for an invalid character', () => {
  for (const character of ['\t', '', 'ab', '\r', '\u0000']) {
    assert.equal(add('text', [{ anchor: 0, head: 4 }], character), undefined, JSON.stringify(character));
  }
});

test('ms makes no edit for overlapping ranges but allows touching ones', () => {
  assert.equal(add('abcd', [{ anchor: 0, head: 3 }, { anchor: 2, head: 4 }], '('), undefined);
  assert.equal(add('abcd', [{ anchor: 2, head: 4 }, { anchor: 0, head: 3 }], '('), undefined);
  assert.equal(add('abcd', [{ anchor: 0, head: 2 }, { anchor: 1, head: 1 }], '('), undefined);
  assert.equal(add('abcd', [{ anchor: 0, head: 2 }, { anchor: 2, head: 4 }], '(')?.text, '(ab)(cd)');
});

test('md deletes the pair around the cursor', () => {
  assert.equal(deleted('a (te|xt) b', '('), 'a text b');
  assert.equal(deleted('a (te|xt) b', ')'), 'a text b');
  assert.equal(deleted('a [te|xt] b', '['), 'a text b');
  assert.equal(deleted('a {te|xt} b', '{'), 'a text b');
  assert.equal(deleted('a <te|xt> b', '<'), 'a text b');
  assert.equal(deleted('a "te|xt" b', '"'), 'a text b');
  assert.equal(deleted("a 'te|xt' b", "'"), 'a text b');
  assert.equal(deleted('a `te|xt` b', '`'), 'a text b');
  assert.equal(deleted('a |(text) b', '('), 'a text b');
  assert.equal(deleted('a (text|) b', '('), 'a text b');
});

test('md quotes pair within the cursor line and skip escaped quotes', () => {
  assert.equal(deleted('"a" |b "c"', '"'), undefined);
  assert.equal(deleted('"x"\n"a|"', '"'), '"x"\na');
  assert.equal(deleted('"a\\" b|" c', '"'), 'a\\" b c');
  assert.equal(deleted('"a" "b|" "c"', '"'), '"a" b "c"');
});

test('md count deletes the n-th enclosing pair', () => {
  assert.equal(deleted('(a (b|))', '(', 2), 'a (b)');
  assert.equal(deleted('(a (b|))', '(', 1), '(a b)');
  assert.equal(deleted('(a (b|))', '(', 3), undefined);
  assert.equal(deleted('"a|"', '"', 2), undefined);
});

test('md makes no edit when any cursor has no pair', () => {
  assert.equal(deleted('(a|) b|', '('), undefined);
  assert.equal(deleted('b| (a|)', '('), undefined);
  assert.equal(deleted('plain| text', '('), undefined);
  assert.equal(deleted('(a|', '('), undefined);
});

test('md reduces several cursors in one pair to one deletion', () => {
  assert.equal(deleted('(a|b c|d)', '('), 'ab cd');
  assert.equal(deleted('|(ab c|d|)', ')'), 'ab cd');
  const text = new WordMotionText('(abc def)');
  assert.deepEqual(deleteSurround(text, [{ anchor: 2, head: 2 }, { anchor: 6, head: 6 }], '(', 1)?.edits, [
    { from: 0, to: 1, text: '' },
    { from: 8, to: 9, text: '' },
  ]);
});

test('md deletes nested distinct pairs with four sorted edits', () => {
  const text = new WordMotionText('(a (b) c)');
  const result = deleteSurround(text, [{ anchor: 4, head: 4 }, { anchor: 1, head: 1 }], '(', 1);
  assert.deepEqual(result?.edits, [
    { from: 0, to: 1, text: '' },
    { from: 3, to: 4, text: '' },
    { from: 5, to: 6, text: '' },
    { from: 8, to: 9, text: '' },
  ]);
  assert.equal(apply(text.text, result?.edits ?? []), 'a b c');
});

test('md makes no edit for a target that is not a delimiter', () => {
  assert.equal(deleted('(a|)', '*'), undefined);
  assert.equal(deleted('(a|)', 'w'), undefined);
  assert.equal(deleted('(a|)', ''), undefined);
});

test('md maps each selection boundary past the deleted delimiters', () => {
  assert.deepEqual(remove('(ab)', [{ anchor: 3, head: 3 }], '('), { text: 'ab', selections: [{ anchor: 2, head: 2 }] });
  // `ma(` on `(ab)` selects all four characters.
  assert.deepEqual(remove('(ab)', [{ anchor: 0, head: 4 }], '('), { text: 'ab', selections: [{ anchor: 0, head: 2 }] });
  assert.deepEqual(remove('(ab)', [{ anchor: 4, head: 0 }], '('), { text: 'ab', selections: [{ anchor: 2, head: 0 }] });
});

test('md returns the selections in input order', () => {
  assert.deepEqual(remove('(a) (b)', [{ anchor: 5, head: 5 }, { anchor: 1, head: 1 }], '('), {
    text: 'a b',
    selections: [{ anchor: 2, head: 2 }, { anchor: 0, head: 0 }],
  });
});

// Ported from helix-term/tests/test/commands.rs:surround_delete at ba40e547.
test('md matches upstream Helix surround_delete', () => {
  const input = parseUpstream('(#[|  ]#)');
  const expected = parseUpstream('#[|  ]#');
  const result = remove(input.text, [...input.ranges], '(');
  assert.equal(result?.text, expected.text);
  assert.deepEqual(result?.selections, expected.ranges);
});
