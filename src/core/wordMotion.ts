/**
 * Helix word motions (`w`, `b`, `e` and the WORD variants `W`, `B`, `E`),
 * ported from helix-core's `movement.rs`.
 *
 * Helix ranges are gap positions, so a Helix range `(anchor, head)` maps
 * directly onto a VS Code end-exclusive selection with the same anchor/active
 * offsets. Helix walks characters; this walks grapheme clusters so selections
 * never split combining marks, emoji sequences, or `\r\n`. On ASCII text with
 * `\n` line endings the results are identical to Helix's.
 */
export type WordMotionTarget =
  | 'nextWordStart'
  | 'prevWordStart'
  | 'nextWordEnd'
  | 'nextLongWordStart'
  | 'prevLongWordStart'
  | 'nextLongWordEnd';

export interface OffsetRange {
  /** UTF-16 offsets, as returned by `TextDocument.offsetAt`. */
  readonly anchor: number;
  readonly head: number;
}

type Category = 'eol' | 'whitespace' | 'word' | 'punctuation' | 'unknown';

interface Grapheme {
  readonly start: number;
  readonly end: number;
  readonly category: Category;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
// VS Code's line breaks: `\n`, `\r\n` (one cluster), and `\r`. Helix's default
// build only recognizes `\n` and would stop between `\r` and `\n`, which is not
// a valid VS Code position.
const eol = /^[\n\r]/u;
const whitespace = /^\p{White_Space}/u;
// Rust's `char::is_alphanumeric` (Alphabetic or Numeric), plus underscore.
const word = /^[\p{Alphabetic}\p{Number}_]/u;
const punctuation = /^[\p{Punctuation}\p{Math_Symbol}\p{Currency_Symbol}\p{Modifier_Symbol}]/u;

function categorize(text: string): Category {
  // A cluster is categorized by its base character.
  if (eol.test(text)) { return 'eol'; }
  if (whitespace.test(text)) { return 'whitespace'; }
  if (word.test(text)) { return 'word'; }
  if (punctuation.test(text)) { return 'punctuation'; }
  return 'unknown';
}

/** Prepared document text; reuse it for every selection in one command. */
export class WordMotionText {
  private readonly segments: Intl.Segments;

  constructor(readonly text: string) {
    this.segments = segmenter.segment(text);
  }

  /** The grapheme starting at a boundary `offset`, if any. */
  after(offset: number): Grapheme | undefined {
    return this.at(offset);
  }

  /** The grapheme ending at a boundary `offset`, if any. */
  before(offset: number): Grapheme | undefined {
    return offset > 0 ? this.at(offset - 1) : undefined;
  }

  private at(offset: number): Grapheme | undefined {
    const segment = this.segments.containing(offset);
    if (!segment) { return undefined; }
    return {
      start: segment.index,
      end: segment.index + segment.segment.length,
      category: categorize(segment.segment),
    };
  }
}

const isPrev = (target: WordMotionTarget) =>
  target === 'prevWordStart' || target === 'prevLongWordStart';

function isBoundary(target: WordMotionTarget, a: Category, b: Category): boolean {
  if (target.includes('Long') &&
      (a === 'word' || a === 'punctuation') && (b === 'word' || b === 'punctuation')) {
    return false;
  }
  return a !== b;
}

/** Helix's `reached_target`; `prev` was visited before `next`. */
function reachedTarget(target: WordMotionTarget, prev: Category, next: Category): boolean {
  if (!isBoundary(target, prev, next)) { return false; }
  return target === 'nextWordStart' || target === 'nextLongWordStart'
    ? next === 'eol' || next !== 'whitespace'
    : prev !== 'whitespace' || next === 'eol';
}

/** Helix's `range_to_target`. */
function rangeToTarget(text: WordMotionText, target: WordMotionTarget, origin: OffsetRange): OffsetRange {
  const backwards = isPrev(target);
  const step = (offset: number) => backwards ? text.before(offset) : text.after(offset);
  const beyond = (grapheme: Grapheme) => backwards ? grapheme.start : grapheme.end;

  let { anchor, head } = origin;
  let previous = (backwards ? text.after(head) : text.before(head))?.category;

  // Skip any initial line endings.
  for (let next = step(head); next?.category === 'eol'; next = step(head)) {
    previous = 'eol';
    head = beyond(next);
  }
  if (previous === 'eol') { anchor = head; }

  const headStart = head;
  for (let next = step(head); next; next = step(head)) {
    if (previous === undefined || reachedTarget(target, previous, next.category)) {
      if (head !== headStart) { break; }
      anchor = head;
    }
    previous = next.category;
    head = beyond(next);
  }
  return { anchor, head };
}

/** Helix's `word_move`: `count` motions, stopping early when one fails. */
export function moveWord(
  text: WordMotionText, range: OffsetRange, target: WordMotionTarget, count = 1
): OffsetRange {
  const backwards = isPrev(target);
  const { anchor, head } = range;
  if (backwards ? head === 0 : head === text.text.length) { return range; }

  // Block-cursor semantics: start from the one grapheme under the cursor, so
  // the previous anchor does not influence the result.
  const nextBoundary = text.after(head)?.end ?? head;
  const prevBoundary = text.before(head)?.start ?? head;
  const start: OffsetRange = backwards
    ? anchor < head ? { anchor: head, head: prevBoundary } : { anchor: nextBoundary, head }
    : anchor < head ? { anchor: prevBoundary, head } : { anchor: head, head: nextBoundary };
  let result = start;
  for (let step = 0; step < count; step++) {
    const next = rangeToTarget(text, target, result);
    if (next.anchor === result.anchor && next.head === result.head) { break; }
    result = next;
  }
  return result;
}
