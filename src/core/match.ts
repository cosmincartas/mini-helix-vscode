/**
 * Helix-style `mi` / `ma` text objects and `mr` surround replacement, by plain
 * text scanning: no parser, no syntax awareness. Offsets are UTF-16 offsets
 * shared with VS Code selections. Word objects use the grapheme categories of
 * `wordMotion.ts`; brackets are matched lexically over the whole document;
 * quotes pair up left to right within one line.
 */
import { Edit } from './editing';
import { OffsetRange, WordMotionText } from './wordMotion';

export type TextObjectKind = 'inside' | 'around';

export interface Pair {
  readonly open: string;
  readonly close: string;
}

/** UTF-16 offsets of the opening and closing delimiter characters. */
export interface PairPosition {
  readonly open: number;
  readonly close: number;
}

const pairs: Readonly<Record<string, Pair>> = (() => {
  const result: Record<string, Pair> = {};
  for (const [open, close] of ['()', '[]', '{}', '<>', `''`, '""']) {
    const pair = { open, close };
    result[open] = pair;
    result[close] = pair;
  }
  return result;
})();

/** `' " ( ) [ ] { } < >`; a closing character is an alias for its pair. Otherwise undefined. */
export function delimiterPair(char: string): Pair | undefined {
  return Object.hasOwn(pairs, char) ? pairs[char] : undefined;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const unprintable = /^[\p{C}\p{Z}\p{White_Space}]/u;

/**
 * Delimiters and aliases map to their pair. Any other single printable
 * non-whitespace grapheme maps to `{open: c, close: c}`. Otherwise undefined.
 */
export function replacementPair(char: string): Pair | undefined {
  const delimiter = delimiterPair(char);
  if (delimiter) { return delimiter; }
  const graphemes = Array.from(segmenter.segment(char));
  if (graphemes.length !== 1 || unprintable.test(char)) { return undefined; }
  return { open: char, close: char };
}

/** The block cursor: empty -> head; reversed -> head; forward non-empty -> start of the grapheme before head. */
export function cursorOffset(text: WordMotionText, range: OffsetRange): number {
  if (range.head <= range.anchor) { return range.head; }
  return text.before(range.head)?.start ?? range.head;
}

/** The inner run of the cursor grapheme's category, plus `around` whitespace. */
function findWord(text: WordMotionText, cursor: number, kind: TextObjectKind): { from: number; to: number } | undefined {
  const grapheme = text.after(cursor);
  if (!grapheme || grapheme.category === 'eol') { return undefined; }
  const { category } = grapheme;
  let from = grapheme.start;
  let to = grapheme.end;
  for (let g = text.before(from); g?.category === category; g = text.before(from)) { from = g.start; }
  for (let g = text.after(to); g?.category === category; g = text.after(to)) { to = g.end; }
  if (kind === 'inside' || category === 'whitespace') { return { from, to }; }

  const runEnd = to;
  for (let g = text.after(to); g?.category === 'whitespace'; g = text.after(to)) { to = g.end; }
  if (to === runEnd) {
    for (let g = text.before(from); g?.category === 'whitespace'; g = text.before(from)) { from = g.start; }
  }
  return { from, to };
}

/** Bracket pair by lexical scanning with nesting depth; O(document) for any count. */
function findBracketPair(text: string, cursor: number, pair: Pair, count: number): PairPosition | undefined {
  if (cursor < 0 || cursor >= text.length) { return undefined; }
  // Openers still unclosed before the cursor, innermost last. Stray closers are ignored.
  const stack: number[] = [];
  const onOpener = text[cursor] === pair.open;
  const end = onOpener ? cursor + 1 : cursor;
  for (let i = 0; i < end; i++) {
    const char = text[i];
    if (char === pair.open) { stack.push(i); }
    else if (char === pair.close) { stack.pop(); }
  }
  if (count > stack.length) { return undefined; }

  // The k-th closer that no later opener claims closes the k-th innermost open pair.
  let depth = 0;
  let found = 0;
  for (let i = end; i < text.length; i++) {
    const char = text[i];
    if (char === pair.open) { depth++; }
    else if (char === pair.close) {
      if (depth > 0) { depth--; continue; }
      if (++found === count) { return { open: stack[stack.length - count], close: i }; }
    }
  }
  return undefined;
}

const isBreak = (char: string) => char === '\n' || char === '\r';

/** Quote pair on the cursor's line, paired left to right, skipping escaped quotes. */
function findQuotePair(text: string, cursor: number, pair: Pair, count: number): PairPosition | undefined {
  if (count >= 2 || cursor < 0 || cursor > text.length) { return undefined; }
  let start = cursor;
  while (start > 0 && !isBreak(text[start - 1])) { start--; }
  let open: number | undefined;
  let backslashes = 0;
  for (let i = start; i < text.length && !isBreak(text[i]); i++) {
    const char = text[i];
    if (char === '\\') { backslashes++; continue; }
    const escaped = backslashes % 2 === 1;
    backslashes = 0;
    if (char !== pair.open || escaped) { continue; }
    if (open === undefined) {
      if (i > cursor) { return undefined; }
      open = i;
    } else {
      if (cursor <= i) { return { open, close: i }; }
      open = undefined;
    }
  }
  return undefined;
}

/** The count-th enclosing pair (count >= 1) for the cursor, per the spec rules for brackets and quotes. */
export function findPair(
  text: WordMotionText, cursor: number, pair: Pair, count: number
): PairPosition | undefined {
  const n = Math.max(1, count);
  return pair.open === pair.close
    ? findQuotePair(text.text, cursor, pair, n)
    : findBracketPair(text.text, cursor, pair, n);
}

/**
 * `mi` / `ma` on every range. `target` is `w` or a delimiter character
 * (aliases allowed). Unmatched ranges stay unchanged; a reversed range gives a
 * reversed result, otherwise forward.
 */
export function selectTextObjects(
  text: WordMotionText, ranges: readonly OffsetRange[], kind: TextObjectKind, target: string, count: number
): OffsetRange[] {
  const pair = delimiterPair(target);
  if (target !== 'w' && !pair) { return [...ranges]; }
  return ranges.map(range => {
    const cursor = cursorOffset(text, range);
    let selected: { from: number; to: number } | undefined;
    if (pair) {
      const found = findPair(text, cursor, pair, count);
      if (found) {
        selected = kind === 'inside'
          ? { from: found.open + 1, to: found.close }
          : { from: found.open, to: found.close + 1 };
      }
    } else {
      selected = findWord(text, cursor, kind);
    }
    if (!selected) { return range; }
    return range.head < range.anchor
      ? { anchor: selected.to, head: selected.from }
      : { anchor: selected.from, head: selected.to };
  });
}

/**
 * `mr`. undefined = make no edit (old not a delimiter, replacement invalid,
 * any range unmatched, or a delimiter offset claimed by two different pairs).
 * [] = the replacement pair equals the old pair. Otherwise sorted, deduplicated,
 * non-overlapping edits that each replace one delimiter character.
 */
export function replaceSurround(
  text: WordMotionText, ranges: readonly OffsetRange[], old: string, replacement: string, count: number
): Edit[] | undefined {
  const oldPair = delimiterPair(old);
  const newPair = replacementPair(replacement);
  if (!oldPair || !newPair) { return undefined; }

  const found = new Map<string, PairPosition>();
  const claimed = new Map<number, string>();
  for (const range of ranges) {
    const position = findPair(text, cursorOffset(text, range), oldPair, count);
    if (!position) { return undefined; }
    const key = `${position.open}:${position.close}`;
    for (const offset of [position.open, position.close]) {
      const owner = claimed.get(offset);
      if (owner !== undefined && owner !== key) { return undefined; }
      claimed.set(offset, key);
    }
    found.set(key, position);
  }
  if (newPair.open === oldPair.open && newPair.close === oldPair.close) { return []; }

  const edits: Edit[] = [];
  for (const { open, close } of found.values()) {
    edits.push({ from: open, to: open + 1, text: newPair.open });
    edits.push({ from: close, to: close + 1, text: newPair.close });
  }
  return edits.sort((a, b) => a.from - b.from);
}
