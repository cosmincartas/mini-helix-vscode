// Block ordinary NORMAL-mode typing without globally overriding VS Code's `type`
// command. User keybindings have higher priority than these extension defaults.
const fs = require('node:fs');
const path = require('node:path');

const normalWhen =
  'editorTextFocus && !editorReadonly && miniHelix.enabled && miniHelix.mode == normal';
const insertWhen =
  'editorTextFocus && miniHelix.enabled && miniHelix.mode == insert';
// Navigation works in read-only editors too; only editing blockers require writable text.
const motionWhen = 'editorTextFocus && miniHelix.enabled && miniHelix.mode == normal';
const jumpWhen = `${motionWhen} && miniHelix.wordJumpActive`;
const idleMotionWhen = `${motionWhen} && !miniHelix.wordJumpActive`;

// Helix word motions; each replaces the selection with the text moved over.
const motions = [
  ['w', 'miniHelix.moveNextWordStart'],
  ['b', 'miniHelix.movePrevWordStart'],
  ['e', 'miniHelix.moveNextWordEnd'],
  ['shift+w', 'miniHelix.moveNextLongWordStart'],
  ['shift+b', 'miniHelix.movePrevLongWordStart'],
  ['shift+e', 'miniHelix.moveNextLongWordEnd'],
];

// Helix selection edits; like `i`, they need a writable editor.
const edits = [
  ['a', 'miniHelix.append'],
  ['c', 'miniHelix.changeSelection'],
  ['d', 'miniHelix.deleteSelection'],
];

// Helix history: whole revisions on VS Code's undo stack.
const history = [
  ['u', 'miniHelix.undo'],
  ['shift+u', 'miniHelix.redo'],
];

function createKeybindings() {
  const printable = [
    ...'abcdefghijklmnopqrstuvwxyz0123456789',
    '`', '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', 'space',
  ];
  const numpad = [
    ...Array.from({ length: 10 }, (_, digit) => `numpad${digit}`),
    'numpad_add', 'numpad_subtract', 'numpad_multiply', 'numpad_divide',
    'numpad_decimal', 'numpad_separator',
  ];
  const blocked = [...printable, ...numpad].flatMap(key => [key, `shift+${key}`]);
  blocked.push('enter', 'shift+enter', 'tab', 'shift+tab',
    'backspace', 'shift+backspace', 'delete', 'shift+delete');

  return [
    ...blocked.map(key => ({
      key,
      command: 'miniHelix.noop',
      when: normalWhen,
    })),
    // These must follow the blockers: the last matching extension binding wins.
    { key: 'i', command: 'miniHelix.enterInsert', when: normalWhen },
    ...[...edits, ...history].map(([key, command]) => ({ key, command, when: normalWhen })),
    { key: 'escape', command: 'miniHelix.enterNormal', when: insertWhen },
    { key: 'g w', command: 'miniHelix.gotoWord', when: idleMotionWhen },
    ...motions.map(([key, command]) => ({ key, command, when: idleMotionWhen })),
    // While labels are visible, i/g/etc. are label input, not mode/chord keys.
    ...[...blocked, 'escape', 'left', 'right', 'up', 'down', 'home', 'end',
      'pageup', 'pagedown', 'insert'].map(key => /^[a-z]$/.test(key) ? {
        key, command: 'miniHelix.wordJumpInput', args: key, when: jumpWhen,
      } : {
        key, command: 'miniHelix.cancelWordJump', when: jumpWhen,
      }),
  ];
}

module.exports = { createKeybindings, motions, edits, history, normalWhen, insertWhen, jumpWhen };

if (require.main === module) {
  const manifestPath = path.join(__dirname, '..', 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const keybindings = createKeybindings();
  if (process.argv.includes('--check')) {
    if (JSON.stringify(manifest.contributes.keybindings) !== JSON.stringify(keybindings)) {
      console.error('Generated keybindings are stale. Run npm run generate:keybindings.');
      process.exitCode = 1;
    }
  } else {
    manifest.contributes.keybindings = keybindings;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
}
