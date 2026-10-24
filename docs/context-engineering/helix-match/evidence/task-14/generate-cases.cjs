#!/usr/bin/env node
// Generates the INPUTS of test/fixtures/helix-match/cases/surround-replace.json (Task 14: the replacement phase of `mr`).
// `expected` is never written here: run `npm run test:match:oracle -- --filter surround-replace --update`.
// Marker notation in the `marked` texts (stripped, converted to Unicode scalar offsets, the fixture default selectionUnit):
//   S  (U+00A7)            a cursor (anchor = head)
//   <  (U+27E8) ... > (U+27E9)  a forward range, anchor at the opener
//   << (U+27EA) ... >> (U+27EB) a backward range: head at the first marker, anchor at the last
'use strict';
const fs = require('node:fs');

const CUR = '§', FS = '⟨', FE = '⟩', BH = '⟪', BA = '⟫';
function parse(marked) {
  let text = '';
  const selections = [];
  const stack = [];
  for (const ch of marked) {
    if (ch === CUR) { const p = [...text].length; selections.push({ anchor: p, head: p }); }
    else if (ch === FS || ch === BH) { stack.push({ kind: ch, at: [...text].length }); }
    else if (ch === FE || ch === BA) {
      const end = [...text].length;
      const open = stack.pop();
      selections.push(open.kind === FS ? { anchor: open.at, head: end } : { anchor: end, head: open.at });
    } else text += ch;
  }
  return { text, selections };
}

const cases = [];
const seen = new Set();
function add(id, description, marked, steps, extra = {}) {
  if (seen.has(id)) throw new Error(`duplicate id ${id}`);
  seen.add(id);
  const { text, selections } = parse(marked);
  const input = { text, selections, steps };
  if (extra.primary !== undefined) input.primary = extra.primary;
  if (extra.eol) input.eol = extra.eol;
  if (extra.language) input.language = extra.language;
  if (extra.failure) input.failure = extra.failure;
  cases.push({ id, description, source: extra.source || 'spec Surround edits and history; Pending input and ordering (mr, replacement phase)', tags: extra.tags || [], input });
}
// `mr<old>` then the replacement key as the next step (the oracle observes the final text and selections after it).
const rep = (old, to) => [`mr${old}`, to];

// ---- A. every pair and alias, old and new (plaintext) ----------------------------------------------------------------------
const pairs = [['(', ')', '(', ')'], ['[', ']', '[', ']'], ['{', '}', '{', '}'], ['<lt>', '<gt>', '<', '>']];
for (const [open, close, lo, lc] of pairs) {
  const t = `a ${lo}b${CUR}c${lc} d\n`;
  for (const [nopen, nclose, nlit] of [['[', ']', 'sq'], ['{', '}', 'cu'], ['<lt>', '<gt>', 'an'], ['(', ')', 'pa']]) {
    add(`old-${lo.charCodeAt(0)}-new-open-${nlit}`, `mr${lo} replaced by the opening key of ${nlit}`, t, rep(open, nopen));
    add(`old-${lo.charCodeAt(0)}-new-close-${nlit}`, `mr${lo} replaced by the closing alias of ${nlit} (same pair)`, t, rep(open, nclose));
    add(`oldclose-${lo.charCodeAt(0)}-new-${nlit}`, `mr with the closing alias of ${lo} replaced by ${nlit}`, t, rep(close, nopen));
  }
}
for (const q of ['"', "'", '`', '|']) {
  const name = { '"': 'dquote', "'": 'squote', '`': 'backtick', '|': 'pipe' }[q];
  add(`quote-${name}-to-paren`, `identical delimiters ${q} replaced by parentheses`, `a ${q}b${CUR}c${q} d\n`, rep(q, '('));
  add(`paren-to-${name}`, `parentheses replaced by identical delimiters ${q}`, `a (b${CUR}c) d\n`, rep('(', q));
  add(`quote-${name}-to-same`, `identical delimiters ${q} replaced by the same character (a replacement edit with equal text)`, `a ${q}b${CUR}c${q} d\n`, rep(q, q));
}
add('same-pair-to-same-key', 'mr( then ( replaces each delimiter by itself', `a (b${CUR}c) d\n`, rep('(', '('));
add('open-to-closing-alias-same', 'mr( then ) yields the same pair', `a (b${CUR}c) d\n`, rep('(', ')'));
for (const [id, ch, lit] of [['star', '*', '*'], ['underscore', '_', '_'], ['slash', '/', '/'], ['space', '<space>', ' '], ['digit', '3', '3'], ['letter', 'x', 'x'], ['m', 'm', 'm']]) {
  add(`new-literal-${id}`, `a character without a pinned pair pairs with itself: mr( then ${ch}`, `a (b${CUR}c) d\n`, rep('(', ch));
  if (ch !== 'm') add(`old-literal-${id}-new-paren`, `the literal old character ${lit} replaced by parentheses`, `a ${lit}b${CUR}c${lit} d\n`, rep(ch, '('));
}
add('new-m-literal-after-closest', 'mrm then the character m: the NEW surround m is a literal (not the closest-pair key)', `x [a (b ${CUR}c) d] y\n`, rep('m', 'm'));
add('new-m-literal-after-explicit', 'mr[ then m: m surrounds with the literal m', `x [a (b ${CUR}c) d] y\n`, rep('[', 'm'));
add('new-m-literal-multi', 'm as the new surround with several selections', `(a${CUR}) [b${CUR}] {c${CUR}}\n`, rep('m', 'm'), { primary: 1 });
add('closest-to-brace', 'mrm (closest) then {', `x [a (b ${CUR}c) d] y\n`, rep('m', '{'));
add('closest-outer-to-brace', 'mrm from outside the inner pair replaces the outer pair', `x [a ${CUR}(b c) d] y\n`, rep('m', '{'));

// ---- B. modified replacement characters ----------------------------------------------------------------------------------------
const base = `x (a ${CUR}b) y\n`;
add('mod-ctrl-x', 'the replacement key <C-x> is the character x whatever its modifiers', base, rep('(', '<C-x>'));
add('mod-alt-bracket', 'the replacement key <A-[> is the character [', base, rep('(', '<A-[>'));
add('mod-ctrl-alt-brace', 'the replacement key <C-A-{> is the character {', base, rep('(', '<C-A-{>'));
add('mod-ctrl-paren-old-and-new', 'old <C-(> and new <A-)> are the characters ( and )', base, ['mr<C-(>', '<A-[>']);
add('mod-ctrl-lt', 'the replacement key <C-lt> is the character <', base, rep('(', '<C-lt>'));
add('mod-ctrl-space', 'the replacement key <C-space> is the space character', base, rep('(', '<C-space>'));

// ---- C. Unicode replacement characters --------------------------------------------------------------------------------------------
add('unicode-new-emoji', 'a non-BMP replacement character (two UTF-16 code units each)', `x (a ${CUR}b) y\n`, rep('(', '\u{1F600}'));
add('unicode-new-emoji-text-before', 'non-BMP characters before and inside the pair shift UTF-16 offsets', `\u{1F600}\u{1F600} (a\u{1F680}${CUR}b) \u{1F600}y\n`, rep('(', '\u{1F680}'));
add('unicode-old-emoji-new-emoji', 'a non-BMP old and new key', `a \u{1F600}b${CUR}c\u{1F600} d\n`, rep('\u{1F600}', '\u{1F680}'));
add('unicode-old-emoji-new-paren', 'a non-BMP old key replaced by parentheses (shrinks UTF-16)', `a \u{1F600}b${CUR}c\u{1F600} d\n`, rep('\u{1F600}', '('));
add('unicode-new-guillemet', 'a guillemet is a literal self-pairing replacement', `x (a ${CUR}b) y\n`, rep('(', '«'));
add('unicode-new-cjk', 'a CJK replacement character', `x (日本${CUR}語) y\n`, rep('(', '日'));
add('unicode-new-fullwidth', 'a fullwidth bracket is a literal self-pairing replacement', `x (a ${CUR}b) y\n`, rep('(', '（'));
add('unicode-new-combining', 'a lone combining mark as the replacement character', `x (a ${CUR}b) y\n`, rep('(', '́'));
add('unicode-new-zwj', 'a lone zero width joiner as the replacement character', `x (a ${CUR}b) y\n`, rep('(', '‍'));
add('unicode-zwj-cluster-adjacent', 'ZWJ clusters next to the delimiters', `x (\u{1F468}‍\u{1F469}‍\u{1F467} a${CUR} \u{1F468}‍\u{1F469}‍\u{1F467}) y\n`, rep('(', '['));
add('unicode-combining-adjacent', 'combining marks next to the delimiters', `x (é${CUR}x́) y\n`, rep('(', '{'));
add('unicode-multi-nonbmp-selections', 'several selections after non-BMP characters', `\u{1F600}(a${CUR}) \u{1F680}(b${CUR})\n`, rep('(', '\u{1F600}'), { primary: 1 });

// ---- D. nested pairs, counts ---------------------------------------------------------------------------------------------------
add('nested-same-closest', 'mr( with nested parentheses replaces the closest pair', `((a ${CUR}b) c)\n`, rep('(', '['));
add('nested-same-count-2', '2mr( replaces the outer pair', `((a ${CUR}b) c)\n`, ['2mr(', '[']);
add('nested-deep-count-3', '3mr( replaces the outermost of three levels', `(1 (2 (3 ${CUR}x 3) 2) 1)\n`, ['3mr(', '{']);
add('nested-closest-count-2', '2mrm replaces the second closest pair', `x [a (b ${CUR}c) d] y\n`, ['2mrm', '<lt>']);
add('nested-closest-braces-in-parens', 'mrm among mixed nested pairs', `f(a, {b, [c${CUR}]})\n`, rep('m', '('));
add('nested-other-pair-skipped', 'mr[ skips an enclosed pair of another type', `[a (b ${CUR}c) d]\n`, rep('[', '{'));
add('nested-multi-closest', 'two selections whose closest pairs are nested: the edits interleave and are sorted', `(a ${CUR}x (b ${CUR}y) c)\n`, rep('m', '['));
add('nested-multi-explicit', 'two selections of the same nested parentheses', `(a ${CUR}x (b ${CUR}y) c)\n`, rep('(', '['));
add('nested-multi-three-levels', 'three selections in three nested levels', `(a [b {c ${CUR}x} ${CUR}y] ${CUR}z)\n`, rep('m', '<lt>'));
add('nested-adjacent-pairs', 'adjacent pairs )( with one cursor', `(a)${CUR}(b)\n`, rep('(', '['));
add('nested-empty-pair-on-opener', 'an empty pair, cursor on the opener', `x ${CUR}() y\n`, rep('(', '['));
add('nested-empty-pair-on-closer', 'an empty pair, cursor on the closer', `x (${CUR}) y\n`, rep('(', '['));
add('nested-delimiters-touching', 'the closing delimiter of one pair touches the opening of the next', `(a${CUR})(b${CUR})\n`, rep('(', '['));
add('nested-multiline', 'a pair spanning lines', `fn x(\n  a,\n  ${CUR}b,\n) {}\n`, rep('(', '['));
add('nested-multiline-closest', 'mrm over lines', `{\n  [\n    ${CUR}x\n  ]\n}\n`, rep('m', '('));
add('nested-count-too-large-cancel', 'a failed lookup leaves no callback: the status is the reference error', `((a ${CUR}b) c)\n`, ['3mr(', '<esc>']);

// ---- E. selections: cursor position, ranges, direction, primary -----------------------------------------------------------------
add('cursor-on-opener', 'cursor on the opening bracket: its mapping through the replaced delimiter', `x ${CUR}(b c) y\n`, rep('(', '['));
add('cursor-on-closer', 'cursor on the closing bracket', `x (b c${CUR}) y\n`, rep('(', '['));
add('cursor-after-opener', 'cursor right after the opening bracket', `x (${CUR}b c) y\n`, rep('(', '['));
add('cursor-before-closer', 'cursor right before the closing bracket', `x (b c${CUR}) y\n`, rep('(', '['));
add('range-inside', 'a range selection inside the pair', `x (a ${FS}b c${FE} d) y\n`, rep('(', '['));
add('range-covering-content', 'a range selection covering exactly the content', `x (${FS}b c${FE}) y\n`, rep('(', '['));
add('range-reversed-covering-content', 'a backward range covering exactly the content', `x (${BH}b c${BA}) y\n`, rep('(', '['));
add('range-covering-with-closest-delimiters', 'a selection covering the pair finds the enclosing pair', `x [a ${FS}(b c)${FE} d] y\n`, rep('m', '{'));
add('range-reversed', 'a backward selection inside the pair', `x (a ${BH}b c${BA} d) y\n`, rep('(', '['));
add('range-reversed-quotes', 'a backward selection inside quotes', `x "a ${BH}b c${BA} d" y\n`, rep('"', "'"));
add('range-covering-pair-no-enclosing', 'a range covering the whole pair has no enclosing pair: lookup error', `x ${FS}(b c)${FE} y\n`, ['mrm', '<esc>']);
add('multi-two', 'two selections in two pairs', `(a${CUR}) (b${CUR})\n`, rep('(', '['), { primary: 0 });
add('multi-two-primary-last', 'two selections, the primary is the last', `(a${CUR}) (b${CUR})\n`, rep('(', '['), { primary: 1 });
add('multi-three-primary-middle', 'three selections, the primary is the middle one', `(a${CUR}) (b${CUR}) (c${CUR})\n`, rep('(', '['), { primary: 1 });
add('multi-three-primary-last', 'three selections, the primary is the last', `(a${CUR}) (b${CUR}) (c${CUR})\n`, rep('(', '<lt>'), { primary: 2 });
add('multi-four-primary-3', 'four selections, the primary is the fourth', `(a${CUR}) (b${CUR}) (c${CUR}) (d${CUR})\n`, rep('(', '{'), { primary: 3 });
add('multi-mixed-ranges-and-cursors', 'ranges and cursors mixed, primary second', `(${FS}a b${FE}) [${CUR}c] {d ${BH}e${BA}}\n`, rep('m', '<lt>'), { primary: 1 });
add('multi-different-types-closest', 'm lets each selection pick its own pair type; all become the same pair', `(a${CUR}) [b${CUR}] {c${CUR}}\n`, rep('m', '('), { primary: 2 });
add('multi-reversed-and-forward', 'a backward and a forward selection in two pairs', `(${BH}a${BA}) (${FS}b${FE})\n`, rep('(', '['), { primary: 1 });
add('multi-overlapping-selections-merge', 'overlapping selections merge before the lookup', `(a ${FS}b ${FS}c${FE} d${FE})\n`, rep('(', '['));
add('multi-touching-selections', 'touching selections: lookup outcome as the reference decides', `(${FS}ab${FE}${FS}cd${FE})\n`, ['mr(', '<esc>']);
add('multi-same-pair-overlap-error', 'two selections inside the same pair: lookup error, nothing to replace', `(a${CUR} b${CUR})\n`, ['mr(', '<esc>']);
add('multi-one-without-pair-fails', 'one selection without a pair fails the whole command', `(a${CUR}) b${CUR}\n`, ['mr(', '<esc>']);

// ---- F. non-character keys cancel (no edits) -----------------------------------------------------------------------------------------
for (const [id, key] of [['escape', '<esc>'], ['tab', '<tab>'], ['enter', '<ret>'], ['left', '<left>'], ['ctrl-left', '<C-left>'], ['backspace', '<backspace>'], ['home', '<home>'], ['end', '<end>'], ['up', '<up>'], ['shift-enter', '<S-ret>'], ['ctrl-enter', '<C-ret>']]) {
  add(`cancel-${id}`, `${key} after the preview restores the original selection and edits nothing`, base, rep('(', key));
}
add('cancel-multi-primary-not-first', 'a non-character key restores all original selections and the original primary', `(a${CUR}) (b${CUR}) (c${CUR})\n`, rep('(', '<esc>'), { primary: 1 });
add('cancel-reversed', 'a non-character key restores a backward selection with its direction', `x (a ${BH}b c${BA} d) y\n`, rep('(', '<tab>'));
add('cancel-then-new-command', 'after cancelling the session is over: a new command works from the restored selection', base, ['mr(', '<esc>', 'mi(']);
add('cancel-then-replace', 'a cancelled preview followed by a complete replacement', base, ['mr(', '<esc>', 'mr(', '[']);
add('oldkey-non-character', 'a non-character OLD key consumes the callback: nothing to continue', base, ['mr<tab>']);

// ---- G. sequences: the next command runs on the edited document ------------------------------------------------------------------
add('seq-replace-twice', 'two consecutive replacements: the second runs on the edited text', `x (a ${CUR}b) y\n`, ['mr(', '[', 'mr[', '{']);
add('seq-replace-then-object', 'a text object command after a replacement', `x (a ${CUR}b) y\n`, ['mr(', '[', 'mi[']);
add('seq-replace-then-add', 'surround add after a replacement', `x (a ${CUR}b) y\n`, ['mr(', '[', 'ms{']);
add('seq-replace-back-and-forth', 'replacing back to the original delimiters', `x (a ${CUR}b) y\n`, ['mr(', '[', 'mr[', '(']);
add('seq-nested-outer-then-inner', 'replace the outer then the inner pair', `((a ${CUR}b) c)\n`, ['2mr(', '[', 'mr(', '{']);
add('seq-count-then-closest', 'a counted replacement then a closest replacement', `x [a (b ${CUR}c) d] y\n`, ['2mrm', '{', 'mrm', '<lt>']);
add('seq-multi-twice', 'two replacements with three selections', `(a${CUR}) (b${CUR}) (c${CUR})\n`, ['mr(', '[', 'mr[', '{'], { primary: 1 });
add('seq-cancel-then-replacement-multi', 'a cancelled preview then a replacement with several selections', `(a${CUR}) (b${CUR})\n`, ['mr(', '<esc>', 'mr(', '['], { primary: 1 });
add('seq-failed-lookup-then-object', 'a failed lookup installs no callback; a later command works', `x a ${CUR}b y\n`, ['mr(', '<esc>', 'mi(']);

// ---- H. boundaries and line endings -----------------------------------------------------------------------------------------------
add('bof-eof-no-newline', 'a pair at the very start and end of the text, no final newline', `(a${CUR}b)`, rep('(', '['));
add('bof-eof-with-newline', 'a pair at the start, final newline', `(a${CUR}b)\n`, rep('(', '['));
add('only-pair-empty-cursor-on-opener', 'a text of just an empty pair', `${CUR}()`, rep('(', '['));
add('crlf-same-line', 'CRLF document, pair on one line', `x (a${CUR}b) y\r\nnext\r\n`, rep('(', '['), { eol: 'crlf' });
add('crlf-across-lines', 'CRLF document, pair across lines', `fn f(\r\n  a${CUR},\r\n) {}\r\n`, rep('(', '['), { eol: 'crlf' });
add('crlf-cursor-on-line-break', 'the cursor on a CRLF line break inside the pair', `(a${CUR}\r\nb)\r\n`, rep('(', '['), { eol: 'crlf' });
add('crlf-closest-multi', 'CRLF document, several selections', `(a${CUR})\r\n(b${CUR})\r\n`, rep('m', '{'), { eol: 'crlf', primary: 1 });
add('crlf-new-emoji', 'CRLF document, non-BMP replacement', `x (a${CUR}b)\r\n(c)\r\n`, rep('(', '\u{1F600}'), { eol: 'crlf' });
add('crlf-lone-cr-in-text', 'a lone CR is not a line break', `(a\rb${CUR})\n`, rep('(', '['));
add('lf-text-crlf-config', 'LF text with a CRLF configuration', `(a${CUR}\nb)\n`, rep('(', '['), { eol: 'crlf' });
add('crlf-cancel', 'CRLF: a non-character key restores', `(a${CUR}\r\nb)\r\n`, rep('(', '<esc>'), { eol: 'crlf' });

// ---- I. syntax-aware old lookup (root and injected languages) ---------------------------------------------------------------------
const src = 'spec Surround edits and history; syntax-aware old-surround lookup, replacement phase';
const rust = (id, description, marked, steps, extra = {}) => add(`rust-${id}`, description, marked, steps, { language: 'rust', source: src, ...extra });
rust('closest-in-call', 'mrm inside a call, replaced', `fn f() { g(a, ${CUR}b); }\n`, rep('m', '['));
rust('closest-in-string-with-brackets', 'mrm inside a string that contains brackets', `fn f() { let s = "a (b ${CUR}c) d"; }\n`, rep('m', '{'));
rust('closest-in-comment', 'mrm inside a comment with brackets', `fn f() {\n    // see (a ${CUR}b)\n}\n`, rep('m', '['));
rust('closest-nested-blocks-count-2', '2mrm in nested blocks', `fn f() { if x { [1, ${CUR}2] } }\n`, ['2mrm', '(']);
rust('closest-char-literal', 'mrm near a char literal containing a bracket', `fn f() { let c = '('; g(${CUR}c); }\n`, rep('m', '['));
rust('closest-lifetime-tick', 'mrm near a lifetime tick: lookup outcome as the reference decides', `fn f<'a>(x: &'a str${CUR}) {}\n`, ['mrm', '<esc>']);
rust('quote-cursor-inside-string', 'mr" with the cursor inside the string', `fn f() { let s = "a${CUR}b"; }\n`, rep('"', "'"));
rust('quote-cursor-on-opening-quote', 'mr" with the cursor on the opening quote of a string', `fn f() { let s = ${CUR}"ab"; }\n`, rep('"', '`'));
rust('quote-escaped-quote-in-string', 'mr" with an escaped quote inside the string', `fn f() { let s = ${CUR}"a\\"b"; }\n`, rep('"', "'"));
rust('quote-two-strings-multi', 'mr" with a selection in each of two strings', `fn f() { g("a${CUR}", "b${CUR}"); }\n`, rep('"', "'"), { primary: 1 });
rust('paren-with-bracket-in-string', 'mr( where an unbalanced ( sits in a string', `fn f() { g("(", ${CUR}b); }\n`, rep('(', '['));
rust('multi-closest-two-constructs', 'mrm with two selections in different constructs', `fn f() { g(a${CUR}); h[b${CUR}]; }\n`, rep('m', '{'), { primary: 1 });
rust('generic-angle', 'mr< in a rust generic', `fn f(x: Vec<Option<${CUR}u8>>) {}\n`, rep('<lt>', '('));
rust('crlf-closest', 'CRLF rust document', `fn f() {\r\n    g(a${CUR});\r\n}\r\n`, rep('m', '['), { eol: 'crlf' });
rust('unicode-string', 'mrm in a string with non-BMP characters', `fn f() { let s = "\u{1F600} (\u{1F600}${CUR}) "; }\n`, rep('m', '\u{1F680}'));
rust('cancel-escape', 'a non-character key after a syntax-aware preview', `fn f() { g(a, ${CUR}b); }\n`, rep('m', '<esc>'));

const md = (id, description, marked, steps, extra = {}) => add(`markdown-${id}`, description, marked, steps, { language: 'markdown', source: src, ...extra });
const fence = (code) => `# T\n\n\`\`\`rust\n${code}\n\`\`\`\n\ntext (prose) here\n`;
md('injected-rust-closest', 'mrm inside a rust code block', fence(`fn f() { g(a, ${CUR}b); }`), rep('m', '['));
md('injected-rust-string-with-brackets', 'mrm in a rust string with brackets inside a code block', fence(`fn f() { let s = "a (b ${CUR}c) d"; }`), rep('m', '{'));
md('injected-rust-quote', 'mr" in a rust string inside a code block', fence(`fn f() { let s = "a${CUR}b"; }`), rep('"', "'"));
md('injected-rust-count-2', '2mrm in a rust code block', fence(`fn f() { if x { [1, ${CUR}2] } }`), ['2mrm', '(']);
md('injected-and-root-selections', 'one selection in the injected rust block, one in the markdown prose', `# T\n\n\`\`\`rust\nfn f() { g(a${CUR}); }\n\`\`\`\n\ntext (pro${CUR}se) here\n`, rep('m', '['), { primary: 1 });
md('root-prose-paren', 'mr( in markdown prose', fence(`fn f() {}`).replace('text (prose)', `text (pro${CUR}se)`), rep('(', '['));
md('root-link-url-parens', 'mr( in the url of a markdown link', `see [docs](http://example.com/a_(b${CUR})) now\n`, rep('(', '['));
md('root-code-span-brackets', 'mrm in a markdown code span', `use \`f(a, ${CUR}b)\` here\n`, rep('m', '['));
md('injected-crlf', 'CRLF markdown with an injected block', fence(`fn f() { g(a, ${CUR}b); }`).replace(/\n/g, '\r\n'), rep('m', '['), { eol: 'crlf' });

const html = (id, description, marked, steps, extra = {}) => add(`html-${id}`, description, marked, steps, { language: 'html', source: src, ...extra });
html('script-js-closest', 'mrm in a script element (injected javascript)', `<div>\n<script>\n  f("a (b", ${CUR}c);\n</script>\n</div>\n`, rep('m', '['));
html('script-js-string-quote', 'mr" on a javascript string quote in a script element', `<script>\n  var s = ${CUR}"a b";\n</script>\n`, rep('"', "'"));
html('script-js-template-literal', 'mr` in a javascript template literal', `<script>\n  var s = \`a ${CUR}b\`;\n</script>\n`, rep('`', '"'));
html('style-css-closest', 'mrm in a style element (injected css)', `<style>\n  a { color: rgb(1, ${CUR}2, 3); }\n</style>\n`, rep('m', '['));
html('attribute-quotes', 'mr" in an html attribute value', `<a href="x${CUR}y">t</a>\n`, rep('"', "'"));
html('multi-script-and-text', 'one selection in the script and one in the text: lookup outcome as the reference decides', `<p>a (b${CUR})</p>\n<script>\n  f(x${CUR});\n</script>\n`, ['mrm', '<esc>']);

const lang = (l, id, description, marked, steps, extra = {}) => add(`${l}-${id}`, description, marked, steps, { language: l, source: src, ...extra });
lang('javascript', 'string-with-brackets', 'mrm in a javascript string with brackets', `f("a (b ${CUR}c) d", e);\n`, rep('m', '['));
lang('json', 'array-in-object', 'mrm in a json array in an object', `{"a": [1, ${CUR}2], "b": "(x)"}\n`, rep('m', '('));
lang('json', 'quote-key', 'mr" on a json key', `{"${CUR}key": 1}\n`, rep('"', "'"));
lang('toml', 'array', 'mrm in a toml array', `a = [1, ${CUR}2]\nb = "(x)"\n`, rep('m', '('));
lang('python', 'string-brackets', 'mrm in a python string with brackets', `f("a (b ${CUR}c) d", e)\n`, rep('m', '['));
lang('python', 'comment-brackets', 'mrm in a python comment', `# see (a ${CUR}b)\nx = 1\n`, rep('m', '['));
lang('c', 'char-literal-bracket', 'mrm near a C char literal', `void f() { char c = '('; g(${CUR}c); }\n`, rep('m', '['));
lang('typescript', 'generic-closest', 'mrm in a typescript generic', `let x: Array<Map<string, ${CUR}number>> = [];\n`, rep('m', '('));

// ---- J. syntax unavailable: plaintext fallback --------------------------------------------------------------------------------------
add('failure-initial-parse-closest', 'a rust document without a syntax tree (failed initial parse): plaintext lookup, then replacement', `fn f() { let s = "a (b ${CUR}c) d"; }\n`, rep('m', '['), { language: 'rust', failure: { kind: 'initial-parse' }, source: 'spec Syntax lifecycle contract; surround without syntax' });
add('failure-initial-parse-quote', 'a failed initial parse: mr" falls back to the plaintext matching', `fn f() { let s = ${CUR}"ab"; }\n`, rep('"', "'"), { language: 'rust', failure: { kind: 'initial-parse' }, source: 'spec Syntax lifecycle contract; surround without syntax' });

const doc = {
  schemaVersion: 1,
  group: 'surround-replace',
  provenance: {
    generator: 'mini-helix-match-oracle (native/oracle) driving helix-term key dispatch; expected results are never produced by extension code',
    reference: 'native/helix-lock.json: helix revision, patched source tree hash, runtime hash (also recorded in every expected.reference)',
    regenerate: 'npm run test:match:oracle -- --update, then review the diff',
  },
  cases,
};
const out = process.argv[2];
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`${cases.length} cases written to ${out}`);
