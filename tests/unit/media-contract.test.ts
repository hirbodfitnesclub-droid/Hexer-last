import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/audio-input.json';
import {
  buildAudioInputPart,
  resolveAudioInputFormat,
} from '../../supabase/functions/ai-assistant/lib/media-contract';

describe('OpenRouter audio input contract', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if ('error' in scenario) {
        expect(() => resolveAudioInputFormat(scenario.path, scenario.mime)).toThrow(scenario.error);
      } else {
        expect(resolveAudioInputFormat(scenario.path, scenario.mime)).toBe(scenario.expected);
      }
    });
  }

  it('uses input_audio with raw base64 instead of a data URL', () => {
    expect(buildAudioInputPart('YWJj', 'webm')).toEqual({
      type: 'input_audio',
      input_audio: { data: 'YWJj', format: 'webm' },
    });
  });

  it('rejects empty audio data', () => {
    expect(() => buildAudioInputPart('', 'mp3')).toThrow('Audio data is empty');
  });
});
