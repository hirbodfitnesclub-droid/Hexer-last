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
    case 0: return 'یک‌شنبه';
    case 1: return 'دو‌شنبه';
    case 2: return 'سه‌شنبه';
    case 3: return 'چهارشنبه';
    case 4: return 'پنج‌شنبه';
    case 5: return 'جمعه';
    default: return '';
  }
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
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
        dayName: getCustomDayName(date),
        dayNumber: date.toLocaleDateString('fa-IR', { day: 'numeric' }),
      });
    }
    return days;
  }, [selectedDate]);

  const headerInfo = useMemo(() => {
    const j = toJalaali(selectedDate);
    return `${persianMonths[j.jm - 1]} ${j.jy}`;
  }, [selectedDate]);

  return (
    <div className="space-y-4">
      {/* Header Info (Month Year) */}
      <div className="flex items-center justify-center mb-2">
        <span className="text-xs font-bold text-gray-400 tracking-wide bg-gray-800/40 px-3 py-1 rounded-full border border-white/5">
          {headerInfo}
        </span>
      </div>
      
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map(({ date, isSelected, dayNumber, dayName, isToday }) => (
          <button
            key={date.toISOString()}
            onClick={() => onDateChange(date)}
            className={`
              group relative flex flex-col items-center justify-between p-1 rounded-2xl transition-all duration-300
              ${isSelected 
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30 scale-105 z-10' 
                : 'bg-gray-800/40 border border-white/5 hover:bg-gray-800'}
            `}
            style={{ height: '4.5rem' }}
          >
            {/* Top: Day Name */}
            <span className={`truncate min-w-0 text-[8px] xs:text-[9px] sm:text-[10px] font-medium mt-1 ${isSelected ? 'text-white/90' : 'text-gray-500 group-hover:text-gray-400'}`}>
              {dayName}
            </span>

            {/* Bottom: Number Container (Nested Box) */}
            <div className={`
              w-full flex-1 flex flex-col items-center justify-center rounded-xl mt-1 py-0.5 xs:py-1
              ${isSelected ? 'bg-black/10 backdrop-blur-sm' : 'bg-gray-900/30'}
            `}>
              <span className={`text-sm sm:text-base md:text-lg font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                {dayNumber}
              </span>
              
              {/* Dot for today - positioned inside the inner container */}
              {isToday && (
                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-sky-500'}`}></div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
