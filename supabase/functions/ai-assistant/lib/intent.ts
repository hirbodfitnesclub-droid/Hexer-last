export type AiIntent = 'chat' | 'create' | 'search' | 'link' | 'extract' | 'mutate';
export type AssistantMode = 'auto' | 'action' | 'memory' | string | undefined;

export interface IntentInput {
  message?: string | null;
  mode?: AssistantMode;
  hasMedia?: boolean;
}

const CREATE_SIGNALS = [
  'بساز', 'ایجاد کن', 'اضافه کن', 'ثبت کن', 'یادداشت کن', 'یادداشت بردار',
  'بنویس', 'درست کن', 'تنظیم کن', 'تنظیمش کن', 'بذار', 'بگذار',
  'کار جدید', 'تسک جدید', 'پروژه جدید', 'عادت جدید', 'یادآور', 'یادآوری',
  // الگوهای محاوره‌ای بدون فعل صریح؛ جمله‌های واقعی production مثل
  // «یه تسک بزن برای فردا» و «یه تسک دارم؛ ...» همین شکلی‌اند.
  // فقط ترکیب‌های بی‌ابهام: «اسم + بزن» (امری) و «اسم + دارم» (اعلام وجود).
  'تسک بزن', 'نوت بزن', 'یادداشت بزن', 'پروژه بزن', 'عادت بزن',
  'تسک دارم', 'یادداشت دارم', 'عادت دارم',
  'create', 'add task', 'add note', 'new task', 'new note', 'set a reminder', 'remind me',
];
const MUTATE_SIGNALS = [
  'انجام دادم', 'انجامش دادم', 'انجام شده', 'انجام‌شده', 'تمومش کردم', 'تمامش کردم',
  'تکمیل کن', 'تکمیلش کن', 'تموم کن', 'تمام کن', 'تیک بزن',
  'ویرایش کن', 'ویرایشش کن', 'عوض کن', 'تغییر بده', 'آپدیت کن', 'به تعویق بنداز',
  'عقب بنداز', 'عقب بینداز', 'چرت بزن', 'باز کن', 'دوباره باز کن', 'بازش کن',
  'خوانده کن', 'خوانده شده', 'خوانده نشده', 'نخوانده کن', 'چک لیست', 'چک‌لیست',
  'mark done', 'complete', 'update', 'edit', 'rename', 'reopen', 'snooze', 'mark read', 'mark unread',
];
const LINK_SIGNALS = ['لینک کن', 'وصل کن', 'ارتباط بده', 'مرتبط کن', 'پیوند بده', 'link ', 'connect '];
const SEARCH_SIGNALS = [
  'پیدا کن', 'پیداش کن', 'بگرد', 'جستجو کن', 'جست‌وجو کن', 'نشون بده', 'نشان بده',
  'چی دارم', 'یادم بیار', 'کجاست', 'لیست کن', 'فهرست کن', 'مرور کن',
  'find ', 'search ', 'show me', 'where is', 'list my',
];

export function normalizeIntentText(message?: string | null): string {
  return String(message ?? '')
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesSignal(message: string, signals: readonly string[]): boolean {
  return signals.some((signal) => message.includes(signal.trim()));
}

export function messageHasCreateVerb(message?: string | null): boolean {
  return includesSignal(normalizeIntentText(message), CREATE_SIGNALS);
}

export const hasCreateVerb = messageHasCreateVerb;

export function classifyIntent(input: IntentInput): AiIntent;
export function classifyIntent(message?: string | null, mode?: AssistantMode, hasMedia?: boolean): AiIntent;
export function classifyIntent(inputOrMessage: IntentInput | string | null = {}, mode?: AssistantMode, hasMedia?: boolean): AiIntent {
  const input = typeof inputOrMessage === 'object' && inputOrMessage !== null
    ? inputOrMessage
    : { message: inputOrMessage, mode, hasMedia };
  if (input.hasMedia) return 'extract';
  if (input.mode === 'memory') return 'search';

  const text = normalizeIntentText(input.message as string | null | undefined);
  const create = includesSignal(text, CREATE_SIGNALS);
  const mutate = includesSignal(text, MUTATE_SIGNALS);
  const link = includesSignal(text, LINK_SIGNALS);
  const search = includesSignal(text, SEARCH_SIGNALS);

  if (mutate) return 'mutate';
  if (link) return 'link';
  if (create) return 'create';
  if (search) return 'search';
  if (input.mode === 'action') return 'create';
  return 'chat';
}

export function needsRag(intent: AiIntent): boolean {
  return intent === 'search' || intent === 'link';
}

export function needsMeta(intent: AiIntent): boolean {
  return intent === 'create' || intent === 'search' || intent === 'link' || intent === 'mutate';
}

export function shouldReturnCitations(intent: AiIntent, mode?: AssistantMode): boolean {
  return mode === 'memory' || needsRag(intent);
}

export function permitsMutation(intent: AiIntent): boolean {
  return intent === 'create' || intent === 'mutate';
}
