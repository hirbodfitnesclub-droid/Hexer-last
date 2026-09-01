import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/persian-normalization.json';
import {
  chunkText,
  CHUNKER_VERSION,
  estimateTokens,
  foldDigits,
  normalizedTokens,
  normalizePersian,
  NORMALIZER_VERSION,
} from '../../supabase/functions/_shared/persian-text';

describe('Persian text normalization', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.kind === 'normalize') {
        expect(normalizePersian(scenario.input)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'tokens') {
        expect(normalizedTokens(scenario.input)).toEqual(scenario.expected);
        return;
      }
      const [left, right] = scenario.input as [string, string];
      expect(normalizePersian(left) === normalizePersian(right)).toBe(scenario.expected);
    });
  }

  it('pins the normalizer and chunker versions', () => {
    expect(NORMALIZER_VERSION).toBe('fa-normalize-v1');
    expect(CHUNKER_VERSION).toBe('fa-chunk-v1');
  });

  it('folds digits without touching surrounding letters', () => {
    expect(foldDigits('ساعت ۱۴:۳۰')).toBe('ساعت 14:30');
  });

  it('is idempotent, so re-indexing cannot drift', () => {
    const once = normalizePersian('يادداشتِ مُهم ۱۲');
    expect(normalizePersian(once)).toBe(once);
  });

  it('returns a single chunk for short text', () => {
    const chunks = chunkText('یک یادداشت کوتاه');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ ordinal: 0, spanStart: 0 });
  });

  it('splits long text into overlapping ordered chunks with usable spans', () => {
    const long = Array.from({ length: 60 }, (_, i) => `این جمله شماره ${i} از یک یادداشت بلند فارسی است.`).join(' ');
    const chunks = chunkText(long);
    const normalized = normalizePersian(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(c => c.ordinal)).toEqual(chunks.map((_, i) => i));
    for (const chunk of chunks) {
      expect(chunk.spanEnd).toBeGreaterThan(chunk.spanStart);
      expect(chunk.spanEnd).toBeLessThanOrEqual(normalized.length);
      expect(normalized.slice(chunk.spanStart, chunk.spanEnd)).toContain(chunk.content.slice(0, 20));
    }
    // Consecutive chunks overlap, so a phrase on a boundary stays retrievable.
    expect(chunks[1].spanStart).toBeLessThan(chunks[0].spanEnd);
  });

  it('produces no chunks for empty input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('estimates at least one token for any content', () => {
    expect(estimateTokens('a')).toBeGreaterThanOrEqual(1);
  });
});
