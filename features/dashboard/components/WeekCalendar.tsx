import React, { useMemo } from 'react';
import { toJalaali, persianMonths, isSameTehranDay } from '../../../utils/dateUtils';

interface WeekCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const getCustomDayName = (date: Date) => {
  const dayIndex = date.getDay(); // 0 = Sunday, 6 = Saturday
  switch (dayIndex) {
    case 6: return 'شنبه';
    case 0: return 'یکشنبه';
    case 1: return 'دوشنبه';
    case 2: return 'سهشنبه';
    case 3: return 'چهارشنبه';
    case 4: return 'پنجشنبه';
    case 5: return 'جمعه';
    default: return '';
  }
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const SHORT_DAY_NAMES: Record<string, string> = {
  'شنبه': 'شنبه',
  'یکشنبه': 'یک',
  'دوشنبه': 'دو',
  'سهشنبه': 'سه',
  'چهارشنبه': 'چهار',
  'پنجشنبه': 'پنج',
  'جمعه': 'جمعه',
};

export const WeekCalendar: React.FC<WeekCalendarProps> = ({ selectedDate, onDateChange }) => {
  const weekDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const startOfWeek = new Date(selectedDate);
    // Center selected date
    startOfWeek.setDate(startOfWeek.getDate() - 3);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push({
        date,
        isToday: isSameTehranDay(date, today),
        isSelected: isSameTehranDay(date, selectedDate),
        dayName: SHORT_DAY_NAMES[getCustomDayName(date)] || getCustomDayName(date),
        dayNumber: date.toLocaleDateString('fa-IR', { day: 'numeric' }),
      });
    }
    return days;
  }, [selectedDate]);

  const headerInfo = useMemo(() => {
    const j = toJalaali(selectedDate);
    return `${persianMonths[j.jm - 1]} ${j.jy}`;
  }, [selectedDate]);

  const nextWeekDays = useMemo(() => {
    const lastDay = weekDays[weekDays.length - 1].date;
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(lastDay);
      d.setDate(lastDay.getDate() + i);
      days.push(d);
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
        {weekDays.map(({ date, isSelected, dayNumber, dayName, isToday }) => (
          <button
            key={date.toISOString()}
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
              <span className={`text-sm sm:text-base md:text-lg font-bold leading-none ${isSelected ? 'text-black' : 'text-main opacity-70 group-hover:opacity-100'}`}>
                {dayNumber}
              </span>
              
              {/* Dot for today - positioned inside the inner container */}
              {isToday && (
                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-black' : 'bg-primary'}`}></div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden lg:block border-t border-subtle/30 pt-2 mt-2">
        <div className="text-[9px] text-muted font-black mb-1.5 px-1">روزهای آینده</div>
        <div className="grid grid-cols-7 gap-1 items-center">
          {/* 7 کپسول کوچک برای روزهای هفته بعد */}
          {nextWeekDays.map((day, idx) => (
            <div key={idx} className="flex flex-col items-center justify-between p-0.5 rounded-[8px] h-[42px] bg-[var(--bg-card)]/40 border border-subtle/30 opacity-40">
              <span className="text-[7px] font-bold text-muted truncate w-full text-center leading-none mt-0.5">
                {SHORT_DAY_NAMES[getCustomDayName(day)] || getCustomDayName(day)}
              </span>
              <span className="text-[10px] font-black leading-none mb-0.5 text-main">
                {day.toLocaleDateString('fa-IR', { day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
