import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/honesty-enforcement.json';
import { applyHonesty, looksLikeSuccessClaim, stripTechnicalIdentifiers } from '../../supabase/functions/ai-assistant/lib/honesty';

describe('honesty enforcement scenarios', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const result = applyHonesty(scenario.input as never);
      expect(result.mode).toBe(scenario.expected.mode);
      if (scenario.expected.replyIncludes) expect(result.reply).toContain(scenario.expected.replyIncludes);
      if (scenario.expected.replyExcludes) expect(result.reply).not.toContain(scenario.expected.replyExcludes);
    });
  }

  it('recognizes common false success claims', () => {
    expect(looksLikeSuccessClaim('باشه، تسک رو ساختم')).toBe(true);
    expect(looksLikeSuccessClaim('یادآوری برای فردا تنظیم شد.')).toBe(true);
    expect(looksLikeSuccessClaim('Reminder set for tomorrow.')).toBe(true);
    expect(looksLikeSuccessClaim('می‌تونی عنوان رو بگی؟')).toBe(false);
  });

  it('blocks false success claims even when intent was misclassified as chat/search', () => {
    // بازتولید دقیق حادثه‌ی production: جمله‌ی بی‌فعل → intent=chat → گارد قدیمی خاموش
    const chatResult = applyHonesty({
      intent: 'chat',
      reply: 'تسک «واریز پول مکمل» برای فردا با موفقیت ایجاد شد.',
      actionResults: [],
      acceptedMutationCount: 0,
    });
    expect(chatResult.mode).toBe('full');
    expect(chatResult.reply).not.toContain('ایجاد شد');

    const searchResult = applyHonesty({
      intent: 'search',
      reply: 'یادآورت تنظیم شد!',
      actionResults: [],
      acceptedMutationCount: 0,
    });
    expect(searchResult.mode).toBe('full');

    const plainChat = applyHonesty({
      intent: 'chat',
      reply: 'سلام! چطور می‌تونم کمک کنم؟',
      actionResults: [],
      acceptedMutationCount: 0,
    });
    expect(plainChat.mode).toBe('none');
  });

  it('counts every database-writing operation as a real mutation', () => {
    for (const operation of ['create', 'update', 'complete', 'link', 'unlink']) {
      const result = applyHonesty({
        intent: 'chat',
        reply: 'انجام شد.',
        actionResults: [{ operation }],
        acceptedMutationCount: 0,
      });
      expect(result.mode).toBe('none');
      expect(result.successMutationCount).toBe(1);
    }
    const suggestOnly = applyHonesty({
      intent: 'link',
      reply: 'لینک با موفقیت ثبت شد.',
      actionResults: [{ operation: 'suggest_link' }],
      acceptedMutationCount: 0,
    });
    expect(suggestOnly.mode).toBe('full');
  });

  it('strips technical identifiers defensively', () => {
    expect(stripTechnicalIdentifiers('[TASK] انجام شد #internal 550e8400-e29b-41d4-a716-446655440000')).toBe('انجام شد');
  });
});
