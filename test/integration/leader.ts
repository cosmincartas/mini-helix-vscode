import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = (milliseconds = 200) => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate: () => Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!await predicate()) {
    if (Date.now() > deadline) { throw new Error(message); }
    await pause(50);
  }
}

interface Widget { visible: boolean; input: string }

/** Space f, b, s, and S open VS Code's own pickers, driven with real keys. */
export async function checkLeader(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const scheme = 'mini-helix-leader';
  const text = 'alpha beta gamma\nsecond line\n';
  const provider = vscode.workspace.registerTextDocumentContentProvider(scheme, {
    provideTextDocumentContent: () => text,
  });
  const widget = () => keyboard.evaluate<Widget>(`(() => {
    const element = document.querySelector('.quick-input-widget');
    const input = document.querySelector('.quick-input-widget .quick-input-box input');
    return {
      visible: !!element && getComputedStyle(element).display !== 'none',
      input: input ? input.value : '',
    };
  })()`);
  const close = async () => {
    await keyboard.keys('<esc>');
    await until(async () => !(await widget()).visible, 'Escape did not close the picker');
  };
  try {
    await vscode.commands.executeCommand('miniHelix.enterNormal');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(`${scheme}:source`));
    const refocus = async () => {
      const shown = await vscode.window.showTextDocument(document, { preview: false });
      await pause();
      return shown;
    };
    const editor = await refocus();
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await pause();

    for (const [keys, expectation] of [
      [' f', (input: string) => input === ''],
      [' b', (input: string) => input.startsWith('edt active ')],
      [' s', (input: string) => input.startsWith('@')],
      [' S', (input: string) => input.startsWith('#')],
    ] as const) {
      await keyboard.keys(keys);
      await until(async () => (await widget()).visible, `${JSON.stringify(keys)} did not open a picker`);
      const { input } = await widget();
      assert.ok(expectation(input), `${JSON.stringify(keys)} opened a picker with input ${JSON.stringify(input)}`);
      await close();
      assert.equal(document.getText(), text);
      assert.deepEqual(api.getState(), { enabled: true, mode: 'normal' });
      await refocus();
    }

    // A pending count is cleared by the leader command, so w then moves one word.
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await keyboard.keys('w');
    const oneWord = editor.selection;
    assert.ok(!oneWord.isEmpty);
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await keyboard.keys('3 f');
    await until(async () => (await widget()).visible, '3 Space f did not open the picker');
    await close();
    await refocus();
    await keyboard.keys('w');
    assert.ok(editor.selection.isEqual(oneWord), 'the count survived the picker');
    assert.ok(/^\S+\s*$/.test(document.getText(editor.selection)), 'the selection is more than one word');

    const commands = ['filePicker', 'bufferPicker', 'symbolPicker', 'workspaceSymbolPicker'];
    const checkGuard = async () => {
      for (const command of commands) {
        await vscode.commands.executeCommand(`miniHelix.${command}`);
        await pause();
        assert.equal((await widget()).visible, false, `${command} opened a picker outside NORMAL`);
      }
    };
    await vscode.commands.executeCommand('miniHelix.enterInsert');
    await checkGuard();
    await vscode.commands.executeCommand('miniHelix.enterNormal');
    await vscode.commands.executeCommand('miniHelix.toggleEnabled');
    try { await checkGuard(); } finally {
      await vscode.commands.executeCommand('miniHelix.toggleEnabled');
    }
    assert.equal(document.getText(), text);
    console.log('PASS Space f/b/s/S open native pickers: read-only NORMAL editors, count clearing, and mode guards');

    // Other Space chords are unbound keys: no text, no command, and the count is cleared.
    const writable = await vscode.workspace.openTextDocument({ language: 'plaintext', content: text });
    const writableEditor = await vscode.window.showTextDocument(writable, { preview: false });
    await pause();
    writableEditor.selection = new vscode.Selection(0, 0, 0, 0);
    await keyboard.keys('w');
    const word = writableEditor.selection;
    assert.ok(!word.isEmpty);
    writableEditor.selection = new vscode.Selection(0, 0, 0, 0);
    await keyboard.keys('2 xw');
    assert.equal(writable.getText(), text);
    assert.ok(writableEditor.selection.isEqual(word), 'the count survived Space x');
    assert.equal((await widget()).visible, false);
    await keyboard.keys(' <ret>');
    assert.equal(writable.getText(), text);
    assert.deepEqual(api.getState(), { enabled: true, mode: 'normal' });
    console.log('PASS other Space chords type nothing and clear the count');
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    provider.dispose();
  }
}
