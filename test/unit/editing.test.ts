import assert from 'node:assert/strict';
import { test } from 'node:test';
import { append, changeSelection, deleteSelection, restoreAppendCursor } from '../../src/core/editing';
import { WordMotionText } from '../../src/core/wordMotion';
import { applyEdits, cursors, normalize, ordered, parse, print, Session } from './helix';

/**
 * `[input, keys, Helix's output]` in Helix's test notation, run through real
 * Helix (helix-term's integration harness, line endings as-is). `'cursor'`
 * rows compare the text and block-cursor positions only: Helix keeps
 * selections while typing in INSERT, but VS Code typing replaces selections,
 * so `i` and `a` leave carets instead.
 */
type Case = [input: string, keys: string, helix: string, compare?: 'cursor'];

// Ported from helix-term/tests, with the trailing newline Helix's harness adds.
const helixSuite: Case[] = [
  // movement.rs: insert_mode_cursor_position, hello_world (integration.rs)
  ['#[\n|]#', 'i', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'i<esc>', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'i<esc>i', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ihello world<esc>', 'hello world#[|\n]#', 'cursor'],
  // movement.rs: insert_to_normal_mode_cursor_position
  ['#[f|]#oo\n#(b|)#ar\n', 'a', '#[fo|]#o\n#(ba|)#r\n', 'cursor'],
  ['#[f|]#oo\n#(b|)#ar\n', 'a<esc>', '#[f|]#oo\n#(b|)#ar\n'],
  // movement.rs: cursor_position_append_eof
  ['#[foo|]#\n', 'abar<esc>', '#[foobar|]#\n', 'cursor'],
  ['#[|foo]#\n', 'abar<esc>', '#[foobar|]#\n', 'cursor'],
  // commands.rs: test_delete_char_forward. Helix's fourth line keeps the
  // document's final line ending; VS Code's native deleteRight removes it.
  ['#[abc|]#def\n#(abc|)#ef\n#(abc|)#f\n', 'a<del><esc>', '#[abc|]#ef\n#(abc|)#f\n#(abc|)#\n', 'cursor'],
  // commands/insert.rs: change_line_above_comment, without `:lang rust`
  ['#[fn main() {}\n|]#// a comment\n', 'c', '#[\n|]#// a comment\n'],
];

const deletes: Case[] = [
  ['#[foo|]# bar\n', 'd', '#[ |]#bar\n'],
  ['#[|foo]# bar\n', 'd', '#[ |]#bar\n'],
  ['f#[o|]#o\n', 'd', 'f#[o|]#\n'],
  ['foo#[\n|]#bar\n', 'd', 'foo#[b|]#ar\n'],
  ['#[foo\n|]#bar\n', 'd', '#[b|]#ar\n'],
  ['#[a|]#b#(c|)#d\n', 'd', '#[b|]##(d|)#\n'],
  ['#[a|]##(b|)#c\n', 'd', '#[c|]#\n'],
  ['#(a|)##[b|]#c\n', 'd', '#[c|]#\n'],
  ['foo#[|]#', 'd', 'foo#[|]#'],
  ['#[foo\nbar|]#', 'd', '#[|]#'],
  ['#[👋🏽|]# x\n', 'd', '#[ |]#x\n'],
  ['#[é|]#x\n', 'd', '#[x|]#\n'],
  ['a#[\r\n|]#b', 'd', 'a#[b|]#'],
  ['#[a\r\n|]#b\r\n', 'd', '#[b|]#\r\n'],
  ['ab#[c|]#', 'd', 'ab#[|]#'],
  ['#[|]#', 'd', '#[|]#'],
];

const changes: Case[] = [
  ['#[foo|]# bar\n', 'cX<esc>', 'X#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'c', '#[ |]#bar\n'],
  ['f#[o|]#o\n', 'cX<esc>', 'fX#[o|]#\n'],
  ['#(a|)# #[b|]#\n', 'cX<esc>', 'X#( |)#X#[\n|]#'],
  // Whole lines open one line above what followed, with that line's indent
  // level (a new Helix document indents with tabs, 4 columns wide).
  ['#[foo\n|]#bar\n', 'c', '#[\n|]#bar\n'],
  ['#[foo\n|]#bar\n', 'cX<esc>', 'X#[\n|]#bar\n'],
  ['x\n#[  foo\n|]#    bar\n', 'c', 'x\n\t#[\n|]#    bar\n'],
  ['x\n#[foo\n|]#  bar\n', 'c', 'x\n#[\n|]#  bar\n'],
  ['x\n#[foo\n|]#\tbar\n', 'c', 'x\n\t#[\n|]#\tbar\n'],
  ['x\n#[foo\n|]#      bar\n', 'c', 'x\n\t#[\n|]#      bar\n'],
  ['#[a\nb\n|]#c\n', 'c', '#[\n|]#c\n'],
  ['a\n#[b\n|]#', 'c', 'a\n#[\n|]#'],
  ['a\n#[b\nc|]#', 'c', 'a\n#[\n|]#'],
  ['#[a\nb|]#', 'c', '#[\n|]#'],
  ['a\n#[\n|]#b\n', 'c', 'a\n#[\n|]#b\n'],
  ['#[a\n|]#b\n#(c\n|)#d\n', 'c', '#[\n|]#b\n#(\n|)#d\n'],
  ['#[a\n|]##(b\n|)#c\n', 'c', '#[\n|]#c\n'],
  ['#[|a\n]#b\n', 'c', '#[\n|]#b\n'],
  // The Helix document's line ending is `\n`; VS Code uses the document's.
  ['#[a\r\n|]#b\r\n', 'c', '#[\n|]#b\r\n'],
  // Not whole lines: a plain delete.
  ['#[a\n|]#b#(c|)#\n', 'c', '#[b|]##(\n|)#'],
  ['a#[\nb\n|]#c\n', 'c', 'a#[c|]#\n'],
];

const appends: Case[] = [
  ['#[foo|]#', 'a', '#[foo\n|]#', 'cursor'],
  ['#[foo|]#', 'abar<esc>', '#[foobar|]#\n', 'cursor'],
  ['#[|foo]#', 'abar<esc>', '#[foobar|]#\n', 'cursor'],
  ['fo#[o|]#', 'a<esc>', 'fo#[o|]#\n'],
  ['foo#[\n|]#bar\n', 'a', 'foo#[\nb|]#ar\n', 'cursor'],
  ['foo#[\n|]#bar\n', 'aX<esc>', 'foo#[\nX|]#bar\n', 'cursor'],
  ['#[foo|]# bar\n', 'aX<esc>', '#[fooX|]# bar\n', 'cursor'],
  ['#[|]#', 'a', '#[|]#'],
  ['#[|]#', 'aX<esc>', 'X#[|]#'],
  ['#[f|]#oo\n', 'a<esc>a<esc>', '#[f|]#oo\n'],
  ['#[👋🏽|]# x\n', 'aX<esc>', '#[👋🏽X|]# x\n', 'cursor'],
  ['#[a|]#b#(c|)#d\n', 'aX<esc>', '#[aX|]#b#(cX|)#d\n', 'cursor'],
  ['a#[\r\n|]#b', 'aX<esc>', 'a#[\r\nX|]#b', 'cursor'],
];

const inserts: Case[] = [
  ['#[foo|]# bar\n', 'i', '#[|foo]# bar\n', 'cursor'],
  ['#[foo|]# bar\n', 'i<esc>', '#[|foo]# bar\n', 'cursor'],
  ['#[foo|]# bar\n', 'iX<esc>', 'X#[|foo]# bar\n', 'cursor'],
  ['#[|foo]# bar\n', 'iX<esc>', 'X#[|foo]# bar\n', 'cursor'],
  ['f#[o|]#o\n', 'iX<esc>', 'fX#[|o]#o\n', 'cursor'],
  ['#[a|]#b#(c|)#d\n', 'iX<esc>', 'X#[|a]#bX#(|c)#d\n', 'cursor'],
];

const withMotions: Case[] = [
  ['#[o|]#ne two three\n', 'wd', '#[t|]#wo three\n'],
  ['one #[t|]#wo\n', 'bd', '#[t|]#wo\n'],
  ['#[o|]#ne two\n', 'wwd', 'one #[\n|]#'],
  ['#[o|]#ne two\n', 'ecX<esc>', 'X#[ |]#two\n'],
  ['#[o|]#ne two\n', 'ea!<esc>', '#[one!|]# two\n', 'cursor'],
  ['one #[t|]#wo\n', 'bi(<esc>', '(#[|one ]#two\n', 'cursor'],
];

function check(cases: Case[]): void {
  for (const [input, keys, helix, compare] of cases) {
    const session = Session.from(input).keys(keys);
    const actual = ordered(normalize(session.document));
    const expected = ordered(normalize(parse(helix)));
    const message = `${JSON.stringify(input)} ${keys} gave ${JSON.stringify(print(actual))}`;
    assert.equal(actual.text, expected.text, message);
    if (compare === 'cursor') {
      assert.deepEqual(cursors(actual), cursors(expected), message);
    } else {
      assert.deepEqual(actual.ranges, expected.ranges, message);
    }
    const insert = /[iac]/.test(keys) && !keys.endsWith('<esc>');
    assert.equal(session.mode, insert ? 'insert' : 'normal', message);
  }
}

test('Helix test suite: i, a, and c cases', () => check(helixSuite));
test('d deletes selections, or the grapheme under each cursor', () => check(deletes));
test('c deletes selections, or replaces whole lines with an indented one', () => check(changes));
test('a appends after selections and restores the cursor on Escape', () => check(appends));
test('i inserts before selections', () => check(inserts));
test('edits act on the selections word motions make', () => check(withMotions));

test('an empty VS Code selection behaves as the block cursor over the next grapheme', () => {
  // VS Code carets stand for Helix's one-grapheme ranges: rerun every case
  // whose ranges are all single forward graphemes with carets instead.
  const all = [...helixSuite, ...deletes, ...changes, ...appends, ...inserts, ...withMotions];
  let rerun = 0;
  for (const [input, keys, helix, compare] of all) {
    const document = parse(input);
    const prepared = new WordMotionText(document.text);
    if (!document.ranges.every(range => prepared.after(range.anchor)?.end === range.head)) { continue; }
    const carets = document.ranges.map(range => ({ anchor: range.anchor, head: range.anchor }));
    check([[print({ text: document.text, ranges: carets }), keys, helix, compare]]);
    rerun++;
  }
  assert.ok(rerun >= 15, `only ${rerun} cases use single-grapheme cursors`);
});

test('edits use the document line ending and editor indentation', () => {
  const text = new WordMotionText('a\r\n  b\r\n    c\r\n');
  const result = changeSelection(text, [{ anchor: 3, head: 8 }], '\r\n', { unit: '  ', tabSize: 8 });
  assert.equal(applyEdits(text.text, result.edits), 'a\r\n    \r\n    c\r\n');
  assert.deepEqual(result.selections, [{ anchor: 7, head: 7 }]);

  const end = new WordMotionText('a\r\nb');
  const appended = append(end, [{ anchor: 3, head: 4 }], '\r\n');
  assert.equal(applyEdits(end.text, appended.edits), 'a\r\nb\r\n');
  assert.deepEqual(appended.selections, [{ anchor: 4, head: 4 }]);
});

test('edits are sorted and disjoint, and the primary selection stays first', () => {
  const text = new WordMotionText('abcdef');
  // VS Code may report the primary (first) selection after the others.
  const result = deleteSelection(text, [
    { anchor: 4, head: 5 }, { anchor: 0, head: 2 }, { anchor: 1, head: 3 }, { anchor: 2, head: 2 },
  ]);
  assert.deepEqual(result.edits, [{ from: 0, to: 3, text: '' }, { from: 4, to: 5, text: '' }]);
  assert.deepEqual(result.selections, [{ anchor: 1, head: 1 }, { anchor: 0, head: 0 }]);
  assert.equal(applyEdits(text.text, result.edits), 'df');
});

test('restoring the append cursor leaves selections and the end of the text alone', () => {
  const text = new WordMotionText('ab\ncd');
  assert.deepEqual(restoreAppendCursor(text, [
    { anchor: 3, head: 3 }, { anchor: 0, head: 2 }, { anchor: 5, head: 5 }, { anchor: 0, head: 0 },
  ]), [
    { anchor: 2, head: 2 }, { anchor: 0, head: 2 }, { anchor: 5, head: 5 }, { anchor: 0, head: 0 },
  ]);
});

test('Helix notation round-trips, including adjacent and reversed ranges', () => {
  for (const notation of ['#[b|]##(d|)#\n', '#[|ab]# #(c|)#', 'x#[|]#', '#(a|)##[|b]#']) {
    assert.equal(print(parse(notation)), notation);
  }
  assert.deepEqual(parse('#(a|)# #[|bc]#'), {
    text: 'a bc', ranges: [{ anchor: 4, head: 2 }, { anchor: 0, head: 1 }],
  });
});
