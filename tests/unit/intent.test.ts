import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/persian-intent.json';
import { classifyIntent, messageHasCreateVerb, needsMeta, needsRag, permitsMutation, shouldReturnCitations } from '../../supabase/functions/ai-assistant/lib/intent';

describe('deterministic Persian intent scenarios', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => expect(classifyIntent(scenario.input)).toBe(scenario.expected));
  }

  it('exposes deterministic context predicates', () => {
    expect(needsRag('search')).toBe(true);
    expect(needsRag('mutate')).toBe(false);
    expect(needsMeta('mutate')).toBe(true);
    expect(needsMeta('chat')).toBe(false);
    expect(shouldReturnCitations('chat', 'memory')).toBe(true);
    expect(permitsMutation('create')).toBe(true);
    expect(permitsMutation('link')).toBe(false);
  });

  it('shares the create signal used for repair gating', () => {
    expect(messageHasCreateVerb('یه یادداشت بنویس')).toBe(true);
    expect(messageHasCreateVerb('یادداشت قبلی را پیدا کن')).toBe(false);
  });

  it('classifies verb-less colloquial sentences that hit production (regression)', () => {
    // جمله‌های واقعی که در production به chat می‌رفتند و پاسخ دروغ می‌ساختند
    expect(classifyIntent({ message: 'یه تسک بزن برای فردا، واریز پول مکمل' })).toBe('create');
    expect(classifyIntent({ message: 'یه تسک دارم؛ گرفتن کاوه نگار برای پاناچت' })).toBe('create');
  });
});
