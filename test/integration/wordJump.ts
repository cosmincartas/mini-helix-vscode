import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { Keyboard } from './keyboard';

const pause = () => new Promise(resolve => setTimeout(resolve, 150));

export async function checkWordJump(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content: 'zero one two three four\nfive six seven eight\n' });
  const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  await pause();
  const baseline = document.getText();
  const press = (letter: string) => keyboard.press(letter, `Key${letter.toUpperCase()}`, letter.toUpperCase().charCodeAt(0), letter);
  const start = async (selection = new vscode.Selection(0, 10, 0, 10)) => {
    editor.selections = [selection];
    await pause();
    await press('g');
    await press('w');
  };
  const input = async (label: string) => {
    for (const letter of label) { await press(letter); }
  };
  // Once labels are cancelled, `a` is append, so probe with what a stale label
  // binding would send; capture release itself is checked by pressing `i`.
  const staleInput = async (label: string) => {
    for (const letter of label) {
      await vscode.commands.executeCommand('miniHelix.wordJumpInput', letter);
    }
  };
  const snapshot = () => editor.selections.map(selection => [
    selection.anchor.line, selection.anchor.character, selection.active.line, selection.active.character,
  ]);

  const renderedLabels = () => keyboard.evaluate<{ content: string; width: string; color: string }[]>(`
    Array.from(document.querySelectorAll('.monaco-editor .view-line span'))
      .map(element => {
        const style = getComputedStyle(element, '::before');
        return { content: style.content, width: style.width, color: style.color };
      }).filter(style => /^"[a-z]"$/.test(style.content))
  `);
  const paintedLabels = async (count: number) => {
    const deadline = Date.now() + 5000;
    let labels = await renderedLabels();
    // CDP key dispatch can finish before the older Electron compositor paints decorations.
    while (labels.length !== count && Date.now() < deadline) {
      await pause();
      labels = await renderedLabels();
    }
    return labels;
  };
  await start();
  const labels = await paintedLabels(16);
  assert.equal(labels.length, 16, 'the eight eligible words each render two label glyphs');
  assert.ok(labels.every(label => label.width === '0px' && label.color !== 'rgba(0, 0, 0, 0)'),
    'labels must be visible overlays that do not shift text');
  await input('a');
  assert.deepEqual(await renderedLabels(), labels, 'the first letter leaves labels unchanged');
  await input('a');
  await pause();
  assert.deepEqual(await paintedLabels(0), [], 'jump completion removes decorations');
  assert.equal(document.getText(editor.selection), 'three', 'gw aa selects the next whole word');
  assert.deepEqual(snapshot(), [[0, 13, 0, 18]], 'successful jumps are forward selections');
  assert.equal(document.getText(), baseline);
  assert.equal(api.getState().mode, 'normal');

  // Repeating gw skips the selected word, even though its active end is exclusive.
  await press('g');
  await press('w');
  await input('aa');
  assert.equal(document.getText(editor.selection), 'four');

  await start();
  await input('ab');
  assert.equal(document.getText(editor.selection), 'one', 'labels alternate forwards/backwards');

  await start(new vscode.Selection(0, 12, 0, 9));
  await input('aa');
  assert.equal(document.getText(editor.selection), 'three', 'reversed primary selections use their active cursor');

  editor.selections = [new vscode.Selection(0, 10, 0, 10), new vscode.Selection(1, 0, 1, 0)];
  await pause();
  const multiple = snapshot();
  await vscode.commands.executeCommand('miniHelix.gotoWord');
  await keyboard.press('Escape', 'Escape', 27);
  assert.deepEqual(snapshot(), multiple, 'cancelling preserves all selections');
  await vscode.commands.executeCommand('miniHelix.gotoWord');
  await vscode.commands.executeCommand('miniHelix.gotoWord'); // Reentry replaces the old session.
  await input('aa');
  assert.equal(editor.selections.length, 1, 'a jump replaces all selections');
  assert.equal(document.getText(editor.selection), 'three');

  // A typed i or g is a label key, never INSERT or the start of another chord.
  await start(new vscode.Selection(0, 0, 0, 0));
  await input('ah');
  assert.equal(document.getText(editor.selection), 'eight');
  await start(new vscode.Selection(0, 0, 0, 0));
  await input('ai'); // i is consumed as the (nonexistent) second label letter.
  assert.equal(editor.selection.isEmpty, true);
  assert.equal(api.getState().mode, 'normal');
  await start();
  await input('g'); // No labels start with g: cancel, do not wait for a chord.
  await press('i');
  assert.equal(api.getState().mode, 'insert');
  await keyboard.press('Escape', 'Escape', 27);

  for (const label of ['z', 'az']) {
    await start();
    const before = snapshot();
    await input(label);
    assert.deepEqual(snapshot(), before, 'unknown labels preserve selections');
    await press('i');
    assert.equal(api.getState().mode, 'insert', 'unknown labels release input capture');
    await keyboard.press('Escape', 'Escape', 27);
  }
  for (const prefix of ['', 'a']) {
    await start();
    const before = snapshot();
    if (prefix) { await input(prefix); }
    await keyboard.press('Escape', 'Escape', 27);
    assert.deepEqual(await paintedLabels(0), [], 'Escape removes decorations');
    assert.deepEqual(snapshot(), before, 'Escape preserves selections');
    await press('i');
    assert.equal(api.getState().mode, 'insert');
    await keyboard.press('Escape', 'Escape', 27);
  }
  await start();
  await keyboard.press('ArrowRight', 'ArrowRight', 39);
  assert.deepEqual(snapshot(), [[0, 10, 0, 10]], 'invalid navigation keys cancel without moving');
  await press('i');
  assert.equal(api.getState().mode, 'insert');
  await vscode.commands.executeCommand('miniHelix.gotoWord'); // Guard direct calls in INSERT.
  await input('z');
  assert.equal(document.getText(), baseline.slice(0, 10) + 'z' + baseline.slice(10));
  await keyboard.press('Escape', 'Escape', 27);
  await vscode.commands.executeCommand('undo');
  await pause();

  await start();
  await vscode.commands.executeCommand('miniHelix.enterInsert');
  await input('z');
  assert.equal(document.getText(), baseline.slice(0, 10) + 'z' + baseline.slice(10),
    'mode changes release capture before native typing');
  await keyboard.press('Escape', 'Escape', 27);
  await vscode.commands.executeCommand('undo');
  await pause();

  await start();
  await vscode.commands.executeCommand('miniHelix.toggleEnabled');
  await vscode.commands.executeCommand('miniHelix.gotoWord'); // Also guarded when disabled.
  await input('q');
  assert.notEqual(document.getText(), baseline, 'suspension releases capture');
  await vscode.commands.executeCommand('undo');
  await vscode.commands.executeCommand('miniHelix.toggleEnabled');
  await pause();

  await start();
  editor.selection = new vscode.Selection(1, 0, 1, 0);
  await pause();
  await staleInput('aa');
  assert.deepEqual(snapshot(), [[1, 0, 1, 0]], 'moving the selection cancels stale labels');

  await start();
  await editor.edit(edit => edit.insert(new vscode.Position(1, 0), 'changed '));
  await pause();
  const beforeEditInput = snapshot();
  await staleInput('aa');
  assert.deepEqual(snapshot(), beforeEditInput, 'document edits cancel stale labels');
  await vscode.commands.executeCommand('undo');
  await pause();

  await start();
  const other = await vscode.workspace.openTextDocument({ content: 'another document' });
  const otherEditor = await vscode.window.showTextDocument(other, vscode.ViewColumn.One);
  await pause();
  await staleInput('aa');
  assert.equal(otherEditor.selection.isEmpty, true, 'tab changes release capture');
  await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  await pause();
  await staleInput('aa');
  assert.equal(editor.selection.isEmpty, true, 'returning to the old tab does not revive labels');

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-wordjump-readonly', {
    provideTextDocumentContent: () => 'zero one two',
  });
  try {
    const readonly = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-wordjump-readonly:test'));
    const readonlyEditor = await vscode.window.showTextDocument(readonly, vscode.ViewColumn.One);
    await pause();
    await vscode.commands.executeCommand('miniHelix.gotoWord'); // Command Palette entry point.
    await input('aa');
    assert.equal(readonly.getText(readonlyEditor.selection), 'one', 'read-only command input works');
    await press('g');
    await press('w');
    await keyboard.press('Escape', 'Escape', 27);
    await input('aa');
    assert.equal(readonly.getText(readonlyEditor.selection), 'one', 'read-only Escape cancels labels');
  } finally {
    provider.dispose();
  }

  const folded = await vscode.workspace.openTextDocument({ content:
    'header\n' + Array.from({ length: 80 }, (_, i) => `  hidden${i} inside${i}`).join('\n') + '\nvisibleWord nextWord',
  });
  const foldedEditor = await vscode.window.showTextDocument(folded, vscode.ViewColumn.One);
  foldedEditor.selection = new vscode.Selection(0, 0, 0, 0);
  await pause();
  await vscode.commands.executeCommand('editor.fold', { selectionLines: [0] });
  await pause();
  assert.ok(foldedEditor.visibleRanges.length > 1, 'test fixture must have a folded region');
  await press('g');
  await press('w');
  await input('aa');
  assert.equal(folded.getText(foldedEditor.selection), 'visibleWord', 'folded words do not use labels');

  const empty = await vscode.workspace.openTextDocument({ content: 'x y z' });
  await vscode.window.showTextDocument(empty, vscode.ViewColumn.One);
  await pause();
  await press('g');
  await press('w');
  await press('i');
  assert.equal(api.getState().mode, 'insert', 'no eligible words means no capture');
  await keyboard.press('Escape', 'Escape', 27);

  const long = await vscode.workspace.openTextDocument({ content: Array.from({ length: 200 }, (_, i) => `word${i} target${i}`).join('\n') });
  const longEditor = await vscode.window.showTextDocument(long, vscode.ViewColumn.One);
  longEditor.selection = new vscode.Selection(0, 0, 0, 0);
  longEditor.revealRange(longEditor.selection);
  await pause();
  const belowViewport = longEditor.visibleRanges.at(-1)!.end.line + 2;
  assert.ok(belowViewport < 200, 'test fixture must extend below the viewport');
  const offscreenIndex = 2 * belowViewport - 1;
  const offscreenLabel = String.fromCharCode(97 + Math.floor(offscreenIndex / 26), 97 + offscreenIndex % 26);
  await press('g');
  await press('w');
  await input(offscreenLabel);
  assert.equal(longEditor.selection.isEmpty, true, 'offscreen words do not use labels');
  await press('g');
  await press('w');
  longEditor.revealRange(new vscode.Range(190, 0, 190, 0), vscode.TextEditorRevealType.AtTop);
  await pause();
  await staleInput('aa');
  assert.equal(longEditor.selection.isEmpty, true, 'scrolling cancels labels');

  console.log('PASS Helix-style word jump: real keyboard input, selections, guards, and lifecycle');
}
