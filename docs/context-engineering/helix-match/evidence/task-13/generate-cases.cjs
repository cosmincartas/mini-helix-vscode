#!/usr/bin/env node
// Generates the INPUTS of test/fixtures/helix-match/cases/surround-replace-preview.json (Task 13).
// `expected` is never written here: run `npm run test:match:oracle -- --filter surround-replace-preview --update`.
// Marker notation in the `marked` texts (stripped, converted to Unicode scalar offsets, the fixture default selectionUnit):
//   S  (U+00A7)            a cursor (anchor = head)
//   <  (U+27E8) ... > (U+27E9)  a forward range, anchor at the opener
//   << (U+27EA) ... >> (U+27EB) a backward range: head at the first marker, anchor at the last
'use strict';
const fs = require('node:fs');
const path = require('node:path');

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
  cases.push({ id, description, source: extra.source || 'spec Surround edits and history; Pending input and ordering (mr)', tags: extra.tags || [], input });
}
const mr = (k) => [`mr${k}`];
const mrCancel = (k, cancel = '<esc>') => [`mr${k}`, cancel];

// ---- A. explicit pairs and their aliases (plaintext) --------------------------------------------------------------------------
const pairs = [['(', ')', '('], ['[', ']', '['], ['{', '}', '{'], ['<lt>', '<gt>', '<']];
for (const [open, close, lit] of pairs) {
  const t = `a ${lit}b${CUR}c${lit === '<' ? '>' : { '(': ')', '[': ']', '{': '}' }[lit]} d\n`;
  add(`pair-open-${lit.charCodeAt(0)}`, `mr with the opening ${lit} finds the pair around the cursor`, t, mr(open));
  add(`pair-close-${lit.charCodeAt(0)}`, `mr with the closing alias of ${lit} finds the same pair`, t, mr(close));
}
for (const q of ['"', "'", '`', '|']) {
  const name = { '"': 'dquote', "'": 'squote', '`': 'backtick', '|': 'pipe' }[q];
  add(`same-char-${name}`, `mr${q} finds the identical-delimiter pair around the cursor`, `a ${q}b${CUR}c${q} d\n`, mr(q));
  add(`same-char-${name}-cursor-on-opener`, `mr${q} with the cursor on the opening ${q}`, `a ${CUR}${q}bc${q} d\n`, mr(q));
  add(`same-char-${name}-cursor-on-closer`, `mr${q} with the cursor on the closing ${q}`, `a ${q}bc${CUR}${q} d\n`, mr(q));
}
for (const [id, ch, text] of [['star', '*', 'a *b'+CUR+'c* d\n'], ['underscore', '_', 'a _b'+CUR+'c_ d\n'], ['slash', '/', 'a /b'+CUR+'c/ d\n'], ['space', '<space>', 'a b'+CUR+'c d e\n'], ['digit', '3', 'a 3b'+CUR+'c3 d\n'], ['letter', 'x', 'axb'+CUR+'cxd\n']]) {
  add(`literal-${id}`, `any other character pairs with itself (pinned get_pair): mr${ch}`, text, mr(ch));
}
add('literal-m-is-closest-not-a-char', 'mrm is the closest-pair lookup, never the literal m', `a m${CUR}b m (c) d\n`, mr('m'));

// ---- B. m: the closest surround ----------------------------------------------------------------------------------------------
add('closest-simple', 'mrm picks the closest pair around the cursor', `x [a (b ${CUR}c) d] y\n`, mr('m'));
add('closest-outer-after-inner', 'mrm from outside the inner pair picks the outer pair', `x [a ${CUR}(b c) d] y\n`, mr('m'));
add('closest-braces-in-parens', 'mrm among mixed nested pairs', `f(a, {b, [c${CUR}]})\n`, mr('m'));
add('closest-count-2', '2mrm skips the closest pair', `x [a (b ${CUR}c) d] y\n`, ['2mrm']);
add('closest-count-3-fails', '3mrm with only two pairs reports the lookup error', `x [a (b ${CUR}c) d] y\n`, ['3mrm', '<esc>']);
add('closest-cursor-on-opener', 'mrm with the cursor on an opening bracket', `x ${CUR}(b c) y\n`, mr('m'));
add('closest-cursor-on-closer', 'mrm with the cursor on a closing bracket', `x (b c${CUR}) y\n`, mr('m'));
add('closest-selection-inside', 'mrm with a non-cursor selection inside the pair', `x (a ${FS}b c${FE} d) y\n`, mr('m'));
add('closest-selection-whole-content', 'mrm with the selection covering exactly the content', `x (${FS}b c${FE}) y\n`, mr('m'));
add('closest-selection-with-delimiters', 'mrm with the selection covering the pair itself selects the enclosing one', `x [a ${FS}(b c)${FE} d] y\n`, mr('m'));
add('closest-no-pair', 'mrm without any pair reports the lookup error', `x a ${CUR}b y\n`, mrCancel('m'));
add('closest-quotes-ignored', 'mrm in plaintext only considers brackets', `x "a ${CUR}b" y\n`, mrCancel('m'));
add('closest-reversed-selection', 'mrm with a backward selection', `x (a ${BH}b c${BA} d) y\n`, mr('m'));

// ---- C. nested pairs and counts -----------------------------------------------------------------------------------------------
add('nested-same-pair-count-1', 'mr( with nested parentheses uses the closest', `((a ${CUR}b) c)\n`, mr('('));
add('nested-same-pair-count-2', '2mr( skips the closest parentheses', `((a ${CUR}b) c)\n`, ['2mr(']);
add('nested-same-pair-count-3-fails', '3mr( with two levels reports the lookup error', `((a ${CUR}b) c)\n`, ['3mr(', '<esc>']);
add('nested-deep-count-3', '3mr( with three levels', `(1 (2 (3 ${CUR}x 3) 2) 1)\n`, ['3mr(']);
add('nested-other-pair-skipped', 'mr[ skips an enclosed pair of another type', `[a (b ${CUR}c) d]\n`, mr('['));
add('nested-quotes-count-2', '2mr" with identical delimiters', `"a "b" ${CUR}c"\n`, ['2mr"']);
add('nested-cursor-in-gap-between', 'cursor between two sibling pairs finds the enclosing pair', `[(a) ${CUR} (b)]\n`, mr('['));
add('nested-sibling-not-enclosing', 'the pair must enclose the cursor: a following sibling pair does not count', `(a) ${CUR}x (b)\n`, mrCancel('('));
add('multiline-pair', 'a pair spanning lines', `fn x(\n  a,\n  ${CUR}b,\n) {}\n`, mr('('));
add('multiline-braces-closest', 'mrm over lines', `{\n  [\n    ${CUR}x\n  ]\n}\n`, mr('m'));

// ---- D. cursor on delimiters and boundaries -----------------------------------------------------------------------------------
add('on-opener', 'cursor on the opening bracket', `x ${CUR}(b c) y\n`, mr('('));
add('on-closer', 'cursor on the closing bracket', `x (b c${CUR}) y\n`, mr('('));
add('on-closer-with-closing-key', 'mr) with the cursor on the closing bracket', `x (b c${CUR}) y\n`, mr(')'));
add('empty-pair', 'an empty pair () with the cursor on the opener', `x ${CUR}() y\n`, mr('('));
add('empty-pair-on-closer', 'an empty pair () with the cursor on the closer', `x (${CUR}) y\n`, mr('('));
add('adjacent-pairs', 'adjacent pairs )(', `(a)${CUR}(b)\n`, mr('('));
add('pair-at-bof-eof-no-newline', 'a pair at the very start and end of the text, no final newline', `(a${CUR}b)`, mr('('));
add('text-shorter-than-two', 'a one-character text cannot contain a pair', `${CUR}x`, mrCancel('('));
add('empty-text', 'the empty text', `${CUR}`, mrCancel('('));
add('cursor-at-eof', 'the cursor at the end of the text', `(ab)\n${CUR}`, mrCancel('('));
add('cursor-on-final-newline', 'the cursor on the final newline inside no pair', `(ab\n${CUR}`, mrCancel('('));

// ---- E. selections: multiple, primary, reversed -----------------------------------------------------------------------------
add('selection-range-inside', 'a non-cursor selection inside the pair', `x (a ${FS}b c${FE} d) y\n`, mr('('));
add('selection-range-covering-content', 'the selection covers exactly the content', `x (${FS}b c${FE}) y\n`, mr('('));
add('selection-range-including-delimiters', 'a selection that includes the delimiters is not enclosed by that pair', `x ((a) ${FS}(b)${FE}) y\n`, mr('('));
add('selection-partially-outside', 'a selection that starts inside and ends outside the pair', `x (a ${FS}b) c${FE} y\n`, mrCancel('('));
add('selection-reversed-single', 'a backward selection inside the pair', `x (a ${BH}b c${BA} d) y\n`, mr('('));
add('selection-reversed-quotes', 'a backward selection inside quotes', `x "a ${BH}b c${BA} d" y\n`, mr('"'));
add('multi-two-pairs', 'two selections in two pairs', `(a${CUR}) (b${CUR})\n`, mr('('), { primary: 0 });
add('multi-two-pairs-primary-last', 'two selections, the primary is the last', `(a${CUR}) (b${CUR})\n`, mr('('), { primary: 1 });
add('multi-three-primary-middle', 'three selections, the primary is the middle one (preview primary doubles)', `(a${CUR}) (b${CUR}) (c${CUR})\n`, mr('('), { primary: 1 });
add('multi-three-primary-last', 'three selections, the primary is the last', `(a${CUR}) (b${CUR}) (c${CUR})\n`, mr('('), { primary: 2 });
add('multi-mixed-ranges-and-cursors', 'ranges and cursors mixed', `(${FS}a b${FE}) [${CUR}c] {d ${BH}e${BA}}\n`, mr('m'), { primary: 1 });
add('multi-different-types-closest', 'm lets each selection pick its own pair type', `(a${CUR}) [b${CUR}] {c${CUR}}\n`, mr('m'), { primary: 2 });
add('multi-different-types-explicit-fails', 'an explicit pair type must exist around every selection', `(a${CUR}) [b${CUR}]\n`, mrCancel('('));
add('multi-nested-pairs-closest', 'two selections whose closest pairs are nested', `(a ${CUR}x (b ${CUR}y) c)\n`, mr('m'));
add('multi-nested-explicit-count-1', 'nested pairs found by two selections of the same parentheses', `(a ${CUR}x (b ${CUR}y) c)\n`, mr('('));
add('multi-same-pair-overlap-error', 'two selections inside the same pair report the overlap error', `(a${CUR} b${CUR})\n`, mrCancel('('));
add('multi-same-pair-quotes-overlap-error', 'two selections inside the same quotes report the overlap error', `"a${CUR} b${CUR}"\n`, mrCancel('"'));
add('multi-overlapping-selections-merge', 'overlapping selections merge before the lookup', `(a ${FS}b ${FS}c${FE} d${FE})\n`, mr('('));
add('multi-touching-selections', 'touching selections', `(${FS}ab${FE}${FS}cd${FE})\n`, mr('('));
add('multi-reversed-and-forward', 'a backward and a forward selection in two pairs', `(${BH}a${BA}) (${FS}b${FE})\n`, mr('('), { primary: 1 });
add('multi-four-pairs', 'four selections in four pairs, primary 3', `(a${CUR}) (b${CUR}) (c${CUR}) (d${CUR})\n`, mr('('), { primary: 3 });
add('multi-one-without-pair-fails', 'one selection without a pair fails the whole command', `(a${CUR}) b${CUR}\n`, mrCancel('('));

// ---- F. lookup failures ------------------------------------------------------------------------------------------------------
add('fail-no-pair', 'no pair around the cursor', `x a ${CUR}b y\n`, mrCancel('('));
add('fail-wrong-type', 'the cursor is in [] but ( is asked', `x [a ${CUR}b] y\n`, mrCancel('('));
add('fail-only-opener', 'an unbalanced opener', `x (a ${CUR}b y\n`, mrCancel('('));
add('fail-only-closer', 'an unbalanced closer', `x a ${CUR}b) y\n`, mrCancel('('));
add('fail-then-ordinary-key', 'a failed lookup installs no callback: the next key is ordinary input', `x a ${CUR}b y\n`, ['mr(', 'd']);
add('fail-quote-single-in-text', 'one lonely quote', `x "a ${CUR}b y\n`, mrCancel('"'));
add('fail-ambiguous-cursor-on-quote', 'cursor on a quote without a partner reports the ambiguous-pair error', `x ${CUR}"a b y\n`, mrCancel('"'));
add('fail-count-too-large', '5mr( reports the lookup error', `(a ${CUR}b)\n`, ['5mr(', '<esc>']);
add('fail-first-selection-fails-second-ok', 'the failing selection decides', `a${CUR} (b${CUR})\n`, mrCancel('('));
add('fail-closest-different-in-selections', 'mrm fails when one selection has no pair', `(a${CUR}) b${CUR}\n`, mrCancel('m'));

// ---- G. non-character keys and modifiers ------------------------------------------------------------------------------------
const base = `x (a ${CUR}b) y\n`;
add('oldkey-tab-consumed', 'a non-character key where the old surround is expected consumes the callback', base, ['mr<tab>']);
add('oldkey-enter-consumed', 'Enter as the old key', base, ['mr<ret>']);
add('oldkey-arrow-consumed', 'an arrow key as the old key', base, ['mr<left>']);
add('oldkey-ctrl-paren', 'a modified character is its character: mr<C-(>', base, ['mr<C-(>', '<esc>']);
add('oldkey-alt-paren', 'mr<A-(> also finds the parentheses', base, ['mr<A-(>', '<esc>']);
add('oldkey-ctrl-x-literal', 'mr<C-x> looks for the literal x', `a x${CUR}b x c\n`, ['mr<C-x>', '<esc>']);
add('oldkey-then-ordinary', 'after a consumed non-character old key the next key is ordinary NORMAL input', base, ['mr<tab>', 'l']);
add('cancel-escape', 'Escape in the replacement preview restores the original selection', base, mrCancel('(', '<esc>'));
add('cancel-tab', 'a non-character key restores the original selection', base, mrCancel('(', '<tab>'));
add('cancel-enter', 'Enter restores the original selection', base, mrCancel('(', '<ret>'));
add('cancel-arrow', 'an arrow key restores the original selection', base, mrCancel('(', '<left>'));
add('cancel-ctrl-arrow', 'Ctrl+arrow restores the original selection', base, mrCancel('(', '<C-left>'));
add('cancel-backspace', 'Backspace restores the original selection', base, mrCancel('(', '<backspace>'));
add('cancel-home', 'Home restores the original selection', base, mrCancel('(', '<home>'));
add('cancel-multi-primary-not-first', 'Escape restores all original selections and the original primary', `(a${CUR}) (b${CUR}) (c${CUR})\n`, mrCancel('(', '<esc>'), { primary: 1 });
add('cancel-reversed', 'Escape restores a backward selection with its direction', `x (a ${BH}b c${BA} d) y\n`, mrCancel('(', '<esc>'));
add('cancel-range-selection', 'Escape restores a range selection', `x (a ${FS}b c${FE} d) y\n`, mrCancel('(', '<esc>'));
add('cancel-then-new-command', 'after Escape the session is over: a new command works from the restored selection', base, ['mr(', '<esc>', 'mi(']);
add('cancel-then-new-preview', 'two consecutive previews, each cancelled', base, ['mr(', '<esc>', 'mr(', '<tab>']);
add('cancel-m-closest', 'Escape after mrm', `x [a (b ${CUR}c) d] y\n`, mrCancel('m', '<esc>'));
add('replacement-char-pending-bracket', 'a character after the preview starts the replacement (Task 14); the preview step is the Task 13 observation', base, mrCancel('(', '['));
add('replacement-char-pending-ctrl', 'a modified character is a replacement character', base, mrCancel('(', '<C-x>'));
add('replacement-char-pending-closest', 'mrm then a replacement', `x [a (b ${CUR}c) d] y\n`, mrCancel('m', '{'));
add('replacement-char-pending-multi', 'mr( then a replacement on several selections', `(a${CUR}) (b${CUR}) (c${CUR})\n`, mrCancel('(', '<lt>'), { primary: 2 });
add('replacement-char-pending-m', 'the replacement key m is a literal character', base, mrCancel('(', 'm'));
add('replacement-char-pending-space', 'the replacement key space is a character', base, mrCancel('(', '<space>'));

// ---- H. Unicode and line endings --------------------------------------------------------------------------------------------
add('unicode-emoji-inside', 'non-BMP content inside the pair (UTF-16 surrogate pairs)', `x (\u{1F600}a${CUR}\u{1F600}) y\n`, mr('('));
add('unicode-emoji-before-pair', 'a non-BMP character before the pair shifts UTF-16 offsets', `\u{1F600}\u{1F600} (a${CUR}) y\n`, mr('('));
add('unicode-emoji-old-key', 'a non-BMP old key pairs with itself', `a \u{1F600}b${CUR}c\u{1F600} d\n`, mr('\u{1F600}'));
add('unicode-guillemet-old-key', 'a guillemet is a literal self-pairing character', `a «${'b'}${CUR}c« d\n`, mr('«'));
add('unicode-guillemet-closing-not-alias', 'the closing guillemet is not an alias of the opening one', `a «b${CUR}c» d\n`, mrCancel('«'));
add('unicode-cjk-content', 'CJK content inside the pair', `x (日本${CUR}語) y\n`, mr('('));
add('unicode-fullwidth-paren-literal', 'fullwidth parentheses are not brackets', `x （a${CUR}b） y\n`, mrCancel('('));
add('unicode-fullwidth-paren-old-key', 'a fullwidth paren as old key is a self-pairing literal', `x （a${CUR}b（ y\n`, mr('（'));
add('unicode-zwj-cluster-before-closer', 'a ZWJ family cluster just before the closing delimiter', `x (a${CUR} \u{1F468}‍\u{1F469}‍\u{1F467}) y\n`, mr('('));
add('unicode-zwj-cluster-after-opener', 'a ZWJ family cluster just after the opening delimiter', `x (\u{1F468}‍\u{1F469}‍\u{1F467} a${CUR}) y\n`, mr('('));
add('unicode-combining-mark', 'a combining mark next to the delimiter', `x (é${CUR}) y\n`, mr('('));
add('unicode-combining-after-cursor', 'cursor on a base letter with a combining mark', `x (${CUR}éx) y\n`, mr('('));
add('unicode-multi-nonbmp-selections', 'several selections after non-BMP characters', `\u{1F600}(a${CUR}) \u{1F680}(b${CUR})\n`, mr('('), { primary: 1 });
add('unicode-nonbmp-cancel', 'Escape restores UTF-16 offsets after non-BMP characters', `\u{1F600} (a${CUR}\u{1F600}b) y\n`, mrCancel('(', '<esc>'));
add('crlf-pair-same-line', 'CRLF document, pair on one line', `x (a${CUR}b) y\r\nnext\r\n`, mr('('), { eol: 'crlf' });
add('crlf-pair-across-lines', 'CRLF document, pair across lines', `fn f(\r\n  a${CUR},\r\n) {}\r\n`, mr('('), { eol: 'crlf' });
add('crlf-cursor-on-line-break', 'the cursor on a CRLF line break inside the pair', `(a${CUR}\r\nb)\r\n`, mr('('), { eol: 'crlf' });
add('crlf-closest', 'CRLF mrm', `{\r\n  [a${CUR}]\r\n}\r\n`, mr('m'), { eol: 'crlf' });
add('crlf-cancel', 'CRLF Escape restores the original selection', `(a${CUR}\r\nb)\r\n`, mrCancel('(', '<esc>'), { eol: 'crlf' });
add('crlf-lone-cr-in-text', 'a lone CR is not a line break', `(a\rb${CUR})\n`, mr('('));
add('lf-text-crlf-config', 'LF text with a CRLF configuration', `(a${CUR}\nb)\n`, mr('('), { eol: 'crlf' });
add('crlf-multi', 'CRLF document, several selections', `(a${CUR})\r\n(b${CUR})\r\n`, mr('('), { eol: 'crlf', primary: 1 });
add('empty-lines-inside', 'empty lines inside the pair', `(\n\n${CUR}\n\n)\n`, mr('('));

// ---- I. syntax-aware lookup (root and injected languages) --------------------------------------------------------------------
const rust = (id, description, marked, steps, extra = {}) => add(`rust-${id}`, description, marked, steps, { language: 'rust', source: 'spec Surround edits and history; syntax-aware old-surround lookup', ...extra });
rust('closest-in-call', 'mrm inside a call', `fn f() { g(a, ${CUR}b); }\n`, mr('m'));
rust('closest-in-string-with-brackets', 'mrm inside a string that contains brackets', `fn f() { let s = "a (b ${CUR}c) d"; }\n`, mr('m'));
rust('closest-in-string-outside-brackets', 'mrm in a string, brackets only outside the string', `fn f() { g("a ${CUR}b"); }\n`, mr('m'));
rust('closest-in-comment', 'mrm inside a comment with brackets', `fn f() {\n    // see (a ${CUR}b)\n}\n`, mr('m'));
rust('closest-nested-blocks', 'mrm in nested blocks', `fn f() { if x { [1, ${CUR}2] } }\n`, mr('m'));
rust('closest-count-2', '2mrm in nested blocks', `fn f() { if x { [1, ${CUR}2] } }\n`, ['2mrm']);
rust('closest-char-literal', 'mrm near a char literal containing a bracket', `fn f() { let c = '('; g(${CUR}c); }\n`, mr('m'));
rust('closest-lifetime-tick', 'mrm near a lifetime tick', `fn f<'a>(x: &'a str${CUR}) {}\n`, mr('m'));
rust('paren-explicit', 'mr( with the cursor in a call', `fn f() { g(a, ${CUR}b); }\n`, mr('('));
rust('paren-explicit-bracket-in-string', 'mr( where an unbalanced ( sits inside a string', `fn f() { g("(", ${CUR}b); }\n`, mr('('));
rust('quote-cursor-on-string-quote', 'mr" with the cursor on the opening quote of a string', `fn f() { let s = ${CUR}"ab"; }\n`, mr('"'));
rust('quote-cursor-on-closing-quote', 'mr" with the cursor on the closing quote', `fn f() { let s = "ab${CUR}"; }\n`, mr('"'));
rust('quote-cursor-inside-string', 'mr" with the cursor inside the string', `fn f() { let s = "a${CUR}b"; }\n`, mr('"'));
rust('quote-escaped-quote-in-string', 'mr" with an escaped quote inside the string', `fn f() { let s = ${CUR}"a\\"b"; }\n`, mr('"'));
rust('quote-in-comment', 'mr" inside a comment', `fn f() {\n    // say "a ${CUR}b"\n}\n`, mr('"'));
rust('quote-apostrophe-in-comment', "mr' on an apostrophe in a comment", `fn f() {\n    // it${CUR}'s fine\n}\n`, mrCancel("'"));
rust('quote-multi-string-selections', 'mr" with a selection in each of two strings', `fn f() { g("a${CUR}", "b${CUR}"); }\n`, mr('"'), { primary: 1 });
rust('quote-cursor-on-quote-two-strings', 'mr" with the cursor on quotes of two different strings', `fn f() { g(${CUR}"a", ${CUR}"b"); }\n`, mr('"'));
rust('multi-closest', 'mrm with two selections in different constructs', `fn f() { g(a${CUR}); h[b${CUR}]; }\n`, mr('m'), { primary: 1 });
rust('multi-closest-two-calls', 'mrm with two selections in two different calls', `fn f() { g(a${CUR}); }\nfn h() { k(b${CUR}); }\n`, mr('m'), { primary: 1 });
rust('multi-in-string-and-code', 'mrm with one selection in a string and one in code', `fn f() { g("(a${CUR})", b${CUR}); }\n`, mr('m'));
rust('cancel-escape', 'Escape after a syntax-aware preview', `fn f() { g(a, ${CUR}b); }\n`, mrCancel('m', '<esc>'));
rust('cancel-tab-multi', 'a non-character key after a syntax-aware preview of two selections', `fn f() { g(a${CUR}); h[b${CUR}]; }\n`, mrCancel('m', '<tab>'), { primary: 1 });
rust('fail-no-enclosing', 'mrm outside of any bracket', `fn f() {}\nlet ${CUR}x = 1;\n`, mrCancel('m'));
rust('closest-unicode-string', 'mrm in a string with non-BMP characters', `fn f() { let s = "\u{1F600} (\u{1F600}${CUR}) "; }\n`, mr('m'));
rust('crlf-closest', 'CRLF rust document, mrm', `fn f() {\r\n    g(a${CUR});\r\n}\r\n`, mr('m'), { eol: 'crlf' });

const md = (id, description, marked, steps, extra = {}) => add(`markdown-${id}`, description, marked, steps, { language: 'markdown', source: 'spec Surround edits and history; injected-language old-surround lookup', ...extra });
const fence = (code) => `# T\n\n\`\`\`rust\n${code}\n\`\`\`\n\ntext (prose) here\n`;
md('injected-rust-closest', 'mrm inside a rust code block (injected language)', fence(`fn f() { g(a, ${CUR}b); }`), mr('m'));
md('injected-rust-paren', 'mr( inside a rust code block', fence(`fn f() { g(a, ${CUR}b); }`), mr('('));
md('injected-rust-string-with-brackets', 'mrm in a rust string with brackets inside a code block', fence(`fn f() { let s = "a (b ${CUR}c) d"; }`), mr('m'));
md('injected-rust-quote', 'mr" in a rust string inside a code block', fence(`fn f() { let s = "a${CUR}b"; }`), mr('"'));
md('injected-rust-quote-on-quote', 'mr" with the cursor on the string quote in the injected block', fence(`fn f() { let s = ${CUR}"ab"; }`), mr('"'));
md('injected-rust-comment', 'mrm in a rust comment inside a code block', fence(`fn f() {\n    // see (a ${CUR}b)\n}`), mr('m'));
md('injected-rust-count-2', '2mrm in a rust code block', fence(`fn f() { if x { [1, ${CUR}2] } }`), ['2mrm']);
md('injected-and-root-selections', 'two selections: one in the injected rust block, one in the markdown prose', `# T\n\n\`\`\`rust\nfn f() { g(a${CUR}); }\n\`\`\`\n\ntext (pro${CUR}se) here\n`, mr('m'), { primary: 1 });
md('root-prose-paren', 'mr( in markdown prose', fence(`fn f() {}`).replace('text (prose)', `text (pro${CUR}se)`), mr('('));
md('root-link-brackets', 'mrm in a markdown link', `see [the ${CUR}docs](http://example.com/a_(b)) now\n`, mr('m'));
md('root-link-url-parens', 'mr( in the url of a markdown link', `see [docs](http://example.com/a_(b${CUR})) now\n`, mr('('));
md('root-code-span-brackets', 'mrm in a markdown code span', `use \`f(a, ${CUR}b)\` here\n`, mr('m'));
md('injected-cancel-escape', 'Escape after a preview in an injected block', fence(`fn f() { g(a, ${CUR}b); }`), mrCancel('m', '<esc>'));
md('injected-crlf', 'CRLF markdown with an injected block', fence(`fn f() { g(a, ${CUR}b); }`).replace(/\n/g, '\r\n'), mr('m'), { eol: 'crlf' });
md('injected-unterminated-fence', 'an unterminated code fence', `# T\n\n\`\`\`rust\nfn f() { g(a, ${CUR}b); }\n`, mr('m'));
md('injected-unknown-language', 'a code fence of an unknown language has no injection', `# T\n\n\`\`\`nosuchlang\nf(a, ${CUR}b)\n\`\`\`\n`, mr('m'));

const html = (id, description, marked, steps, extra = {}) => add(`html-${id}`, description, marked, steps, { language: 'html', source: 'spec Surround edits and history; injected-language old-surround lookup', ...extra });
html('script-js-closest', 'mrm in a script element (injected javascript)', `<div>\n<script>\n  f("a (b", ${CUR}c);\n</script>\n</div>\n`, mr('m'));
html('script-js-string-quote', 'mr" on a javascript string quote in a script element', `<script>\n  var s = ${CUR}"a b";\n</script>\n`, mr('"'));
html('script-js-template-literal', 'mr` in a javascript template literal', `<script>\n  var s = \`a ${CUR}b\`;\n</script>\n`, mr('`'));
html('style-css-closest', 'mrm in a style element (injected css)', `<style>\n  a { color: rgb(1, ${CUR}2, 3); }\n</style>\n`, mr('m'));
html('attribute-quotes', 'mr" in an html attribute value', `<a href="x${CUR}y">t</a>\n`, mr('"'));
html('attribute-quote-cursor-on-quote', 'mr" with the cursor on an attribute quote', `<a href=${CUR}"xy">t</a>\n`, mr('"'));
html('text-parens', 'mr( in html text', `<p>a (b ${CUR}c) d</p>\n`, mr('('));
html('multi-script-and-text', 'one selection in the script and one in the text', `<p>a (b${CUR})</p>\n<script>\n  f(x${CUR});\n</script>\n`, mr('m'));
html('cancel-in-script', 'Escape after a preview inside a script element', `<script>\n  f(a, ${CUR}b);\n</script>\n`, mrCancel('m', '<esc>'));

const lang = (l, id, description, marked, steps, extra = {}) => add(`${l}-${id}`, description, marked, steps, { language: l, source: 'spec Surround edits and history; syntax-aware old-surround lookup', ...extra });
lang('javascript', 'string-with-brackets', 'mrm in a javascript string with brackets', `f("a (b ${CUR}c) d", e);\n`, mr('m'));
lang('javascript', 'template-literal-quote', 'mr` inside a template literal', `const s = \`a ${CUR}b\`;\n`, mr('`'));
lang('javascript', 'regex-with-bracket', 'mrm near a regex literal containing a bracket', `const r = /[(]/; g(${CUR}x);\n`, mr('m'));
lang('json', 'array-in-object', 'mrm in a json array in an object', `{"a": [1, ${CUR}2], "b": "(x)"}\n`, mr('m'));
lang('json', 'quote-key', 'mr" on a json key', `{"${CUR}key": 1}\n`, mr('"'));
lang('json', 'cursor-on-quote', 'mr" with the cursor on a json string quote', `{"k": ${CUR}"v"}\n`, mr('"'));
lang('toml', 'array', 'mrm in a toml array', `a = [1, ${CUR}2]\nb = "(x)"\n`, mr('m'));
lang('toml', 'string-quote', 'mr" in a toml string', `a = "x${CUR}y"\n`, mr('"'));
lang('python', 'string-brackets', 'mrm in a python string with brackets', `f("a (b ${CUR}c) d", e)\n`, mr('m'));
lang('python', 'triple-quote', 'mr" in a triple-quoted python string', `s = """a ${CUR}b"""\n`, mr('"'));
lang('python', 'comment-brackets', 'mrm in a python comment', `# see (a ${CUR}b)\nx = 1\n`, mr('m'));
lang('c', 'char-literal-bracket', 'mrm near a C char literal', `void f() { char c = '('; g(${CUR}c); }\n`, mr('m'));
lang('c', 'string-quote', 'mr" in a C string', `char *s = "a${CUR}b";\n`, mr('"'));
lang('typescript', 'generic-angle', 'mr< in a typescript generic', `let x: Array<Map<string, ${CUR}number>> = [];\n`, mr('<lt>'));
lang('typescript', 'generic-closest', 'mrm in a typescript generic', `let x: Array<Map<string, ${CUR}number>> = [];\n`, mr('m'));
lang('rust', 'generic-angle', 'mr< in a rust generic', `fn f(x: Vec<Option<${CUR}u8>>) {}\n`, mr('<lt>'));
lang('rust', 'generic-angle-close-key', 'mr> in a rust generic', `fn f(x: Vec<Option<${CUR}u8>>) {}\n`, mr('<gt>'));
lang('rust', 'comparison-angle', 'mr< around a comparison operator', `fn f() { if a < ${CUR}b { } }\n`, mrCancel('<lt>'));

// ---- J. syntax unavailable: plaintext fallback ------------------------------------------------------------------------------
add('failure-initial-parse-closest', 'a rust document without a syntax tree (failed initial parse) uses the plaintext lookup', `fn f() { let s = "a (b ${CUR}c) d"; }\n`, mr('m'), { language: 'rust', failure: { kind: 'initial-parse' }, source: 'spec Syntax lifecycle contract; surround without syntax' });
add('failure-initial-parse-quote', 'a failed initial parse: mr" on a quote falls back to the plaintext matching', `fn f() { let s = ${CUR}"ab"; }\n`, mr('"'), { language: 'rust', failure: { kind: 'initial-parse' }, source: 'spec Syntax lifecycle contract; surround without syntax' });
add('failure-initial-parse-cancel', 'a failed initial parse: Escape restores', `fn f() { g(a, ${CUR}b); }\n`, mrCancel('m', '<esc>'), { language: 'rust', failure: { kind: 'initial-parse' }, source: 'spec Syntax lifecycle contract; surround without syntax' });

const doc = {
  schemaVersion: 1,
  group: 'surround-replace-preview',
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
