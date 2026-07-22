import {
  ChecklistItem,
  TaskRecurrence,
  TaskRecurrenceEnd,
} from '../types';
import {
  formatPersianDate,
  getDaysInPersianMonth,
  getTehranDateString,
  persianMonths,
  toGregorian,
  toJalaali,
} from './dateUtils';
import { newId } from './uuid';

/** Display order: Saturday → Friday with JS getDay() values. */
export const WEEKDAYS_FA: ReadonlyArray<{ jsDay: number; label: string }> = [
  { jsDay: 6, label: 'شنبه' },
  { jsDay: 0, label: 'یکشنبه' },
  { jsDay: 1, label: 'دوشنبه' },
  { jsDay: 2, label: 'سه‌شنبه' },
  { jsDay: 3, label: 'چهارشنبه' },
  { jsDay: 4, label: 'پنجشنبه' },
  { jsDay: 5, label: 'جمعه' },
];

const WEEKDAY_LABEL: Record<number, string> = Object.fromEntries(
  WEEKDAYS_FA.map((w) => [w.jsDay, w.label])
);

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFaDigits = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function uniqueSortedNums(arr: number[], min: number, max: number): number[] {
  const set = new Set<number>();
  for (const raw of arr) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < min || n > max) continue;
    set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function normalizeEnd(raw: unknown): TaskRecurrenceEnd | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const e = raw as Record<string, unknown>;
  if (e.kind === 'on_date') {
    const date = typeof e.date === 'string' ? e.date.trim() : '';
    if (!DATE_RE.test(date)) return undefined;
    return { kind: 'on_date', date };
  }
  if (e.kind === 'after_n') {
    const remaining = Math.floor(Number(e.remaining));
    if (!Number.isFinite(remaining) || remaining < 0) return undefined;
    return { kind: 'after_n', remaining: Math.min(remaining, 998) };
  }
  return undefined;
}

export function normalizeRecurrence(input: unknown): TaskRecurrence | null {
  if (input == null || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const type = o.type;
  const end = normalizeEnd(o.end);

  if (type === 'daily') {
    const r: TaskRecurrence = { type: 'daily' };
    if (end) r.end = end;
    return r;
  }

  if (type === 'weekly') {
    const weekdays = uniqueSortedNums(
      Array.isArray(o.weekdays) ? (o.weekdays as number[]) : [],
      0,
      6
    );
    if (weekdays.length === 0) return null;
    const r: TaskRecurrence = { type: 'weekly', weekdays };
    if (end) r.end = end;
    return r;
  }

  if (type === 'monthly') {
    const days = uniqueSortedNums(
      Array.isArray(o.days) ? (o.days as number[]) : [],
      1,
      31
    );
    if (days.length === 0) return null;
    const r: TaskRecurrence = { type: 'monthly', days };
    if (end) r.end = end;
    return r;
  }

  if (type === 'yearly') {
    if (!Array.isArray(o.dates)) return null;
    const map = new Map<string, { month: number; day: number }>();
    for (const item of o.dates) {
      if (!item || typeof item !== 'object') continue;
      const m = Math.floor(Number((item as any).month));
      const d = Math.floor(Number((item as any).day));
      if (!Number.isFinite(m) || m < 1 || m > 12) continue;
      if (!Number.isFinite(d) || d < 1 || d > 31) continue;
      map.set(`${m}-${d}`, { month: m, day: d });
    }
    const dates = Array.from(map.values()).sort(
      (a, b) => a.month - b.month || a.day - b.day
    );
    if (dates.length === 0) return null;
    const r: TaskRecurrence = { type: 'yearly', dates };
    if (end) r.end = end;
    return r;
  }

  return null;
}

export function isRecurring(
  r: TaskRecurrence | null | undefined
): r is TaskRecurrence {
  return normalizeRecurrence(r) != null;
}

/** False when due is null/invalid or Tehran wall-clock is exactly 12:00 (date-only convention). */
export function hasExplicitDueTime(
  due: string | Date | null | undefined
): boolean {
  if (due == null || due === '') return false;
  const date = typeof due === 'string' ? new Date(due) : due;
  if (isNaN(date.getTime())) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(date);
    let h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    if (h === 24) h = 0;
    return !(h === 12 && m === 0);
  } catch {
    return false;
  }
}

function tehranWallClock(date: Date): { h: number; m: number; s: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(date);
    let h = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const s = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
    if (h === 24) h = 0;
    return { h, m, s };
  } catch {
    return { h: 12, m: 0, s: 0 };
  }
}

/**
 * Build ISO for a Tehran civil YYYY-MM-DD at wall-clock h:m:s in Asia/Tehran.
 * Exported so TaskEditor save never uses browser-local setHours.
 */
export function tehranDayAtWallClock(
  ymd: string,
  h: number,
  m: number,
  s = 0
): string {
  // Interpret civil date as local components then adjust via formatter iteration is heavy;
  // Use noon UTC probe + offset from Asia/Tehran parts (same approach as product date pickers).
  const [Y, Mo, D] = ymd.split('-').map(Number);
  // Construct a Date that represents that civil day at h:m in Tehran by binary-ish search on UTC.
  // Start from UTC noon of that gregorian day and shift.
  let guess = new Date(Date.UTC(Y, Mo - 1, D, 9, 0, 0)); // rough
  for (let i = 0; i < 48; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(guess);
    const gy = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
    const gm = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
    const gd = parseInt(parts.find((p) => p.type === 'day')!.value, 10);
    let gh = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
    const gmin = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
    if (gh === 24) gh = 0;
    const dayDelta =
      Date.UTC(Y, Mo - 1, D) - Date.UTC(gy, gm - 1, gd);
    const minDelta = h * 60 + m - (gh * 60 + gmin);
    if (dayDelta === 0 && minDelta === 0) {
      return new Date(guess.getTime() + s * 1000).toISOString();
    }
    guess = new Date(guess.getTime() + dayDelta + minDelta * 60_000);
  }
  return guess.toISOString();
}

function addTehranCalendarDays(ymd: string, days: number): string {
  const [Y, Mo, D] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(Y, Mo - 1, D + days, 12, 0, 0));
  // Convert that UTC noon civil shift to Tehran date string of the shifted gregorian day
  // Using local components of the UTC date as civil Y-M-D is correct for day arithmetic on calendar.
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function tehranWeekday(ymd: string): number {
  // Weekday of that Tehran civil day — use UTC noon of the civil Y-M-D so getUTCDay
  // is independent of the browser's local timezone (getDay() is not).
  const [Y, Mo, D] = ymd.split('-').map(Number);
  return new Date(Date.UTC(Y, Mo - 1, D, 12, 0, 0)).getUTCDay();
}

export function tehranTodayNoonIso(now: Date = new Date()): string {
  const ymd = getTehranDateString(now);
  return tehranDayAtWallClock(ymd, 12, 0, 0);
}

export function remainingOccurrencesLabel(
  r: TaskRecurrence | null | undefined
): string | null {
  const n = normalizeRecurrence(r);
  if (!n?.end || n.end.kind !== 'after_n') return null;
  const totalFromNow = n.end.remaining + 1;
  return `${toFaDigits(totalFromNow)} نوبت از این به‌بعد`;
}

export function describeRecurrenceFa(
  r: TaskRecurrence | null | undefined,
  opts?: { dueDate?: string | Date | null }
): string {
  const n = normalizeRecurrence(r);
  if (!n) return 'بدون تکرار';

  let core = '';
  if (n.type === 'daily') {
    core = 'هر روز';
  } else if (n.type === 'weekly') {
    const labels = n.weekdays
      .map((d) => WEEKDAY_LABEL[d])
      .filter(Boolean);
    const count = labels.length;
    core =
      count === 7
        ? 'هر روز هفته'
        : `هفته‌ای ${toFaDigits(count)} بار · ${labels.join(' و ')}`;
  } else if (n.type === 'monthly') {
    const days = n.days.map((d) => toFaDigits(d)).join(' و ');
    core = `روزهای ${days} هر ماه`;
  } else {
    const parts = n.dates.map(
      (d) => `${toFaDigits(d.day)} ${persianMonths[d.month - 1] || ''}`
    );
    core =
      parts.length === 1
        ? `هر سال · ${parts[0]}`
        : `هر سال · ${parts.join('، ')}`;
  }

  if (opts?.dueDate && hasExplicitDueTime(opts.dueDate)) {
    const date =
      typeof opts.dueDate === 'string'
        ? new Date(opts.dueDate)
        : opts.dueDate;
    const { h, m } = tehranWallClock(date);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    core += ` ساعت ${toFaDigits(hh)}:${toFaDigits(mm)}`;
  }

  if (n.end?.kind === 'on_date') {
    // show as fa jalaali via formatPersianDate on that civil day noon
    const iso = tehranDayAtWallClock(n.end.date, 12, 0, 0);
    core += ` · تا ${formatPersianDate(iso)}`;
  } else if (n.end?.kind === 'after_n') {
    const label = remainingOccurrencesLabel(n);
    if (label) core += ` · ${label}`;
  }

  return core;
}

export function canContinueRecurrence(
  r: TaskRecurrence | null | undefined,
  nextDueIso: string
): boolean {
  const n = normalizeRecurrence(r);
  if (!n) return false;
  if (!n.end) return true;
  if (n.end.kind === 'after_n') {
    return n.end.remaining >= 1;
  }
  // on_date: next due Tehran day must be <= end.date inclusive
  const nextDay = getTehranDateString(new Date(nextDueIso));
  return nextDay <= n.end.date;
}

export function buildNextRecurrence(r: TaskRecurrence): TaskRecurrence {
  const n = normalizeRecurrence(r);
  if (!n) {
    // caller should only pass valid; return daily fallback-safe copy attempt
    return { type: 'daily' };
  }
  if (!n.end || n.end.kind !== 'after_n') {
    return { ...n, end: n.end ? { ...n.end } : undefined };
  }
  const remaining = Math.max(0, n.end.remaining - 1);
  return { ...n, end: { kind: 'after_n', remaining } };
}

export function computeNextDueDate(
  fromDue: string | Date | null | undefined,
  r: TaskRecurrence | null | undefined,
  now: Date = new Date()
): string | null {
  const rec = normalizeRecurrence(r);
  if (!rec) return null;

  let anchor: Date;
  if (fromDue == null || fromDue === '') {
    anchor = new Date(tehranTodayNoonIso(now));
  } else {
    anchor = typeof fromDue === 'string' ? new Date(fromDue) : fromDue;
    if (isNaN(anchor.getTime())) {
      anchor = new Date(tehranTodayNoonIso(now));
    }
  }

  const wall = tehranWallClock(anchor);
  const anchorYmd = getTehranDateString(anchor);

  if (rec.type === 'daily') {
    const nextYmd = addTehranCalendarDays(anchorYmd, 1);
    return tehranDayAtWallClock(nextYmd, wall.h, wall.m, wall.s);
  }

  if (rec.type === 'weekly') {
    const set = new Set(rec.weekdays);
    for (let i = 1; i <= 7; i++) {
      const ymd = addTehranCalendarDays(anchorYmd, i);
      if (set.has(tehranWeekday(ymd))) {
        return tehranDayAtWallClock(ymd, wall.h, wall.m, wall.s);
      }
    }
    return null;
  }

  // monthly — Jalali calendar days (same product calendar as yearly / PersianDatePicker)
  if (rec.type === 'monthly') {
    const jAnchor = toJalaali(anchor);
    for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
      let jy = jAnchor.jy;
      let jm = jAnchor.jm + monthOffset;
      while (jm > 12) {
        jm -= 12;
        jy += 1;
      }
      const dim = getDaysInPersianMonth(jy, jm);
      for (const day of rec.days) {
        const d = Math.min(day, dim);
        const g = toGregorian(jy, jm, d);
        const ymd = getTehranDateString(g);
        if (ymd <= anchorYmd) continue;
        return tehranDayAtWallClock(ymd, wall.h, wall.m, wall.s);
      }
    }
    return null;
  }

  // yearly — Jalali month/day
  const jAnchor = toJalaali(anchor);
  const candidates: string[] = [];
  for (const year of [jAnchor.jy, jAnchor.jy + 1, jAnchor.jy + 2]) {
    for (const { month, day } of rec.dates) {
      const maxD = getDaysInPersianMonth(year, month);
      const d = Math.min(day, maxD);
      const g = toGregorian(year, month, d);
      const ymd = getTehranDateString(g);
      candidates.push(ymd);
    }
  }
  candidates.sort();
  for (const ymd of candidates) {
    if (ymd <= anchorYmd) continue;
    return tehranDayAtWallClock(ymd, wall.h, wall.m, wall.s);
  }
  return null;
}

export function resetChecklistItems(
  items?: ChecklistItem[] | null
): ChecklistItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => ({
    id: newId(),
    text: item.text,
    isCompleted: false,
  }));
}

/** True if due Tehran day is strictly older than `days` before todayYmd. */
export function isRecurringDoneOlderThan(
  taskDue: string | Date | null | undefined,
  todayYmd: string,
  days = 14
): boolean {
  if (taskDue == null || taskDue === '') return false;
  const dueYmd = getTehranDateString(
    typeof taskDue === 'string' ? new Date(taskDue) : taskDue
  );
  if (!dueYmd || !todayYmd) return false;
  const cutoff = addTehranCalendarDays(todayYmd, -days);
  return dueYmd <= cutoff;
}

export function formatNextDuePreview(iso: string | null | undefined): string {
  if (!iso) return '';
  const datePart = formatPersianDate(iso);
  if (!hasExplicitDueTime(iso)) return datePart;
  const { h, m } = tehranWallClock(new Date(iso));
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${datePart} · ${toFaDigits(hh)}:${toFaDigits(mm)}`;
}
