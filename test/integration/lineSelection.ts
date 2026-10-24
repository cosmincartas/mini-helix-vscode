import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { MiniHelixApi } from '../../src/extension';
import { blockRange } from '../../src/core/editing';
import { OffsetRange, WordMotionText } from '../../src/core/wordMotion';
import { Keyboard } from './keyboard';

const pause = () => new Promise(resolve => setTimeout(resolve, 150));
const lineCommands = ['miniHelix.extendLineBelow', 'miniHelix.extendToLineBounds'];

interface OracleState {
  text: string;
  ranges: OffsetRange[];
  primaryIndex: number;
}
interface OracleCase {
  id: string;
  keys: string;
  input: OracleState;
  steps: (OracleState & { keys: string })[];
}

async function open(text: string, ranges: readonly OffsetRange[] = [{ anchor: 0, head: 0 }]): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({ content: text });
  const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  select(editor, ranges);
  await pause();
  return editor;
}

function select(editor: vscode.TextEditor, ranges: readonly OffsetRange[]): void {
  editor.selections = ranges.map(({ anchor, head }) => new vscode.Selection(
    editor.document.positionAt(anchor), editor.document.positionAt(head)
  ));
}

function offsets(editor: vscode.TextEditor): OffsetRange[] {
  return editor.selections.map(selection => ({
    anchor: editor.document.offsetAt(selection.anchor),
    head: editor.document.offsetAt(selection.active),
  }));
}

function primaryFirst(state: OracleState): OffsetRange[] {
  return [state.ranges[state.primaryIndex], ...state.ranges.filter((_, index) => index !== state.primaryIndex)];
}

async function close(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
}

/** Real keyboard checks keep document text, directed ranges and primary identity exact. */
export async function checkLineSelection(api: MiniHelixApi, keyboard: Keyboard): Promise<void> {
  const setting = vscode.workspace.getConfiguration('editor').get('multiCursorMergeOverlapping');
  assert.equal(setting, false, 'parity profile must disable VS Code touching-cursor merging');
  console.log(`HOST ${vscode.version}; editor.multiCursorMergeOverlapping=${setting}`);

  const text = 'one\ntwo\nthree\nfour\nfive\n';
  const cases: [string, OffsetRange, OffsetRange][] = [
    ['x', { anchor: 1, head: 1 }, { anchor: 0, head: 4 }],
    ['xx', { anchor: 1, head: 1 }, { anchor: 0, head: 8 }],
    ['2x', { anchor: 1, head: 1 }, { anchor: 0, head: 8 }],
    ['x2x', { anchor: 1, head: 1 }, { anchor: 0, head: 14 }],
    ['X', { anchor: 3, head: 1 }, { anchor: 4, head: 0 }],
    ['XX', { anchor: 3, head: 1 }, { anchor: 4, head: 0 }],
    ['2Xx', { anchor: 1, head: 1 }, { anchor: 0, head: 8 }],
    ['0x', { anchor: 1, head: 1 }, { anchor: 0, head: 4 }],
    ['1000000009x', { anchor: 1, head: 1 }, { anchor: 0, head: text.length }],
  ];
  for (const [keys, input, expected] of cases) {
    const editor = await open(text, [input]);
    const { version, isDirty } = editor.document;
    await keyboard.keys(keys);
    assert.deepEqual(offsets(editor), [expected], keys);
    assert.equal(editor.document.getText(), text, keys);
    assert.equal(editor.document.version, version, `${keys} must not create an edit`);
    assert.equal(editor.document.isDirty, isDirty, `${keys} must preserve dirty state`);
    await close();
  }

  // Multi-digit input reaches commands, including numeric keypad digits.
  {
    const many = Array.from({ length: 20 }, (_, index) => `line ${index}\n`);
    const editor = await open(many.join(''));
    await keyboard.keys('12x');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: many.slice(0, 12).join('').length }]);
    select(editor, [{ anchor: 0, head: 0 }]);
    await keyboard.press('2', 'Numpad2', 98, '2', 0, true);
    await keyboard.keys('x');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: many.slice(0, 2).join('').length }]);
    await close();
  }

  // Existing consumers share the same count and consume it once.
  {
    const editor = await open('one two three four\n');
    await keyboard.keys('2w');
    assert.equal(editor.document.getText(editor.selection), 'two ');
    await keyboard.keys('w');
    assert.equal(editor.document.getText(editor.selection), 'three ');
    await close();
    const historyEditor = await open('\n');
    await keyboard.keys('ia<esc>ib<esc>2u');
    assert.equal(historyEditor.document.getText(), '\n', '2u undoes two committed INSERT sessions');
    await keyboard.keys('2U');
    assert.equal(historyEditor.document.getText(), 'ab\n', '2U redoes both sessions');
    await close();
  }

  for (const boundary of ['<esc>', 'q', 'i<esc>', 'gw<esc>']) {
    const editor = await open(text);
    await keyboard.keys(`2${boundary}x`);
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 4 }], `count reset by ${boundary}`);
    assert.equal(editor.document.getText(), text);
    await close();
  }
  for (const boundary of ['miniHelix.toggleMode', 'miniHelix.toggleEnabled']) {
    const editor = await open(text);
    await keyboard.keys('2');
    await vscode.commands.executeCommand(boundary);
    await vscode.commands.executeCommand(boundary);
    await keyboard.keys('x');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 4 }], `count reset by ${boundary}`);
    await close();
  }

  {
    const editor = await open(text);
    await keyboard.keys('2');
    const other = await open('other\n');
    const restored = await vscode.window.showTextDocument(editor.document);
    await pause();
    await keyboard.keys('x');
    assert.equal(vscode.window.activeTextEditor, restored);
    assert.deepEqual(offsets(restored), [{ anchor: 0, head: 4 }], 'editor switches clear pending counts');
    await vscode.window.showTextDocument(other.document);
    await close();
    await vscode.window.showTextDocument(editor.document);
    await close();
  }

  {
    const editor = await open(text);
    await vscode.commands.executeCommand('miniHelix.count', 2);
    for (const invalid of ['3', -1, 10, 1.5, null, {}, NaN]) {
      await vscode.commands.executeCommand('miniHelix.count', invalid);
    }
    await keyboard.keys('x');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 8 }], 'invalid digit arguments preserve pending count');
    await close();
  }

  // During word jumps x is label input; X and digits cancel instead of selecting/counting.
  for (const cancel of ['x', 'X', '2']) {
    const editor = await open('one two three four\nfive six seven eight\n', [{ anchor: 1, head: 1 }]);
    await keyboard.keys('2gw');
    const before = offsets(editor);
    await keyboard.keys(cancel);
    assert.deepEqual(offsets(editor), before, `word-jump input ${cancel} does not select a line`);
    await keyboard.keys('x');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 19 }], `word-jump ${cancel} clears prior counts`);
    await close();
  }

  {
    const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-line-override', {
      provideTextDocumentContent: () => 'override\nsecond\n',
    });
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-line-override:test'));
      const editor = await vscode.window.showTextDocument(document);
      select(editor, [{ anchor: 0, head: 0 }]);
      // Keybinding contexts live in the renderer, after showTextDocument resolves in the host.
      await pause();
      assert.equal(vscode.window.activeTextEditor, editor);
      await keyboard.keys('x');
      assert.deepEqual(offsets(editor), [{ anchor: 8, head: 8 }], 'user x binding overrides extension line command');
      await close();
    } finally {
      provider.dispose();
    }
  }

  // The primary may be the later range; normalization must retain its identity.
  {
    const editor = await open(text, [{ anchor: 15, head: 16 }, { anchor: 1, head: 2 }]);
    await keyboard.keys('X');
    assert.deepEqual(offsets(editor), [{ anchor: 14, head: 19 }, { anchor: 0, head: 4 }]);
    await close();
  }

  // EOF cursor preservation is the reason for the compatibility prerequisite.
  {
    const editor = await open('a\n');
    select(editor, [{ anchor: 0, head: 2 }, { anchor: 2, head: 2 }]);
    await keyboard.keys('X');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 2 }, { anchor: 2, head: 2 }]);
    const settings = vscode.workspace.getConfiguration('editor');
    try {
      await settings.update('multiCursorMergeOverlapping', true, vscode.ConfigurationTarget.Global);
      await pause();
      select(editor, [{ anchor: 0, head: 2 }, { anchor: 2, head: 2 }]);
      await pause();
      assert.equal(editor.selections.length, 1, 'default VS Code setting merges the EOF point');
      await keyboard.keys('X');
      assert.deepEqual(offsets(editor), [{ anchor: 0, head: 2 }]);
      console.log('PASS default-setting experiment: distinct Helix EOF point is merged by VS Code');
    } finally {
      await settings.update('multiCursorMergeOverlapping', false, vscode.ConfigurationTarget.Global);
      await pause();
    }
    await close();
  }

  // Only the isolated test profile changes settings; extension commands preserve them.
  {
    const before = vscode.workspace.getConfiguration('editor').inspect('multiCursorMergeOverlapping');
    const editor = await open(text);
    await keyboard.keys('xX');
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('multiCursorMergeOverlapping'), before);
    await editor.edit(builder => builder.insert(new vscode.Position(0, 0), 'added'));
    await keyboard.keys('xXu');
    assert.equal(editor.document.getText(), text, 'line commands add no native undo step');
    await close();
  }

  // Queue tests dispatch before the preceding asynchronous edit has completed.
  for (const [commands, expectedText, expectedRanges, expectedMode] of [
    [['miniHelix.deleteSelection', 'miniHelix.extendLineBelow'], 'ne\ntwo\nthree\nfour\nfive\n', [{ anchor: 0, head: 3 }], 'normal'],
    [['miniHelix.extendLineBelow', 'miniHelix.deleteSelection'], 'two\nthree\nfour\nfive\n', [{ anchor: 0, head: 0 }], 'normal'],
    [['miniHelix.extendLineBelow', 'miniHelix.changeSelection'], '\ntwo\nthree\nfour\nfive\n', [{ anchor: 0, head: 0 }], 'insert'],
    [['miniHelix.extendLineBelow', 'miniHelix.deleteSelection', 'miniHelix.undo'], text, [{ anchor: 0, head: 4 }], 'normal'],
    [['miniHelix.extendLineBelow', 'miniHelix.changeSelection', 'miniHelix.enterNormal', 'miniHelix.undo'], text, [{ anchor: 0, head: 4 }], 'normal'],
  ] as const) {
    const editor = await open(text);
    await Promise.all(commands.map(command => vscode.commands.executeCommand(command)));
    assert.equal(editor.document.getText(), expectedText, commands.join(','));
    assert.deepEqual(offsets(editor), expectedRanges, commands.join(','));
    assert.equal(api.getState().mode, expectedMode, commands.join(','));
    await vscode.commands.executeCommand('miniHelix.enterNormal');
    await close();
  }
  {
    const editor = await open(text);
    await vscode.commands.executeCommand('miniHelix.count', 2);
    const first = vscode.commands.executeCommand('miniHelix.extendLineBelow');
    await vscode.commands.executeCommand('miniHelix.count', 3);
    const second = vscode.commands.executeCommand('miniHelix.extendLineBelow');
    await Promise.all([first, second]);
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: text.length }], 'queued commands snapshot their own counts');
    await close();
  }

  const provider = vscode.workspace.registerTextDocumentContentProvider('mini-helix-line-readonly', {
    provideTextDocumentContent: () => text,
  });
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse('mini-helix-line-readonly:test'));
    let editor = await vscode.window.showTextDocument(document);
    select(editor, [{ anchor: 1, head: 1 }]);
    await pause();
    await keyboard.keys('2x');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 8 }], 'counts and x work in read-only documents');
    select(editor, [{ anchor: 0, head: 0 }]);
    await keyboard.keys('2qx');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 4 }], 'ignored read-only input clears a count');
    select(editor, [{ anchor: 0, head: 0 }]);
    await keyboard.keys('2ix');
    assert.equal(api.getState().mode, 'normal', 'read-only i never enters INSERT');
    assert.deepEqual(offsets(editor), [{ anchor: 0, head: 4 }], 'ignored read-only i clears a count');
    for (const ignored of [
      ['Backspace', 'Backspace', 8], ['Delete', 'Delete', 46], ['Enter', 'Enter', 13, '\r'],
    ] as Parameters<Keyboard['press']>[]) {
      select(editor, [{ anchor: 0, head: 0 }]);
      await keyboard.keys('2');
      await keyboard.press(...ignored);
      await keyboard.keys('x');
      assert.deepEqual(offsets(editor), [{ anchor: 0, head: 4 }], `ignored read-only ${ignored[0]} clears count`);
    }
    select(editor, [{ anchor: 0, head: 0 }]);
    const focusBeforeTab = await keyboard.evaluate<string>(`document.activeElement?.tagName + ':' + document.activeElement?.className`);
    await keyboard.press('Tab', 'Tab', 9);
    assert.notEqual(await keyboard.evaluate<string>(`document.activeElement?.tagName + ':' + document.activeElement?.className`), focusBeforeTab,
      'read-only Tab retains native focus navigation');
    editor = await vscode.window.showTextDocument(document);
    await pause();
    select(editor, [{ anchor: 3, head: 1 }]);
    await keyboard.keys('X');
    assert.deepEqual(offsets(editor), [{ anchor: 4, head: 0 }], 'X preserves reversed read-only selections');
    assert.equal(document.getText(), text);
    assert.equal(document.isDirty, false);
    await close();
  } finally {
    provider.dispose();
  }

  // Native typing contexts include all newly bound character classes.
  {
    const editor = await open(text);
    await keyboard.keys('ixX2<esc>');
    assert.equal(editor.document.getText(), `xX2${text}`);
    await vscode.commands.executeCommand('miniHelix.toggleEnabled');
    await keyboard.keys('xX2');
    assert.equal(editor.document.getText(), `xX2xX2${text}`);
    await vscode.commands.executeCommand('miniHelix.toggleEnabled');
    await close();
    const input = vscode.window.createInputBox();
    try {
      input.show();
      await pause();
      await keyboard.keys('xX2');
      assert.equal(input.value, 'xX2');
    } finally {
      input.hide();
      input.dispose();
    }
  }

  {
    const editor = await open(text);
    for (const mode of ['insert', 'disabled']) {
      const before = offsets(editor);
      await vscode.commands.executeCommand(mode === 'insert' ? 'miniHelix.enterInsert' : 'miniHelix.toggleEnabled');
      for (const command of lineCommands) { await vscode.commands.executeCommand(command); }
      assert.equal(editor.document.getText(), text);
      assert.deepEqual(offsets(editor), before, `direct line commands ignore ${mode}`);
      await vscode.commands.executeCommand(mode === 'insert' ? 'miniHelix.enterNormal' : 'miniHelix.toggleEnabled');
    }
    await close();
    const next = await open(text);
    await keyboard.keys('x');
    assert.deepEqual(offsets(next), [{ anchor: 0, head: 4 }], 'ineligible direct commands leave no stale count');
    await close();
  }

  // Expected selections are generated by the pinned Rust application, never by this port.
  const corpus = JSON.parse(readFileSync(path.resolve(__dirname, '../../../test/fixtures/line-selection-oracle.json'), 'utf8')) as {
    revision: string; cases: OracleCase[];
  };
  assert.equal(corpus.revision, 'ba40e547426b0f9896c8bdc699a4ab11f2b37dbc');
  const representativeIds = new Set([
    'empty/x', 'single/X', 'lf/x', 'lf/x2x', 'lf/2Xx', 'no-final-eol/X',
    'blank/x', 'consecutive-blank/xx', 'indent/x', 'crlf/xx', 'crlf-no-final/Xx',
    'astral/X', 'combining/x', 'emoji/x', 'reversed/primary-0/X',
    'whole-line/primary-0/x', 'next-line-start-reversed/primary-0/X',
    'eof-point/primary-0/X', 'eof-pair/primary-1/X', 'unsorted/primary-2/X',
    'touching/primary-1/x',
  ]);
  let replayed = 0;
  for (const fixture of corpus.cases) {
    if (!representativeIds.has(fixture.id) && !fixture.id.startsWith('follow-on/')) { continue; }
    representativeIds.delete(fixture.id);
    const editor = await open(fixture.input.text, primaryFirst(fixture.input));
    for (const step of fixture.steps) {
      await keyboard.keys(step.keys);
      assert.equal(editor.document.getText(), step.text, `${fixture.id}: ${step.keys} text`);
      // Existing edit/INSERT adapters use empty carets for Helix blocks (core/editing.ts).
      // x/X outputs always compare raw ranges, so line semantics cannot be hidden by this mapping.
      const actual = /[xX]$/.test(step.keys) ? offsets(editor) : offsets(editor).map(range =>
        blockRange(new WordMotionText(editor.document.getText()), range));
      assert.deepEqual(actual, primaryFirst(step), `${fixture.id}: ${step.keys} directed ranges and primary`);
    }
    assert.equal(api.getState().mode, 'normal', fixture.id);
    replayed++;
    await close();
  }
  assert.deepEqual([...representativeIds], [], 'representative Rust oracle cases missing');
  assert.equal(replayed, 28, 'every selected oracle case and all follow-on cases must execute');
  console.log(`PASS x/X, counts, lifecycle, queue, read-only, compatibility, and ${replayed} independent Helix keyboard cases`);
}
