/**
 * Persian text normalization shared by indexing and querying. Both sides must apply
 * the identical transform, otherwise a document indexed with one spelling of ی or ک
 * becomes unreachable by a query that spells it the other way.
 */

export const NORMALIZER_VERSION = 'fa-normalize-v1';

const ARABIC_YEH = /[يى]/g;          // ي ى -> ی
const ARABIC_KAF = /ك/g;                  // ك -> ک
const ARABIC_HEH = /ة/g;                  // ة -> ه
const ARABIC_ALEF_VARIANTS = /[أإآ]/g; // أ إ آ -> ا
const DIACRITICS = /[ً-ْٓ-ٰٕ]/g;
const TATWEEL = /ـ/g;
const ZERO_WIDTH = /[​‌‍‎‏﻿]/g;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Folds Persian and Arabic-Indic digits to ASCII so "۱۲" and "12" match. */
export function foldDigits(value: string): string {
  let out = '';
  for (const char of value) {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian >= 0) { out += String(persian); continue; }
    const arabic = ARABIC_INDIC_DIGITS.indexOf(char);
    if (arabic >= 0) { out += String(arabic); continue; }
    out += char;
  }
  return out;
}

/**
 * Canonical form for storage and matching: unified letters, no diacritics, ASCII
 * digits, zero-width characters turned into spaces, and collapsed whitespace.
 */
export function normalizePersian(value: unknown): string {
  if (typeof value !== 'string') return '';
  let text = value.normalize('NFC');
  text = text.replace(ZERO_WIDTH, ' ');
  text = text.replace(ARABIC_YEH, 'ی');
  text = text.replace(ARABIC_KAF, 'ک');
  text = text.replace(ARABIC_HEH, 'ه');
  text = text.replace(ARABIC_ALEF_VARIANTS, 'ا');
  text = text.replace(DIACRITICS, '');
  text = text.replace(TATWEEL, '');
  text = foldDigits(text);
  text = text.toLocaleLowerCase('fa-IR');
  return text.replace(/\s+/g, ' ').trim();
}

/** Normalized tokens, used for exact-title and tag matching. */
export function normalizedTokens(value: unknown): string[] {
  const normalized = normalizePersian(value);
  if (!normalized) return [];
  return normalized
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Stable hash of the normalized content, used to detect real changes. */
export async function contentHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizePersian(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const CHUNKER_VERSION = 'fa-chunk-v1';

export interface MemoryChunk {
  ordinal: number;
  content: string;
  spanStart: number;
  spanEnd: number;
  tokenEstimate: number;
}

const MAX_CHUNK_CHARS = 900;
const CHUNK_OVERLAP_CHARS = 120;

/**
 * Splits text into overlapping chunks on sentence-ish boundaries. Spans are offsets
 * into the normalized text, so a citation can highlight exactly what was retrieved.
 */
export function chunkText(text: string): MemoryChunk[] {
  const normalized = normalizePersian(text);
  if (!normalized) return [];
  if (normalized.length <= MAX_CHUNK_CHARS) {
    return [{ ordinal: 0, content: normalized, spanStart: 0, spanEnd: normalized.length, tokenEstimate: estimateTokens(normalized) }];
  }

  const chunks: MemoryChunk[] = [];
  let start = 0;
  let ordinal = 0;
  while (start < normalized.length) {
    const hardEnd = Math.min(start + MAX_CHUNK_CHARS, normalized.length);
    const end = hardEnd === normalized.length ? hardEnd : findBoundary(normalized, start, hardEnd);
    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({ ordinal, content, spanStart: start, spanEnd: end, tokenEstimate: estimateTokens(content) });
      ordinal += 1;
    }
    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }
  return chunks;
}

function findBoundary(text: string, start: number, hardEnd: number): number {
  const window = text.slice(start, hardEnd);
  for (const marker of ['۔', '.', '!', '؟', '?', '\n', '،', ' ']) {
    const index = window.lastIndexOf(marker);
    if (index > MAX_CHUNK_CHARS * 0.4) return start + index + 1;
  }
  return hardEnd;
}

/** Rough token count; Persian averages near four characters per token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
