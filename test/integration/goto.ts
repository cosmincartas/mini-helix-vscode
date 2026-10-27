import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Document, normalize, ordered, parse, print } from '../unit/helix';
import { firstNonWhitespace, fileStart, lastLine, lineEnd } from '../unit/gotoMotionCases';
import { Keyboard } from './keyboard';

const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) { throw new Error(message); }
    await pause(50);
  }
}

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
  return vscode.window.showTextDocument(document, vscode.ViewColumn.One);
}

async function close(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
}

function select(editor: vscode.TextEditor, notation: string): void {
  const position = (offset: number) => editor.document.positionAt(offset);
  editor.selections = parse(notation).ranges.map(range =>
    new vscode.Selection(position(range.anchor), position(range.head)));
}

const visible = (editor: vscode.TextEditor, line: number) =>
  editor.visibleRanges.some(range => range.start.line <= line && line <= range.end.line);

/** gs, gl, gg, and ge from real Helix 25.07.1 cases (FR-1 to FR-11), with real keys. */
export async function checkGotoMotions(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const failures: string[] = [];
  // The FR-8 case `3gll` and the FR-10 multi-selection cases are rows of these tables.
  // VS Code gives a new document one line ending, so a mixed `\n` and `\r\n` case only runs in the unit tests.
  const mixedEndings = (text: string) => /\r\n/.test(text) && /(?<!\r)\n/.test(text);
  const all = [...firstNonWhitespace, ...lineEnd, ...fileStart, ...lastLine]
    .filter(([input]) => !mixedEndings(parse(input).text));
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
    assert.equal(editor.document.getText(), parse(input).text, `${keys} never edits`);
    await close();
  }
  assert.deepEqual(failures, []);
  console.log(`PASS gs, gl, gg, ge match Helix in ${all.length} cases with real keyboard input`);

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-goto-readonly', {
    provideTextDocumentContent: () => 'read only\ntext here\n',
  });
  try {
    const readonly = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-goto-readonly:test'));
    const editor = await vscode.window.showTextDocument(readonly, vscode.ViewColumn.One);
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    await keyboard.keys('gl');
    await until(() => editor.selection.active.character === 8, 'gl did not move in a read-only editor');
    await close();
  } finally {
    provider.dispose();
  }

  {
    const editor = await open('abc\n');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    await keyboard.keys('i');
    await until(() => api.getState().mode === 'insert', 'i did not enter INSERT');
    await keyboard.keys('gs');
    await until(() => editor.document.getText() === 'gsabc\n', 'INSERT mode did not type gs');
    await keyboard.keys('<esc>');
    await until(() => api.getState().mode === 'normal', 'Escape did not enter NORMAL');
    await close();
  }

  {
    const editor = await open(Array.from({ length: 500 }, (_, index) => `line ${index}`).join('\n') + '\n');
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();
    await keyboard.keys('ge');
    await until(() => visible(editor, 499), 'ge did not scroll the last line into view');
    assert.equal(editor.selection.active.line, 499);
    await keyboard.keys('gg');
    await until(() => visible(editor, 0), 'gg did not scroll the first line into view');
    assert.equal(editor.selection.active.line, 0);
    await close();
  }
  console.log('PASS gs, gl, gg, ge work in read-only editors, yield to INSERT, and scroll the cursor into view');
}
