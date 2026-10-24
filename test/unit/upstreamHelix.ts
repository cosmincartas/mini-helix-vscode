/**
 * Dedicated import of helix_core::test::print at
 * ba40e547426b0f9896c8bdc699a4ab11f2b37dbc (MPL-2.0).
 * The existing helix.ts round-trip notation intentionally stays unchanged.
 */
import { normalizeSelections, SelectionSet } from '../../src/core/lineSelection';
import { OffsetRange } from '../../src/core/wordMotion';

export interface UpstreamDocument extends SelectionSet {
  readonly text: string;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Parse upstream display notation, including its repeated LF/CRLF skipping. */
export function parseUpstream(notation: string): UpstreamDocument {
  const graphemes = Array.from(segmenter.segment(notation), item => item.segment);
  let text = '';
  let primaryIndex: number | undefined;
  const ranges: OffsetRange[] = [];
  for (let index = 0; index < graphemes.length; index++) {
    const character = graphemes[index];
    if (character !== '#') { text += character; continue; }
    const next = graphemes[++index];
    if (next === undefined) { break; } // Same trailing-marker behavior as print.
    if (next !== '[' && next !== '(') { text += '#' + next; continue; }
    const primary = next === '[';
    if (primary && primaryIndex !== undefined) { throw new Error('Upstream notation repeats the primary range'); }
    const close = primary ? ']' : ')';
    const start = text.length;
    const headAtStart = graphemes[index + 1] === '|';
    if (headAtStart) { index++; }
    let closed = false;
    for (index++; index < graphemes.length; index++) {
      const current = graphemes[index];
      if (current !== close || graphemes[index + 1] !== '#' || (!headAtStart && !text.endsWith('|'))) {
        text += current;
        continue;
      }
      if (!headAtStart) { text = text.slice(0, -1); }
      index++; // Closing #.
      const last = Array.from(segmenter.segment(text)).at(-1)?.segment;
      if ((last === '\n' || last === '\r\n') && graphemes[index + 1] === last) { index++; }
      if (primary) { primaryIndex = ranges.length; }
      ranges.push(headAtStart ? { anchor: text.length, head: start } : { anchor: start, head: text.length });
      closed = true;
      break;
    }
    if (!closed) { throw new Error(`Unclosed upstream range in ${JSON.stringify(notation)}`); }
  }
  if (primaryIndex === undefined) { throw new Error('Upstream notation has no primary range'); }
  return { text, ...normalizeSelections(ranges, primaryIndex) };
}
