export const MODEL_KEYS = {
  PRIMARY: 'gemini-3.1-flash-lite',
  EMBEDDING: 'gemini-embedding-2',
} as const;

export type ModelKey = typeof MODEL_KEYS[keyof typeof MODEL_KEYS];
export type ThinkingEffort = 'minimal' | 'low' | 'medium' | 'high';

type ModelConfig = {
  key: ModelKey;
  providerSlug: string;
  maxOutputTokens: number;
  deprecatesAt: string | null;
};

const registry: Record<ModelKey, ModelConfig> = {
  [MODEL_KEYS.PRIMARY]: {
    key: MODEL_KEYS.PRIMARY,
    providerSlug: 'google/gemini-3.1-flash-lite',
    maxOutputTokens: 8_192,
    deprecatesAt: '2027-05-07T00:00:00.000Z',
  },
  [MODEL_KEYS.EMBEDDING]: {
    key: MODEL_KEYS.EMBEDDING,
    providerSlug: 'google/gemini-embedding-2',
    maxOutputTokens: 0,
    deprecatesAt: null,
  },
};

export function resolveModel(key: string): ModelConfig {
  const normalized = key.replace(/^google\//, '');
  const config = registry[normalized as ModelKey];
  if (!config) throw new Error(`Unapproved model key: ${key}`);
  return config;
}

export function chooseThinkingEffort(input: {
  mode?: string;
  hasMedia?: boolean;
  message?: string;
}): ThinkingEffort {
  const text = input.message || '';
  if (input.hasMedia || /تکرار|یادآور|هر روز|هر هفته|شمسی|انجام دادم|تموم کردم/.test(text)) return 'medium';
  if (input.mode === 'memory' || /پیدا|جستجو|نوت|یادداشت|تسک|کار/.test(text)) return 'low';
  return 'minimal';
}
