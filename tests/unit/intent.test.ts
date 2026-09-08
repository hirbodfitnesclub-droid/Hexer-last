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
    // قرارداد جدید: citation فقط برای search/link است؛ مود memory
    // به‌تنهایی دلیل برگرداندن citation نیست (وگرنه زیر «تسک بساز»
    // هم کارت مرتبط می‌آمد).
    expect(shouldReturnCitations('search', 'memory')).toBe(true);
    expect(shouldReturnCitations('search', 'auto')).toBe(true);
    expect(shouldReturnCitations('link', 'auto')).toBe(true);
    expect(shouldReturnCitations('create', 'memory')).toBe(false);
    expect(shouldReturnCitations('create', 'auto')).toBe(false);
    expect(shouldReturnCitations('chat', 'memory')).toBe(false);
    expect(shouldReturnCitations('chat', 'auto')).toBe(false);
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

  it('prefers explicit verbs over mode chips (root fix for create-triggering-search)', () => {
    // ریشه باگ: قبلاً mode=memory هر جمله‌ای را search می‌کرد، حتی «بساز».
    // حالا فعل صریح بر چیپ مود غلبه دارد؛ مود فقط پیش‌فرض ابهام است.
    expect(classifyIntent({ message: 'برام تسک بساز', mode: 'memory' })).toBe('create');
    expect(classifyIntent({ message: 'یه تسک بزن برای فردا', mode: 'memory' })).toBe('create');
    expect(classifyIntent({ message: 'تسک خرید را انجام‌شده بزن', mode: 'memory' })).toBe('mutate');
    expect(classifyIntent({ message: 'یادداشت را پیدا کن', mode: 'action' })).toBe('search');
    // بدون فعل صریح، مود همچنان اعمال می‌شود:
    expect(classifyIntent({ message: 'سلام', mode: 'memory' })).toBe('search');
    expect(classifyIntent({ message: 'سلام', mode: 'auto' })).toBe('chat');
    expect(classifyIntent({ message: '', mode: 'action' })).toBe('create');
  });
});
