import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { cursors, Document, normalize, ordered, parse, print } from '../unit/helix';
import { Keyboard } from './keyboard';

const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * `[input, keys, Helix's output]`, run through real Helix with the input
 * committed first (`<esc>` before the keys), since Helix's test harness
 * otherwise merges the input text into the first revision. `'cursor'` rows
 * compare text and block cursors only: Helix's `i` and `a` keep selections
 * that VS Code typing would replace, and undo restores them.
 */
type Case = [input: string, keys: string, helix: string, compare?: 'cursor'];

const cases: Case[] = [
  ['#[\n|]#', 'u', '#[\n|]#'],
  ['#[\n|]#', 'U', '#[\n|]#'],
  // One INSERT session is one revision, however VS Code splits its typing.
  ['#[\n|]#', 'ihello world<esc>u', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ihello world<esc>uU', 'hello world#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ihello world<esc>uUU', 'hello world#[|\n]#', 'cursor'],
  ['#[\n|]#', 'iHello, world<esc>u', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ione<ret>two<esc>u', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ione<ret>two<esc>uU', 'one\ntwo#[|\n]#', 'cursor'],
  // Consecutive sessions stay separate, though VS Code would merge them.
  ['#[\n|]#', 'ihello<esc>iworld<esc>u', 'hello#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ihello<esc>iworld<esc>uu', '#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ihello<esc>iworld<esc>uuU', 'hello#[|\n]#', 'cursor'],
  ['#[\n|]#', 'ihello<esc>iworld<esc>uuUU', 'helloworld#[|\n]#', 'cursor'],
  ['#[f|]#oo\n#(b|)#ar\n', 'ix<esc>iy<esc>u', 'x#[|f]#oo\nx#(|b)#ar\n', 'cursor'],
  ['#[f|]#oo\n#(b|)#ar\n', 'ix<esc>iy<esc>uu', '#[|f]#oo\n#(|b)#ar\n', 'cursor'],
  ['#[f|]#oo\n#(b|)#ar\n', 'ix<esc>iy<esc>uuUU', 'xy#[|f]#oo\nxy#(|b)#ar\n', 'cursor'],
  // commands.rs test_undo_redo, third case, with `i<ret><esc>` for `[<space>`.
  ['#[\n|]#', 'i<ret><esc>ui<ret><esc>u', '#[|\n]#', 'cursor'],
  // d: each one is a revision, restoring the selection it deleted.
  ['#[foo|]# bar\n', 'du', '#[foo|]# bar\n'],
  ['#[foo|]# bar\n', 'duU', '#[ |]#bar\n'],
  ['#[|foo]# bar\n', 'du', '#[|foo]# bar\n'],
  ['#[foo|]# bar\n', 'ddu', '#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'dduu', '#[foo|]# bar\n'],
  ['#[foo|]# bar\n', 'dduuU', '#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'dduuUU', '#[b|]#ar\n'],
  ['#[foo|]# bar\n', 'dudU', '#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'duduU', '#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'di<esc>u', '#[foo|]# bar\n'],
  ['#[foo|]# bar\n', 'duwU', '#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'wdu', 'fo#[o |]#bar\n'],
  ['#[a|]#b#(c|)#d\n', 'du', '#[a|]#b#(c|)#d\n'],
  ['#[a|]#b#(c|)#d\n', 'duU', '#[b|]##(d|)#\n'],
  ['a#[\r\n|]#b', 'du', 'a#[\r\n|]#b'],
  ['#[f|]#oo bar\n', 'ix<esc>du', 'x#[|f]#oo bar\n', 'cursor'],
  ['#[f|]#oo bar\n', 'ix<esc>duu', '#[|f]#oo bar\n', 'cursor'],
  ['#[f|]#oo bar\n', 'ix<esc>duuUU', 'x#[o|]#o bar\n'],
  // c: the deletion and the typing are one revision.
  ['#[foo|]# bar\n', 'cX<esc>u', '#[foo|]# bar\n'],
  ['#[foo|]# bar\n', 'cX<esc>uU', 'X#[ |]#bar\n'],
  ['#[foo|]# bar\n', 'cXY Z<esc>u', '#[foo|]# bar\n'],
  ['#[foo|]# bar\n', 'cXY Z<esc>uU', 'XY Z#[ |]#bar\n'],
  ['#[foo\n|]#bar\n', 'cX<esc>u', '#[foo\n|]#bar\n'],
  ['#[foo\n|]#bar\n', 'cX<esc>uU', 'X#[\n|]#bar\n'],
  ['#(a|)# #[b|]#\n', 'cX<esc>u', '#(a|)# #[b|]#\n'],
  ['#(a|)# #[b|]#\n', 'cX<esc>uU', 'X#( |)#X#[\n|]#'],
  // a: redo restores the cursor onto the appended text, as Escape did.
  ['#[f|]#oo\n#(b|)#ar\n', 'aX<esc>u', '#[fo|]#o\n#(ba|)#r\n', 'cursor'],
  ['#[f|]#oo\n#(b|)#ar\n', 'aX<esc>uU', '#[fX|]#oo\n#(bX|)#ar\n', 'cursor'],
  ['#[foo|]#', 'aX<esc>u', '#[foo|]#'],
  ['#[foo|]#', 'aX<esc>uU', '#[fooX|]#\n', 'cursor'],
  ['#[foo|]# bar\n', 'aX<esc>aY<esc>u', '#[fooX |]#bar\n', 'cursor'],
  ['#[foo|]# bar\n', 'aX<esc>aY<esc>uu', '#[foo |]#bar\n', 'cursor'],
];

function state(editor: vscode.TextEditor): Document {
  return {
    text: editor.document.getText(),
    ranges: editor.selections.map(selection => ({
      anchor: editor.document.offsetAt(selection.anchor),
      head: editor.document.offsetAt(selection.active),
    })),
  };
}

async function open(content: string): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({ content });
  const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  editor.options = { insertSpaces: true, tabSize: 4, indentSize: 4 };
  return editor;
}

async function close(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
}

/** Native undo steps until the stack is empty; each one must change the text. */
async function nativeUndoSteps(document: vscode.TextDocument): Promise<string[]> {
  const texts: string[] = [];
  for (;;) {
    const version = document.version;
    await vscode.commands.executeCommand('undo');
    if (document.version === version) { return texts; }
    texts.push(document.getText());
  }
}

export async function checkHistory(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  let exact = 0;
  const failures: string[] = [];
  for (const [input, keys, helix, compare] of cases) {
    const { text, ranges } = parse(input);
    const editor = await open(text);
    const position = (offset: number) => editor.document.positionAt(offset);
    editor.selections = ranges.map(range => new vscode.Selection(position(range.anchor), position(range.head)));
    await pause();
    await keyboard.keys(keys);
    await pause(250);
    const actual = ordered(normalize(state(editor)));
    const expected = ordered(normalize(parse(helix)));
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const result = `${JSON.stringify(input)} ${keys} gave ${JSON.stringify(print(actual))}, Helix ${JSON.stringify(helix)}`;
    if (actual.text !== expected.text || !same(cursors(actual), cursors(expected))) {
      failures.push(`text or cursors differ: ${result}`);
    } else if (!same(actual.ranges, expected.ranges)) {
      if (compare !== 'cursor') { failures.push(`selections differ: ${result}`); }
    } else if (compare === 'cursor') {
      failures.push(`selections match, drop 'cursor': ${result}`);
    } else {
      exact++;
    }
    if (api.getState().mode !== 'normal') { failures.push(`left in INSERT: ${result}`); }
    await close();
  }
  assert.deepEqual(failures, []);
  console.log(`PASS u/U match Helix in ${cases.length} cases (${exact} with identical selections)`);

  // The undo stop between sessions leaves no empty step on the native stack.
  {
    const editor = await open('\n');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await keyboard.keys('ihello<esc>iworld<esc>');
    await pause();
    assert.deepEqual(editor.selections.map(selection => editor.document.offsetAt(selection.active)), [10]);
    assert.deepEqual(await nativeUndoSteps(editor.document), ['hello\n', '\n'],
      'Ctrl+Z keeps VS Code steps, and every one changes the text');
    await close();
  }

  // Sessions stay separate with the cursor on the last visible line, and
  // with multiple cursors; the undo stop never moves them.
  {
    const editor = await open(Array.from({ length: 300 }, (_, line) => `line ${line}`).join('\n') + '\n');
    await pause();
    const bottom = editor.visibleRanges.at(-1)!.end.line;
    editor.selection = new vscode.Selection(bottom, 0, bottom, 0);
    await pause();
    await keyboard.keys('ix<esc>');
    await pause();
    assert.deepEqual([editor.selection.anchor, editor.selection.active].map(p => [p.line, p.character]),
      [[bottom, 1], [bottom, 1]], 'Escape at the bottom edge keeps the cursor');
    await keyboard.keys('iy<esc>u');
    await pause();
    assert.equal(editor.document.lineAt(bottom).text, `xline ${bottom}`);
    await keyboard.keys('u');
    await pause();
    assert.equal(editor.document.lineAt(bottom).text, `line ${bottom}`);

    const top = editor.visibleRanges[0].start.line;
    const carets = [top + 2, top + 4].map(line => new vscode.Selection(line, 0, line, 0));
    editor.selections = carets;
    await pause();
    await keyboard.keys('ix<esc>');
    await pause();
    assert.deepEqual(editor.selections.map(selection => selection.active.character), [1, 1]);
    await keyboard.keys('iy<esc>u');
    await pause();
    assert.equal(editor.document.lineAt(top + 4).text, `xline ${top + 4}`);
    await close();
  }

  // Ctrl+Z moves the native stack under the revisions: u then steps natively.
  {
    const editor = await open('\n');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await keyboard.keys('ihello world<esc>');
    await vscode.commands.executeCommand('undo');
    assert.equal(editor.document.getText(), 'hello\n');
    await keyboard.keys('u');
    await pause();
    assert.equal(editor.document.getText(), '\n');
    await keyboard.keys('U');
    await pause();
    assert.equal(editor.document.getText(), 'hello\n');
    await close();
  }

  // Changes made outside Mini Helix while in NORMAL are revisions of their own.
  {
    const editor = await open('foo bar\n');
    editor.selection = new vscode.Selection(0, 0, 0, 3);
    await keyboard.keys('d');
    await pause();
    await editor.edit(builder => builder.insert(new vscode.Position(1, 0), 'pasted'));
    await editor.edit(builder => builder.insert(new vscode.Position(1, 0), '>'));
    await keyboard.keys('u');
    await pause();
    assert.equal(editor.document.getText(), ' bar\npasted');
    await keyboard.keys('uu');
    await pause();
    assert.equal(editor.document.getText(), 'foo bar\n');
    await close();
  }

  console.log('PASS u/U: undo stops, native undo, and outside edits');
}
