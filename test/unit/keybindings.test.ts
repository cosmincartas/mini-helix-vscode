import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';

interface Binding {
  key: string;
  command: string;
  when: string;
  args?: string | number;
}

const root = path.resolve(__dirname, '../../..');
const { createKeybindings, delimiterKeys, textObjectKeys } = require(path.join(root, 'scripts/keybindings.cjs')) as {
  createKeybindings(): Binding[];
  delimiterKeys: [string, string][];
  textObjectKeys: [string, string][];
};
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const bindings: Binding[] = manifest.contributes.keybindings;
const motionWhen = 'editorTextFocus && miniHelix.enabled && miniHelix.mode == normal';
const idleWhen = `${motionWhen} && !miniHelix.wordJumpActive && !miniHelix.surroundReplacePending`;
const pendingWhen = `${motionWhen} && miniHelix.surroundReplacePending`;
const navigation = [
  ['g d', 'miniHelix.gotoDefinition'], ['g r', 'miniHelix.gotoReferences'],
  ['alt+o', 'miniHelix.expandSelection'], ['alt+i', 'miniHelix.shrinkSelection'],
  ['ctrl+o', 'miniHelix.jumpBack'], ['ctrl+i', 'miniHelix.jumpForward'],
];

test('navigation works in read-only NORMAL editors, yields to labels, and has no chord blockers', () => {
  for (const [key, command] of navigation) {
    assert.deepEqual(bindings.filter(binding => binding.key === key), [{
      key, command,
      when: idleWhen,
    }]);
  }
});

test('manifest contains the generated bindings', () => {
  assert.deepEqual(bindings, createKeybindings());
});

test('i, a, c, d, o, O, u, U, Escape, g w, motions, and counts are the default bindings outside a word jump', () => {
  const motionWhen = idleWhen;
  const hjklWhen = `${motionWhen} && config.miniHelix.hjklMotions`;
  const editWhen = 'editorTextFocus && !editorReadonly && miniHelix.enabled && miniHelix.mode == normal';
  assert.deepEqual(bindings.filter(binding =>
    binding.command !== 'miniHelix.noop' && !binding.when.endsWith('&& miniHelix.wordJumpActive') &&
    binding.when !== pendingWhen && !/^m ([iard] |s$)/.test(binding.key)
  ), [
    { key: 'i', command: 'miniHelix.enterInsert', when: editWhen },
    { key: 'a', command: 'miniHelix.append', when: editWhen },
    { key: 'c', command: 'miniHelix.changeSelection', when: editWhen },
    { key: 'd', command: 'miniHelix.deleteSelection', when: editWhen },
    { key: 'o', command: 'miniHelix.openBelow', when: editWhen },
    { key: 'shift+o', command: 'miniHelix.openAbove', when: editWhen },
    { key: 'u', command: 'miniHelix.undo', when: editWhen },
    { key: 'shift+u', command: 'miniHelix.redo', when: editWhen },
    {
      key: 'escape', command: 'miniHelix.enterNormal',
      when: 'editorTextFocus && miniHelix.enabled && miniHelix.mode == insert',
    },
    { key: 'g w', command: 'miniHelix.gotoWord', when: motionWhen },
    ...navigation.map(([key, command]) => ({ key, command, when: motionWhen })),
    { key: 'w', command: 'miniHelix.moveNextWordStart', when: motionWhen },
    { key: 'b', command: 'miniHelix.movePrevWordStart', when: motionWhen },
    { key: 'e', command: 'miniHelix.moveNextWordEnd', when: motionWhen },
    { key: 'shift+w', command: 'miniHelix.moveNextLongWordStart', when: motionWhen },
    { key: 'shift+b', command: 'miniHelix.movePrevLongWordStart', when: motionWhen },
    { key: 'shift+e', command: 'miniHelix.moveNextLongWordEnd', when: motionWhen },
    { key: 'x', command: 'miniHelix.extendLineBelow', when: motionWhen },
    { key: 'shift+x', command: 'miniHelix.extendToLineBounds', when: motionWhen },
    { key: 'h', command: 'miniHelix.moveCharLeft', when: hjklWhen },
    { key: 'j', command: 'miniHelix.moveVisualLineDown', when: hjklWhen },
    { key: 'k', command: 'miniHelix.moveVisualLineUp', when: hjklWhen },
    { key: 'l', command: 'miniHelix.moveCharRight', when: hjklWhen },
    ...Array.from({ length: 10 }, (_, digit) => [
      { key: String(digit), command: 'miniHelix.count', args: digit, when: motionWhen },
      { key: `numpad${digit}`, command: 'miniHelix.count', args: digit, when: motionWhen },
    ]).flat(),
    { key: 'escape', command: 'miniHelix.clearCount', when: `${motionWhen} && miniHelix.countPending` },
    // With a count pending, arrows are counted h/j/k/l and other navigation keys clear it.
    ...[['left', 'miniHelix.moveCharLeft'], ['down', 'miniHelix.moveVisualLineDown'],
      ['up', 'miniHelix.moveVisualLineUp'], ['right', 'miniHelix.moveCharRight']].map(([key, command]) =>
      ({ key, command, when: `${motionWhen} && miniHelix.countPending` })),
    ...[['home', 'cursorHome'], ['end', 'cursorEnd'], ['pageup', 'cursorPageUp'], ['pagedown', 'cursorPageDown']]
      .map(([key, args]) => ({
        key, command: 'miniHelix.clearCount', args, when: `${motionWhen} && miniHelix.countPending`,
      })),
  ]);
});

test('every bound motion and edit command is contributed and registered', () => {
  const contributed = new Set(manifest.contributes.commands.map((command: { command: string }) => command.command));
  for (const [file, pattern] of [
    ['src/motions/word.ts', /^miniHelix\.move(Next|Prev)/],
    ['src/motions/line.ts', /^miniHelix\.(extendLineBelow|extendToLineBounds)$/],
    ['src/motions/hjkl.ts', /^miniHelix\.move(Char|VisualLine)/],
    ['src/vscode/editing.ts', /^miniHelix\.(append|changeSelection|deleteSelection|openBelow|openAbove)$/],
    ['src/vscode/history.ts', /^miniHelix\.(undo|redo)$/],
    ['src/vscode/navigation.ts', /^miniHelix\.(gotoDefinition|gotoReferences|expandSelection|shrinkSelection|jumpBack|jumpForward)$/],
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

test('motion keys override their blockers but yield to label input', () => {
  for (const key of ['w', 'b', 'e', 'h', 'j', 'k', 'l']) {
    assert.deepEqual(bindings.filter(binding => binding.key === key).map(binding => binding.command), [
      'miniHelix.noop', bindings.find(binding => binding.key === key && binding.command.startsWith('miniHelix.move'))!.command,
      'miniHelix.wordJumpInput', 'miniHelix.surroundReplaceInput',
    ]);
  }
});

test('blockers are unique and NORMAL-only, and editable-editor-only unless a count is pending', () => {
  const blockers = bindings.filter(binding => binding.command === 'miniHelix.noop');
  assert.equal(new Set(blockers.map(binding => binding.key)).size, blockers.length);
  for (const binding of blockers) {
    assert.match(binding.when, /editorTextFocus/);
    assert.match(binding.when, /miniHelix.enabled/);
    assert.match(binding.when, /miniHelix.mode == normal/);
    if (/^[gm] /.test(binding.key)) {
      // g and m chords are motion keys, like g w, so they work in read-only editors.
      assert.match(binding.when, /!miniHelix.wordJumpActive/);
    } else {
      assert.match(binding.when, /\(!editorReadonly \|\| miniHelix.countPending\)/);
    }
  }
});

test('every other g chord is an unbound key that clears the count', () => {
  const chords = bindings.filter(binding => binding.key.startsWith('g '));
  const single = bindings.filter(binding => binding.command === 'miniHelix.noop' && !binding.key.includes(' '));
  assert.deepEqual(chords.map(binding => binding.key).sort(),
    [...single.map(binding => binding.key), 'escape', 'left', 'right', 'up', 'down', 'home', 'end',
      'pageup', 'pagedown'].map(key => `g ${key}`).sort());
  assert.deepEqual(new Set(chords.map(binding => binding.command)),
    new Set(['miniHelix.noop', 'miniHelix.gotoWord', 'miniHelix.gotoDefinition', 'miniHelix.gotoReferences']));
});

test('digits are counts in NORMAL and label-free; Escape clears a pending count', () => {
  for (const key of ['1', '0', 'numpad7']) {
    const matching = bindings.filter(binding => binding.key === key);
    assert.deepEqual(matching.map(binding => binding.command), [
      'miniHelix.noop', 'miniHelix.count', 'miniHelix.cancelWordJump', 'miniHelix.surroundReplaceInput',
    ]);
    assert.equal(matching[1].args, Number(key.at(-1)));
  }
  const escape = bindings.filter(binding => binding.key === 'escape');
  assert.deepEqual(escape.map(binding => binding.command), [
    'miniHelix.enterNormal', 'miniHelix.clearCount', 'miniHelix.cancelWordJump', 'miniHelix.cancelSurroundReplace',
  ]);
  assert.match(escape[1].when, /miniHelix.countPending/);
  assert.match(escape[1].when, /miniHelix.mode == normal/);
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

test('only requested modified shortcuts are bound; arrow keys are captured only during a jump', () => {
  for (const binding of bindings) {
    if (/ctrl\+|cmd\+|alt\+/.test(binding.key)) {
      assert.ok(['alt+o', 'alt+i', 'ctrl+o', 'ctrl+i'].includes(binding.key));
      assert.equal(binding.when, idleWhen);
    }
    if (/left|right|up|down|home|end|insert/.test(binding.key)) {
      // Also while a count is pending, so that the key uses or clears it.
      assert.ok(binding.when.endsWith('&& miniHelix.wordJumpActive') ||
        binding.when.endsWith('&& miniHelix.countPending') || binding.when === pendingWhen ||
        /^[gm] /.test(binding.key), binding.key);
    }
  }
});

test('i, a, c, d, o, and u override their blockers and label input overrides them during a jump', () => {
  for (const [key, command] of [
    ['i', 'miniHelix.enterInsert'], ['a', 'miniHelix.append'],
    ['c', 'miniHelix.changeSelection'], ['d', 'miniHelix.deleteSelection'],
    ['o', 'miniHelix.openBelow'], ['u', 'miniHelix.undo'],
  ]) {
    const matching = bindings.filter(binding => binding.key === key && binding.command !== 'miniHelix.clearCount');
    assert.deepEqual(matching.map(binding => binding.command), [
      'miniHelix.noop', command, 'miniHelix.wordJumpInput', 'miniHelix.surroundReplaceInput',
    ]);
    // Edits are blocked in read-only editors, like their blockers.
    assert.match(matching[1].when, /!editorReadonly/);
  }
});

test('O overrides its blocker, needs a writable editor, and cancels a jump', () => {
  const matching = bindings.filter(binding => binding.key === 'shift+o' && binding.command !== 'miniHelix.clearCount');
  assert.deepEqual(matching.map(binding => binding.command), [
    'miniHelix.noop', 'miniHelix.openAbove', 'miniHelix.cancelWordJump', 'miniHelix.surroundReplaceInput',
  ]);
  assert.match(matching[1].when, /!editorReadonly/);
});

test('U overrides its blocker, needs a writable editor, and cancels a jump', () => {
  const matching = bindings.filter(binding => binding.key === 'shift+u' && binding.command !== 'miniHelix.clearCount');
  assert.deepEqual(matching.map(binding => binding.command), [
    'miniHelix.noop', 'miniHelix.redo', 'miniHelix.cancelWordJump', 'miniHelix.surroundReplaceInput',
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
    const binding = bindings.filter(binding =>
      binding.key === key && binding.when.endsWith('&& miniHelix.wordJumpActive')).at(-1)!;
    assert.equal(binding.command, 'miniHelix.cancelWordJump');
    assert.ok(binding.when.endsWith('&& miniHelix.wordJumpActive'));
  }
});

const pendingKeys = bindings.filter(binding => binding.when === pendingWhen);

test('m is a chord prefix: m i, m a select text objects and m r starts a replacement', () => {
  assert.equal(textObjectKeys.length, 12);
  assert.equal(delimiterKeys.length, 11);
  const typed = Object.fromEntries(delimiterKeys);
  assert.deepEqual(typed, {
    "'": "'", "shift+'": '"', 'shift+9': '(', 'shift+0': ')', '[': '[', ']': ']',
    'shift+[': '{', 'shift+]': '}', 'shift+,': '<', 'shift+.': '>', '`': '`',
  });
  for (const [prefix, kind] of [['i', 'inside'], ['a', 'around']]) {
    for (const [key, target] of [['w', 'w'], ...delimiterKeys]) {
      assert.deepEqual(bindings.filter(binding => binding.key === `m ${prefix} ${key}`), [{
        key: `m ${prefix} ${key}`, command: 'miniHelix.selectTextObject', args: { kind, target }, when: idleWhen,
      }]);
    }
  }
  const writable = `editorTextFocus && !editorReadonly && miniHelix.enabled && miniHelix.mode == normal && ` +
    '!miniHelix.wordJumpActive && !miniHelix.surroundReplacePending';
  for (const [key, target] of delimiterKeys) {
    assert.deepEqual(bindings.filter(binding => binding.key === `m r ${key}`), [
      { key: `m r ${key}`, command: 'miniHelix.noop', when: `${idleWhen} && editorReadonly` },
      { key: `m r ${key}`, command: 'miniHelix.surroundReplace', args: { target }, when: writable },
    ]);
  }
  // The word jump and a pending replacement both take over from the text object commands.
  assert.ok(bindings.filter(binding => /^m ([iard] |s$)/.test(binding.key) && binding.command !== 'miniHelix.noop')
    .every(binding => binding.when.includes('!miniHelix.wordJumpActive') &&
      binding.when.includes('!miniHelix.surroundReplacePending')));
});

test('m s starts a surround add, and m d <delimiter> deletes a surround; both need a writable editor', () => {
  const writable = `editorTextFocus && !editorReadonly && miniHelix.enabled && miniHelix.mode == normal && ` +
    '!miniHelix.wordJumpActive && !miniHelix.surroundReplacePending';
  assert.deepEqual(bindings.filter(binding => binding.key === 'm s'), [
    { key: 'm s', command: 'miniHelix.noop', when: `${idleWhen} && editorReadonly` },
    { key: 'm s', command: 'miniHelix.surroundAdd', when: writable },
  ]);
  const add = bindings.find(binding => binding.key === 'm s' && binding.command === 'miniHelix.surroundAdd')!;
  assert.match(add.when, /!miniHelix\.wordJumpActive/);
  assert.match(add.when, /!miniHelix\.surroundReplacePending/);
  for (const [key, target] of delimiterKeys) {
    assert.deepEqual(bindings.filter(binding => binding.key === `m d ${key}`), [
      { key: `m d ${key}`, command: 'miniHelix.noop', when: `${idleWhen} && editorReadonly` },
      { key: `m d ${key}`, command: 'miniHelix.surroundDelete', args: { target }, when: writable },
    ]);
  }
});

test('every other key after m, m i, m a, m r, and m d is an unbound key that clears the count', () => {
  const keys = (prefix: string) => bindings
    .filter(binding => binding.command === 'miniHelix.noop' && binding.key.startsWith(`${prefix} `) &&
      binding.key.split(' ').length === prefix.split(' ').length + 1 && binding.when === idleWhen)
    .map(binding => binding.key.slice(prefix.length + 1));
  const single = bindings.filter(binding => binding.command === 'miniHelix.noop' && !binding.key.includes(' '))
    .map(binding => binding.key);
  const all = [...single, 'escape', 'left', 'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown'];
  const except = (excluded: string[]) => all.filter(key => !excluded.includes(key)).sort();
  assert.deepEqual(keys('m').sort(), except(['i', 'a', 'r', 's', 'd']));
  assert.deepEqual(keys('m i').sort(), except(textObjectKeys.map(([key]) => key)));
  assert.deepEqual(keys('m a').sort(), except(textObjectKeys.map(([key]) => key)));
  assert.deepEqual(keys('m r').sort(), except(delimiterKeys.map(([key]) => key)));
  assert.deepEqual(keys('m d').sort(), except(delimiterKeys.map(([key]) => key)));
  for (const key of ['escape', 'x', 'space', 'enter', 'left', 'shift+7']) {
    for (const prefix of ['m', 'm i', 'm a', 'm r', 'm d']) {
      assert.ok(keys(prefix).includes(key), `${prefix} ${key}`);
    }
  }
  assert.equal(keys('m').includes('w'), true);
});

test('a pending replacement captures every printable key as its character, and cancels on the rest', () => {
  const expected = new Map<string, string>();
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    expected.set(letter, letter);
    expected.set(`shift+${letter}`, letter.toUpperCase());
  }
  for (let digit = 0; digit <= 9; digit++) {
    expected.set(String(digit), String(digit));
    expected.set(`numpad${digit}`, String(digit));
    expected.set(`shift+${digit}`, ')!@#$%^&*('[digit]);
  }
  for (const [key, plain, shifted] of [
    ['`', '`', '~'], ['-', '-', '_'], ['=', '=', '+'], ['[', '[', '{'], [']', ']', '}'],
    ['\\', '\\', '|'], [';', ';', ':'], ["'", "'", '"'], [',', ',', '<'], ['.', '.', '>'], ['/', '/', '?'],
  ]) {
    expected.set(key, plain);
    expected.set(`shift+${key}`, shifted);
  }
  // Enter and Space are characters: `ms` wraps with them, and `mr` rejects them without an edit.
  for (const [key, character] of [['enter', '\n'], ['shift+enter', '\n'], ['space', ' '], ['shift+space', ' '],
    ['numpad_add', '+'], ['numpad_subtract', '-'], ['numpad_multiply', '*'],
    ['numpad_divide', '/'], ['numpad_decimal', '.'], ['numpad_separator', ',']]) {
    expected.set(key, character);
  }
  const input = pendingKeys.filter(binding => binding.command === 'miniHelix.surroundReplaceInput');
  for (const binding of input) {
    assert.equal(binding.args, expected.get(binding.key), binding.key);
  }
  for (const key of expected.keys()) {
    assert.ok(input.some(binding => binding.key === key), key);
  }
  assert.equal(new Set(pendingKeys.map(binding => binding.key)).size, pendingKeys.length);
  const cancelled = pendingKeys.filter(binding => binding.command === 'miniHelix.cancelSurroundReplace')
    .map(binding => binding.key);
  for (const key of ['escape', 'tab', 'shift+tab', 'backspace', 'shift+backspace', 'delete', 'shift+delete', 'left',
    'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown', 'insert']) {
    assert.ok(cancelled.includes(key), key);
  }
  for (const key of ['enter', 'shift+enter', 'space', 'shift+space']) {
    assert.ok(!cancelled.includes(key), key);
  }
  assert.deepEqual(pendingKeys.filter(binding =>
    !['miniHelix.surroundReplaceInput', 'miniHelix.cancelSurroundReplace'].includes(binding.command)), []);
});

test('pending input comes last so that it beats every other binding, and nothing else starts meanwhile', () => {
  const firstPending = bindings.findIndex(binding => binding.when === pendingWhen);
  assert.ok(firstPending > 0);
  assert.ok(bindings.slice(firstPending).every(binding => binding.when === pendingWhen));
  // Every other extension binding either cannot match while pending or sits before the pending keys.
  for (const binding of bindings.slice(0, firstPending)) {
    if (/^(editorTextFocus && )(miniHelix\.enabled && miniHelix\.mode == insert)/.test(binding.when)) { continue; }
    if (binding.command === 'miniHelix.noop' && !binding.key.includes(' ')) { continue; }
    if (['i', 'a', 'c', 'd', 'o', 'shift+o', 'u', 'shift+u'].includes(binding.key)) { continue; }
    if (binding.when.endsWith('&& miniHelix.wordJumpActive')) { continue; }
    assert.match(binding.when, /!miniHelix\.surroundReplacePending/, `${binding.key} ${binding.command}`);
  }
});

test('the new commands are contributed and registered', () => {
  const contributed = new Set(manifest.contributes.commands.map((command: { command: string }) => command.command));
  const source = readFileSync(path.join(root, 'src/vscode/match.ts'), 'utf8');
  for (const id of ['selectTextObject', 'surroundReplace', 'surroundReplaceInput', 'cancelSurroundReplace',
    'surroundAdd', 'surroundDelete']) {
    assert.ok(contributed.has(`miniHelix.${id}`), id);
    assert.ok(source.includes(`'miniHelix.${id}'`), id);
    assert.ok(bindings.some(binding => binding.command === `miniHelix.${id}`), id);
  }
});


test('line commands and digit prefixes work read-only and yield to jump capture', () => {
  for (const [key, command] of [
    ['x', 'miniHelix.extendLineBelow'], ['shift+x', 'miniHelix.extendToLineBounds'],
    ...Array.from({ length: 10 }, (_, digit) => [String(digit), `numpad${digit}`]).flat()
      .map(key => [key, 'miniHelix.count']),
  ]) {
    const matching = bindings.filter(binding => binding.key === key && binding.command !== 'miniHelix.clearCount' && binding.when !== pendingWhen);
    assert.equal(matching[0].command, 'miniHelix.noop');
    assert.equal(matching[1].command, command);
    assert.doesNotMatch(matching[1].when, /editorReadonly/);
    assert.match(matching[1].when, /!miniHelix.wordJumpActive/);
    assert.equal(matching.at(-1)!.command, key === 'x' ? 'miniHelix.wordJumpInput' : 'miniHelix.cancelWordJump');
  }
  assert.ok(!manifest.contributes.commands.some((command: {command:string}) => command.command === 'miniHelix.count'));
  for (const binding of bindings.filter(binding => binding.command === 'miniHelix.count')) {
    assert.equal(binding.args, Number(binding.key.replace('numpad', '')));
  }
});


test('ignored read-only input clears a pending count and otherwise retains native input', () => {
  const blockers = bindings.filter(binding => binding.command === 'miniHelix.noop' && !binding.key.startsWith('g '));
  for (const key of ['q', 'i', 'shift+q', ';', 'space', 'backspace', 'delete', 'enter', 'tab']) {
    const blocker = blockers.find(binding => binding.key === key);
    assert.ok(blocker, key);
    assert.match(blocker.when, /\(!editorReadonly \|\| miniHelix.countPending\)/);
  }
});
