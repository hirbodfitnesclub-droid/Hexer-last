
import * as jalaali from 'https://esm.sh/jalaali-js@1.2.6';

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

