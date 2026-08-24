import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/recorder-constraints.json';
import {
  baseMimeType,
  describeMediaError,
  fileExtensionFor,
  MAX_RECORDING_BYTES,
  MAX_RECORDING_MS,
  selectMimeType,
  validateRecording,
} from '../../features/chat/hooks/recorderConstraints';

/** Fake browser support matrix: only the listed types are recordable. */
function supportOnly(types: string[]) {
  return (type: string) => types.includes(type);
}

describe('voice recorder constraints', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      if (scenario.kind === 'select') {
        expect(selectMimeType(supportOnly(scenario.input as string[])) ?? null).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'base') {
        expect(baseMimeType(scenario.input as string | undefined)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'ext') {
        expect(fileExtensionFor(scenario.input as string | undefined)).toBe(scenario.expected);
        return;
      }
      if (scenario.kind === 'error') {
        const error = Object.assign(new Error('probe'), { name: scenario.input as string });
        expect(describeMediaError(error).code).toBe(scenario.expected);
        return;
      }
      const result = validateRecording(scenario.input as { size: number; durationMs: number });
      expect(result?.code ?? null).toBe(scenario.expected);
    });
  }

  it('omits the option when the browser cannot probe support at all', () => {
    expect(selectMimeType(undefined)).toBeUndefined();
  });

  it('treats a browser that throws while probing as unsupported', () => {
    expect(selectMimeType(() => { throw new Error('probe failed'); })).toBeUndefined();
  });

  it('prefers Opus in WebM when several containers are available', () => {
    const supported = supportOnly(['audio/mp4', 'audio/webm', 'audio/webm;codecs=opus']);
    expect(selectMimeType(supported)).toBe('audio/webm;codecs=opus');
  });

  it('accepts a capture exactly at both limits', () => {
    expect(validateRecording({ size: MAX_RECORDING_BYTES, durationMs: MAX_RECORDING_MS })).toBeNull();
  });

  it('produces a Persian message for every rejection', () => {
    for (const input of [{ size: 0, durationMs: 1 }, { size: 10, durationMs: MAX_RECORDING_MS + 1 }, { size: MAX_RECORDING_BYTES + 1, durationMs: 10 }]) {
      const error = validateRecording(input);
      expect(error?.message).toBeTruthy();
      expect(error?.message).toMatch(/[؀-ۿ]/);
    }
  });

  it('describes an unknown failure without leaking the raw error', () => {
    const described = describeMediaError({ name: 'WeirdError', message: 'internal detail' });
    expect(described.code).toBe('unsupported');
    expect(described.message).not.toContain('internal detail');
  });
});
