/**
 * Helix `x`/`X` and selection normalization, ported from commands.rs and
 * selection.rs at ba40e547426b0f9896c8bdc699a4ab11f2b37dbc (MPL-2.0).
 * All offsets at this boundary are UTF-16 gaps, not Rust character indices.
 */
import { Lines, textLines } from './charMotion';
import { blockRange } from './editing';
import { OffsetRange, WordMotionText } from './wordMotion';

export interface SelectionSet {
  readonly ranges: readonly OffsetRange[];
  readonly primaryIndex: number;
}

const from = (range: OffsetRange) => Math.min(range.anchor, range.head);
const to = (range: OffsetRange) => Math.max(range.anchor, range.head);

/** Helix `Range::overlaps`: a point at the upper boundary stays separate. */
export function overlaps(a: OffsetRange, b: OffsetRange): boolean {
  return from(a) === from(b) || (to(a) > from(b) && to(b) > from(a));
}

function merge(a: OffsetRange, b: OffsetRange): OffsetRange {
  return a.anchor > a.head && b.anchor > b.head
    ? { anchor: Math.max(a.anchor, b.anchor), head: Math.min(a.head, b.head) }
    : { anchor: Math.min(from(a), from(b)), head: Math.max(to(a), to(b)) };
}

/** Sort, merge actual overlaps, and retain the primary's merged identity. */
export function normalizeSelections(ranges: readonly OffsetRange[], primaryIndex = 0): SelectionSet {
  if (!ranges.length || !Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= ranges.length) {
    throw new Error('A selection needs at least one range and a valid primary index');
  }
  const sorted = ranges.map((range, index) => ({ range: { ...range }, primary: index === primaryIndex }))
    .sort((a, b) => from(a.range) - from(b.range));
  const result: typeof sorted = [];
  for (const current of sorted) {
    const previous = result.at(-1);
    if (previous && overlaps(previous.range, current.range)) {
      previous.range = merge(previous.range, current.range);
      previous.primary ||= current.primary;
    } else {
      result.push(current);
    }
  }
  return { ranges: result.map(item => item.range), primaryIndex: result.findIndex(item => item.primary) };
}

/** The inclusive logical line interval covered by a range, before invariants. */
export function lineRange(text: WordMotionText, lines: Lines, range: OffsetRange): readonly [number, number] {
  const start = from(range);
  const last = range.anchor === range.head ? to(range) : Math.max(start, text.before(to(range))?.start ?? 0);
  return [lines.indexAt(start), lines.indexAt(last)];
}

/**
 * Pinned Helix disables Ropey's `cr_lines` feature: lone CR is content.
 * Existing line access can be reused for the normal LF/CRLF document shapes.
 */
function helixLines(text: string): Lines {
  if (!/\r(?!\n)/.test(text)) { return textLines(text); }
  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '\n') { starts.push(index + 1); }
  }
  return {
    count: starts.length,
    indexAt(offset) {
      let low = 0;
      let high = starts.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (starts[middle] <= offset) { low = middle; } else { high = middle - 1; }
      }
      return low;
    },
    at(index) {
      const start = starts[index];
      let end = index + 1 < starts.length ? starts[index + 1] - 1 : text.length;
      if (text[end] === '\n' && text[end - 1] === '\r') { end--; }
      return { start, end, text: text.slice(start, end) };
    },
  };
}

/** Helix min_width_1 followed by grapheme_aligned. */
function invariantRange(text: WordMotionText, range: OffsetRange): OffsetRange {
  const block = blockRange(text, range);
  const previousBoundary = (offset: number) => text.after(offset)?.start ?? offset;
  const nextBoundary = (offset: number) => {
    const next = text.after(offset);
    return next && next.start !== offset ? next.end : offset;
  };
  return block.anchor <= block.head
    ? { anchor: previousBoundary(block.anchor), head: nextBoundary(block.head) }
    : { anchor: nextBoundary(block.anchor), head: previousBoundary(block.head) };
}

/**
 * Establish Helix selection invariants, apply `x` or `X`, then normalize the
 * whole set. `X` consumes its command count in the adapter but ignores it here.
 * Supply line access only when it uses the pinned Helix line interpretation.
 */
export function transformLineSelection(
  text: WordMotionText,
  selection: SelectionSet,
  command: 'x' | 'X',
  count = 1,
  lines: Lines = helixLines(text.text)
): SelectionSet {
  const normalized = normalizeSelections(selection.ranges, selection.primaryIndex);
  const input = normalizeSelections(normalized.ranges.map(range => invariantRange(text, range)), normalized.primaryIndex);
  const lineStart = (index: number) => index >= lines.count ? text.text.length : lines.at(index).start;
  const ranges = input.ranges.map(range => {
    const [startLine, endLine] = lineRange(text, lines, range);
    const start = lineStart(startLine);
    const end = lineStart(endLine + 1);
    if (command === 'X') {
      return range.anchor > range.head ? { anchor: end, head: start } : { anchor: start, head: end };
    }
    const fullLines = from(range) === start && to(range) === end;
    return { anchor: start, head: lineStart(Math.min(endLine + count + (fullLines ? 1 : 0), lines.count)) };
  });
  return normalizeSelections(ranges, input.primaryIndex);
}
