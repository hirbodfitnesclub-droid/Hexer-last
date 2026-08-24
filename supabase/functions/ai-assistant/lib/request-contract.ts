export const AI_HISTORY_LIMIT = 8;
export const AI_MESSAGE_LIMIT = 12_000;
export const AI_HISTORY_TEXT_LIMIT = 4_000;

export type AssistantMode = 'auto' | 'action' | 'memory' | 'chat';

export interface AssistantRequest {
  message: string;
  history: Array<{ sender: 'user' | 'ai'; text: string }>;
  mode: AssistantMode;
  audioPath?: string;
  imagePath?: string;
  undoReceiptId?: string;
  requestId?: string;
  idempotencyKey?: string;
  filters?: {
    types?: Array<'task' | 'note' | 'project'>;
    timeRange?: 'all' | 'today' | 'last_week';
  };
}

const MODES = new Set<AssistantMode>(['auto', 'action', 'memory', 'chat']);
const ENTITY_TYPES = new Set(['task', 'note', 'project']);
const TIME_RANGES = new Set(['all', 'today', 'last_week']);

export function parseAssistantRequest(value: unknown): AssistantRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid request body');
  }
  const input = value as Record<string, unknown>;
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (message.length > AI_MESSAGE_LIMIT) throw new Error('Message is too long');

  const mode = (typeof input.mode === 'string' ? input.mode : 'auto') as AssistantMode;
  if (!MODES.has(mode)) throw new Error('Invalid assistant mode');

  const audioPath = parseOptionalPath(input.audioPath, 'audioPath');
  const imagePath = parseOptionalPath(input.imagePath, 'imagePath');
  const undoReceiptId = parseOptionalUuid(input.undoReceiptId, 'undoReceiptId');
  const requestId = parseOptionalUuid(input.requestId, 'requestId');
  const idempotencyKey = parseOptionalIdempotencyKey(input.idempotencyKey);
  if (!message && !audioPath && !imagePath && !undoReceiptId) throw new Error('Message, media, or undo receipt is required');

  const rawHistory = input.history == null ? [] : input.history;
  if (!Array.isArray(rawHistory)) throw new Error('History must be an array');
  const history = rawHistory.slice(-AI_HISTORY_LIMIT).map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid history item');
    const entry = item as Record<string, unknown>;
    if (entry.sender !== 'user' && entry.sender !== 'ai') throw new Error('Invalid history sender');
    if (typeof entry.text !== 'string') throw new Error('Invalid history text');
    return {
      sender: entry.sender as 'user' | 'ai',
      text: entry.text.slice(0, AI_HISTORY_TEXT_LIMIT),
    };
  });

  return {
    message,
    history,
    mode,
    ...(audioPath ? { audioPath } : {}),
    ...(imagePath ? { imagePath } : {}),
    ...(undoReceiptId ? { undoReceiptId } : {}),
    ...(requestId ? { requestId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(input.filters == null ? {} : { filters: parseFilters(input.filters) }),
  };
}

function parseOptionalPath(value: unknown, field: string): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 500) throw new Error(`Invalid ${field}`);
  return value;
}

function parseOptionalUuid(value: unknown, field: string): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseOptionalIdempotencyKey(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || value.length < 8 || value.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error('Invalid idempotencyKey');
  }
  return value;
}

function parseFilters(value: unknown): AssistantRequest['filters'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid filters');
  const raw = value as Record<string, unknown>;
  const types = raw.types == null ? undefined : raw.types;
  if (types !== undefined && (!Array.isArray(types) || types.some((type) => !ENTITY_TYPES.has(String(type))))) {
    throw new Error('Invalid filter types');
  }
  const validTypes = types as Array<'task' | 'note' | 'project'> | undefined;
  const timeRange = raw.timeRange == null ? undefined : String(raw.timeRange);
  if (timeRange !== undefined && !TIME_RANGES.has(timeRange)) throw new Error('Invalid time range');
  return {
    ...(validTypes ? { types: [...new Set(validTypes)] } : {}),
    ...(timeRange ? { timeRange: timeRange as 'all' | 'today' | 'last_week' } : {}),
  };
}
