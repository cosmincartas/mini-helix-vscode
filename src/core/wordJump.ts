/** Helix's default alphabet: every jump takes exactly two unmodified letters. */
export const JUMP_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export interface TextRegion {
  readonly text: string;
  /** UTF-16 document offset of this visible region. */
  readonly offset: number;
}

export interface WordTarget {
  readonly start: number;
  readonly end: number;
  /** End offsets of the first and second graphemes, for in-place labels. */
  readonly firstEnd: number;
  readonly secondEnd: number;
  readonly label: string;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const wordCharacter = /^[\p{Alphabetic}\p{Number}_]+$/u;

/**
 * Find words of at least two graphemes, excluding the word under the primary
 * cursor. Labels alternate forwards/backwards from that cursor, as in Helix.
 * Regions may be disjoint (folds), overlapping, or supplied out of order.
 */
export function wordTargets(regions: readonly TextRegion[], cursor: number): WordTarget[] {
  const words = new Map<number, Omit<WordTarget, 'label'>>();
  for (const region of regions) {
    let start = 0;
    let end = 0;
    let firstEnd = 0;
    let secondEnd = 0;
    let length = 0;
    const finish = () => {
      if (length >= 2 && !(start <= cursor && cursor < end)) {
        words.set(start, { start, end, firstEnd, secondEnd });
      }
      length = 0;
    };
    for (const part of graphemes.segment(region.text)) {
      if (!wordCharacter.test(part.segment)) {
        finish();
        continue;
      }
      if (length === 0) { start = region.offset + part.index; }
      end = region.offset + part.index + part.segment.length;
      length++;
      if (length === 1) { firstEnd = end; }
      if (length === 2) { secondEnd = end; }
    }
    finish();
  }

  const ordered = [...words.values()].sort((a, b) => a.start - b.start);
  const before = ordered.filter(word => word.end <= cursor).reverse();
  const after = ordered.filter(word => word.start > cursor);
  const result: WordTarget[] = [];
  const limit = JUMP_ALPHABET.length ** 2;
  for (let i = 0; (i < before.length || i < after.length) && result.length < limit; i++) {
    for (const word of [after[i], before[i]]) {
      if (!word || result.length === limit) { continue; }
      const index = result.length;
      result.push({
        ...word,
        label: JUMP_ALPHABET[Math.floor(index / JUMP_ALPHABET.length)] +
          JUMP_ALPHABET[index % JUMP_ALPHABET.length],
      });
    }
  }
  return result;
}
