
import * as jalaali from 'jalaali-js';

export const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const toJalaali = (date: Date) => {
  return jalaali.toJalaali(date);
};

export const toGregorian = (jy: number, jm: number, jd: number) => {
  const g = jalaali.toGregorian(jy, jm, jd);
  // Set time to noon to avoid timezone date shifting issues
  const date = new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0); 
  return date;
};

export const formatPersianDate = (dateString: string | Date | undefined | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const j = toJalaali(date);
  const m = j.jm.toString().padStart(2, '0');
  const d = j.jd.toString().padStart(2, '0');
  return `${j.jy}/${m}/${d}`;
};

export const getDaysInPersianMonth = (year: number, month: number) => {
  return jalaali.jalaaliMonthLength(year, month);
};

/**
 * Tehran-authoritative calendar helpers.
 *
 * Product contract: the in-app calendar is ALWAYS Asia/Tehran, regardless of
 * the device's OS timezone (users may live/travel abroad, e.g. Washington DC
 * which trails Tehran by ~7.5h and would otherwise render "yesterday").
 *
 * Strategy: derive everything from the Tehran civil day (Gregorian YYYY-MM-DD
 * in Asia/Tehran) using UTC-based arithmetic, so no `getDay()` /
 * `toLocaleDateString()` / `getFullYear()` local-timezone traps can leak in.
 */

/** Jalali conversion of the Tehran civil day of an instant (NOT the local day). */
export const toJalaaliInTehran = (date: Date) => {
  const [gy, gm, gd] = getTehranDateString(date).split('-').map(Number);
  return jalaali.toJalaali(gy, gm, gd);
};

/** Tehran Persian date formatter (cf. local-tz `formatPersianDate`). */
export const formatPersianDateInTehran = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const j = toJalaaliInTehran(date);
  const m = j.jm.toString().padStart(2, '0');
  const d = j.jd.toString().padStart(2, '0');
  return `${j.jy}/${m}/${d}`;
};

/**
 * Weekday of an instant in Tehran: 0=Sunday … 6=Saturday (same numbering as
 * Date.getDay, but resolved in Asia/Tehran so it never depends on OS tz).
 */
export const getTehranWeekday = (date: Date): number => {
  const [Y, Mo, D] = getTehranDateString(date).split('-').map(Number);
  return new Date(Date.UTC(Y, Mo - 1, D, 12, 0, 0)).getUTCDay();
};

/** Persian day-of-month number (fa-IR digits) for the Tehran civil day. */
export const formatTehranDayNumber = (date: Date): string => {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    day: 'numeric',
  }).format(date);
};

/** Shift a Tehran YYYY-MM-DD civil day by N days (pure calendar arithmetic). */
export const shiftTehranYmd = (ymd: string, days: number): string => {
  const [Y, Mo, D] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(Y, Mo - 1, D + days, 12, 0, 0));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

/**
 * Representative instant for a Tehran civil day: UTC noon == 15:30 Tehran
 * (IRST is fixed +3:30, no DST since 2022), so `getTehranDateString()` of the
 * probe always returns the same `ymd` on every device timezone.
 */
export const tehranYmdToProbeDate = (ymd: string): Date => {
  const [Y, Mo, D] = ymd.split('-').map(Number);
  return new Date(Date.UTC(Y, Mo - 1, D, 12, 0, 0));
};

export const getTehranDateString = (date?: Date): string => {
  const d = date || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d); // Returns YYYY-MM-DD
};

export const isSameTehranDay = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return getTehranDateString(d1) === getTehranDateString(d2);
};

export const compareTehranDates = (
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): number => {
  if (!date1 && !date2) return 0;
  if (!date1) return 1;
  if (!date2) return -1;
  const d1Str = getTehranDateString(typeof date1 === 'string' ? new Date(date1) : date1);
  const d2Str = getTehranDateString(typeof date2 === 'string' ? new Date(date2) : date2);
  return d1Str.localeCompare(d2Str);
};

export const dueToTehranDay = (dueDate: Date | string | null | undefined): string => {
  if (!dueDate) return '';
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return getTehranDateString(date);
};

