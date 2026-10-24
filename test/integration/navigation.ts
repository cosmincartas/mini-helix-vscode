import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = () => new Promise(resolve => setTimeout(resolve, 200));
async function until(predicate: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) { throw new Error(message); }
    await pause();
  }
}

/** Real keys and deterministic providers; no language extension is required. */
export async function checkNavigation(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const scheme = 'mini-helix-navigation';
  const source = vscode.Uri.parse(`${scheme}:source`);
  const target = vscode.Uri.parse(`${scheme}:target`);
  let referenceCalls = 0;
  const disposables = [
    vscode.workspace.registerTextDocumentContentProvider(scheme, {
      provideTextDocumentContent: () => 'alpha beta\nsecond line\n',
    }),
    vscode.languages.registerDefinitionProvider({ scheme }, {
      provideDefinition: () => new vscode.Location(target, new vscode.Position(1, 2)),
    }),
    vscode.languages.registerReferenceProvider({ scheme }, {
      provideReferences: () => {
        referenceCalls++;
        return [new vscode.Location(source, new vscode.Range(0, 0, 0, 5))];
      },
    }),
    vscode.languages.registerSelectionRangeProvider({ scheme }, {
      provideSelectionRanges: (_document, positions) => positions.map(() =>
        new vscode.SelectionRange(new vscode.Range(0, 0, 0, 5),
          new vscode.SelectionRange(new vscode.Range(0, 0, 1, 11))))
    }),
  ];
  const modified = (letter: string, modifiers: number) =>
    keyboard.press(letter, `Key${letter.toUpperCase()}`, letter.toUpperCase().charCodeAt(0), undefined, modifiers);
  try {
    await vscode.commands.executeCommand('miniHelix.enterNormal');
    const document = await vscode.workspace.openTextDocument(source);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    editor.selection = new vscode.Selection(0, 2, 0, 2);
    await pause();

    await modified('o', 1); // Alt+O
    await until(() => !editor.selection.isEmpty, 'Alt+O did not expand selection');
    assert.equal(document.getText(editor.selection), 'alpha');
    await modified('i', 1); // Alt+I
    await until(() => editor.selection.isEmpty, 'Alt+I did not shrink selection');
    assert.equal(editor.selection.active.character, 2);

    await keyboard.keys('gd');
    await until(() => vscode.window.activeTextEditor?.document.uri.toString() === target.toString(),
      'gd did not reveal the definition');
    assert.equal(vscode.window.activeTextEditor!.selection.active.line, 1);

    await modified('o', 2); // Ctrl+O
    await until(() => vscode.window.activeTextEditor?.document.uri.toString() === source.toString(),
      'Ctrl+O did not navigate back');
    await modified('i', 2); // Ctrl+I
    await until(() => vscode.window.activeTextEditor?.document.uri.toString() === target.toString(),
      'Ctrl+I did not navigate forward');

    await vscode.window.showTextDocument(document);
    await pause();
    await keyboard.keys('gr');
    await until(() => referenceCalls > 0, 'gr did not request references');
    assert.equal(document.getText(), 'alpha beta\nsecond line\n');
    assert.deepEqual(api.getState(), { enabled: true, mode: 'normal' });
    await vscode.commands.executeCommand('closeReferenceSearch');
    await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 2, 0, 2);
    const referencesBefore = referenceCalls;
    const guardedCommands = [
      'gotoDefinition', 'gotoReferences', 'expandSelection', 'shrinkSelection', 'jumpBack', 'jumpForward',
    ];
    const checkGuard = async () => {
      for (const command of guardedCommands) {
        await vscode.commands.executeCommand(`miniHelix.${command}`);
      }
      assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), source.toString());
      assert.ok(editor.selection.isEqual(new vscode.Selection(0, 2, 0, 2)));
      assert.equal(referenceCalls, referencesBefore);
    };
    await vscode.commands.executeCommand('miniHelix.enterInsert');
    await checkGuard();
    await vscode.commands.executeCommand('miniHelix.enterNormal');
    await vscode.commands.executeCommand('miniHelix.toggleEnabled');
    try { await checkGuard(); } finally {
      await vscode.commands.executeCommand('miniHelix.toggleEnabled');
    }
    console.log('PASS gd/gr, Alt+O/I, and Ctrl+O/I: read-only NORMAL editors and mode guards');
  } finally {
    await vscode.commands.executeCommand('closeReferenceSearch');
    for (const disposable of disposables) { disposable.dispose(); }
  }
}
