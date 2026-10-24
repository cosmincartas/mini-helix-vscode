#!/usr/bin/env node
// Generates the INPUTS of test/fixtures/helix-match/cases/surround-delete.json (Task 15: `md<char>`, the delete transaction).
// `expected` is never written here: run `npm run test:match:oracle -- --filter surround-delete --update`.
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
const SRC = 'spec Surround edits (md retains reference all-selection validation); Object inventory (m); Pending input and ordering (md)';
function add(id, description, marked, steps, extra = {}) {
  if (seen.has(id)) throw new Error(`duplicate id ${id}`);
  seen.add(id);
  const { text, selections } = parse(marked);
  const input = { text, selections, steps };
  if (extra.primary !== undefined) input.primary = extra.primary;
  if (extra.eol) input.eol = extra.eol;
  if (extra.language) input.language = extra.language;
  if (extra.failure) input.failure = extra.failure;
  if (extra.queryOverrides) input.queryOverrides = extra.queryOverrides;
  cases.push({ id, description, source: extra.source || SRC, tags: extra.tags || [], input });
}
const del = (ch) => [`md${ch}`];

// ---- A. every pair and alias (plaintext) ----------------------------------------------------------------------------------------
for (const [open, close, lo, lc] of [['(', ')', '(', ')'], ['[', ']', '[', ']'], ['{', '}', '{', '}'], ['<lt>', '<gt>', '<', '>']]) {
  const t = `a ${lo}b${CUR}c${lc} d\n`;
  add(`pair-${lo.charCodeAt(0)}-open`, `md${lo} deletes the pair via its opening key`, t, del(open));
  add(`pair-${lo.charCodeAt(0)}-close`, `md with the closing alias of ${lo} deletes the same pair`, t, del(close));
  add(`pair-${lo.charCodeAt(0)}-closest`, `mdm deletes the closest ${lo}${lc} pair`, t, del('m'));
}
for (const q of ['"', "'", '`', '|']) {
  const name = { '"': 'dquote', "'": 'squote', '`': 'backtick', '|': 'pipe' }[q];
  add(`quote-${name}`, `identical delimiters ${q} deleted`, `a ${q}b${CUR}c${q} d\n`, del(q));
  add(`quote-${name}-closest`, `mdm over identical delimiters ${q}: lookup outcome as the reference decides`, `a ${q}b${CUR}c${q} d\n`, del('m'));
  add(`quote-${name}-cursor-on-opener`, `cursor on the opening ${q}`, `a ${CUR}${q}bc${q} d\n`, del(q));
  add(`quote-${name}-cursor-on-closer`, `cursor on the closing ${q}`, `a ${q}bc${CUR}${q} d\n`, del(q));
  add(`quote-${name}-no-pair`, `a single ${q} has no pair: reference error, nothing deleted`, `a ${q}b${CUR}c d\n`, del(q));
}
for (const [id, ch, lit] of [['star', '*', '*'], ['underscore', '_', '_'], ['slash', '/', '/'], ['space', '<space>', ' '], ['digit', '3', '3'], ['letter', 'x', 'x']]) {
  add(`literal-${id}`, `a character without a pinned pair pairs with itself: md${ch}`, `a ${lit}b${CUR}c${lit} d\n`, del(ch));
  add(`literal-${id}-no-pair`, `md${ch} with no such delimiter: error`, `a (b${CUR}c) d\n`, del(ch));
}
add('m-closest-paren', 'mdm picks the closest of different pair types', `x [a (b ${CUR}c) d] y\n`, del('m'));
add('m-closest-outer', 'mdm from outside the inner pair deletes the outer pair', `x [a ${CUR}(b c) d] y\n`, del('m'));
add('m-no-pair', 'mdm without any surrounding pair: error, nothing deleted', `plain ${CUR}text\n`, del('m'));
add('explicit-no-pair', 'md( without any surrounding pair: error', `plain ${CUR}text\n`, del('('));
add('explicit-wrong-pair', 'md( inside brackets only: error', `[a ${CUR}b]\n`, del('('));
add('explicit-closing-no-pair', 'md) without a pair', `x ${CUR}y\n`, del(')'));
add('explicit-skips-other-pair', 'md[ skips an enclosed pair of another type', `[a (b ${CUR}c) d]\n`, del('['));

// ---- B. modified and non-character keys ---------------------------------------------------------------------------------------
const base = `x (a ${CUR}b) y [c ${CUR}d]\n`;
const one = `x (a ${CUR}b) y\n`;
add('mod-ctrl-paren', 'md<C-(> is the character ( whatever its modifiers', one, ['md<C-(>']);
add('mod-alt-close', 'md<A-)> is the character )', one, ['md<A-)>']);
add('mod-ctrl-alt-brace', 'md<C-A-{> against parentheses: error', one, ['md<C-A-{>']);
add('mod-ctrl-m', 'md<C-m> is the closest-pair key m? (a character key whatever its modifiers)', one, ['md<C-m>']);
add('mod-alt-m', 'md<A-m> as the closest-pair key', one, ['md<A-m>']);
add('mod-ctrl-lt', 'md<C-lt> against angle brackets', `x <a ${CUR}b> y\n`, ['md<C-lt>']);
add('mod-shift-char', 'md<S-(>', one, ['md<S-(>']);
add('mod-ctrl-space', 'md<C-space> deletes a space-delimited pair', `a b${CUR}c d\n`, ['md<C-space>']);
for (const [id, key] of [['tab', '<tab>'], ['enter', '<ret>'], ['left', '<left>'], ['ctrl-left', '<C-left>'], ['backspace', '<backspace>'], ['home', '<home>'], ['end', '<end>'], ['up', '<up>'], ['shift-enter', '<S-ret>'], ['ctrl-enter', '<C-ret>'], ['right', '<right>'], ['down', '<down>']]) {
  add(`nonchar-${id}`, `${key} after md consumes the callback with no edit and no status`, base, ['md' + key], { primary: 1 });
}
add('nonchar-then-command', 'after a consumed callback the session is over: a new command works', base, ['md<tab>', 'mi(']);
add('escape-cancels', 'Escape after md cancels the pending phase', base, ['md<esc>']);
add('escape-then-delete', 'Escape then a complete md', one, ['md<esc>', 'md(']);
add('count-then-escape', 'a count then md then Escape', one, ['2md<esc>']);

// ---- C. Unicode ----------------------------------------------------------------------------------------------------------------------
add('unicode-emoji-delimiters', 'a non-BMP surround character (two UTF-16 code units per delimiter)', `a \u{1F600}b${CUR}c\u{1F600} d\n`, del('\u{1F600}'));
add('unicode-emoji-delimiters-closest', 'mdm does not treat a non-BMP character as a pair', `a \u{1F600}b${CUR}c\u{1F600} d\n`, del('m'));
add('unicode-emoji-key-no-pair', 'a non-BMP key with no such delimiter: error', `a (b${CUR}c) d\n`, del('\u{1F680}'));
add('unicode-text-before-and-inside', 'non-BMP text before and inside the pair shifts UTF-16 offsets', `\u{1F600}\u{1F600} (a\u{1F680}${CUR}b) \u{1F600}y\n`, del('('));
add('unicode-multi-nonbmp-selections', 'several selections after non-BMP characters', `\u{1F600}(a${CUR}) \u{1F680}(b${CUR})\n`, del('('), { primary: 1 });
add('unicode-guillemet', 'a guillemet is a literal self-pairing surround character', `x «a ${CUR}b« y\n`, del('«'));
add('unicode-cjk', 'a CJK surround character', `x 日日本${CUR}語日 y\n`, del('日'));
add('unicode-cjk-text-in-parens', 'CJK text inside parentheses', `x (日本${CUR}語) y\n`, del('('));
add('unicode-fullwidth-no-pair', 'a fullwidth bracket is a literal, not the ASCII pair', `x (a ${CUR}b) y\n`, del('（'));
add('unicode-zwj-cluster-adjacent', 'ZWJ clusters next to the delimiters', `x (\u{1F468}‍\u{1F469}‍\u{1F467} a${CUR} \u{1F468}‍\u{1F469}‍\u{1F467}) y\n`, del('('));
add('unicode-combining-adjacent', 'combining marks next to the delimiters', `x (é${CUR}x́) y\n`, del('m'));
add('unicode-combining-key', 'a lone combining mark as the surround character', `x (a ${CUR}b) y\n`, del('́'));

// ---- D. nested pairs, closest and counts -------------------------------------------------------------------------------------------------
add('nested-same-closest', 'md( with nested parentheses deletes the closest pair', `((a ${CUR}b) c)\n`, del('('));
add('nested-same-count-2', '2md( deletes the outer pair', `((a ${CUR}b) c)\n`, ['2md(']);
add('nested-deep-count-3', '3md( deletes the outermost of three levels', `(1 (2 (3 ${CUR}x 3) 2) 1)\n`, ['3md(']);
add('nested-deep-count-2', '2md( deletes the middle of three levels', `(1 (2 (3 ${CUR}x 3) 2) 1)\n`, ['2md(']);
add('nested-closest-count-2', '2mdm deletes the second closest pair', `x [a (b ${CUR}c) d] y\n`, ['2mdm']);
add('nested-closest-count-3-mixed', '3mdm among three mixed levels', `{x [a (b ${CUR}c) d] y}\n`, ['3mdm']);
add('nested-closest-count-too-large', 'a count beyond the nesting: reference error, nothing deleted', `x [a (b ${CUR}c) d] y\n`, ['3mdm']);
add('nested-count-too-large-explicit', '3md( with two levels: error', `((a ${CUR}b) c)\n`, ['3md(']);
add('nested-count-huge', '99md( : error', `((a ${CUR}b) c)\n`, ['99md(']);
add('nested-count-digits-10', '10md( with ten levels', `${'('.repeat(10)}${CUR}x${')'.repeat(10)}\n`, ['10md(']);
add('nested-closest-braces-in-parens', 'mdm among mixed nested pairs', `f(a, {b, [c${CUR}]})\n`, del('m'));
add('nested-other-pair-skipped-count', '2md[ skips pairs of other types when counting', `[a [b (c ${CUR}d) e] f]\n`, ['2md[']);
add('nested-multi-closest', 'two selections whose closest pairs are nested: sorted interleaved deletions', `(a ${CUR}x (b ${CUR}y) c)\n`, del('m'));
add('nested-multi-explicit', 'two selections of the same nested parentheses: shared outer pair is a reference error', `(a ${CUR}x (b ${CUR}y) c)\n`, del('('));
add('nested-multi-explicit-count-2', 'one selection in the inner pair, count 2 reaches the outer pair; the other selection also in the outer: shared', `(a ${CUR}x (b ${CUR}y) c)\n`, ['2md(']);
add('nested-multi-three-levels', 'three selections in three nested levels with closest pairs', `(a [b {c ${CUR}x} ${CUR}y] ${CUR}z)\n`, del('m'));
add('nested-multi-three-levels-counted', '2mdm with selections in nested levels: shared pair error or success as the reference decides', `(a [b {c ${CUR}x} ${CUR}y] ${CUR}z)\n`, ['2mdm']);
add('nested-multi-disjoint-nested-sorted', 'nested pairs in two selections with different types: edits must be sorted', `([a ${CUR}x] {b ${CUR}y})\n`, del('m'));
add('nested-adjacent-pairs', 'adjacent pairs )( with one cursor', `(a)${CUR}(b)\n`, del('('));
add('nested-empty-pair-on-opener', 'an empty pair, cursor on the opener', `x ${CUR}() y\n`, del('('));
add('nested-empty-pair-on-closer', 'an empty pair, cursor on the closer', `x (${CUR}) y\n`, del('('));
add('nested-delimiters-touching', 'the closing delimiter of one pair touches the opening of the next', `(a${CUR})(b${CUR})\n`, del('('));
add('nested-multiline', 'a pair spanning lines', `fn x(\n  a,\n  ${CUR}b,\n) {}\n`, del('('));
add('nested-multiline-closest', 'mdm over lines', `{\n  [\n    ${CUR}x\n  ]\n}\n`, del('m'));
add('nested-multiline-count-2', '2mdm over lines', `{\n  [\n    ${CUR}x\n  ]\n}\n`, ['2mdm']);

// ---- E. selections: shared, mixed success/failure, primary, direction ----------------------------------------------------------------------------
add('cursor-on-opener', 'cursor on the opening bracket', `x ${CUR}(b c) y\n`, del('('));
add('cursor-on-closer', 'cursor on the closing bracket', `x (b c${CUR}) y\n`, del('('));
add('cursor-after-opener', 'cursor right after the opening bracket', `x (${CUR}b c) y\n`, del('('));
add('cursor-before-closer', 'cursor right before the closing bracket', `x (b c${CUR}) y\n`, del('('));
add('range-inside', 'a range inside the pair', `x (a ${FS}b c${FE} d) y\n`, del('('));
add('range-covering-content', 'a range covering exactly the content', `x (${FS}b c${FE}) y\n`, del('('));
add('range-reversed-covering-content', 'a backward range covering exactly the content', `x (${BH}b c${BA}) y\n`, del('('));
add('range-covering-with-delimiters-closest', 'a selection covering a pair finds the enclosing pair', `x [a ${FS}(b c)${FE} d] y\n`, del('m'));
add('range-covering-pair-no-enclosing', 'a range covering the whole pair has no enclosing pair: error', `x ${FS}(b c)${FE} y\n`, del('m'));
add('range-reversed', 'a backward selection inside the pair', `x (a ${BH}b c${BA} d) y\n`, del('('));
add('range-reversed-quotes', 'a backward selection inside quotes', `x "a ${BH}b c${BA} d" y\n`, del('"'));
add('range-spanning-two-pairs', 'a range spanning two pairs: no enclosing pair', `(a ${FS}b) (c${FE} d)\n`, del('('));
add('multi-two', 'two selections in two pairs', `(a${CUR}) (b${CUR})\n`, del('('), { primary: 0 });
add('multi-two-primary-last', 'two selections, the primary is the last', `(a${CUR}) (b${CUR})\n`, del('('), { primary: 1 });
add('multi-three-primary-middle', 'three selections, the primary is the middle one', `(a${CUR}) (b${CUR}) (c${CUR})\n`, del('('), { primary: 1 });
add('multi-three-primary-last', 'three selections, the primary is the last', `(a${CUR}) (b${CUR}) (c${CUR})\n`, del('('), { primary: 2 });
add('multi-four-primary-3', 'four selections, the primary is the fourth', `(a${CUR}) (b${CUR}) (c${CUR}) (d${CUR})\n`, del('('), { primary: 3 });
add('multi-mixed-ranges-and-cursors', 'ranges and cursors mixed, primary second', `(${FS}a b${FE}) [${CUR}c] {d ${BH}e${BA}}\n`, del('m'), { primary: 1 });
add('multi-different-types-closest', 'm lets each selection pick its own pair type', `(a${CUR}) [b${CUR}] {c${CUR}}\n`, del('m'), { primary: 2 });
add('multi-different-types-explicit-fails', 'md( with a [ pair among the selections: the whole command fails, nothing deleted', `(a${CUR}) [b${CUR}] (c${CUR})\n`, del('('), { primary: 1 });
add('multi-reversed-and-forward', 'a backward and a forward selection in two pairs', `(${BH}a${BA}) (${FS}b${FE})\n`, del('('), { primary: 1 });
add('multi-overlapping-selections-merge', 'overlapping selections merge before the lookup', `(a ${FS}b ${FS}c${FE} d${FE})\n`, del('('));
add('multi-touching-selections', 'touching selections', `(${FS}ab${FE}${FS}cd${FE})\n`, del('('));
add('multi-same-pair-overlap-error', 'two selections inside the same pair: CursorOverlap error, nothing deleted', `(a${CUR} b${CUR})\n`, del('('));
add('multi-same-pair-overlap-closest', 'two selections inside the same pair with mdm: error', `(a${CUR} b${CUR})\n`, del('m'));
add('multi-same-open-different-close-shared', 'three selections, two share a pair: whole command fails', `(a${CUR} b${CUR}) (c${CUR})\n`, del('('), { primary: 2 });
add('multi-one-without-pair-fails', 'one selection without a pair fails the whole command: no partial deletion', `(a${CUR}) b${CUR}\n`, del('('));
add('multi-last-without-pair-fails', 'the last of three selections has no pair: no partial deletion', `(a${CUR}) (b${CUR}) c${CUR}\n`, del('('), { primary: 1 });
add('multi-first-without-pair-fails', 'the first of three selections has no pair: no partial deletion', `a${CUR} (b${CUR}) (c${CUR})\n`, del('('), { primary: 2 });
add('multi-middle-without-pair-fails', 'the middle of three selections has no pair', `(a${CUR}) b${CUR} (c${CUR})\n`, del('m'), { primary: 0 });
add('multi-one-wrong-type-fails-closest-ok', 'the same layout succeeds with mdm', `(a${CUR}) [b${CUR}] {c${CUR}}\n`, del('m'));
add('multi-shared-closest-after-count', '2mdm with one selection having no second level: failure, no partial deletion', `((a${CUR})) (b${CUR})\n`, ['2mdm']);
add('multi-shared-delimiter-nested-counts', 'selections whose pairs overlap through a shared closing delimiter', `(a (b${CUR}) c${CUR})\n`, del('m'));
add('multi-error-then-retry', 'a failed md leaves the document unchanged; the next md with a character that works edits', `(a${CUR}) [b${CUR}]\n`, ['md(', 'mdm']);
add('multi-failure-keeps-selection', 'the failed command leaves the selection set, including its primary, unchanged', `(a${CUR}) x${CUR} (c${CUR})\n`, del('('), { primary: 2 });

// ---- F. sequences ------------------------------------------------------------------------------------------------------------------------
add('seq-delete-twice', 'two consecutive deletions: the second runs on the edited text', `((a ${CUR}b) c)\n`, ['md(', 'md(']);
add('seq-delete-then-object', 'a text object command after a deletion', `x [(a ${CUR}b)] y\n`, ['md(', 'mi[']);
add('seq-delete-then-add', 'surround add after a deletion', `x (a ${CUR}b) y\n`, ['md(', 'ms{']);
add('seq-add-then-delete', 'delete the surround just added', `x ${FS}ab${FE} y\n`, ['ms(', 'md(']);
add('seq-count-then-closest', 'a counted deletion then a closest deletion', `{x [a (b ${CUR}c) d] y}\n`, ['2mdm', 'mdm']);
add('seq-multi-twice', 'two deletions with three nested-level selections', `((a${CUR})) ((b${CUR})) ((c${CUR}))\n`, ['md(', 'md('], { primary: 1 });
add('seq-failure-then-success', 'a failing md then a succeeding md', `(a${CUR}) b${CUR}\n`, ['md(', 'md[']);
add('seq-delete-then-edit', 'a deletion then an ordinary edit key', `x (a ${CUR}b) y\n`, ['md(', 'x']);

// ---- G. boundaries and line endings ----------------------------------------------------------------------------------------------------
add('bof-eof-no-newline', 'a pair at the very start and end of the text, no final newline', `(a${CUR}b)`, del('('));
add('bof-eof-with-newline', 'a pair at the start, final newline', `(a${CUR}b)\n`, del('('));
add('only-pair-empty-cursor-on-opener', 'a text of just an empty pair', `${CUR}()`, del('('));
add('only-pair-empty-closest', 'a text of just an empty pair, mdm', `${CUR}()`, del('m'));
add('crlf-same-line', 'CRLF document, pair on one line', `x (a${CUR}b) y\r\nnext\r\n`, del('('), { eol: 'crlf' });
add('crlf-across-lines', 'CRLF document, pair across lines', `fn f(\r\n  a${CUR},\r\n) {}\r\n`, del('('), { eol: 'crlf' });
add('crlf-cursor-on-line-break', 'the cursor on a CRLF line break inside the pair', `(a${CUR}\r\nb)\r\n`, del('('), { eol: 'crlf' });
add('crlf-closest-multi', 'CRLF document, several selections', `(a${CUR})\r\n(b${CUR})\r\n`, del('m'), { eol: 'crlf', primary: 1 });
add('crlf-delimiter-at-line-end', 'delimiters next to CRLF line ends', `(\r\n${CUR}a\r\n)\r\n`, del('('), { eol: 'crlf' });
add('crlf-emoji-delimiter', 'CRLF document, non-BMP surround character', `x \u{1F600}a${CUR}b\u{1F600}\r\n(c)\r\n`, del('\u{1F600}'), { eol: 'crlf' });
add('crlf-lone-cr-in-text', 'a lone CR is not a line break', `(a\rb${CUR})\n`, del('('));
add('lf-text-crlf-config', 'LF text with a CRLF configuration', `(a${CUR}\nb)\n`, del('('), { eol: 'crlf' });
add('crlf-failure', 'CRLF: a failing lookup leaves the document', `a${CUR}\r\nb\r\n`, del('('), { eol: 'crlf' });

// ---- H. syntax-aware lookup (root and injected languages) -----------------------------------------------------------------------------------
const src = 'spec Surround edits; syntax-aware old-surround lookup (get_surround_pos), delete';
const rust = (id, description, marked, steps, extra = {}) => add(`rust-${id}`, description, marked, steps, { language: 'rust', source: src, ...extra });
rust('closest-in-call', 'mdm inside a call', `fn f() { g(a, ${CUR}b); }\n`, del('m'));
rust('closest-in-string-with-brackets', 'mdm inside a string that contains brackets', `fn f() { let s = "a (b ${CUR}c) d"; }\n`, del('m'));
rust('paren-in-string-with-brackets', 'md( inside a string that contains brackets', `fn f() { let s = "a (b ${CUR}c) d"; }\n`, del('('));
rust('closest-in-comment', 'mdm inside a comment with brackets', `fn f() {\n    // see (a ${CUR}b)\n}\n`, del('m'));
rust('closest-nested-blocks-count-2', '2mdm in nested blocks', `fn f() { if x { [1, ${CUR}2] } }\n`, ['2mdm']);
rust('closest-char-literal', 'mdm near a char literal containing a bracket', `fn f() { let c = '('; g(${CUR}c); }\n`, del('m'));
rust('closest-lifetime-tick', 'mdm near a lifetime tick', `fn f<'a>(x: &'a str${CUR}) {}\n`, del('m'));
rust('quote-cursor-inside-string', 'md" with the cursor inside the string', `fn f() { let s = "a${CUR}b"; }\n`, del('"'));
rust('quote-cursor-on-opening-quote', 'md" with the cursor on the opening quote', `fn f() { let s = ${CUR}"ab"; }\n`, del('"'));
rust('quote-escaped-quote-in-string', 'md" with an escaped quote inside the string', `fn f() { let s = ${CUR}"a\\"b"; }\n`, del('"'));
rust('quote-two-strings-multi', 'md" with a selection in each of two strings', `fn f() { g("a${CUR}", "b${CUR}"); }\n`, del('"'), { primary: 1 });
rust('paren-with-bracket-in-string', 'md( where an unbalanced ( sits in a string', `fn f() { g("(", ${CUR}b); }\n`, del('('));
rust('multi-closest-two-constructs', 'mdm with two selections in different constructs', `fn f() { g(a${CUR}); h[b${CUR}]; }\n`, del('m'), { primary: 1 });
rust('multi-shared-error', 'two selections in one call: shared pair error', `fn f() { g(a${CUR}, b${CUR}); }\n`, del('('));
rust('multi-one-in-string-one-outside', 'one selection in a string, one in code: lookup as the reference decides, whole-command failure included', `fn f() { g("a${CUR}"); h(b${CUR}); }\n`, del('('));
rust('generic-angle', 'md< in a rust generic', `fn f(x: Vec<Option<${CUR}u8>>) {}\n`, del('<lt>'));
rust('generic-angle-count-2', '2md< in a rust generic', `fn f(x: Vec<Option<${CUR}u8>>) {}\n`, ['2md<lt>']);
rust('crlf-closest', 'CRLF rust document', `fn f() {\r\n    g(a${CUR});\r\n}\r\n`, del('m'), { eol: 'crlf' });
rust('unicode-string', 'mdm in a string with non-BMP characters', `fn f() { let s = "\u{1F600} (\u{1F600}${CUR}) "; }\n`, del('m'));
rust('nonchar-key', 'a non-character key after md on a syntax document', `fn f() { g(a, ${CUR}b); }\n`, ['md<tab>']);
rust('modifier-key', 'a modified character key on a syntax document', `fn f() { g(a, ${CUR}b); }\n`, ['md<C-(>']);
rust('whitespace-only-closest', 'a whitespace-only document with the cursor in the leading whitespace (the debug-only overflow guard): no pair', `    ${CUR}\n`, del('m'));
rust('whitespace-only-explicit', 'a whitespace-only document: md(', `  ${CUR}  \n`, del('('));
rust('empty-document', 'an empty rust document', `${CUR}`, del('m'));

const md = (id, description, marked, steps, extra = {}) => add(`markdown-${id}`, description, marked, steps, { language: 'markdown', source: src, ...extra });
const fence = (code) => `# T\n\n\`\`\`rust\n${code}\n\`\`\`\n\ntext (prose) here\n`;
md('injected-rust-closest', 'mdm inside a rust code block', fence(`fn f() { g(a, ${CUR}b); }`), del('m'));
md('injected-rust-string-with-brackets', 'mdm in a rust string with brackets inside a code block', fence(`fn f() { let s = "a (b ${CUR}c) d"; }`), del('m'));
md('injected-rust-quote', 'md" in a rust string inside a code block', fence(`fn f() { let s = "a${CUR}b"; }`), del('"'));
md('injected-rust-count-2', '2mdm in a rust code block', fence(`fn f() { if x { [1, ${CUR}2] } }`), ['2mdm']);
md('injected-and-root-selections', 'one selection in the injected rust block, one in the markdown prose', `# T\n\n\`\`\`rust\nfn f() { g(a${CUR}); }\n\`\`\`\n\ntext (pro${CUR}se) here\n`, del('m'), { primary: 1 });
md('injected-and-root-selections-explicit', 'the same layout with md(', `# T\n\n\`\`\`rust\nfn f() { g(a${CUR}); }\n\`\`\`\n\ntext (pro${CUR}se) here\n`, del('('));
md('root-prose-paren', 'md( in markdown prose', fence(`fn f() {}`).replace('text (prose)', `text (pro${CUR}se)`), del('('));
md('root-link-url-parens', 'md( in the url of a markdown link', `see [docs](http://example.com/a_(b${CUR})) now\n`, del('('));
md('root-link-url-parens-count-2', '2md( in the url of a markdown link', `see [docs](http://example.com/a_(b${CUR})) now\n`, ['2md(']);
md('root-code-span-brackets', 'mdm in a markdown code span', `use \`f(a, ${CUR}b)\` here\n`, del('m'));
md('injected-crlf', 'CRLF markdown with an injected block', fence(`fn f() { g(a, ${CUR}b); }`).replace(/\n/g, '\r\n'), del('m'), { eol: 'crlf' });
md('injected-failure-shared', 'two selections in one injected call: shared pair error', fence(`fn f() { g(a${CUR}, b${CUR}); }`), del('('));

const html = (id, description, marked, steps, extra = {}) => add(`html-${id}`, description, marked, steps, { language: 'html', source: src, ...extra });
html('script-js-closest', 'mdm in a script element (injected javascript)', `<div>\n<script>\n  f("a (b", ${CUR}c);\n</script>\n</div>\n`, del('m'));
html('script-js-string-quote', 'md" on a javascript string in a script element', `<script>\n  var s = ${CUR}"a b";\n</script>\n`, del('"'));
html('script-js-template-literal', 'md` in a javascript template literal', `<script>\n  var s = \`a ${CUR}b\`;\n</script>\n`, del('`'));
html('style-css-closest', 'mdm in a style element (injected css)', `<style>\n  a { color: rgb(1, ${CUR}2, 3); }\n</style>\n`, del('m'));
html('style-css-count-2', '2mdm in a style element', `<style>\n  a { color: rgb(1, ${CUR}2, 3); }\n</style>\n`, ['2mdm']);
html('attribute-quotes', 'md" in an html attribute value', `<a href="x${CUR}y">t</a>\n`, del('"'));
html('multi-script-and-text', 'one selection in the script and one in the text', `<p>a (b${CUR})</p>\n<script>\n  f(x${CUR});\n</script>\n`, del('m'));
html('multi-script-and-text-explicit', 'the same layout with md(', `<p>a (b${CUR})</p>\n<script>\n  f(x${CUR});\n</script>\n`, del('('));

const lang = (l, id, description, marked, steps, extra = {}) => add(`${l}-${id}`, description, marked, steps, { language: l, source: src, ...extra });
lang('javascript', 'string-with-brackets', 'mdm in a javascript string with brackets', `f("a (b ${CUR}c) d", e);\n`, del('m'));
lang('json', 'array-in-object', 'mdm in a json array in an object', `{"a": [1, ${CUR}2], "b": "(x)"}\n`, del('m'));
lang('json', 'array-in-object-count-2', '2mdm in a json array in an object', `{"a": [1, ${CUR}2], "b": "(x)"}\n`, ['2mdm']);
lang('json', 'quote-key', 'md" on a json key', `{"${CUR}key": 1}\n`, del('"'));
lang('toml', 'array', 'mdm in a toml array', `a = [1, ${CUR}2]\nb = "(x)"\n`, del('m'));
lang('python', 'string-brackets', 'mdm in a python string with brackets', `f("a (b ${CUR}c) d", e)\n`, del('m'));
lang('python', 'comment-brackets', 'mdm in a python comment', `# see (a ${CUR}b)\nx = 1\n`, del('m'));
lang('c', 'char-literal-bracket', 'mdm near a C char literal', `void f() { char c = '('; g(${CUR}c); }\n`, del('m'));
lang('tsx', 'jsx-expression-brackets', 'mdm in a tsx expression container', `const x = <a b={f("(", ${CUR}c)}>t</a>;\n`, del('m'));
lang('jsx', 'string-attr-quote', 'md" in a jsx attribute string', `const x = <a b="p${CUR}q">t</a>;\n`, del('"'));
lang('bash', 'string-brackets', 'mdm in a bash string with brackets', `echo "a (b ${CUR}c) d" $(ls ${CUR})\n`, del('m'));
lang('bash', 'command-substitution', 'md( in a bash command substitution', `x=$(ls ${CUR}-l)\n`, del('('));
lang('c-sharp', 'generic-and-call', 'mdm in a c# generic and call', `var x = new List<Dictionary<string, ${CUR}int>>();\n`, del('m'));
lang('typescript', 'generic-closest', 'mdm in a typescript generic', `let x: Array<Map<string, ${CUR}number>> = [];\n`, del('m'));

// ---- I. syntax unavailable: plaintext fallback (parser failure, root query failure, incremental failure) --------------------------------------------------
const fsrc = 'spec Syntax lifecycle contract; surround without syntax';
const fbody = `fn f() { let s = "a (b ${CUR}c) d"; g(x${CUR}); }\n`;
for (const [k, ch] of [['closest', 'm'], ['paren', '('], ['quote', '"']]) {
  add(`failure-initial-parse-${k}`, `a rust document without a syntax tree (failed initial parse): plaintext lookup for md${ch}`, fbody, del(ch), { language: 'rust', failure: { kind: 'initial-parse' }, source: fsrc });
}
add('failure-initial-parse-quote-on-opener', 'a failed initial parse: md" falls back to the plaintext matching', `fn f() { let s = ${CUR}"ab"; }\n`, del('"'), { language: 'rust', failure: { kind: 'initial-parse' }, source: fsrc });
add('failure-initial-parse-count-2', 'a failed initial parse: 2mdm', `fn f() { if x { [1, ${CUR}2] } }\n`, ['2mdm'], { language: 'rust', failure: { kind: 'initial-parse' }, source: fsrc });
add('failure-initial-parse-multi-fails', 'a failed initial parse, mixed success and failure across selections: no partial deletion', `(a${CUR}) b${CUR}\n`, del('('), { language: 'rust', failure: { kind: 'initial-parse' }, source: fsrc });
add('failure-initial-parse-markdown-injected', 'a failed initial parse of markdown: the injected code block is plain text', fence(`fn f() { let s = "a (b ${CUR}c) d"; }`), del('m'), { language: 'markdown', failure: { kind: 'initial-parse' }, source: fsrc });
add('failure-initial-parse-nonchar', 'a failed initial parse: a non-character key', fbody, ['md<tab>'], { language: 'rust', failure: { kind: 'initial-parse' }, source: fsrc });
add('failure-initial-parse-whitespace-only', 'a failed initial parse of a whitespace-only document', `    ${CUR}\n`, del('m'), { language: 'rust', failure: { kind: 'initial-parse' }, source: fsrc });
for (const [file, ch] of [['highlights.scm', 'm'], ['injections.scm', '('], ['locals.scm', 'm']]) {
  add(`query-root-${file.replace('.scm', '')}-failure-${ch === 'm' ? 'closest' : 'paren'}`, `a broken root ${file} makes syntax initialization fail: plaintext lookup for md${ch}`, fbody, del(ch), {
    language: 'rust', queryOverrides: [{ language: 'rust', file, content: '(broken' }], source: fsrc,
  });
}
add('query-textobjects-failure-closest', 'a broken textobjects.scm leaves syntax available: the syntax-aware lookup still runs', fbody, del('m'), {
  language: 'rust', queryOverrides: [{ language: 'rust', file: 'textobjects.scm', content: '(broken' }], source: fsrc,
});
add('query-injected-highlights-failure', 'a broken injected-language (rust) highlights.scm under markdown', fence(`fn f() { let s = "a (b ${CUR}c) d"; }`), del('m'), {
  language: 'markdown', queryOverrides: [{ language: 'rust', file: 'highlights.scm', content: '(broken' }], source: fsrc,
});
add('failure-incremental-after-delete-closest', 'the syntax tree is dropped after the first deletion: the next md is plaintext', `fn f() { g((a${CUR})); let s = "(b${CUR})"; }\n`, ['md(', 'mdm'], { language: 'rust', failure: { kind: 'incremental-parse', afterStep: 0 }, source: fsrc, primary: 1 });
add('failure-incremental-after-delete-string', 'the tree is dropped after the first deletion: the next md( runs on plain text inside a string', `fn f() { let s = "((a${CUR}))"; }\n`, ['md(', 'md('], { language: 'rust', failure: { kind: 'incremental-parse', afterStep: 0 }, source: fsrc });
add('failure-incremental-control', 'control: the incremental failure comes after the commands', `fn f() { g((a${CUR})); }\n`, ['md(', 'mdm'], { language: 'rust', failure: { kind: 'incremental-parse', afterStep: 5 }, source: fsrc });

const doc = {
  schemaVersion: 1,
  group: 'surround-delete',
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
