import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';

interface Binding {
  key: string;
  command: string;
  when: string;
  args?: string;
}

const root = path.resolve(__dirname, '../../..');
const { createKeybindings } = require(path.join(root, 'scripts/keybindings.cjs')) as {
  createKeybindings(): Binding[];
};
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const bindings: Binding[] = manifest.contributes.keybindings;

test('manifest contains the generated bindings', () => {
  assert.deepEqual(bindings, createKeybindings());
});

test('i, a, c, d, u, U, Escape, g w, and word motions are the default bindings outside a word jump', () => {
  const motionWhen =
    'editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive';
  const editWhen = 'editorTextFocus && !editorReadonly && miniHelix.enabled && miniHelix.mode == normal';
  assert.deepEqual(bindings.filter(binding =>
    binding.command !== 'miniHelix.noop' && !binding.when.endsWith('&& miniHelix.wordJumpActive')
  ), [
    { key: 'i', command: 'miniHelix.enterInsert', when: editWhen },
    { key: 'a', command: 'miniHelix.append', when: editWhen },
    { key: 'c', command: 'miniHelix.changeSelection', when: editWhen },
    { key: 'd', command: 'miniHelix.deleteSelection', when: editWhen },
    { key: 'u', command: 'miniHelix.undo', when: editWhen },
    { key: 'shift+u', command: 'miniHelix.redo', when: editWhen },
    {
      key: 'escape', command: 'miniHelix.enterNormal',
      when: 'editorTextFocus && miniHelix.enabled && miniHelix.mode == insert',
    },
    { key: 'g w', command: 'miniHelix.gotoWord', when: motionWhen },
    { key: 'w', command: 'miniHelix.moveNextWordStart', when: motionWhen },
    { key: 'b', command: 'miniHelix.movePrevWordStart', when: motionWhen },
    { key: 'e', command: 'miniHelix.moveNextWordEnd', when: motionWhen },
    { key: 'shift+w', command: 'miniHelix.moveNextLongWordStart', when: motionWhen },
    { key: 'shift+b', command: 'miniHelix.movePrevLongWordStart', when: motionWhen },
    { key: 'shift+e', command: 'miniHelix.moveNextLongWordEnd', when: motionWhen },
  ]);
});

test('every bound motion and edit command is contributed and registered', () => {
  const contributed = new Set(manifest.contributes.commands.map((command: { command: string }) => command.command));
  for (const [file, pattern] of [
    ['src/motions/word.ts', /^miniHelix\.move/],
    ['src/vscode/editing.ts', /^miniHelix\.(append|changeSelection|deleteSelection)$/],
    ['src/vscode/history.ts', /^miniHelix\.(undo|redo)$/],
  ] as const) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const bound = bindings.filter(binding => pattern.test(binding.command));
    assert.ok(bound.length >= 2, file);
    for (const binding of bound) {
      assert.ok(contributed.has(binding.command), binding.command);
      assert.ok(source.includes(`'${binding.command}'`), binding.command);
    }
  }
});

test('word motion keys override their blockers but yield to label input', () => {
  for (const key of ['w', 'b', 'e']) {
    assert.deepEqual(bindings.filter(binding => binding.key === key).map(binding => binding.command), [
      'miniHelix.noop', bindings.find(binding => binding.key === key && binding.command.startsWith('miniHelix.move'))!.command,
      'miniHelix.wordJumpInput',
    ]);
  }
});

test('blockers are unique, editable-editor-only, and NORMAL-only', () => {
  const blockers = bindings.filter(binding => binding.command === 'miniHelix.noop');
  assert.equal(new Set(blockers.map(binding => binding.key)).size, blockers.length);
  for (const binding of blockers) {
    assert.match(binding.when, /editorTextFocus/);
    assert.match(binding.when, /!editorReadonly/);
    assert.match(binding.when, /miniHelix.enabled/);
    assert.match(binding.when, /miniHelix.mode == normal/);
  }
});

test('ordinary printable keys and direct editing keys are blocked', () => {
  const keys = new Set(bindings
    .filter(binding => binding.command === 'miniHelix.noop')
    .map(binding => binding.key));
  for (const key of [
    ...'abcdefghijklmnopqrstuvwxyz0123456789',
    '`', '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', 'space',
    ...Array.from({ length: 10 }, (_, digit) => `numpad${digit}`),
    'numpad_add', 'numpad_subtract', 'numpad_multiply', 'numpad_divide',
    'numpad_decimal', 'numpad_separator',
  ]) {
    assert.ok(keys.has(key), key);
    assert.ok(keys.has(`shift+${key}`), `shift+${key}`);
  }
  for (const key of ['enter', 'tab', 'backspace', 'delete']) {
    assert.ok(keys.has(key));
    assert.ok(keys.has(`shift+${key}`));
  }
});

test('modified shortcuts remain native; navigation is captured only during a jump', () => {
  for (const binding of bindings) {
    assert.doesNotMatch(binding.key, /ctrl\+|cmd\+|alt\+/);
    if (/left|right|up|down|home|end|insert/.test(binding.key)) {
      assert.ok(binding.when.endsWith('&& miniHelix.wordJumpActive'));
    }
  }
});

test('i, a, c, d, and u override their blockers and label input overrides them during a jump', () => {
  for (const [key, command] of [
    ['i', 'miniHelix.enterInsert'], ['a', 'miniHelix.append'],
    ['c', 'miniHelix.changeSelection'], ['d', 'miniHelix.deleteSelection'],
    ['u', 'miniHelix.undo'],
  ]) {
    const matching = bindings.filter(binding => binding.key === key);
    assert.deepEqual(matching.map(binding => binding.command), [
      'miniHelix.noop', command, 'miniHelix.wordJumpInput',
    ]);
    // Edits are blocked in read-only editors, like their blockers.
    assert.match(matching[1].when, /!editorReadonly/);
  }
});

test('U overrides its blocker, needs a writable editor, and cancels a jump', () => {
  const matching = bindings.filter(binding => binding.key === 'shift+u');
  assert.deepEqual(matching.map(binding => binding.command), [
    'miniHelix.noop', 'miniHelix.redo', 'miniHelix.cancelWordJump',
  ]);
  assert.match(matching[1].when, /!editorReadonly/);
});

test('every label character is captured with its argument, only during a jump', () => {
  const input = bindings.filter(binding => binding.command === 'miniHelix.wordJumpInput');
  assert.equal(input.length, 26);
  for (const binding of input) {
    assert.equal(binding.args, binding.key);
    assert.match(binding.key, /^[a-z]$/);
    assert.ok(binding.when.endsWith('&& miniHelix.wordJumpActive'));
  }
  for (const key of ['escape', 'enter', 'space', 'shift+a', 'backspace', 'left']) {
    const binding = bindings.filter(binding => binding.key === key).at(-1)!;
    assert.equal(binding.command, 'miniHelix.cancelWordJump');
    assert.ok(binding.when.endsWith('&& miniHelix.wordJumpActive'));
  }
});
