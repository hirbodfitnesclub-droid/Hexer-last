/**
 * Recording constraints and MIME negotiation for voice capture.
 *
 * The pipeline itself is unchanged: audio still goes to Gemini 3.1 in a single call.
 * This module only decides what the browser records and when a capture is rejected,
 * so Safari and iOS work and the microphone is never left open.
 */

export const MAX_RECORDING_MS = 120_000;
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024;

/** Ordered by how well each container is understood downstream. */
export const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
] as const;

export type RecorderErrorCode =
  | 'permission_denied'
  | 'no_device'
  | 'unsupported'
  | 'too_long'
  | 'too_large'
  | 'empty'
  | 'recorder_error';

export interface RecorderError {
  code: RecorderErrorCode;
  message: string;
}

/**
 * Picks the first container the browser will actually record. Returning undefined is
 * valid and means "let the browser choose its own default", which is what older Safari
 * requires; passing an unsupported mimeType there throws instead.
 */
export function selectMimeType(
  isTypeSupported?: (type: string) => boolean
): string | undefined {
  if (typeof isTypeSupported !== 'function') return undefined;
  for (const candidate of PREFERRED_MIME_TYPES) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      // A browser that throws on probing is treated as not supporting the type.
    }
  }
  return undefined;
}

/** Strips codec parameters so the value can be used as a blob type and an extension hint. */
export function baseMimeType(mimeType: string | undefined): string {
  if (!mimeType) return 'audio/webm';
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

export function fileExtensionFor(mimeType: string | undefined): string {
  switch (baseMimeType(mimeType)) {
    case 'audio/ogg': return 'ogg';
    case 'audio/mp4': return 'm4a';
    case 'audio/mpeg': return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav': return 'wav';
    default: return 'webm';
  }
}

export function describeMediaError(error: unknown): RecorderError {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { code: 'permission_denied', message: 'اجازهٔ دسترسی به میکروفون داده نشد.' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { code: 'no_device', message: 'میکروفونی پیدا نشد.' };
  }
  if (name === 'NotReadableError') {
    return { code: 'recorder_error', message: 'میکروفون در دسترس برنامهٔ دیگری است.' };
  }
  return { code: 'unsupported', message: 'ضبط صدا در این مرورگر پشتیبانی نمی‌شود.' };
}

/** Rejects a capture that is empty, too long, or too large, before any upload happens. */
export function validateRecording(input: {
  size: number;
  durationMs: number;
}): RecorderError | null {
  if (input.size <= 0) return { code: 'empty', message: 'صدایی ضبط نشد.' };
  if (input.durationMs > MAX_RECORDING_MS) {
    return { code: 'too_long', message: 'حداکثر مدت ضبط ۲ دقیقه است.' };
  }
  if (input.size > MAX_RECORDING_BYTES) {
    return { code: 'too_large', message: 'حجم فایل صوتی بیش از حد مجاز است.' };
  }
  return null;
}
