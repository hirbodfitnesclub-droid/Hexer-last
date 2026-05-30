
import jalaali from 'https://esm.sh/jalaali-js';

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
