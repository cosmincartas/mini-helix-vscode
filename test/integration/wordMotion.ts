import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = () => new Promise(resolve => setTimeout(resolve, 150));

export async function checkWordMotions(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content: 'one two.three four\n  five six\n' });
  const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  editor.selection = new vscode.Selection(0, 0, 0, 0);
  await pause();
  const baseline = document.getText();
  const press = async (letter: string) => {
    const upper = letter.toUpperCase();
    await keyboard.press(letter, `Key${upper}`, upper.charCodeAt(0), letter, letter === upper ? 8 : 0);
    await pause();
  };
  const selected = () => editor.selections.map(selection => [
    document.getText(selection), selection.isReversed ? 'reversed' : 'forward',
  ]);

  await press('w');
  assert.deepEqual(selected(), [['one ', 'forward']], 'w selects the word and trailing space');
  await press('w');
  assert.deepEqual(selected(), [['two', 'forward']], 'w stops at punctuation');
  await press('e');
  assert.deepEqual(selected(), [['.', 'forward']], 'e selects punctuation as its own word');
  await press('e');
  assert.deepEqual(selected(), [['three', 'forward']]);
  await press('b');
  assert.deepEqual(selected(), [['three', 'reversed']], 'b selects back to the word start');
  await press('b');
  assert.deepEqual(selected(), [['.', 'reversed']]);

  editor.selection = new vscode.Selection(0, 4, 0, 4);
  await pause();
  await press('W');
  assert.deepEqual(selected(), [['two.three ', 'forward']], 'W treats punctuation as part of a WORD');
  await press('E');
  assert.deepEqual(selected(), [[' four', 'forward']], 'E from whitespace keeps it, as in Helix');
  await press('w');
  assert.deepEqual(selected(), [['  ', 'forward']], 'w crosses the line ending into indentation');
  await press('w');
  assert.deepEqual(selected(), [['five ', 'forward']]);
  await press('B');
  assert.deepEqual(selected(), [['five ', 'reversed']], 'B keeps the block cursor as its anchor');

  editor.selections = [new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 2, 1, 2)];
  await pause();
  await press('e');
  assert.deepEqual(selected(), [['one', 'forward'], ['five', 'forward']], 'every cursor moves');
  assert.equal(document.getText(), baseline, 'motions never edit the document');

  await press('i');
  assert.equal(api.getState().mode, 'insert');
  await press('w');
  assert.equal(document.getText(), 'wone two.three four\n  wfive six\n', 'INSERT types w natively');
  await keyboard.press('Escape', 'Escape', 27);
  await vscode.commands.executeCommand('undo');
  await pause();

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-motion-readonly', {
    provideTextDocumentContent: () => 'read only words',
  });
  try {
    const readonly = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-motion-readonly:test'));
    const readonlyEditor = await vscode.window.showTextDocument(readonly, vscode.ViewColumn.One);
    readonlyEditor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    await press('w');
    assert.equal(readonly.getText(readonlyEditor.selection), 'read ', 'motions work in read-only editors');
  } finally {
    provider.dispose();
  }

  console.log('PASS Helix-style word motions: w, b, e, W, B, E with real keyboard input');
}
