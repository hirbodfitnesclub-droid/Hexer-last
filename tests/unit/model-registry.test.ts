import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/model-registry.json';
import {
  MODEL_KEYS,
  chooseThinkingEffort,
  resolveModel,
} from '../../supabase/functions/_shared/model-registry';

describe('model registry scenario contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if ('error' in scenario) {
        expect(() => resolveModel(scenario.input)).toThrow(scenario.error);
      } else {
        expect(resolveModel(scenario.input).providerSlug).toBe(scenario.expected);
      }
    });
  }

  it('keeps the primary model on Gemini 3.1 Flash-Lite', () => {
    expect(resolveModel(MODEL_KEYS.PRIMARY)).toMatchObject({
      key: 'gemini-3.1-flash-lite',
      providerSlug: 'google/gemini-3.1-flash-lite',
      maxOutputTokens: 8192,
    });
  });

  it('uses medium thinking for implicit completion language', () => {
    expect(chooseThinkingEffort({ message: 'راستی آن کار را انجام دادم' })).toBe('medium');
  });

  it('uses low thinking for memory retrieval', () => {
    expect(chooseThinkingEffort({ mode: 'memory', message: 'یادم نیست' })).toBe('low');
  });

  it('uses minimal thinking for ordinary chat', () => {
    expect(chooseThinkingEffort({ message: 'سلام، خوبی؟' })).toBe('minimal');
  });
});
