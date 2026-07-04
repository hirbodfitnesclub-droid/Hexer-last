
import React, { useEffect, useState } from 'react';
import { toJalaali, toGregorian, getDaysInPersianMonth, persianMonths } from '../utils/dateUtils';
import { ChevronDownIcon } from './icons';

interface PersianDatePickerProps {
  value?: string | null;
  onChange: (isoDate: string) => void;
}

const SelectWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="relative flex-1">
        {children}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
            <ChevronDownIcon className="w-4 h-4" />
        </div>
    </div>
);

const PersianDatePicker: React.FC<PersianDatePickerProps> = ({ value, onChange }) => {
  const [selectedYear, setSelectedYear] = useState(1403);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const j = toJalaali(date);
        setSelectedYear(j.jy);
        setSelectedMonth(j.jm);
        setSelectedDay(j.jd);
      }
    } else {
        // Default to today
        const now = new Date();
        const j = toJalaali(now);
        setSelectedYear(j.jy);
        setSelectedMonth(j.jm);
        setSelectedDay(j.jd);
    }
  }, [value]);

  const handleChange = (y: number, m: number, d: number) => {
    const maxDays = getDaysInPersianMonth(y, m);
    const validDay = Math.min(d, maxDays);
    
    setSelectedYear(y);
    setSelectedMonth(m);
    setSelectedDay(validDay);

    const gDate = toGregorian(y, m, validDay);
    onChange(gDate.toISOString());
  };

  // Generate range of years (e.g., current year -5 to +5 or fixed range)
  const currentYear = toJalaali(new Date()).jy;
  const years = Array.from({ length: 15 }, (_, i) => currentYear - 2 + i); 
  const days = Array.from({ length: getDaysInPersianMonth(selectedYear, selectedMonth) }, (_, i) => i + 1);

  return (
    <div className="flex gap-2 w-full direction-rtl">
        {/* Day */}
        <SelectWrapper>
            <select 
                value={selectedDay} 
                onChange={(e) => handleChange(selectedYear, selectedMonth, parseInt(e.target.value))}
                className="w-full bg-[var(--bg-card)] appearance-none px-3 py-2 rounded-lg text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-primary text-sm cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80 transition-colors"
            >
                {days.map(d => <option key={d} value={d} className="bg-[var(--bg-card)] text-[var(--text-main)]">{d}</option>)}
            </select>
        </SelectWrapper>

        {/* Month */}
        <SelectWrapper>
            <select 
                value={selectedMonth} 
                onChange={(e) => handleChange(selectedYear, parseInt(e.target.value), selectedDay)}
                className="w-full bg-[var(--bg-card)] appearance-none px-3 py-2 rounded-lg text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-primary text-sm cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80 transition-colors"
            >
                {persianMonths.map((name, index) => <option key={index} value={index + 1} className="bg-[var(--bg-card)] text-[var(--text-main)]">{name}</option>)}
            </select>
        </SelectWrapper>

        {/* Year */}
        <SelectWrapper>
            <select 
                value={selectedYear} 
                onChange={(e) => handleChange(parseInt(e.target.value), selectedMonth, selectedDay)}
                className="w-full bg-[var(--bg-card)] appearance-none px-3 py-2 rounded-lg text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-primary text-sm cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80 transition-colors"
            >
                {years.map(y => <option key={y} value={y} className="bg-[var(--bg-card)] text-[var(--text-main)]">{y}</option>)}
            </select>
        </SelectWrapper>
    </div>
  );
};

export default PersianDatePicker;
