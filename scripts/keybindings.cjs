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
// While `mr<old>` waits for its replacement, nothing else may start.
const idleMotionWhen =
  `${motionWhen} && !miniHelix.wordJumpActive && !miniHelix.surroundReplacePending`;
const surroundWhen = `${normalWhen} && !miniHelix.wordJumpActive && !miniHelix.surroundReplacePending`;
const surroundPendingWhen = `${motionWhen} && miniHelix.surroundReplacePending`;
// Blockers also run in read-only editors while a count is pending, because
// every key that is not a digit clears it, as in Helix.
const blockWhen =
  'editorTextFocus && (!editorReadonly || miniHelix.countPending) && miniHelix.enabled && miniHelix.mode == normal';
// Escape is native in NORMAL unless it has a count to clear.
const countWhen = `${idleMotionWhen} && miniHelix.countPending`;
const hjklWhen = `${idleMotionWhen} && config.miniHelix.hjklMotions`;

// Helix word motions; each replaces the selection with the text moved over.
const motions = [
  ['w', 'miniHelix.moveNextWordStart'],
  ['b', 'miniHelix.movePrevWordStart'],
  ['e', 'miniHelix.moveNextWordEnd'],
  ['shift+w', 'miniHelix.moveNextLongWordStart'],
  ['shift+b', 'miniHelix.movePrevLongWordStart'],
  ['shift+e', 'miniHelix.moveNextLongWordEnd'],
];

// Helix h, j, k, l, behind the miniHelix.hjklMotions setting.
const charMotions = [
  ['h', 'miniHelix.moveCharLeft'],
  ['j', 'miniHelix.moveVisualLineDown'],
  ['k', 'miniHelix.moveVisualLineUp'],
  ['l', 'miniHelix.moveCharRight'],
];

// Helix binds the arrows like h, j, k, l. They stay native, except that with
// a count pending they use it (3<down> is 3j), as Helix's do.
const countedArrows = [
  ['left', 'miniHelix.moveCharLeft'],
  ['down', 'miniHelix.moveVisualLineDown'],
  ['up', 'miniHelix.moveVisualLineUp'],
  ['right', 'miniHelix.moveCharRight'],
];
// Other navigation keys clear a pending count, then act natively.
const countClearing = [
  ['home', 'cursorHome'],
  ['end', 'cursorEnd'],
  ['pageup', 'cursorPageUp'],
  ['pagedown', 'cursorPageDown'],
];

// Count digits, including the numeric keypad's, which terminals send to Helix as digits.
const digits = Array.from({ length: 10 }, (_, digit) => digit)
  .flatMap(digit => [[String(digit), digit], [`numpad${digit}`, digit]]);

const lines = [
  ['x', 'miniHelix.extendLineBelow'],
  ['shift+x', 'miniHelix.extendToLineBounds'],
];

// Helix selection edits; like `i`, they need a writable editor.
const edits = [
  ['a', 'miniHelix.append'],
  ['c', 'miniHelix.changeSelection'],
  ['d', 'miniHelix.deleteSelection'],
  ['o', 'miniHelix.openBelow'],
  ['shift+o', 'miniHelix.openAbove'],
];

// Helix history: whole revisions on VS Code's undo stack.
const history = [
  ['u', 'miniHelix.undo'],
  ['shift+u', 'miniHelix.redo'],
];

// Native language navigation, smart selection, and navigation history.
const navigation = [
  ['g d', 'miniHelix.gotoDefinition'],
  ['g r', 'miniHelix.gotoReferences'],
  ['alt+o', 'miniHelix.expandSelection'],
  ['alt+i', 'miniHelix.shrinkSelection'],
  ['ctrl+o', 'miniHelix.jumpBack'],
  ['ctrl+i', 'miniHelix.jumpForward'],
];

// `mi`, `ma`, and `mr` delimiters on the US layout: key → the character it types.
const delimiterKeys = [
  ["'", "'"], ["shift+'", '"'], ['shift+9', '('], ['shift+0', ')'], ['[', '['],
  [']', ']'], ['shift+[', '{'], ['shift+]', '}'], ['shift+,', '<'], ['shift+.', '>'],
  ['`', '`'],
];
// Text objects add the word to the delimiters.
const textObjectKeys = [['w', 'w'], ...delimiterKeys];
const textObjectKinds = [['i', 'inside'], ['a', 'around']];

// US-layout characters typed by the unmodified and shifted punctuation keys.
const punctuationKeys = [
  ['`', '~'], ['-', '_'], ['=', '+'], ['[', '{'], [']', '}'], ['\\', '|'],
  [';', ':'], ["'", '"'], [',', '<'], ['.', '>'], ['/', '?'],
];
const shiftedDigits = ')!@#$%^&*(';
const numpadCharacters = [
  ['numpad_add', '+'], ['numpad_subtract', '-'], ['numpad_multiply', '*'],
  ['numpad_divide', '/'], ['numpad_decimal', '.'], ['numpad_separator', ','],
];
// Key → the character it types, for the replacement of a pending `mr`.
const typedCharacters = new Map([
  ...[...'abcdefghijklmnopqrstuvwxyz'].flatMap(key => [[key, key], [`shift+${key}`, key.toUpperCase()]]),
  ...Array.from({ length: 10 }, (_, digit) => [
    [String(digit), String(digit)], [`shift+${digit}`, shiftedDigits[digit]],
    [`numpad${digit}`, String(digit)],
  ]).flat(),
  ...punctuationKeys.flatMap(([key, shifted]) => [[key, key], [`shift+${key}`, shifted]]),
  ...numpadCharacters,
]);

const navigationKeys = ['left', 'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown'];

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
      when: blockWhen,
    })),
    // These must follow the blockers: the last matching extension binding wins.
    { key: 'i', command: 'miniHelix.enterInsert', when: normalWhen },
    ...[...edits, ...history].map(([key, command]) => ({ key, command, when: normalWhen })),
    { key: 'escape', command: 'miniHelix.enterNormal', when: insertWhen },
    { key: 'g w', command: 'miniHelix.gotoWord', when: idleMotionWhen },
    ...navigation.map(([key, command]) => ({ key, command, when: idleMotionWhen })),
    // Other g chords are unbound keys: they clear the count instead of leaving it pending.
    ...chordNoops('g', ['w', 'd', 'r']),
    // m i / m a select text objects, and m r starts a surround replacement, which
    // needs a writable editor: in a read-only one its delimiter key only clears the count.
    ...textObjectKinds.flatMap(([prefix, kind]) => textObjectKeys.map(([key, target]) => ({
      key: `m ${prefix} ${key}`, command: 'miniHelix.selectTextObject', args: { kind, target }, when: idleMotionWhen,
    }))),
    ...delimiterKeys.map(([key]) => ({
      key: `m r ${key}`, command: 'miniHelix.noop', when: `${idleMotionWhen} && editorReadonly`,
    })),
    ...delimiterKeys.map(([key, target]) => ({
      key: `m r ${key}`, command: 'miniHelix.surroundReplace', args: { target }, when: surroundWhen,
    })),
    ...chordNoops('m', ['i', 'a', 'r']),
    ...textObjectKinds.flatMap(([prefix]) => chordNoops(`m ${prefix}`, textObjectKeys.map(([key]) => key))),
    ...chordNoops('m r', delimiterKeys.map(([key]) => key)),
    ...[...motions, ...lines].map(([key, command]) => ({ key, command, when: idleMotionWhen })),
    ...charMotions.map(([key, command]) => ({ key, command, when: hjklWhen })),
    ...digits.map(([key, digit]) => ({ key, command: 'miniHelix.count', args: digit, when: idleMotionWhen })),
    { key: 'escape', command: 'miniHelix.clearCount', when: countWhen },
    ...countedArrows.map(([key, command]) => ({ key, command, when: countWhen })),
    ...countClearing.map(([key, command]) => ({ key, command: 'miniHelix.clearCount', args: command, when: countWhen })),
    // While labels are visible, i/g/etc. are label input, not mode/chord keys.
    ...[...blocked, 'escape', 'left', 'right', 'up', 'down', 'home', 'end',
      'pageup', 'pagedown', 'insert'].map(key => /^[a-z]$/.test(key) ? {
        key, command: 'miniHelix.wordJumpInput', args: key, when: jumpWhen,
      } : {
        key, command: 'miniHelix.cancelWordJump', when: jumpWhen,
      }),
    // Last, so the replacement of a pending mr beats every other NORMAL binding.
    ...[...blocked, 'escape', ...navigationKeys, 'insert'].map(key => typedCharacters.has(key) ? {
      key, command: 'miniHelix.surroundReplaceInput', args: typedCharacters.get(key), when: surroundPendingWhen,
    } : {
      key, command: 'miniHelix.cancelSurroundReplace', when: surroundPendingWhen,
    }),
  ];

  // Unbound keys after a chord prefix clear the count and never type.
  function chordNoops(prefix, bound) {
    return [...blocked, 'escape', ...navigationKeys]
      .filter(key => !bound.includes(key)).map(key => ({
        key: `${prefix} ${key}`, command: 'miniHelix.noop', when: idleMotionWhen,
      }));
  }
}

module.exports = {
  createKeybindings, motions, charMotions, lines, digits, edits, history, navigation,
  normalWhen, insertWhen, jumpWhen, blockWhen, delimiterKeys, textObjectKeys, typedCharacters,
};

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
