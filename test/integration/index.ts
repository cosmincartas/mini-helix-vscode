import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Count } from '../../src/core/count';
import { checkLineSelection } from './lineSelection';
import { ModeController } from '../../src/core/mode';
import { registerMotion } from '../../src/core/registerMotion';
import { Keyboard } from './keyboard';
import { checkEditing } from './editing';
import { checkHistory } from './history';
import { checkCharMotions } from './hjkl';
import { checkWordJump } from './wordJump';
import { checkWordMotions } from './wordMotion';
import { checkNavigation } from './navigation';
import { checkMatch } from './match';
import { checkLeader } from './leader';

async function until(predicate: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) { throw new Error(message); }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

async function check(name: string, body: () => Promise<void>): Promise<void> {
  await body();
  console.log(`PASS ${name}`);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<MiniHelixApi>('local.mini-helix');
  assert.ok(extension);
  const api = await extension.activate();
  const keyboard = await Keyboard.connect();
  assert.equal(vscode.window.activeTextEditor, undefined, 'isolated host starts without an editor');
  await vscode.commands.executeCommand('miniHelix.count', 2);
  await vscode.commands.executeCommand('miniHelix.extendLineBelow');
  await vscode.commands.executeCommand('miniHelix.extendToLineBounds');
  console.log('PASS line commands and count input guard no-editor calls');
  const document = await vscode.workspace.openTextDocument({
    language: 'plaintext', content: 'alpha beta\ngamma delta\n',
  });
  let editor = await vscode.window.showTextDocument(document);
  const baseline = document.getText();

  try {
    await check('activates in NORMAL with a block cursor without changing settings', async () => {
      assert.deepEqual(api.getState(), { enabled: true, mode: 'normal' });
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
      assert.equal(vscode.workspace.getConfiguration('editor').get('cursorStyle'), 'underline');
    });

    await check('unbound normal keys, shifted punctuation, and editing keys cannot type', async () => {
      const keys: [string, string, number, string?, number?][] = [
        ['x', 'KeyX', 88, 'x'],
        ['X', 'KeyX', 88, 'X', 8],
        ['7', 'Digit7', 55, '7'],
        ['$', 'Digit4', 52, '$', 8],
        [';', 'Semicolon', 186, ';'],
        ['"', 'Quote', 222, '"', 8],
        [' ', 'Space', 32, ' '],
        ['Enter', 'Enter', 13, '\r'],
        ['Tab', 'Tab', 9],
        ['Backspace', 'Backspace', 8],
        ['Delete', 'Delete', 46],
      ];
      for (const key of keys) { await keyboard.press(...key); }
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(document.getText(), baseline);
      // x/X now select lines; the same key stream must still preserve the document.
      await keyboard.keys('<esc>');
    });

    await check('numeric keypad digits and operators cannot type in NORMAL', async () => {
      for (let digit = 0; digit <= 9; digit++) {
        await keyboard.press(String(digit), `Numpad${digit}`, 96 + digit, String(digit), 0, true);
      }
      for (const [key, code, virtualKey] of [
        ['+', 'NumpadAdd', 107], ['-', 'NumpadSubtract', 109],
        ['*', 'NumpadMultiply', 106], ['/', 'NumpadDivide', 111],
        ['.', 'NumpadDecimal', 110],
      ] as const) {
        await keyboard.press(key, code, virtualKey, key, 0, true);
      }
      assert.equal(document.getText(), baseline);
    });

    await check('i enters INSERT, native typing works, Escape returns to NORMAL', async () => {
      // Earlier x/X checks move the selection; this case starts at the document's beginning.
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      await keyboard.press('i', 'KeyI', 73, 'i');
      await until(() => api.getState().mode === 'insert', 'i did not enter INSERT');
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      await keyboard.press('z', 'KeyZ', 90, 'z');
      await until(() => document.getText().startsWith('zalpha'), 'INSERT did not type');
      await keyboard.press('Escape', 'Escape', 27);
      await until(() => api.getState().mode === 'normal', 'Escape did not enter NORMAL');
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
    });

    await check('user-defined g l overrides blockers and uses native VS Code chords', async () => {
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      await keyboard.press('g', 'KeyG', 71, 'g');
      await keyboard.press('l', 'KeyL', 76, 'l');
      await until(
        () => editor.selection.active.character === document.lineAt(0).text.length,
        'Opt-in g l chord did not move to the end of the line'
      );
    });

    await check('NORMAL does not block text input in a Quick Input box', async () => {
      const input = vscode.window.createInputBox();
      try {
        input.show();
        await new Promise(resolve => setTimeout(resolve, 150));
        await keyboard.press('x', 'KeyX', 88, 'x');
        await until(() => input.value === 'x', 'Quick Input typing was blocked');
        assert.equal(api.getState().mode, 'normal');
      } finally {
        input.hide();
        input.dispose();
        editor = await vscode.window.showTextDocument(document);
      }
    });

    await check('read-only editors do not capture the NORMAL i binding', async () => {
      const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-readonly', {
        provideTextDocumentContent: () => 'read-only content',
      });
      try {
        const readonlyDocument = await vscode.workspace.openTextDocument(
          vscode.Uri.parse('mini-helix-readonly:test')
        );
        await vscode.window.showTextDocument(readonlyDocument);
        await keyboard.press('i', 'KeyI', 73, 'i');
        assert.equal(api.getState().mode, 'normal');
        assert.equal(readonlyDocument.getText(), 'read-only content');
      } finally {
        provider.dispose();
        editor = await vscode.window.showTextDocument(document);
      }
    });

    await check('INSERT collapses forward and reversed selections to their starts', async () => {
      editor.selections = [
        new vscode.Selection(0, 1, 0, 4),
        new vscode.Selection(1, 5, 1, 1),
      ];
      const before = document.getText();
      await vscode.commands.executeCommand('miniHelix.enterInsert');
      assert.equal(editor.selections.length, 2);
      assert.ok(editor.selections.every(selection => selection.isEmpty));
      assert.deepEqual(editor.selections.map(selection => [selection.active.line, selection.active.character]), [
        [0, 1], [1, 1],
      ]);
      assert.equal(document.getText(), before);
      await vscode.commands.executeCommand('miniHelix.enterNormal');
    });

    await check('suspension restores cursors and native typing; resume restores NORMAL', async () => {
      editor.selections = [new vscode.Selection(0, 0, 0, 0)];
      await vscode.commands.executeCommand('miniHelix.toggleEnabled');
      assert.equal(api.getState().enabled, false);
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      await keyboard.press('q', 'KeyQ', 81, 'q');
      await until(() => document.getText().startsWith('qzalpha'), 'Suspended mode blocked typing');
      await vscode.commands.executeCommand('miniHelix.enterInsert');
      assert.equal(api.getState().mode, 'normal', 'Suspended mode must ignore mode commands');
      await vscode.commands.executeCommand('miniHelix.toggleEnabled');
      assert.equal(api.getState().enabled, true);
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
    });

    await check('switching tabs in one group does not capture the temporary block cursor', async () => {
      const tab = await vscode.workspace.openTextDocument({ content: 'same group tab' });
      const tabEditor = await vscode.window.showTextDocument(tab, vscode.ViewColumn.One);
      assert.equal(tabEditor.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
      await vscode.commands.executeCommand('miniHelix.enterInsert');
      assert.equal(tabEditor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      await vscode.commands.executeCommand('miniHelix.enterNormal');
      editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      await vscode.commands.executeCommand('miniHelix.enterInsert');
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      await vscode.commands.executeCommand('miniHelix.enterNormal');
    });

    await check('cursor-setting changes retain NORMAL styling and update INSERT styling', async () => {
      const settings = vscode.workspace.getConfiguration('editor');
      let changed = false;
      const subscription = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('editor.cursorStyle')) { changed = true; }
      });
      try {
        await settings.update('cursorStyle', 'line-thin', vscode.ConfigurationTarget.Global);
        await until(() => changed && editor.options.cursorStyle === vscode.TextEditorCursorStyle.Block,
          'cursor setting did not propagate and restore NORMAL block styling');
        assert.equal(vscode.workspace.getConfiguration('editor').get('cursorStyle'), 'line-thin');
        assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
        await vscode.commands.executeCommand('miniHelix.enterInsert');
        assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.LineThin);
        changed = false;
        await settings.update('cursorStyle', 'underline', vscode.ConfigurationTarget.Global);
        await until(() => changed && editor.options.cursorStyle === vscode.TextEditorCursorStyle.Underline,
          'cursor setting did not propagate to INSERT styling');
        assert.equal(vscode.workspace.getConfiguration('editor').get('cursorStyle'), 'underline');
        assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
        await vscode.commands.executeCommand('miniHelix.enterNormal');
      } finally {
        subscription.dispose();
      }
    });

    await check('both visible editors follow the global mode and restore native cursors', async () => {
      const second = await vscode.workspace.openTextDocument({ content: 'another editor' });
      const secondEditor = await vscode.window.showTextDocument(second, vscode.ViewColumn.Beside);
      assert.equal(secondEditor.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
      await vscode.commands.executeCommand('miniHelix.enterInsert');
      assert.equal(secondEditor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      await vscode.commands.executeCommand('miniHelix.enterNormal');
      editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    });

    await check('settings can disable and re-enable the core at runtime', async () => {
      const settings = vscode.workspace.getConfiguration('miniHelix');
      await settings.update('enabled', false, vscode.ConfigurationTarget.Global);
      await until(() => !api.getState().enabled, 'enabled setting was not applied');
      assert.equal(editor.options.cursorStyle, vscode.TextEditorCursorStyle.Underline);
      await settings.update('enabled', true, vscode.ConfigurationTarget.Global);
      await until(() => api.getState().enabled, 'enabled setting was not reapplied');
    });

    await checkNavigation(api, keyboard);
    await checkLeader(api, keyboard);
    await checkLineSelection(api, keyboard);
    await checkWordJump(api, keyboard);
    await checkWordMotions(api, keyboard);
    await checkEditing(api, keyboard);
    await checkHistory(api, keyboard);
    await checkCharMotions(api, keyboard);
    await check('match: text objects and surround replacement', () => checkMatch(api, keyboard));
    editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

    await check('motion runner supports multiple selections and guards INSERT/disabled states', async () => {
      const modes = new ModeController({ enabled: true, mode: 'normal' }, {
        prepareInsert() {}, restoreAppendCursor() {}, commitInsert() {}, render() {}, publish: async () => {},
      });
      let calls = 0;
      const command = registerMotion('miniHelix.testMotion', (doc, selection) => {
        calls++;
        const next = doc.positionAt(doc.offsetAt(selection.active) + 1);
        return new vscode.Selection(next, next);
      }, modes, new Count());
      try {
        editor.selections = [new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0)];
        await vscode.commands.executeCommand('miniHelix.testMotion');
        assert.equal(calls, 2);
        assert.deepEqual(editor.selections.map(selection => selection.active.character), [1, 1]);
        await modes.enter('insert');
        await vscode.commands.executeCommand('miniHelix.testMotion');
        assert.equal(calls, 2);
        await modes.enter('normal');
        await modes.setEnabled(false);
        await vscode.commands.executeCommand('miniHelix.testMotion');
        assert.equal(calls, 2);
      } finally {
        command.dispose();
      }
    });
  } finally {
    keyboard.dispose();
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    // Do not save temporary untitled documents or show save dialogs on exit.
    for (const visible of vscode.window.visibleTextEditors) {
      await vscode.window.showTextDocument(visible.document, visible.viewColumn);
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  }
}
