import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

type Key = Parameters<Keyboard['press']>;
const shift = 8;
// US-layout punctuation, as the generated bindings expect.
const punctuation: Record<string, Key> = {
  '(': ['(', 'Digit9', 57, '(', shift], ')': [')', 'Digit0', 48, ')', shift],
  '*': ['*', 'Digit8', 56, '*', shift], '!': ['!', 'Digit1', 49, '!', shift],
  '[': ['[', 'BracketLeft', 219, '['], ']': [']', 'BracketRight', 221, ']'],
  '{': ['{', 'BracketLeft', 219, '{', shift], '}': ['}', 'BracketRight', 221, '}', shift],
  '<': ['<', 'Comma', 188, '<', shift], '>': ['>', 'Period', 190, '>', shift],
  "'": ["'", 'Quote', 222, "'"], '"': ['"', 'Quote', 222, '"', shift],
  '`': ['`', 'Backquote', 192, '`'],
  '.': ['.', 'Period', 190, '.'], ';': [';', 'Semicolon', 186, ';'],
  '/': ['/', 'Slash', 191, '/'], '=': ['=', 'Equal', 187, '='],
  '<enter>': ['Enter', 'Enter', 13, '\r'],
  '<tab>': ['Tab', 'Tab', 9], '<bs>': ['Backspace', 'Backspace', 8],
  '<left>': ['ArrowLeft', 'ArrowLeft', 37],
};

export async function checkMatch(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content: '' });
  let editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  await pause();

  const type = async (sequence: string) => {
    for (const [token] of sequence.matchAll(/<[a-z]+>|[\s\S]/gu)) {
      if (punctuation[token]) {
        await keyboard.press(...punctuation[token]);
      } else {
        await keyboard.keys(token);
      }
    }
    await pause();
  };
  const reset = async (text: string, ...selections: vscode.Selection[]) => {
    await editor.edit(builder => builder.replace(new vscode.Range(0, 0, document.lineCount, 0), text));
    editor.selections = selections.length ? selections : [new vscode.Selection(0, 0, 0, 0)];
    await pause();
  };
  const caret = (character: number, line = 0) => new vscode.Selection(line, character, line, character);
  const selected = () => editor.selections.map(selection => document.getText(selection));
  const where = () => editor.selections.map(selection => [
    selection.anchor.line, selection.anchor.character, selection.active.line, selection.active.character,
  ]);

  // The replacement of a pending mr is captured, so it never reaches the normal commands.
  // A released capture shows as `d` deleting the character under the caret.
  const assertReleased = async (text: string, at: number) => {
    await reset(text, caret(at));
    await type('d');
    assert.equal(document.getText(), text.slice(0, at) + text.slice(at + 1), 'the pending replacement was not released');
    assert.equal(api.getState().mode, 'normal');
  };

  // mi / ma: words, with whitespace after, or before when none follows.
  await reset('foo bar baz', caret(5));
  await type('miw');
  assert.deepEqual(selected(), ['bar']);
  assert.deepEqual(where(), [[0, 4, 0, 7]]);
  await reset('foo bar baz', caret(5));
  await type('maw');
  assert.deepEqual(selected(), ['bar ']);
  await reset('foo bar baz', caret(9));
  await type('maw');
  assert.deepEqual(selected(), [' baz'], 'around uses the preceding whitespace when nothing follows');
  await reset('foo bar baz', caret(1));
  await type('3miw');
  assert.deepEqual(selected(), ['foo'], 'a count on miw is ignored');
  assert.equal(api.getState().mode, 'normal');

  // Delimiters, with closing aliases, on the US-layout shifted keys.
  await reset('f(a, (b)) [c] {d} <e> "f" \'g\'', caret(7));
  await type('mi(');
  assert.deepEqual(selected(), ['b']);
  await reset('f(a, (b)) [c] {d} <e> "f" \'g\'', caret(7));
  await type('ma(');
  assert.deepEqual(selected(), ['(b)']);
  await reset('f(a, (b)) [c] {d} <e> "f" \'g\'', caret(7));
  await type('mi)');
  assert.deepEqual(selected(), ['b'], 'a closing delimiter is an alias for its pair');
  await reset('f(a, (b)) [c] {d} <e> "f" \'g\'', caret(7));
  await type('2mi(');
  assert.deepEqual(selected(), ['a, (b)'], 'a count selects the outer pair');
  await reset('f(a, (b)) [c] {d} <e> "f" \'g\'', caret(7));
  await type('3mi(');
  assert.deepEqual(selected(), [''], 'no third pair: the selection is unchanged');
  assert.deepEqual(where(), [[0, 7, 0, 7]]);
  for (const [text, at, keys, inside] of [
    ['x [c] y', 4, 'mi[', 'c'], ['x [c] y', 4, 'ma]', '[c]'],
    ['x {d} y', 4, 'mi{', 'd'], ['x {d} y', 4, 'ma}', '{d}'],
    ['x <e> y', 4, 'mi<', 'e'], ['x <e> y', 4, 'ma>', '<e>'],
    ['x "f g" y', 5, 'mi"', 'f g'], ['x "f g" y', 5, 'ma"', '"f g"'],
    ["x 'g h' y", 5, "mi'", 'g h'], ["x 'g h' y", 5, "ma'", "'g h'"],
    ['x `i j` y', 5, 'mi`', 'i j'], ['x `i j` y', 5, 'ma`', '`i j`'],
  ] as const) {
    await reset(text, caret(at));
    await type(keys);
    assert.deepEqual(selected(), [inside], keys);
  }
  await reset('(a) b', caret(4));
  await type('mi(');
  assert.deepEqual(where(), [[0, 4, 0, 4]], 'no enclosing pair leaves the selection unchanged');
  await reset('a "b" c "d', caret(2), caret(9));
  await type('mi"');
  assert.deepEqual(selected(), ['b', ''], 'each selection is handled on its own');
  assert.deepEqual(where(), [[0, 3, 0, 4], [0, 9, 0, 9]]);
  await reset('(()) x', caret(2));
  await type('mi(');
  assert.deepEqual(where(), [[0, 2, 0, 2]], 'an empty pair gives a caret between the delimiters');
  await reset('(abc)', new vscode.Selection(0, 3, 0, 2));
  await type('mi(');
  assert.deepEqual(where(), [[0, 4, 0, 1]], 'a reversed selection gives a reversed result');
  assert.equal(document.getText(), '(abc)', 'text objects never edit');

  // mr: replaces a pair, with the delimiter or any character on both sides.
  await reset('f(text) g', caret(3));
  await type('mr([');
  assert.equal(document.getText(), 'f[text] g');
  assert.equal(api.getState().mode, 'normal');
  assert.deepEqual(where(), [[0, 3, 0, 3]], 'the caret stays');
  await reset('f(text) g', caret(3));
  await type('mr)}');
  assert.equal(document.getText(), 'f{text} g', 'a closing old delimiter is an alias');
  await reset('say "hi" now', caret(6));
  await type('mr"*');
  assert.equal(document.getText(), 'say *hi* now');
  await reset('say "hi" now', caret(6));
  await type("mr\"'");
  assert.equal(document.getText(), "say 'hi' now");
  await reset('say "hi" now', caret(6));
  await type('mr"`');
  assert.equal(document.getText(), 'say `hi` now');
  await reset('say `hi` now', caret(6));
  await type('mr`"');
  assert.equal(document.getText(), 'say "hi" now');
  await reset('<a> {b}', caret(1));
  await type('mr<(');
  assert.equal(document.getText(), '(a) {b}');
  await reset('(a (b))', caret(4));
  await type('2mr([');
  assert.equal(document.getText(), '[a (b)]', 'a count selects the outer pair');
  await reset('(a (b))', caret(4));
  await type('3mr([');
  assert.equal(document.getText(), '(a (b))', 'no match edits nothing');
  await reset('(a)', caret(1));
  await type('mr((');
  assert.equal(document.getText(), '(a)', 'an identical replacement edits nothing');
  assert.equal(api.getState().mode, 'normal');
  await reset('(a)', caret(0));
  await type('mr([');
  assert.equal(document.getText(), '[a]', 'a caret on the opener replaces that pair');
  await reset('(a)', new vscode.Selection(0, 0, 0, 1));
  await type('mr([');
  assert.equal(document.getText(), '[a]');
  assert.deepEqual(where(), [[0, 0, 0, 1]], 'a selection on the replaced delimiter stays');

  // Several cursors: one replacement per pair, in one undo step.
  await reset('(ab) (cd)', caret(1), caret(2));
  await type('mr([');
  assert.equal(document.getText(), '[ab] (cd)', 'two cursors in one pair replace it once');
  await reset('(ab) (cd)', caret(1), caret(7));
  await type('mr([');
  assert.equal(document.getText(), '[ab] [cd]');
  assert.deepEqual(where(), [[0, 1, 0, 1], [0, 7, 0, 7]]);
  await type('u');
  assert.equal(document.getText(), '(ab) (cd)', 'u undoes all the replacements as one revision');
  assert.deepEqual(where(), [[0, 1, 0, 1], [0, 7, 0, 7]]);
  await type('U');
  assert.equal(document.getText(), '[ab] [cd]', 'U redoes them together');
  await reset('(ab) (cd)', caret(1), caret(7));
  await type('mr([');
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), '(ab) (cd)', 'native undo is one step for every replacement');
  await vscode.commands.executeCommand('redo');
  assert.equal(document.getText(), '[ab] [cd]');
  await reset('(ab) (cd)', caret(1), caret(7));
  await type('mr(*');
  assert.equal(document.getText(), '*ab* *cd*');
  await reset('(ab) (cd)', caret(1), caret(8));
  await type('mr(*');
  assert.equal(document.getText(), '*ab* *cd*', 'cursors in distinct pairs');
  await reset('(a (b))', caret(1), caret(4));
  await type('mr([');
  assert.equal(document.getText(), '[a [b]]', 'nested pairs are distinct');
  await reset('(a) (b)', caret(1), caret(5));
  await type('3mr([');
  assert.equal(document.getText(), '(a) (b)', 'a selection without a match rejects every edit');

  // Pending state: Escape and invalid keys cancel, and never type.
  await reset('(text)', caret(2));
  await type('mr(<esc>');
  assert.equal(document.getText(), '(text)');
  assert.equal(api.getState().mode, 'normal');
  await assertReleased('(text)', 2);
  for (const keys of ['m<esc>', 'mx', 'mi<esc>', 'mix', 'ma<esc>', 'ma7', 'mr<esc>', 'mrx', 'mr7', 'mr<bs>']) {
    await reset('(text)', caret(2));
    await type(keys);
    assert.equal(document.getText(), '(text)', keys);
    assert.equal(api.getState().mode, 'normal', keys);
    assert.deepEqual(where(), [[0, 2, 0, 2]], keys);
  }
  // Invalid chord keys clear a pending count, so the next key is not repeated.
  await reset('abcdef', caret(0));
  await type('3mx');
  await type('d');
  assert.equal(document.getText(), 'bcdef', 'an invalid chord key clears the count');
  await reset('abcdef', caret(0));
  await type('3mi<esc>');
  await type('d');
  assert.equal(document.getText(), 'bcdef');
  await reset('(text)', caret(2));
  await type('mr(');
  await type('<tab>');
  await type('<left>');
  assert.equal(document.getText(), '(text)');
  await reset('(text)', caret(2));
  await type('mr( ');
  assert.equal(document.getText(), '(text)', 'whitespace is not a valid replacement');
  await assertReleased('(text)', 2);

  // The replacement beats i, a, d, w, digits, and the other normal keys. (Not g: the test profile's
  // own `g l` binding makes it a user chord prefix, which user bindings may do.)
  for (const [keys, expected] of [
    ['d', 'dtextd'], ['i', 'itexti'], ['a', 'atexta'], ['w', 'wtextw'], ['5', '5text5'], ['0', '0text0'],
    ['D', 'DtextD'], ['u', 'utextu'], ['c', 'ctextc'], ['m', 'mtextm'], ['!', '!text!'],
    ['.', '.text.'], [';', ';text;'], ['<', '<text>'],
  ]) {
    await reset('(text)', caret(2));
    await type(`mr(${keys}`);
    assert.equal(document.getText(), expected, keys);
    assert.equal(api.getState().mode, 'normal', keys);
  }
  await reset('((text))', caret(3));
  await type('2mr(d');
  assert.equal(document.getText(), 'd(text)d', 'the count belongs to mr, not to the replacement key');
  await type('d');
  assert.equal(document.getText(), 'd(txt)d', 'the session is over, so d is a normal command again');

  // Stale state cancels, and the next key then behaves normally.
  await reset('(text) z', caret(2));
  await type('mr(');
  editor.selections = [caret(3)];
  await pause();
  await type('d');
  assert.equal(document.getText(), '(tet) z', 'a selection change cancels, so d deletes');
  await reset('(text) z', caret(2));
  await type('mr(');
  editor.selections = [caret(2)];
  await pause();
  await type('[');
  assert.equal(document.getText(), '[text] z', 'a selection set to what it was keeps the session');
  await reset('(text) z', caret(2));
  await type('mr(');
  await editor.edit(builder => builder.insert(new vscode.Position(0, 8), '!'));
  await pause();
  await type('d');
  assert.equal(document.getText(), '(txt) z!', 'a document change cancels, so d deletes');
  await reset('(text) z', caret(2));
  await type('mr(');
  await vscode.commands.executeCommand('miniHelix.enterInsert');
  await vscode.commands.executeCommand('miniHelix.enterNormal');
  await pause();
  await type('d');
  assert.equal(document.getText(), '(txt) z', 'a mode change cancels');
  await reset('(text) z', caret(2));
  await type('mr(');
  const other = await vscode.workspace.openTextDocument({ content: 'other' });
  await vscode.window.showTextDocument(other, vscode.ViewColumn.One);
  await pause();
  editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  await pause();
  await type('d');
  assert.equal(document.getText(), '(txt) z', 'an active editor change cancels');
  await reset('(text) z', caret(2));
  await type('mr(');
  await vscode.commands.executeCommand('miniHelix.toggleEnabled');
  await vscode.commands.executeCommand('miniHelix.toggleEnabled');
  await pause();
  await type('d');
  assert.equal(document.getText(), '(txt) z', 'suspending and resuming cancels');
  await reset('(text) z', caret(2));
  await type('mr(');
  await vscode.commands.executeCommand('miniHelix.surroundReplaceInput', '[');
  assert.equal(document.getText(), '[text] z', 'the input command applies to the live session');
  await vscode.commands.executeCommand('miniHelix.surroundReplaceInput', '(');
  assert.equal(document.getText(), '[text] z', 'a finished session ignores further input');
  await assertReleased('(text)', 2);

  // A repeated mr (through the command API: a pending physical m is the replacement) replaces the pending one.
  await reset('(a) [b]', caret(1));
  await vscode.commands.executeCommand('miniHelix.surroundReplace', { target: '[' });
  await vscode.commands.executeCommand('miniHelix.surroundReplace', { target: '(' });
  await type('{');
  assert.equal(document.getText(), '{a} [b]');
  await assertReleased('(text)', 2);

  // The replacement key consumes the session at once, even while the queue is busy:
  // the keys after it are ordinary commands, queued behind it, and are not swallowed.
  // A definition provider that we resolve by hand keeps the queue busy deterministically.
  let provided: (() => void) | undefined;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { provided = resolve; });
  const definitions = vscode.languages.registerDefinitionProvider({ language: 'plaintext' }, {
    provideDefinition: async () => { provided?.(); await barrier; return undefined; },
  });
  try {
    await reset('(text)', caret(2));
    const busy = vscode.commands.executeCommand('miniHelix.gotoDefinition');
    await requested;
    await type('mr(');
    await type('[');
    await type('d');
    await type('i');
    assert.equal(document.getText(), '(text)', 'nothing runs while the queue is busy');
    release();
    await busy;
    await pause();
    assert.equal(document.getText(), '[txt]', 'the replacement applied, then d deleted the character under the caret');
    assert.equal(api.getState().mode, 'insert', 'i was a normal command, not swallowed');
    await type('<esc>');
    assert.equal(api.getState().mode, 'normal');
  } finally {
    release();
    definitions.dispose();
  }

  // Edits and undo queue ahead of a following chord.
  await reset('x(ab)', caret(0));
  await Promise.all([
    vscode.commands.executeCommand('miniHelix.deleteSelection'),
    vscode.commands.executeCommand('miniHelix.selectTextObject', { kind: 'inside', target: '(' }),
  ]);
  assert.deepEqual(selected(), ['ab'], 'mi( sees the text left by d');
  await reset('x(ab)', caret(0));
  await Promise.all([
    vscode.commands.executeCommand('miniHelix.deleteSelection'),
    vscode.commands.executeCommand('miniHelix.surroundReplace', { target: '(' }),
    vscode.commands.executeCommand('miniHelix.surroundReplaceInput', '['),
  ]);
  assert.equal(document.getText(), '[ab]', 'mr sees the text left by d');
  await reset('x(ab)', caret(0));
  await keyboard.press('d', 'KeyD', 68, 'd');
  await keyboard.press('m', 'KeyM', 77, 'm');
  await keyboard.press('i', 'KeyI', 73, 'i');
  await keyboard.press(...punctuation['(']);
  await pause();
  assert.deepEqual(selected(), ['ab'], 'typed d then mi( sees the text left by d');
  await reset('x(ab)', caret(1));
  await type('d');
  await vscode.commands.executeCommand('miniHelix.undo');
  await vscode.commands.executeCommand('miniHelix.selectTextObject', { kind: 'around', target: '(' });
  assert.equal(document.getText(), 'x(ab)');
  assert.deepEqual(selected(), ['(ab)'], 'ma( sees the text restored by u');
  await reset('(ab) z', caret(1));
  await type('mr([');
  await type('u');
  await type('mr({');
  assert.equal(document.getText(), '{ab} z', 'mr after u starts from the undone text');

  // ms: wraps every selection, and its selection then covers the pair.
  for (const [keys, wrapped] of [['ms(', '(text)'], ['ms)', '(text)'], ['ms*', '*text*'], ['ms ', ' text ']]) {
    await reset('f text g', new vscode.Selection(0, 2, 0, 6));
    await type(keys);
    assert.equal(document.getText(), `f ${wrapped} g`, keys);
    assert.deepEqual(selected(), [wrapped], keys);
    assert.deepEqual(where(), [[0, 2, 0, 8]], keys);
    assert.equal(api.getState().mode, 'normal', keys);
  }
  await reset('abc', caret(1));
  await type('ms(');
  assert.equal(document.getText(), 'a(b)c', 'a caret wraps the character under it');
  assert.deepEqual(where(), [[0, 1, 0, 4]]);
  await reset('text', new vscode.Selection(0, 0, 0, 4));
  await type('ms<enter>');
  assert.equal(document.getText(), '\ntext\n', 'Enter wraps in line breaks');
  assert.deepEqual(selected(), ['\ntext\n']);
  await reset('ab', new vscode.Selection(0, 2, 0, 0));
  await type('ms[');
  assert.equal(document.getText(), '[ab]');
  assert.deepEqual(where(), [[0, 4, 0, 0]], 'a reversed selection stays reversed');
  await assertReleased('(text)', 2);
  // A count does not apply to ms, and does not reach the next command.
  const afterWord = async (keys: string) => {
    await reset('abc d e f g h', new vscode.Selection(0, 0, 0, 3));
    await type(keys);
    assert.equal(document.getText(), '(abc) d e f g h', keys);
    return where();
  };
  assert.deepEqual(await afterWord('3ms(w'), await afterWord('ms(w'), 'the count of ms does not carry over');
  // Escape and the other cancel keys end ms with no edit.
  await reset('(text)', new vscode.Selection(0, 1, 0, 5));
  await type('ms<esc>');
  assert.equal(document.getText(), '(text)');
  assert.deepEqual(where(), [[0, 1, 0, 5]]);
  await type('d');
  assert.equal(document.getText(), '()', 'the next key acts normally');
  for (const keys of ['ms<esc>', 'ms<tab>', 'ms<bs>', 'ms<left>']) {
    await reset('(text)', caret(2));
    await type(keys);
    assert.equal(document.getText(), '(text)', keys);
    await assertReleased('(text)', 2);
  }
  // Several cursors: one pair each, in one undo step.
  await reset('ab cd', new vscode.Selection(0, 0, 0, 2), new vscode.Selection(0, 3, 0, 5));
  await type('ms(');
  assert.equal(document.getText(), '(ab) (cd)');
  assert.deepEqual(where(), [[0, 0, 0, 4], [0, 5, 0, 9]]);
  await type('u');
  assert.equal(document.getText(), 'ab cd', 'u undoes every wrap as one revision');
  await type('U');
  assert.equal(document.getText(), '(ab) (cd)', 'U redoes them together');
  await reset('ab cd', new vscode.Selection(0, 0, 0, 2), new vscode.Selection(0, 3, 0, 5));
  await type('ms(');
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), 'ab cd', 'native undo is one step for every wrap');
  await vscode.commands.executeCommand('redo');
  assert.equal(document.getText(), '(ab) (cd)');
  // A selection change between ms and its key cancels it (F-1).
  await reset('text', new vscode.Selection(0, 0, 0, 4));
  await type('ms');
  editor.selections = [new vscode.Selection(0, 1, 0, 3)];
  await pause();
  await type('(');
  assert.equal(document.getText(), 'text', 'a selection change cancels ms');
  await assertReleased('text', 1);
  // mr takes Enter and Space as keys, but they are not replacements: no edit, and the session ends.
  for (const keys of ['mr(<enter>', 'mr( ']) {
    await reset('(text)', caret(2));
    await type(keys);
    assert.equal(document.getText(), '(text)', keys);
    assert.equal(api.getState().mode, 'normal', keys);
    await assertReleased('(text)', 2);
  }

  // md: deletes the enclosing pair of every cursor.
  await reset('x (ab) y', caret(4));
  await type('md(');
  assert.equal(document.getText(), 'x ab y');
  assert.deepEqual(where(), [[0, 3, 0, 3]], 'the caret moves back past the deleted opener');
  await reset('say "hi" now', caret(6));
  await type('md"');
  assert.equal(document.getText(), 'say hi now');
  await reset('x [a] y', caret(4));
  await type('md]');
  assert.equal(document.getText(), 'x a y', 'a closing delimiter is an alias');
  await reset('(a (b))', caret(4));
  await type('2md(');
  assert.equal(document.getText(), 'a (b)', 'a count selects the outer pair');
  await reset('(a)', caret(1));
  await type('md*');
  assert.equal(document.getText(), '(a)', 'only the delimiters work');
  await reset('a (b', caret(3));
  await type('md(');
  assert.equal(document.getText(), 'a (b', 'no pair edits nothing');
  await reset('f(abc)', caret(3));
  await type('ma(');
  await type('md(');
  assert.equal(document.getText(), 'fabc');
  assert.deepEqual(selected(), ['abc'], 'the inner text stays selected');
  await reset('(ab) (cd)', caret(1), caret(7));
  await type('md(');
  assert.equal(document.getText(), 'ab cd');
  assert.deepEqual(where(), [[0, 0, 0, 0], [0, 4, 0, 4]], 'each caret moves back past the deleted delimiters before it');
  await type('u');
  assert.equal(document.getText(), '(ab) (cd)', 'u undoes every deletion as one revision');
  await reset('(ab) (cd)', caret(1), caret(7));
  await type('md(');
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), '(ab) (cd)', 'native undo is one step for every deletion');
  await reset('(ab) (cd)', caret(1), caret(7));
  await type('md)');
  assert.equal(document.getText(), 'ab cd');
  await reset('abcdef', caret(0));
  await type('3mdx');
  assert.equal(document.getText(), 'abcdef', 'x after md is an unbound key');
  assert.deepEqual(where(), [[0, 0, 0, 0]]);
  await type('d');
  assert.equal(document.getText(), 'bcdef', 'the unbound key cleared the count');
  await reset('abcdef', caret(0));
  await type('md<esc>');
  await type('d');
  assert.equal(document.getText(), 'bcdef', 'Escape after md cancels');

  // Read-only editors: selecting works, replacing never edits.
  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-match-readonly', {
    provideTextDocumentContent: () => 'a (ro) b',
  });
  try {
    const readonlyDocument = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-match-readonly:test'));
    const readonlyEditor = await vscode.window.showTextDocument(readonlyDocument, vscode.ViewColumn.One);
    readonlyEditor.selections = [caret(4)];
    await pause();
    await type('mi(');
    assert.equal(readonlyDocument.getText(readonlyEditor.selection), 'ro');
    readonlyEditor.selections = [caret(4)];
    await pause();
    await type('ma(');
    assert.equal(readonlyDocument.getText(readonlyEditor.selection), '(ro)');
    readonlyEditor.selections = [caret(4)];
    await pause();
    await type('mr([');
    assert.equal(readonlyDocument.getText(), 'a (ro) b');
    assert.deepEqual(readonlyEditor.selections.map(selection => selection.active.character), [4]);
    assert.equal(api.getState().mode, 'normal');
    await type('2mr(');
    await type('i');
    assert.equal(api.getState().mode, 'normal', 'read-only: mr clears the count and starts nothing');
    readonlyEditor.selections = [caret(4)];
    await pause();
    await type('ms(');
    assert.equal(readonlyDocument.getText(), 'a (ro) b', 'read-only: ms edits nothing');
    await type('md(');
    assert.equal(readonlyDocument.getText(), 'a (ro) b', 'read-only: md edits nothing');
    assert.deepEqual(readonlyEditor.selections.map(selection => selection.active.character), [4]);
    await type('2ms(');
    await type('i');
    assert.equal(api.getState().mode, 'normal', 'read-only: ms clears the count and starts nothing');
    await type('2md(');
    await type('i');
    assert.equal(api.getState().mode, 'normal', 'read-only: md clears the count');
  } finally {
    provider.dispose();
    editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  }
  await pause();
  assert.equal(api.getState().mode, 'normal');
}
