/**
 * Helix's `h`, `l` (`move_horizontally`) and `j`, `k` (`move_vertically`,
 * which `move_visual_line_*` uses while soft wrap is off), ported from
 * helix-core's `movement.rs`. Positions are VS Code UTF-16 offsets; like the
 * word motions, these step over grapheme clusters and treat `\r\n` and `\r`
 * as Helix treats `\n`.
 */
import { graphemeWidth } from './unicodeWidth';
import { OffsetRange, WordMotionText } from './wordMotion';

export type Direction = 'forward' | 'backward';

export interface Line {
  readonly start: number;
  /** Where the line break starts, or the end of the text on the last line. */
  readonly end: number;
  readonly text: string;
}

/** Line access, so a VS Code document need not be copied into a string. */
export interface Lines {
  readonly count: number;
  /** The line containing `offset`; a line break belongs to the line it ends. */
  indexAt(offset: number): number;
  at(index: number): Line;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Lines of a string, split at `\r\n`, `\r`, and `\n` like VS Code. */
export function textLines(text: string): Lines {
  const starts = [0];
  const ends: number[] = [];
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    ends.push(match.index);
    starts.push(match.index + match[0].length);
  }
  ends.push(text.length);
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
    at: index => ({ start: starts[index], end: ends[index], text: text.slice(starts[index], ends[index]) }),
  };
}

/** Helix's `Range::cursor`: where the block cursor is drawn. */
export function cursorOf(lines: Lines, { anchor, head }: OffsetRange): number {
  if (head <= anchor) { return head; }
  const line = lines.at(lines.indexAt(head));
  if (head === line.start) {
    // The grapheme before a line start is the previous line's break.
    return lines.at(lines.indexAt(head) - 1).end;
  }
  let start = line.start;
  for (const { index } of segmenter.segment(line.text.slice(0, head - line.start))) {
    start = line.start + index;
  }
  return start;
}

/** Helix's tab stops: a tab fills up to the next multiple of the tab width. */
function width(grapheme: string, column: number, tabSize: number): number {
  return grapheme === '\t' ? tabSize - column % tabSize : graphemeWidth(grapheme);
}

/** Helix's `visual_offset_from_block` without soft wrap or annotations. */
function visualColumn(line: Line, offset: number, tabSize: number): number {
  let column = 0;
  for (const { segment, index } of segmenter.segment(line.text)) {
    if (line.start + index >= offset) { break; }
    column += width(segment, column, tabSize);
  }
  return column;
}

/** Helix's `char_idx_at_visual_block_offset`: the grapheme covering `column`, or the line end. */
function offsetAtColumn(line: Line, column: number, tabSize: number): number {
  let current = 0;
  for (const { segment, index } of segmenter.segment(line.text)) {
    const next = current + width(segment, current, tabSize);
    if (next > column) { return line.start + index; }
    current = next;
  }
  return line.end;
}

/** Helix's `move_horizontally`: `count` graphemes from the cursor, collapsing the selection. */
export function moveHorizontally(
  text: WordMotionText, range: OffsetRange, direction: Direction, count: number
): OffsetRange {
  let position = range.head > range.anchor ? text.before(range.head)!.start : range.head;
  for (let step = 0; step < count; step++) {
    const next = direction === 'forward' ? text.after(position)?.end : text.before(position)?.start;
    if (next === undefined) { break; }
    position = next;
  }
  return { anchor: position, head: position };
}

export interface VerticalMove {
  readonly range: OffsetRange;
  /** Helix's `old_visual_position`: pass it to the next vertical move of this range. */
  readonly column: number;
}

/**
 * Helix's `move_vertically`: `count` lines up or down, keeping the visual
 * column, or the remembered `column` of a preceding vertical move.
 */
export function moveVertically(
  lines: Lines, range: OffsetRange, direction: Direction, count: number,
  tabSize: number, column?: number
): VerticalMove {
  const cursor = cursorOf(lines, range);
  const index = lines.indexAt(cursor);
  const goal = column ?? visualColumn(lines.at(index), cursor, tabSize);
  const target = direction === 'forward'
    ? Math.min(index + count, lines.count - 1)
    : Math.max(index - count, 0);
  const position = offsetAtColumn(lines.at(target), goal, tabSize);
  return { range: { anchor: position, head: position }, column: goal };
}
