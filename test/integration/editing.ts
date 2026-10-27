import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = () => new Promise(resolve => setTimeout(resolve, 150));

export async function checkEditing(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content: 'one two three\n    four\nfive' });
  let editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
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

  // o, O: open a line below the last or above the first selected line, then INSERT.
  await reset('one\ntwo\n', new vscode.Selection(0, 0, 1, 2));
  await press('o');
  assert.equal(document.getText(), 'one\ntwo\n\n', 'o opens below the line of the last selected character');
  assert.deepEqual(carets(), [8]);
  assert.equal(api.getState().mode, 'insert');
  await press('Escape');

  await reset('one\ntwo\n', new vscode.Selection(0, 2, 1, 2));
  await press('O');
  assert.equal(document.getText(), '\none\ntwo\n', 'O opens above the line of the first selected character');
  assert.deepEqual(carets(), [0]);
  assert.equal(api.getState().mode, 'insert');
  await press('Escape');

  await reset('ab\ncd\n', new vscode.Selection(0, 0, 0, 0), new vscode.Selection(0, 1, 0, 1));
  await press('o');
  assert.equal(document.getText(), 'ab\n\n\ncd\n', 'two selections on one line open two lines');
  assert.deepEqual(carets(), [3, 4]);
  await press('Escape');

  // A count has no effect on o, and the key clears it.
  await reset('one two three four', new vscode.Selection(0, 0, 0, 0));
  await keyboard.press('3', 'Digit3', 51, '3');
  await pause();
  await press('o');
  assert.equal(document.getText(), 'one two three four\n', '3o opens one line');
  await press('Escape');
  editor.selection = new vscode.Selection(0, 0, 0, 0);
  await press('w');
  assert.equal(document.getText(editor.selection), 'one ', 'o cleared the count, so w moves one word');

  // Escape right after o or O removes the indentation it gave the line, and `u` undoes the whole open.
  const indented = '    one\n    two\n';
  await reset(indented, new vscode.Selection(0, 4, 0, 4));
  await press('o');
  assert.equal(document.getText(), '    one\n    \n    two\n', 'o keeps the indentation of the line');
  await press('Escape');
  assert.equal(document.getText(), '    one\n\n    two\n', 'Escape after o leaves the line empty');
  assert.deepEqual(carets(), [8]);
  await press('u');
  assert.equal(document.getText(), indented, 'one u undoes the open and the removal');

  await reset(indented, new vscode.Selection(1, 4, 1, 4));
  await press('O');
  await press('Escape');
  assert.equal(document.getText(), '    one\n\n    two\n', 'Escape after O leaves the line empty');
  await press('u');
  assert.equal(document.getText(), indented, 'one u undoes O and the removal');

  await reset(indented, new vscode.Selection(0, 4, 0, 4));
  await press('o');
  await press('x');
  await press('Escape');
  assert.equal(document.getText(), '    one\n    x\n    two\n', 'typed text keeps the indentation');
  await press('u');
  assert.equal(document.getText(), indented, 'one u undoes the open and what it typed');

  await reset(indented, new vscode.Selection(0, 4, 0, 4), new vscode.Selection(1, 4, 1, 4));
  await press('o');
  await press('Escape');
  assert.equal(document.getText(), '    one\n    \n    two\n    \n', 'two carets keep both indentations');
  await press('u');
  assert.equal(document.getText(), indented, 'one u undoes both opens');

  // The indentation comes from VS Code's native line commands.
  const indent = vscode.languages.setLanguageConfiguration(document.languageId, {
    indentationRules: { increaseIndentPattern: /\{\s*$/, decreaseIndentPattern: /^\s*\}/ },
  });
  try {
    await reset('if (a) {\n}\n', new vscode.Selection(0, 0, 0, 0));
    await press('o');
    assert.equal(document.getText(), 'if (a) {\n    \n}\n', 'o indents after a line that opens a block');
    assert.deepEqual(carets(), [13], 'the caret is after the indentation');
    await press('Escape');

    // An open editor keeps the autoIndent it was created with, so a new one shows the setting.
    const autoIndent = vscode.workspace.getConfiguration('editor');
    const previous = autoIndent.inspect('autoIndent')?.globalValue;
    await autoIndent.update('autoIndent', 'none', vscode.ConfigurationTarget.Global);
    try {
      const plain = await vscode.workspace.openTextDocument({ content: 'if (a) {\n}\n' });
      const plainEditor = await vscode.window.showTextDocument(plain, vscode.ViewColumn.One);
      plainEditor.selection = new vscode.Selection(0, 0, 0, 0);
      await pause();
      await press('o');
      assert.equal(plain.getText(), 'if (a) {\n\n}\n', 'editor.autoIndent none gives an empty line');
      assert.equal(plain.offsetAt(plainEditor.selection.active), 9);
      await press('Escape');
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    } finally {
      await autoIndent.update('autoIndent', previous, vscode.ConfigurationTarget.Global);
      // Showing the document again makes a new editor, with the restored setting.
      editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      editor.options = { insertSpaces: true, tabSize: 4, indentSize: 4 };
      await pause();
    }
  } finally {
    indent.dispose();
  }

  // New lines use the document's line ending.
  await editor.edit(builder => builder.setEndOfLine(vscode.EndOfLine.CRLF));
  await reset('ab\ncd', new vscode.Selection(0, 0, 0, 0));
  await press('o');
  assert.equal(document.getText(), 'ab\r\n\r\ncd', 'o inserts a CRLF line ending in a CRLF document');
  assert.deepEqual(carets(), [4]);
  await press('Escape');
  await editor.edit(builder => builder.setEndOfLine(vscode.EndOfLine.LF));

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-edit-readonly', {
    provideTextDocumentContent: () => 'read only words',
  });
  try {
    const readonly = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-edit-readonly:test'));
    const readonlyEditor = await vscode.window.showTextDocument(readonly, vscode.ViewColumn.One);
    readonlyEditor.selection = new vscode.Selection(0, 0, 0, 4);
    await pause();
    for (const key of ['d', 'c', 'a', 'o', 'O']) { await press(key); }
    assert.equal(readonly.getText(), 'read only words', 'edits are not bound in read-only editors');
    assert.equal(api.getState().mode, 'normal');
  } finally {
    provider.dispose();
  }

  console.log('PASS Helix-style edits: a, c, d, o, O with real keyboard input');
}
