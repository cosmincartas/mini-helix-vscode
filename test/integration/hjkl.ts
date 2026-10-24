import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Case, countLifetime, counted, horizontal, vertical } from '../unit/charMotionCases';
import { Document, normalize, ordered, parse, print } from '../unit/helix';
import { Keyboard } from './keyboard';

const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Undo and redo with a count, from real Helix with the input committed first
 * (`<esc>` before the keys), as in history.ts.
 */
const undoCounts: Case[] = [
  ['#[foo|]# bar baz\n', 'dd2u', '#[foo|]# bar baz\n'],
  ['#[foo|]# bar baz\n', 'ddd2u', '#[ |]#bar baz\n'],
  ['#[foo|]# bar baz\n', 'ddd3u', '#[foo|]# bar baz\n'],
  ['#[foo|]# bar baz\n', 'ddd3u2U', '#[b|]#ar baz\n'],
  ['#[foo|]# bar baz\n', 'ddd3u3U', '#[a|]#r baz\n'],
  ['#[foo|]# bar baz\n', 'ddd3u9U', '#[a|]#r baz\n'],
  ['#[foo|]# bar baz\n', 'ddd2-u', '#[b|]#ar baz\n'],
  ['#[foo|]# bar baz\n', 'dd2<esc>u', '#[ |]#bar baz\n'],
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

function select(editor: vscode.TextEditor, notation: string): void {
  const position = (offset: number) => editor.document.positionAt(offset);
  editor.selections = parse(notation).ranges.map(range =>
    new vscode.Selection(position(range.anchor), position(range.head)));
}

async function caretAfter(editor: vscode.TextEditor, keyboard: Keyboard, keys: string): Promise<number> {
  await keyboard.keys(keys);
  await pause();
  assert.ok(editor.selection.isEmpty, `${keys} leaves a caret`);
  return editor.document.offsetAt(editor.selection.active);
}

export async function checkCharMotions(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const failures: string[] = [];
  const all = [...horizontal, ...vertical, ...counted, ...countLifetime, ...undoCounts];
  for (const [input, keys, helix] of all) {
    const editor = await open(parse(input).text);
    select(editor, input);
    await pause();
    await keyboard.keys(keys);
    await pause(250);
    const actual = ordered(normalize(state(editor)));
    const expected = ordered(normalize(parse(helix)));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${JSON.stringify(input)} ${keys} gave ${JSON.stringify(print(actual))}, Helix ${JSON.stringify(helix)}`);
    }
    if (api.getState().mode !== 'normal') { failures.push(`left in INSERT: ${JSON.stringify(input)} ${keys}`); }
    await close();
  }
  assert.deepEqual(failures, []);
  console.log(`PASS h, j, k, l, counts, and counted u/U match Helix in ${all.length} cases with real keyboard input`);

  {
    const editor = await open('abcdefghij\n');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    // Numeric keypad digits count too; terminals send them to Helix as digits.
    await keyboard.press('3', 'Numpad3', 99, '3', 0, true);
    assert.equal(await caretAfter(editor, keyboard, 'l'), 3, 'numpad count');
    // g followed by an unbound key is unbound in Helix: it clears the count.
    assert.equal(await caretAfter(editor, keyboard, '3gxl'), 4, 'g x clears the count');
    assert.equal(editor.document.getText(), 'abcdefghij\n', 'counts and blocked keys never type');

    const settings = vscode.workspace.getConfiguration('miniHelix');
    await settings.update('hjklMotions', false, vscode.ConfigurationTarget.Global);
    try {
      await pause();
      assert.equal(await caretAfter(editor, keyboard, '2l'), 4, 'l is blocked when the setting is off');
      assert.equal(editor.document.getText(), 'abcdefghij\n');
    } finally {
      await settings.update('hjklMotions', undefined, vscode.ConfigurationTarget.Global);
    }
    await pause();
    // The blocked l cleared the count, so this l moves once.
    assert.equal(await caretAfter(editor, keyboard, 'l'), 5, 'l is bound again');
    await close();
  }

  {
    const editor = await open('a\nb\nc\nd\ne\nf\n');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    const line = () => editor.selection.active.line;
    // With a count pending, arrows are counted motions, as in Helix.
    await keyboard.keys('3');
    await keyboard.press('ArrowDown', 'ArrowDown', 40);
    await pause();
    assert.equal(line(), 3, '3<down> moves three lines');
    await keyboard.press('ArrowDown', 'ArrowDown', 40);
    await pause();
    assert.equal(line(), 4, 'without a count, Down stays native');
    // Other navigation keys clear the count and act natively.
    await keyboard.keys('2');
    await keyboard.press('Home', 'Home', 36);
    await keyboard.keys('k');
    await pause();
    assert.equal(line(), 3, 'Home clears the count');
    await close();
  }

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-hjkl-readonly', {
    provideTextDocumentContent: () => 'read only\ntext here\n',
  });
  try {
    const readonly = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-hjkl-readonly:test'));
    const editor = await vscode.window.showTextDocument(readonly, vscode.ViewColumn.One);
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    assert.equal(await caretAfter(editor, keyboard, 'jl'), 11, 'h, j, k, l work in read-only editors');
    assert.equal(await caretAfter(editor, keyboard, '3-l'), 12, 'unbound keys clear a count in read-only editors');
    assert.equal(await caretAfter(editor, keyboard, '2h'), 10);
    await close();
  } finally {
    provider.dispose();
  }

  // With word wrap on, j and k move by screen line natively from the block cursor.
  const editorSettings = vscode.workspace.getConfiguration('editor');
  await editorSettings.update('wordWrap', 'on', vscode.ConfigurationTarget.Global);
  try {
    const editor = await open('one two\nthree four\nx\nfive six\n');
    select(editor, '#[one |]#two\nthree four\nx\nfive six\n');
    await pause();
    assert.deepEqual(editor.document.positionAt(await caretAfter(editor, keyboard, 'j')), new vscode.Position(1, 3),
      'j starts from the block cursor on the selection\'s last character');
    assert.deepEqual(editor.document.positionAt(await caretAfter(editor, keyboard, 'jj')), new vscode.Position(3, 3),
      'VS Code keeps the column across a short line');
    assert.deepEqual(editor.document.positionAt(await caretAfter(editor, keyboard, '2k')), new vscode.Position(1, 3));
    await close();
  } finally {
    await editorSettings.update('wordWrap', undefined, vscode.ConfigurationTarget.Global);
  }

  console.log('PASS h, j, k, l: keypad counts, g chords, the setting, read-only editors, and word wrap');
}
