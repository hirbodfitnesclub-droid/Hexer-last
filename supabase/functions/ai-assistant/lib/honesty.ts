import type { AiIntent } from './intent.ts';

export type HonestyFailureReason = 'no_actions' | 'all_failed' | 'ambiguous' | 'not_found' | 'policy_rejected';
export type HonestyMode = 'none' | 'full' | 'partial';

export interface ActionResultLike {
  operation?: unknown;
}

export interface ApplyHonestyInput {
  intent: AiIntent;
  reply?: string | null;
  actionResults?: readonly ActionResultLike[] | null;
  acceptedMutationCount?: number;
  hadAcceptedActions?: boolean;
  failureHints?: readonly HonestyFailureReason[];
}

export interface HonestyResult {
  reply: string;
  mode: HonestyMode;
  acceptedMutationCount: number;
  successMutationCount: number;
}

// عملیات‌هایی که واقعاً در دیتابیس می‌نویسند؛ هر ادعای موفقیت باید پشتوانه‌ی
// دست‌کم یکی از این‌ها را داشته باشد، مستقل از اینکه intent چه طبقه‌بندی شده.
const WRITE_OPERATIONS = new Set(['create', 'update', 'complete', 'link', 'unlink']);

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const SUCCESS_PATTERNS = [
  /ساختم/u, /ایجاد (?:شد|کردم)/u, /ثبت (?:شد|کردم)/u, /انجام (?:شد|دادم)/u,
  /آپدیت (?:شد|کردم)/u, /به ?روز (?:شد|کردم)/u, /تکمیل (?:شد|کردم)/u,
  /تمام (?:شد|کردم)/u, /ویرایش (?:شد|کردم)/u, /تنظیم (?:شد|کردم)/u,
  /created/i, /updated/i, /completed/i, /done/i, /(?:reminder|remind).*(?:set|scheduled)/i,
];

export function looksLikeSuccessClaim(reply?: string | null): boolean {
  const text = String(reply ?? '').trim();
  return text.length > 0 && SUCCESS_PATTERNS.some((pattern) => pattern.test(text));
}

export function stripTechnicalIdentifiers(reply?: string | null): string {
  return String(reply ?? '')
    .replace(UUID_PATTERN, '')
    .replace(/\[(?:TASK|NOTE|PROJECT|HABIT)(?::[^\]]*)?\]/gi, '')
    .replace(/#[\w-]+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([،,.!?؟])/g, '$1')
    .trim();
}

export function buildHonestFailureReply(input: { intent: AiIntent; reason: HonestyFailureReason }): string {
  if (input.reason === 'ambiguous') return 'چند تسک شبیه هم پیدا شد؛ لطفاً عنوان دقیق‌تر را بگو.';
  if (input.reason === 'not_found') return 'تسک موردنظر پیدا نشد. لطفاً عنوان را دقیق‌تر بفرست.';
  if (input.reason === 'policy_rejected') return 'این تغییر در حالت فعلی مجاز نبود. لطفاً دستور را ساده‌تر بگو.';
  if (input.reason === 'no_actions' && input.intent === 'create') {
    return 'نتونستم عملیات ساخت رو قطعی انجام بدم. لطفاً عنوان و جزئیات را واضح‌تر بگو.';
  }
  return 'درخواست فهمیده شد، اما ذخیره یا به‌روزرسانی موفق نبود. لطفاً یک‌بار دیگر تلاش کن.';
}

export function applyHonesty(input: ApplyHonestyInput): HonestyResult {
  const results = Array.isArray(input.actionResults) ? input.actionResults : [];
  const successMutationCount = results.filter((result) => WRITE_OPERATIONS.has(String(result?.operation))).length;
  const acceptedMutationCount = Math.max(0, input.acceptedMutationCount ?? (input.hadAcceptedActions ? 1 : 0));
  const guardedIntent = input.intent === 'create' || input.intent === 'mutate';

  const resolveReason = (): HonestyFailureReason => {
    const hintedReason = input.failureHints?.find((reason) => reason === 'ambiguous' || reason === 'not_found' || reason === 'policy_rejected');
    return hintedReason ?? (acceptedMutationCount > 0 ? 'all_failed' : 'no_actions');
  };

  // گارد مستقل از intent (تصمیم محصولی ثبت‌شده در honesty-enforcement.json):
  // اگر مدل ادعای موفقیت کرده ولی هیچ نوشتن واقعی در دیتابیس تأیید نشده،
  // پاسخ باید به شکست صادقانه جایگزین شود — حتی وقتی classifier جمله را
  // اشتباه به chat/search فرستاده. «انجام شد» بدون write واقعی توهم است.
  if (successMutationCount === 0 && looksLikeSuccessClaim(input.reply)) {
    return {
      reply: buildHonestFailureReply({ intent: input.intent, reason: resolveReason() }),
      mode: 'full', acceptedMutationCount, successMutationCount,
    };
  }

  if (guardedIntent && successMutationCount === 0) {
    return {
      reply: buildHonestFailureReply({ intent: input.intent, reason: resolveReason() }),
      mode: 'full', acceptedMutationCount, successMutationCount,
    };
  }

  if (guardedIntent && acceptedMutationCount > successMutationCount) {
    return {
      reply: `${successMutationCount} مورد با موفقیت انجام شد، اما ${acceptedMutationCount - successMutationCount} مورد انجام نشد.`,
      mode: 'partial', acceptedMutationCount, successMutationCount,
    };
  }

  const safeReply = stripTechnicalIdentifiers(input.reply) || (successMutationCount > 0 ? 'عملیات با موفقیت انجام شد.' : 'در خدمتم.');
  return { reply: safeReply, mode: 'none', acceptedMutationCount, successMutationCount };
}
