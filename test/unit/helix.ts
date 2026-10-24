/**
 * Test helpers mirroring helix-term's integration tests: Helix selection
 * notation and a key-sequence session that drives the same core functions as
 * the VS Code commands, with VS Code-style typing for INSERT text.
 */
import { moveHorizontally, moveVertically, textLines } from '../../src/core/charMotion';
import { Count } from '../../src/core/count';
import { append, changeSelection, deleteSelection, EditResult, restoreAppendCursor } from '../../src/core/editing';
import { moveWord, OffsetRange, WordMotionTarget, WordMotionText } from '../../src/core/wordMotion';

export interface Document {
  readonly text: string;
  /** The primary range first, as with VS Code's `editor.selections`. */
  readonly ranges: readonly OffsetRange[];
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Port of `helix_core::test::print`: `#[` marks the primary range, `#(` the
 * others, and `|` the head, e.g. `#[foo|]# #(|bar)#`.
 */
export function parse(notation: string): Document {
  const graphemes = Array.from(segmenter.segment(notation), part => part.segment);
  let text = '';
  let primary: OffsetRange | undefined;
  const others: OffsetRange[] = [];
  for (let i = 0; i < graphemes.length; i++) {
    if (graphemes[i] !== '#' || !['[', '('].includes(graphemes[i + 1])) {
      text += graphemes[i];
      continue;
    }
    const isPrimary = graphemes[++i] === '[';
    const close = isPrimary ? ']' : ')';
    const start = text.length;
    const headAtStart = graphemes[i + 1] === '|';
    if (headAtStart) { i++; }
    for (i++; !(graphemes[i] === close && graphemes[i + 1] === '#'); i++) {
      if (i >= graphemes.length) { throw new Error(`Unclosed range in ${JSON.stringify(notation)}`); }
      if (graphemes[i] === '|' && graphemes[i + 1] === close && graphemes[i + 2] === '#') { continue; }
      text += graphemes[i];
    }
    i++;
    const range = headAtStart ? { anchor: text.length, head: start } : { anchor: start, head: text.length };
    if (isPrimary) { primary = range; } else { others.push(range); }
  }
  if (!primary) { throw new Error(`No primary range in ${JSON.stringify(notation)}`); }
  return { text, ranges: [primary, ...others] };
}

/** Helix notation for a document; unlike Helix, closes adjacent ranges before opening the next. */
export function print({ text, ranges }: Document): string {
  const marks: { offset: number; order: number; mark: string }[] = [];
  ranges.forEach((range, index) => {
    const [open, close] = index === 0 ? ['#[', ']#'] : ['#(', ')#'];
    const from = Math.min(range.anchor, range.head);
    const to = Math.max(range.anchor, range.head);
    if (from === to) {
      marks.push({ offset: from, order: 0, mark: `${open}|${close}` });
    } else {
      const reversed = range.head < range.anchor;
      marks.push({ offset: from, order: 1, mark: reversed ? `${open}|` : open });
      marks.push({ offset: to, order: 0, mark: reversed ? close : `|${close}` });
    }
  });
  marks.sort((a, b) => b.offset - a.offset || b.order - a.order);
  let result = text;
  for (const { offset, mark } of marks) { result = result.slice(0, offset) + mark + result.slice(offset); }
  return result;
}

/** Helix's view of a VS Code selection: an empty one is a block over the next grapheme. */
export function normalize({ text, ranges }: Document): Document {
  const prepared = new WordMotionText(text);
  return {
    text,
    ranges: ranges.map(range => {
      const next = range.anchor === range.head ? prepared.after(range.head) : undefined;
      return next ? { anchor: range.head, head: next.end } : range;
    }),
  };
}

/** Secondary ranges in document order, as Helix stores them. */
export function ordered({ text, ranges }: Document): Document {
  const start = (range: OffsetRange) => Math.min(range.anchor, range.head);
  return { text, ranges: [ranges[0], ...ranges.slice(1).sort((a, b) => start(a) - start(b))] };
}

/** Helix's `Range::cursor`: the grapheme the block cursor is drawn on. */
export function cursors({ text, ranges }: Document): number[] {
  const prepared = new WordMotionText(text);
  return ranges.map(range => range.head > range.anchor ? prepared.before(range.head)!.start : range.head);
}

const motions: Readonly<Record<string, WordMotionTarget>> = {
  w: 'nextWordStart', b: 'prevWordStart', e: 'nextWordEnd',
  W: 'nextLongWordStart', B: 'prevLongWordStart', E: 'nextLongWordEnd',
};

const charMotions = { h: 'backward', l: 'forward', j: 'forward', k: 'backward' } as const;

/** Indentation of a new Helix document, which its integration tests use. */
export const HELIX_INDENT = { unit: '\t', tabSize: 4 } as const;

/** Replays Helix key notation (`ciao<esc>`) against the core commands. */
export class Session {
  mode: 'normal' | 'insert' = 'normal';
  private restoreCursor = false;
  private readonly count = new Count();
  /** Columns kept between `j`/`k` presses, like Helix's `old_visual_position`. */
  private columns: (number | undefined)[] | undefined;

  constructor(public text: string, public ranges: readonly OffsetRange[], private readonly eol = '\n') {}

  static from(notation: string): Session {
    const { text, ranges } = parse(notation);
    return new Session(text, ranges);
  }

  get document(): Document {
    return { text: this.text, ranges: this.ranges };
  }

  keys(sequence: string): this {
    for (const [key] of sequence.matchAll(/<[^>]+>|[\s\S]/gu)) { this.key(key); }
    return this;
  }

  private key(key: string): void {
    const text = new WordMotionText(this.text);
    if (this.mode === 'insert') {
      if (key === '<esc>') {
        // ModeController asks for this restore only when `a` entered INSERT.
        if (this.restoreCursor) { this.ranges = restoreAppendCursor(text, this.ranges); }
        this.restoreCursor = false;
        this.mode = 'normal';
      } else if (key === '<del>' || key === '<backspace>') {
        // VS Code's deleteRight / deleteLeft on each caret.
        this.edit(this.ranges.map(({ head }) => key === '<del>'
          ? { from: head, to: text.after(head)?.end ?? head, text: '' }
          : { from: text.before(head)?.start ?? head, to: head, text: '' }));
      } else {
        const typed = ({ '<space>': ' ', '<ret>': this.eol, '<tab>': '\t' } as Record<string, string>)[key] ?? key;
        if (typed.length > 1 && typed.startsWith('<')) { throw new Error(`Unsupported INSERT key ${key}`); }
        this.edit(this.ranges.map(({ head }) => ({ from: head, to: head, text: typed })));
      }
      return;
    }

    if (/^[0-9]$/.test(key)) {
      this.count.digit(Number(key));
      return;
    }
    // Every other key uses the count and drops the remembered columns.
    const count = this.count.take();
    const columns = this.columns;
    this.columns = undefined;
    if (key in motions) {
      this.ranges = this.ranges.map(range => moveWord(text, range, motions[key], count));
    } else if (key === 'h' || key === 'l') {
      this.ranges = merged(this.ranges.map(range => moveHorizontally(text, range, charMotions[key], count)));
    } else if (key === 'j' || key === 'k') {
      const lines = textLines(this.text);
      const moves = this.ranges.map((range, index) =>
        moveVertically(lines, range, charMotions[key], count, HELIX_INDENT.tabSize, columns?.[index]));
      this.ranges = merged(moves.map(move => move.range));
      // A merged cursor has no column, as in Helix; the others keep theirs.
      this.columns = this.ranges.map(range => {
        const sources = moves.filter(move => move.range.anchor === range.anchor && move.range.head === range.head);
        return sources.length === 1 ? sources[0].column : undefined;
      });
    } else if (key === 'i') {
      // prepareInsert: a caret at the start of each selection.
      this.ranges = this.ranges.map(range => {
        const start = Math.min(range.anchor, range.head);
        return { anchor: start, head: start };
      });
      this.enterInsert(false);
    } else if (key === 'a') {
      this.apply(append(text, this.ranges, this.eol));
      this.enterInsert(true);
    } else if (key === 'c') {
      this.apply(changeSelection(text, this.ranges, this.eol, HELIX_INDENT));
      this.enterInsert(false);
    } else if (key === 'd') {
      this.apply(deleteSelection(text, this.ranges));
    } else if (key !== '<esc>' && key !== '-') {
      // `-` is unbound in Helix and blocked here: it only clears the count.
      throw new Error(`Unsupported NORMAL key ${key}`);
    }
  }

  private enterInsert(restoreCursor: boolean): void {
    this.mode = 'insert';
    this.restoreCursor = restoreCursor;
  }

  private apply(result: EditResult): void {
    this.text = applyEdits(this.text, result.edits);
    this.ranges = result.selections;
  }

  /** Native typing: one edit per caret; carets end after their own edit. */
  private edit(edits: { from: number; to: number; text: string }[]): void {
    const sorted = [...edits].sort((a, b) => a.from - b.from);
    const moved = (offset: number) => sorted.reduce((position, edit) =>
      edit.to <= offset ? position + edit.text.length - (edit.to - edit.from) : position, offset);
    this.text = applyEdits(this.text, sorted);
    this.ranges = this.ranges.map(({ head }) => ({ anchor: moved(head), head: moved(head) }));
  }
}

/** Cursors that land on the same position become one, as in both editors. */
function merged(ranges: readonly OffsetRange[]): OffsetRange[] {
  return ranges.filter((range, index) => ranges.findIndex(other =>
    other.anchor === range.anchor && other.head === range.head) === index);
}

export function applyEdits(text: string, edits: readonly { from: number; to: number; text: string }[]): string {
  return [...edits].sort((a, b) => b.from - a.from)
    .reduce((result, edit) => result.slice(0, edit.from) + edit.text + result.slice(edit.to), text);
}
