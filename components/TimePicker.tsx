
import React, { useEffect, useState } from 'react';
import { ChevronDownIcon } from './icons';

interface TimePickerProps {
  value?: string | null;
  onChange: (time: string) => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('00');

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      if (h && m) {
        setHour(h);
        setMinute(m);
      }
    } else {
        // Default to current time roughly
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMinute = (Math.floor(now.getMinutes() / 5) * 5).toString().padStart(2, '0');
        
        // Just set internal state for display, don't trigger onChange yet
        setHour(currentHour);
        setMinute(currentMinute); 
    }
  }, [value]);

  const handleChange = (newHour: string, newMinute: string) => {
    setHour(newHour);
    setMinute(newMinute);
    onChange(`${newHour}:${newMinute}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // 00, 05, 10, ... 55
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  const SelectWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
      <div className="relative flex-1">
          {children}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDownIcon className="w-4 h-4" />
          </div>
      </div>
  )

  return (
    <div className="flex gap-2 w-full items-center" dir="ltr">
        {/* Hour */}
        <SelectWrapper>
            <select 
                value={hour} 
                onChange={(e) => handleChange(e.target.value, minute)}
                className="w-full bg-slate-800/60 appearance-none px-3 py-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm cursor-pointer border border-slate-700 hover:border-slate-600 transition-colors text-center font-mono"
            >
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
        </SelectWrapper>

        <span className="text-slate-400 font-bold pb-1">:</span>

        {/* Minute */}
        <SelectWrapper>
            <select 
                value={minute} 
                onChange={(e) => handleChange(hour, e.target.value)}
                className="w-full bg-slate-800/60 appearance-none px-3 py-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm cursor-pointer border border-slate-700 hover:border-slate-600 transition-colors text-center font-mono"
            >
                {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </SelectWrapper>
    </div>
  );
};

export default TimePicker;
