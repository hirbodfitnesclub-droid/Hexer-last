import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/ai-telemetry.json';
import { normalizeOpenRouterUsage } from '../../supabase/functions/_shared/ai-telemetry';

describe('OpenRouter telemetry normalization', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      expect(normalizeOpenRouterUsage(scenario.input)).toMatchObject(scenario.expected);
    });
  }

  it('does not retain raw response content', () => {
    const normalized = normalizeOpenRouterUsage({
      choices: [{ message: { content: 'private user content' } }],
      usage: { prompt_tokens: 1 },
    });
    expect(JSON.stringify(normalized)).not.toContain('private user content');
  });
});
