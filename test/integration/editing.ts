import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = () => new Promise(resolve => setTimeout(resolve, 150));

export async function checkEditing(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content: 'one two three\n    four\nfive' });
  const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  editor.options = { insertSpaces: true, tabSize: 4, indentSize: 4 };
  const press = async (key: string) => {
    if (key === 'Escape') {
      await keyboard.press('Escape', 'Escape', 27);
    } else {
      const upper = key.toUpperCase();
      await keyboard.press(key, `Key${upper}`, upper.charCodeAt(0), key, key === upper ? 8 : 0);
    }
    await pause();
  };
  const reset = async (text: string, ...selections: vscode.Selection[]) => {
    await editor.edit(builder => builder.replace(new vscode.Range(0, 0, document.lineCount, 0), text));
    editor.selections = selections;
    await pause();
  };
  const carets = () => editor.selections.map(selection => {
    assert.ok(selection.isEmpty, 'expected carets');
    return document.offsetAt(selection.active);
  });

  // d: Helix deletes the selection, or the character under the block cursor.
  await reset('one two three\n', new vscode.Selection(0, 0, 0, 0));
  await press('w');
  await press('d');
  assert.equal(document.getText(), 'two three\n', 'w then d deletes the word and its space');
  assert.deepEqual(carets(), [0]);
  assert.equal(api.getState().mode, 'normal');
  await press('d');
  assert.equal(document.getText(), 'wo three\n', 'd on a caret deletes the character under it');
  // Repeated keys queue behind the previous edit instead of racing it.
  await keyboard.press('d', 'KeyD', 68, 'd');
  await keyboard.press('d', 'KeyD', 68, 'd');
  await keyboard.press('d', 'KeyD', 68, 'd');
  await pause();
  assert.equal(document.getText(), 'three\n');

  await reset('abcd\n', new vscode.Selection(0, 0, 0, 0), new vscode.Selection(0, 2, 0, 2));
  await press('d');
  assert.equal(document.getText(), 'bd\n', 'every cursor deletes');
  assert.deepEqual(carets(), [0, 1]);
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), 'abcd\n', 'd is one undo step');

  // c: delete, then INSERT; whole lines become one line with the next line's indentation.
  await reset('one two three\n', new vscode.Selection(0, 4, 0, 7));
  await press('c');
  assert.equal(api.getState().mode, 'insert');
  assert.equal(document.getText(), 'one  three\n');
  await press('x');
  await press('Escape');
  assert.equal(document.getText(), 'one x three\n');
  assert.deepEqual(carets(), [5], 'Escape after c keeps the caret');
  // Native undo (Ctrl+Z) keeps VS Code's steps; `u` undoes both at once.
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), 'one  three\n', 'undo removes the typed text first');
  await vscode.commands.executeCommand('undo');
  assert.equal(document.getText(), 'one two three\n', 'then the deletion');

  await reset('one\ntwo\n    four\n', new vscode.Selection(1, 0, 2, 0));
  await press('c');
  assert.equal(api.getState().mode, 'insert');
  assert.equal(document.getText(), 'one\n    \n    four\n', 'c on whole lines opens an indented line');
  assert.deepEqual(carets(), [8]);
  await press('x');
  await press('Escape');
  assert.equal(document.getText(), 'one\n    x\n    four\n');

  // a: INSERT after each selection; Escape steps back onto the appended text.
  await reset('one two\n', new vscode.Selection(0, 0, 0, 3));
  await press('a');
  assert.equal(api.getState().mode, 'insert');
  assert.deepEqual(carets(), [3]);
  await press('s');
  await press('Escape');
  assert.equal(document.getText(), 'ones two\n');
  assert.deepEqual(carets(), [3], 'the block cursor rests on the appended s');

  await reset('one', new vscode.Selection(0, 0, 0, 0));
  await press('e');
  await press('a');
  assert.equal(document.getText(), 'one\n', 'a at the end of the text adds a line ending, like Helix');
  await press('s');
  await press('Escape');
  assert.equal(document.getText(), 'ones\n');
  assert.deepEqual(carets(), [3]);

  await reset('ab\n', new vscode.Selection(0, 0, 0, 0));
  await press('a');
  await press('Escape');
  assert.deepEqual(carets(), [0], 'a then Escape leaves the cursor where it was');

  // i keeps working: a caret at the start of the selection.
  await reset('one two\n', new vscode.Selection(0, 7, 0, 4));
  await press('i');
  await press('x');
  await press('Escape');
  assert.equal(document.getText(), 'one xtwo\n');

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-edit-readonly', {
    provideTextDocumentContent: () => 'read only words',
  });
  try {
    const readonly = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-edit-readonly:test'));
    const readonlyEditor = await vscode.window.showTextDocument(readonly, vscode.ViewColumn.One);
    readonlyEditor.selection = new vscode.Selection(0, 0, 0, 4);
    await pause();
    for (const key of ['d', 'c', 'a']) { await press(key); }
    assert.equal(readonly.getText(), 'read only words', 'edits are not bound in read-only editors');
    assert.equal(api.getState().mode, 'normal');
  } finally {
    provider.dispose();
  }

  console.log('PASS Helix-style edits: a, c, d with real keyboard input');
}
