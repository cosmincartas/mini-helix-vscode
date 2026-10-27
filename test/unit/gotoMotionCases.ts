import { Case } from './charMotionCases';

/**
 * Helix 25.07.1 goto chords, as `[input, keys, Helix's output]`. `　` is
 * the ideographic space, `́` a combining acute accent.
 */

// gs
export const firstNonWhitespace: Case[] = [
  ['#[ |]# \tfoo bar\n', 'gs', '  \t#[f|]#oo bar\n'],
  ['#[　|]#x\n', 'gs', '　#[x|]#\n'],
  ['#[f|]#oo\n', 'gs', '#[f|]#oo\n'],
  ['fo#[o|]#\n', 'gs', '#[f|]#oo\n'],
  ['  fo#[o|]# bar', 'gs', '  #[f|]#oo bar'],
  ['a\n#[  |]#\nb\n', 'gs', 'a\n#[  |]#\nb\n'],
  ['a\n#[\n|]#b\n', 'gs', 'a\n#[\n|]#b\n'],
  ['a\n \t#[ |]#\nb\n', 'gs', 'a\n \t#[ |]#\nb\n'],
  ['a\n　#[　|]#\nb\n', 'gs', 'a\n　#[　|]#\nb\n'],
  ['  ab#[c\n|]#def\n', 'gs', '  #[a|]#bc\ndef\n'],
  ['#[|  ab]#c\n', 'gs', '  #[a|]#bc\n'],
  ['  a#[|bc\nd]#ef\n', 'gs', '  #[a|]#bc\ndef\n'],
  ['  abc\n#[  d|]#ef\n', 'gs', '  abc\n  #[d|]#ef\n'],
  ['  abc\r\n  d#[e|]#f\r\n', 'gs', '  abc\r\n  #[d|]#ef\r\n'],
  [' #[a|]#\n  #(b|)#\n', 'gs', ' #[a|]#\n  #(b|)#\n'],
  [' a#[b|]#\n  c#(d|)#\n', 'gs', ' #[a|]#b\n  #(c|)#d\n'],
  ['  a#[b|]#  a#(b|)#\n', 'gs', '  #[a|]#b  ab\n'],
  ['#[|]#', 'gs', '#[|]#'],
  ['  #[a|]#\n', '3gs', '  #[a|]#\n'],
];

// gl
export const lineEnd: Case[] = [
  ['#[a|]#bc\ndef\n', 'gl', 'ab#[c|]#\ndef\n'],
  ['#[a|]#bc\r\ndef', 'gl', 'ab#[c|]#\r\ndef'],
  ['#[a|]#é\n', 'gl', 'a#[é|]#\n'],
  ['#[a|]#é\n', 'gl', 'a#[é|]#\n'],
  ['#[a|]#👋🏽\n', 'gl', 'a#[👋🏽|]#\n'],
  ['a\n#[\n|]#b\n', 'gl', 'a\n#[\n|]#b\n'],
  ['x\n#[y|]#z', 'gl', 'x\ny#[z|]#'],
  ['ab#[c|]#', 'gl', 'ab#[c|]#'],
  ['#[abc\n|]#def\n', 'gl', 'ab#[c|]#\ndef\n'],
  ['#[abc\r\n|]#def\r\n', 'gl', 'ab#[c|]#\r\ndef\r\n'],
  ['ab#[|c\nd]#ef\n', 'gl', 'ab#[c|]#\ndef\n'],
  ['#[a|]#bc\n#(d|)#ef\n', 'gl', 'ab#[c|]#\nde#(f|)#\n'],
  ['#[a|]#b\n#(c|)#d\n', 'gl', 'a#[b|]#\nc#(d|)#\n'],
  ['#[a|]#b #(c|)#d\n', 'gl', 'ab c#[d|]#\n'],
  ['#[|]#', 'gl', '#[|]#'],
  ['#[\n|]#', 'gl', '#[\n|]#'],
  ['#[a|]#bc\ndefg\n', '3gll', 'abc#[\n|]#defg\n'],
];

// gg
export const fileStart: Case[] = [
  ['a\nb#[c|]#\n#(d|)#\n', 'gg', '#[a|]#\nbc\nd\n'],
  ['a\nbc\n#[d|]#\n', 'gg', '#[a|]#\nbc\nd\n'],
  ['#[a|]#\nbb\ncc\n', '2gg', 'a\n#[b|]#b\ncc\n'],
  ['#[a|]#\nbb\ncc\n', '9gg', 'a\nbb\n#[c|]#c\n'],
  ['#[a|]#\nbb\ncc', '9gg', 'a\nbb\n#[c|]#c'],
  ['a\n#[b|]#\n', '1gg', '#[a|]#\nb\n'],
  ['#[a|]#\nb\n', '99999999gg', 'a\n#[b|]#\n'],
  ['#[a|]#\nb\r\nc\n', '3gg', 'a\nb\r\n#[c|]#\n'],
  ['a\nb\n#[c|]#', '0gg', '#[a|]#\nb\nc'],
  ['a\n#[bc|]#\n#(d|)#\n', '2gg', 'a\n#[b|]#c\nd\n'],
  ['#[|]#', 'gg', '#[|]#'],
  ['#[|]#', '5gg', '#[|]#'],
  ['#[\n|]#', 'gg', '#[\n|]#'],
  ['#[\n|]#', '3gg', '#[\n|]#'],
  ['a\n#[b|]#\n', '2gg2l', 'a\nb\n#[|]#'],
];

// ge
export const lastLine: Case[] = [
  ['#[a|]#\nbb\ncc\n', 'ge', 'a\nbb\n#[c|]#c\n'],
  ['#[a|]#\nbb\ncc', 'ge', 'a\nbb\n#[c|]#c'],
  ['#[a|]#\n\n', 'ge', 'a\n#[\n|]#'],
  ['#[|]#', 'ge', '#[|]#'],
  ['#[\n|]#', 'ge', '#[\n|]#'],
  ['#[a|]#\nb\n', '3ge', 'a\n#[b|]#\n'],
  ['#[a|]#\r\nbb\r\n', 'ge', 'a\r\n#[b|]#b\r\n'],
  ['a\nb#[c|]#\n#(d|)#\ne\n', 'ge', 'a\nbc\nd\n#[e|]#\n'],
];
