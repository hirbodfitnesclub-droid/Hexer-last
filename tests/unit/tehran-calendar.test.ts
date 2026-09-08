import { describe, expect, it } from 'vitest';
import {
  formatPersianDateInTehran,
  formatTehranDayNumber,
  getTehranDateString,
  getTehranWeekday,
  shiftTehranYmd,
  tehranYmdToProbeDate,
  toJalaaliInTehran,
} from '../../utils/dateUtils';

/**
 * Tehran-authoritative calendar contract.
 *
 * Regression coverage for the "calendar is one day behind" bug seen when the
 * device OS timezone is NOT Asia/Tehran (e.g. America/New_York, UTC-4, which
 * trails Tehran by ~7.5h): every helper below must resolve the TEHRAN civil
 * day no matter what TZ the process runs in. Run this file under a foreign TZ
 * too, e.g. `$env:TZ='America/New_York'; npx vitest run tehran-calendar`.
 */
describe('Tehran-authoritative calendar', () => {
  // 2026-09-08T02:00:00Z == Tue 2026-09-08 05:30 Asia/Tehran
  //                     == Mon 2026-09-07 22:00 America/New_York.
  // Tehran Jalali: 1405/06/17 (Tuesday). Local-Washington Jalali: 1405/06/16.
  const tehranTuesdayMorning = new Date('2026-09-08T02:00:00.000Z');

  it('getTehranDateString resolves the Tehran civil day', () => {
    expect(getTehranDateString(tehranTuesdayMorning)).toBe('2026-09-08');
  });

  it('toJalaaliInTehran returns 17 Shahrivar 1405 for that instant', () => {
    expect(toJalaaliInTehran(tehranTuesdayMorning)).toEqual({
      jy: 1405,
      jm: 6,
      jd: 17,
    });
  });

  it('getTehranWeekday returns Tuesday (2) for that instant', () => {
    expect(getTehranWeekday(tehranTuesdayMorning)).toBe(2);
  });

  it('formatPersianDateInTehran / formatTehranDayNumber agree on the 17th', () => {
    expect(formatPersianDateInTehran(tehranTuesdayMorning)).toBe('1405/06/17');
    expect(formatTehranDayNumber(tehranTuesdayMorning)).toBe(
      (17).toLocaleString('fa-IR')
    );
  });

  it('shiftTehranYmd does pure civil arithmetic across month boundaries', () => {
    expect(shiftTehranYmd('2026-09-08', -3)).toBe('2026-09-05');
    expect(shiftTehranYmd('2026-09-08', 3)).toBe('2026-09-11');
    expect(shiftTehranYmd('2026-09-01', -1)).toBe('2026-08-31');
    expect(shiftTehranYmd('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('probe dates round-trip through getTehranDateString in any TZ', () => {
    for (const ymd of ['2026-09-08', '2026-03-20', '2026-03-21', '2025-02-28']) {
      expect(getTehranDateString(tehranYmdToProbeDate(ymd))).toBe(ymd);
    }
  });

  it('a 7-day strip centered on Tehran-today contains today at index 3', () => {
    const selectedYmd = getTehranDateString(tehranTuesdayMorning);
    const startYmd = shiftTehranYmd(selectedYmd, -3);
    const strip = Array.from({ length: 7 }, (_, i) =>
      shiftTehranYmd(startYmd, i)
    );
    expect(strip).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(strip[3]).toBe(selectedYmd);
  });
});
