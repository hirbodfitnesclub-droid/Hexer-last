import React, { useMemo } from 'react';
import {
  getTehranDateString,
  persianMonths,
  toJalaaliInTehran,
  getTehranWeekday,
  formatTehranDayNumber,
  shiftTehranYmd,
  tehranYmdToProbeDate,
} from '../../../utils/dateUtils';
import { useNow } from '../../../hooks/useNow';

interface WeekCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

// JS-weekday (0=Sunday … 6=Saturday, resolved in Asia/Tehran) → labels.
const FULL_DAY_NAMES: Record<number, string> = {
  6: 'شنبه',
  0: 'یکشنبه',
  1: 'دوشنبه',
  2: 'سهشنبه',
  3: 'چهارشنبه',
  4: 'پنجشنبه',
  5: 'جمعه',
};

const SHORT_DAY_NAMES: Record<number, string> = {
  6: 'شنبه',
  0: 'یک',
  1: 'دو',
  2: 'سه',
  3: 'چهار',
  4: 'پنج',
  5: 'جمعه',
};

export const WeekCalendar: React.FC<WeekCalendarProps> = ({ selectedDate, onDateChange }) => {
  // Live clock: the "today" dot rolls over at Tehran midnight even if the tab
  // stays open for days (previously `today` was frozen inside the memo below
  // and only recomputed when selectedDate changed).
  const now = useNow();
  const todayYmd = getTehranDateString(now);
  const selectedYmd = getTehranDateString(selectedDate);

  // Strip is built from Tehran civil days (YYYY-MM-DD in Asia/Tehran), so the
  // rendered numbers/names never depend on the device OS timezone.
  const weekDays = useMemo(() => {
    const startYmd = shiftTehranYmd(selectedYmd, -3);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const ymd = shiftTehranYmd(startYmd, i);
      const date = tehranYmdToProbeDate(ymd);
      const weekday = getTehranWeekday(date);
      days.push({
        key: ymd,
        date,
        isToday: ymd === todayYmd,
        isSelected: ymd === selectedYmd,
        dayName: SHORT_DAY_NAMES[weekday] ?? '',
        dayNumber: formatTehranDayNumber(date),
      });
    }
    return days;
  }, [selectedYmd, todayYmd]);

  const headerInfo = useMemo(() => {
    const j = toJalaaliInTehran(selectedDate);
    return `${persianMonths[j.jm - 1]} ${j.jy}`;
  }, [selectedDate]);

  const nextWeekDays = useMemo(() => {
    const lastYmd = weekDays[weekDays.length - 1].key;
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const ymd = shiftTehranYmd(lastYmd, i);
      const d = tehranYmdToProbeDate(ymd);
      days.push({ key: ymd, date: d });
    }
    return days;
  }, [weekDays]);

  return (
    <div className="glass-panel px-3.5 py-3 rounded-[var(--radius-lg)] shrink-0 lg:min-h-[200px] flex flex-col justify-between" id="week-calendar-panel">
      {/* Header Info (Month Year) */}
      <div className="flex items-center justify-center">
        <span className="text-xs font-bold text-muted tracking-wide">
          {headerInfo}
        </span>
      </div>
      
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {weekDays.map(({ key, date, isSelected, dayNumber, dayName, isToday }) => (
          <button
            key={key}
            onClick={() => onDateChange(date)}
            className={`
              group relative flex flex-col items-center justify-between p-1 rounded-2xl transition-all duration-300 h-[64px] sm:h-[70px]
              ${isSelected 
                ? 'bg-primary border-transparent shadow-[0_4px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.15)] scale-105 z-10' 
                : 'bg-[var(--bg-card)] border border-subtle hover:bg-black/5 dark:hover:bg-white/5'}
            `}
          >
            {/* Top: Day Name */}
            <span className={`truncate w-full text-center text-[8px] sm:text-[9px] font-medium mt-1 ${isSelected ? 'text-black' : 'text-muted group-hover:text-main'}`}>
              {dayName}
            </span>

            {/* Bottom: Number Container (Nested Box) */}
            <div className={`
              w-full flex-1 flex flex-col items-center justify-center rounded-xl mt-1 py-0.5 xs:py-1
              ${isSelected ? 'bg-black/10' : 'bg-transparent'}
            `}>
              <span className={`text-xs sm:text-sm md:text-base font-bold leading-none ${isSelected ? 'text-black' : 'text-main'}`}>
                              {dayNumber}
                            </span>
              
              {/* Dot for today - positioned inside the inner container */}
              {isToday && (
                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-black' : 'bg-[var(--color-primary-text)]'}`}></div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden lg:block border-t border-subtle/30 pt-2 mt-2">
        <div className="text-[9px] text-muted font-black mb-1.5 px-1">روزهای آینده</div>
        <div className="grid grid-cols-7 gap-1 items-center">
          {/* 7 کپسول کوچک برای روزهای هفته بعد */}
          {nextWeekDays.map(({ key, date }) => (
            <div key={key} className="flex flex-col items-center justify-between p-0.5 rounded-[8px] h-[42px] bg-[var(--bg-card)]/40 border border-subtle/30 saturate-50">
              <span className="text-[7px] font-bold text-muted truncate w-full text-center leading-none mt-0.5">
                {SHORT_DAY_NAMES[getTehranWeekday(date)] ?? FULL_DAY_NAMES[getTehranWeekday(date)] ?? ''}
              </span>
              <span className="text-[10px] font-black leading-none mb-0.5 text-main">
                {formatTehranDayNumber(date)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
