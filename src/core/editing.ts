/**
 * Helix selection edits: `a` (append_mode), `d` (delete_selection), `c`
 * (change_selection), and the cursor restore when `a`'s INSERT ends.
 * Ported from helix-term's `commands.rs`; `i` is `prepareInsert` in
 * `selections.ts`.
 *
 * Like the word motions, ranges are UTF-16 gap offsets shared with VS Code
 * selections. An empty VS Code selection is Helix's block cursor: it covers
 * the grapheme after it. Helix keeps selections while typing in INSERT, but
 * VS Code typing replaces them, so commands that enter INSERT leave carets.
 */
import { OffsetRange, WordMotionText } from './wordMotion';

/** A replacement in offsets of the text before any edit. */
export interface Edit {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

/** Sorted, non-overlapping edits, and the selections after applying them. */
export interface EditResult {
  readonly edits: readonly Edit[];
  readonly selections: readonly OffsetRange[];
}

/** Indentation for the line `c` opens; Helix's fallback without tree-sitter. */
export interface IndentOptions {
  /** One indent level: a tab, or `indentSize` spaces. */
  readonly unit: string;
  readonly tabSize: number;
}

/** Helix's range for a selection: an empty one covers the grapheme after it. */
export function blockRange(text: WordMotionText, range: OffsetRange): OffsetRange {
  if (range.anchor !== range.head) { return range; }
  const next = text.after(range.head);
  return next ? { anchor: range.head, head: next.end } : range;
}

const from = (range: OffsetRange) => Math.min(range.anchor, range.head);
const to = (range: OffsetRange) => Math.max(range.anchor, range.head);
const point = (offset: number): OffsetRange => ({ anchor: offset, head: offset });

/** Remove repeated carets, keeping the first (primary) occurrence. */
function unique(ranges: readonly OffsetRange[]): OffsetRange[] {
  const seen = new Set<string>();
  return ranges.filter(range => {
    const key = `${range.anchor},${range.head}`;
    return !seen.has(key) && !!seen.add(key);
  });
}

/** `a`: a caret after each selection, adding a line ending if one is at the end. */
export function append(text: WordMotionText, ranges: readonly OffsetRange[], eol: string): EditResult {
  const blocks = ranges.map(range => blockRange(text, range));
  const end = text.text.length;
  // Helix makes room for its block cursor when the last selection ends the text.
  const edits = blocks.some(range => range.anchor !== range.head && to(range) === end)
    ? [{ from: end, to: end, text: eol }] : [];
  return { edits, selections: unique(blocks.map(range => point(to(range)))) };
}

/** Helix's `selection_is_linewise` for one range: whole lines, with a line ending. */
function isLinewise(text: string, range: OffsetRange): boolean {
  const start = from(range);
  const end = to(range);
  const lineStart = (offset: number) => offset === 0 ||
    (/[\r\n]/.test(text[offset - 1]) && !(text[offset - 1] === '\r' && text[offset] === '\n'));
  return /[\r\n]/.test(text.slice(start, end)) && lineStart(start) &&
    (end === text.length || lineStart(end));
}

/** Helix's `indent_level_for_line`, rendered with the editor's indent unit. */
function indentFor(line: string, { unit, tabSize }: IndentOptions): string {
  const width = unit === '\t' ? tabSize : unit.length;
  let columns = 0;
  for (const character of line) {
    if (character === '\t') { columns += tabSize - columns % tabSize; }
    else if (character === ' ') { columns++; }
    else { break; }
  }
  return unit.repeat(Math.floor(columns / width));
}

/**
 * Delete every selection (empty ones delete the grapheme under the cursor).
 * Spans that overlap or touch merge, as Helix merges the carets they collapse
 * to. With `open`, each span is replaced by an empty line indented like the
 * line that follows it, and the caret goes after that indentation.
 */
function deleteRanges(
  text: WordMotionText,
  ranges: readonly OffsetRange[],
  open?: { readonly eol: string; readonly indent: IndentOptions }
): EditResult {
  const blocks = ranges.map(range => blockRange(text, range));
  const spans: { from: number; to: number }[] = [];
  for (const span of blocks.map(range => ({ from: from(range), to: to(range) }))
    .sort((a, b) => a.from - b.from)) {
    const last = spans.at(-1);
    if (last && span.from <= last.to) { last.to = Math.max(last.to, span.to); }
    else { spans.push(span); }
  }

  let shift = 0;
  const edits = spans.map(span => {
    const indent = open ? indentFor(text.text.slice(span.to).match(/^[^\r\n]*/)![0], open.indent) : '';
    const edit = { ...span, text: open ? indent + open.eol : '', caret: span.from + shift + indent.length };
    shift += edit.text.length - (span.to - span.from);
    return edit;
  });
  // Each selection becomes a caret in the span that contains it.
  const caret = (range: OffsetRange) =>
    point(edits.reduce((found, edit) => edit.from <= from(range) ? edit : found).caret);
  return {
    edits: edits.map(({ from, to, text }) => ({ from, to, text })),
    selections: unique(blocks.map(caret)),
  };
}

/** `d`: delete each selection and leave a cursor where it was. */
export function deleteSelection(text: WordMotionText, ranges: readonly OffsetRange[]): EditResult {
  return deleteRanges(text, ranges);
}

/**
 * `c`: delete each selection, then INSERT at its start. When every selection
 * is whole lines, Helix instead opens a line above the text that followed them.
 */
export function changeSelection(
  text: WordMotionText,
  ranges: readonly OffsetRange[],
  eol: string,
  indent: IndentOptions
): EditResult {
  const linewise = ranges.every(range => isLinewise(text.text, blockRange(text, range)));
  return deleteRanges(text, ranges, linewise ? { eol, indent } : undefined);
}

/**
 * Leaving `a`'s INSERT moves each caret back onto the last appended grapheme.
 * Helix's range at the end of the text is empty, so a caret there stays.
 */
export function restoreAppendCursor(text: WordMotionText, ranges: readonly OffsetRange[]): OffsetRange[] {
  return unique(ranges.map(range => {
    if (range.anchor !== range.head || range.head === text.text.length) { return range; }
    return point(text.before(range.head)?.start ?? range.head);
  }));
}
