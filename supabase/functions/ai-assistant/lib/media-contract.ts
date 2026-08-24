export type AudioInputFormat = 'webm' | 'mp3' | 'wav' | 'ogg' | 'm4a';

const AUDIO_FORMAT_BY_MIME: Readonly<Record<string, AudioInputFormat>> = {
  'audio/webm': 'webm',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
};

const AUDIO_FORMAT_BY_EXTENSION: Readonly<Record<string, AudioInputFormat>> = {
  webm: 'webm',
  mp3: 'mp3',
  wav: 'wav',
  ogg: 'ogg',
  oga: 'ogg',
  m4a: 'm4a',
  mp4: 'm4a',
};

export function resolveAudioInputFormat(path: string, mimeType?: string): AudioInputFormat {
  const normalizedMime = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalizedMime && AUDIO_FORMAT_BY_MIME[normalizedMime]) {
    return AUDIO_FORMAT_BY_MIME[normalizedMime];
  }

  const cleanPath = path.split(/[?#]/, 1)[0];
  const extension = cleanPath.split('.').pop()?.toLowerCase() || '';
  const format = AUDIO_FORMAT_BY_EXTENSION[extension];
  if (!format) throw new Error('Unsupported audio format');
  return format;
}

export function buildAudioInputPart(data: string, format: AudioInputFormat) {
  if (!data) throw new Error('Audio data is empty');
  return {
    type: 'input_audio' as const,
    input_audio: { data, format },
  };
}
