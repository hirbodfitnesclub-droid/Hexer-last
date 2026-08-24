import * as jalaali from 'npm:jalaali-js';

export type RecurrenceEnd =
  | { kind: 'on_date'; date: string }
  | { kind: 'after_n'; remaining: number };

export type RecurrenceRule =
  | { type: 'daily'; end?: RecurrenceEnd }
  | { type: 'weekly'; weekdays: number[]; end?: RecurrenceEnd }
  | { type: 'monthly'; days: number[]; end?: RecurrenceEnd }
  | { type: 'yearly'; dates: Array<{ month: number; day: number }>; end?: RecurrenceEnd };

export const RECURRENCE_CALCULATOR_VERSION = 'tehran-jalali-v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeServerRecurrence(input: unknown): RecurrenceRule | null {
  if (!isRecord(input)) return null;
  const end = normalizeEnd(input.end);
  if (input.type === 'daily') return end ? { type: 'daily', end } : { type: 'daily' };
  if (input.type === 'weekly') {
    const weekdays = uniqueNumbers(input.weekdays, 0, 6);
    if (!weekdays.length) return null;
    return end ? { type: 'weekly', weekdays, end } : { type: 'weekly', weekdays };
  }
  if (input.type === 'monthly') {
    const days = uniqueNumbers(input.days, 1, 31);
    if (!days.length) return null;
    return end ? { type: 'monthly', days, end } : { type: 'monthly', days };
  }
  if (input.type === 'yearly') {
    if (!Array.isArray(input.dates)) return null;
    const unique = new Map<string, { month: number; day: number }>();
    for (const value of input.dates) {
      if (!isRecord(value)) continue;
      const month = Math.floor(Number(value.month));
      const day = Math.floor(Number(value.day));
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      unique.set(`${month}-${day}`, { month, day });
    }
    const dates = [...unique.values()].sort((left, right) => left.month - right.month || left.day - right.day);
    if (!dates.length) return null;
    return end ? { type: 'yearly', dates, end } : { type: 'yearly', dates };
  }
  return null;
}

export function calculateNextOccurrence(input: {
  fromDue: string | null | undefined;
  recurrence: unknown;
  now?: Date;
}): { nextDue: string; nextRecurrence: RecurrenceRule; occurrenceKey: string; calculatorVersion: string } | null {
  const recurrence = normalizeServerRecurrence(input.recurrence);
  if (!recurrence) return null;
  const now = input.now ?? new Date();
  let anchor = input.fromDue ? new Date(input.fromDue) : new Date(tehranDayAtWallClock(tehranDate(now), 12, 0, 0));
  if (!Number.isFinite(anchor.getTime())) anchor = new Date(tehranDayAtWallClock(tehranDate(now), 12, 0, 0));
  const nextDue = nextDueDate(anchor, recurrence);
  if (!nextDue || !canContinue(recurrence, nextDue)) return null;
  return {
    nextDue,
    nextRecurrence: decrementRecurrence(recurrence),
    occurrenceKey: `${tehranDate(new Date(nextDue))}:${wallClockKey(new Date(nextDue))}`,
    calculatorVersion: RECURRENCE_CALCULATOR_VERSION,
  };
}

function nextDueDate(anchor: Date, recurrence: RecurrenceRule): string | null {
  const wall = tehranWallClock(anchor);
  const anchorDay = tehranDate(anchor);
  if (recurrence.type === 'daily') {
    return tehranDayAtWallClock(addCivilDays(anchorDay, 1), wall.hour, wall.minute, wall.second);
  }
  if (recurrence.type === 'weekly') {
    const weekdays = new Set(recurrence.weekdays);
    for (let offset = 1; offset <= 7; offset += 1) {
      const day = addCivilDays(anchorDay, offset);
      if (weekdays.has(civilWeekday(day))) return tehranDayAtWallClock(day, wall.hour, wall.minute, wall.second);
    }
    return null;
  }
  const jAnchor = jalaali.toJalaali(anchor);
  if (recurrence.type === 'monthly') {
    for (let offset = 0; offset < 24; offset += 1) {
      let year = jAnchor.jy;
      let month = jAnchor.jm + offset;
      while (month > 12) { month -= 12; year += 1; }
      const maxDay = jalaali.jalaaliMonthLength(year, month);
      for (const rawDay of recurrence.days) {
        const gregorian = jalaali.toGregorian(year, month, Math.min(rawDay, maxDay));
        const day = formatCivil(gregorian.gy, gregorian.gm, gregorian.gd);
        if (day > anchorDay) return tehranDayAtWallClock(day, wall.hour, wall.minute, wall.second);
      }
    }
    return null;
  }
  const candidates: string[] = [];
  for (const year of [jAnchor.jy, jAnchor.jy + 1, jAnchor.jy + 2]) {
    for (const value of recurrence.dates) {
      const maxDay = jalaali.jalaaliMonthLength(year, value.month);
      const gregorian = jalaali.toGregorian(year, value.month, Math.min(value.day, maxDay));
      candidates.push(formatCivil(gregorian.gy, gregorian.gm, gregorian.gd));
    }
  }
  candidates.sort();
  const day = candidates.find((candidate) => candidate > anchorDay);
  return day ? tehranDayAtWallClock(day, wall.hour, wall.minute, wall.second) : null;
}

function canContinue(recurrence: RecurrenceRule, nextDue: string): boolean {
  if (!recurrence.end) return true;
  if (recurrence.end.kind === 'after_n') return recurrence.end.remaining >= 1;
  return tehranDate(new Date(nextDue)) <= recurrence.end.date;
}

function decrementRecurrence(recurrence: RecurrenceRule): RecurrenceRule {
  if (!recurrence.end || recurrence.end.kind !== 'after_n') return structuredClone(recurrence);
  return { ...structuredClone(recurrence), end: { kind: 'after_n', remaining: Math.max(0, recurrence.end.remaining - 1) } };
}

function normalizeEnd(value: unknown): RecurrenceEnd | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'on_date' && typeof value.date === 'string' && DATE_RE.test(value.date.trim())) {
    return { kind: 'on_date', date: value.date.trim() };
  }
  if (value.kind === 'after_n') {
    const remaining = Math.floor(Number(value.remaining));
    if (Number.isFinite(remaining) && remaining >= 0) return { kind: 'after_n', remaining: Math.min(remaining, 998) };
  }
  return undefined;
}

function uniqueNumbers(value: unknown, minimum: number, maximum: number): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(Number.isFinite).map(Math.floor).filter((item) => item >= minimum && item <= maximum))]
    .sort((left, right) => left - right);
}

function tehranDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function tehranWallClock(date: Date): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).formatToParts(date);
  let hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 12);
  if (hour === 24) hour = 0;
  return {
    hour,
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? 0),
    second: Number(parts.find((part) => part.type === 'second')?.value ?? 0),
  };
}

function tehranDayAtWallClock(day: string, hour: number, minute: number, second: number): string {
  const [year, month, date] = day.split('-').map(Number);
  let guess = new Date(Date.UTC(year, month - 1, date, 9, 0, 0));
  for (let index = 0; index < 48; index += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(guess);
    const actualYear = Number(parts.find((part) => part.type === 'year')?.value);
    const actualMonth = Number(parts.find((part) => part.type === 'month')?.value);
    const actualDate = Number(parts.find((part) => part.type === 'day')?.value);
    let actualHour = Number(parts.find((part) => part.type === 'hour')?.value);
    if (actualHour === 24) actualHour = 0;
    const actualMinute = Number(parts.find((part) => part.type === 'minute')?.value);
    const dayDelta = Date.UTC(year, month - 1, date) - Date.UTC(actualYear, actualMonth - 1, actualDate);
    const minuteDelta = hour * 60 + minute - (actualHour * 60 + actualMinute);
    if (dayDelta === 0 && minuteDelta === 0) return new Date(guess.getTime() + second * 1000).toISOString();
    guess = new Date(guess.getTime() + dayDelta + minuteDelta * 60_000);
  }
  return guess.toISOString();
}

function addCivilDays(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + count, 12));
  return formatCivil(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function civilWeekday(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12)).getUTCDay();
}

function formatCivil(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function wallClockKey(date: Date): string {
  const wall = tehranWallClock(date);
  return `${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}:${String(wall.second).padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
