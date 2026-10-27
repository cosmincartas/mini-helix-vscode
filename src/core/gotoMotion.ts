/**
 * Helix's `gs` (`goto_first_nonwhitespace`), `gl` (`goto_line_end`), `gg`
 * (`goto_file_start`) and `ge` (`goto_last_line`), ported from helix-term's
 * `commands.rs` at 25.07.1. Positions are VS Code UTF-16 offsets. Like Helix's
 * NORMAL mode, each command moves the selection to a point range, and `gs`
 * and `gl` work on the line of the block cursor. Jump history is not kept.
 */
import { cursorOf, Lines } from './charMotion';
import { OffsetRange, WordMotionText } from './wordMotion';

// Rust's `char::is_whitespace`, which Helix's `first_non_whitespace_char` uses.
const notWhitespace = /\P{White_Space}/u;

function point(offset: number): OffsetRange {
  return { anchor: offset, head: offset };
}

/** Helix's `Range::cursor_line`. */
function cursorLine(lines: Lines, range: OffsetRange) {
  return lines.at(lines.indexAt(cursorOf(lines, range)));
}

/** Helix's `goto_first_nonwhitespace_impl`: a line of whitespace leaves `range` as it is. */
export function gotoFirstNonWhitespace(lines: Lines, range: OffsetRange): OffsetRange {
  const line = cursorLine(lines, range);
  const index = line.text.search(notWhitespace);
  return index < 0 ? range : point(line.start + index);
}

/** Helix's `goto_line_end_impl`: the last grapheme before the line break, but not before the line start. */
export function gotoLineEnd(text: WordMotionText, lines: Lines, range: OffsetRange): OffsetRange {
  const line = cursorLine(lines, range);
  return point(Math.max(line.start, text.before(line.end)?.start ?? line.start));
}

/** The last line, or the one before it when the file ends in a line break. */
function lastTargetLine(lines: Lines): number {
  const last = lines.count - 1;
  return lines.at(last).end === lines.at(last).start ? Math.max(last - 1, 0) : last;
}

/** Helix's `goto_line_without_jumplist`; `line` is 1-based, as Helix's count. */
export function gotoLine(lines: Lines, line: number): OffsetRange {
  return point(lines.at(Math.min(line - 1, lastTargetLine(lines))).start);
}

/** Helix's `goto_last_line_impl`. */
export function gotoLastLine(lines: Lines): OffsetRange {
  return point(lines.at(lastTargetLine(lines)).start);
}
