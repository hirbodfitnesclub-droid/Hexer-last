import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useData } from '../../../contexts/DataContext';
import { UserIcon } from '../../../components/icons';

interface DashboardHeaderProps {
  onOpenProfile: () => void;
  todayProgress: number;
  hasTasksToday: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onOpenProfile,
  todayProgress,
  hasTasksToday,
}) => {
  const { user } = useAuth();
  const { profile } = useData();
  
  const size = 44; 
  const strokeWidth = 3; 
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (todayProgress / 100) * circumference;
  
  const displayName = (profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim();
  const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : null;
  const firstName = displayName ? displayName.split(/\s+/)[0] : 'رفیق';
  
  const isComplete = hasTasksToday && todayProgress === 100;
  
  // Calculate Tehran time based greeting
  const getTehranHour = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      hour12: false,
    });
    let hour = parseInt(formatter.format(new Date()), 10);
    if (hour === 24) hour = 0;
    return hour;
  };

  const tehranHour = getTehranHour();
  let greeting = 'شب بخیر';
  if (tehranHour >= 5 && tehranHour < 11) {
    greeting = 'صبح بخیر';
  } else if (tehranHour >= 11 && tehranHour < 17) {
    greeting = 'ظهر بخیر';
  } else if (tehranHour >= 17 && tehranHour < 20) {
    greeting = 'عصر بخیر';
  }
  
  return (
    <header className="pt-app-safe pb-3 px-5 sticky top-0 z-20 backdrop-blur-xl border-b border-[var(--border-subtle)] bg-[var(--bg-app-glass)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Right Side: Greeting (RTL Start) */}
        <div className="flex flex-col justify-center">
          <span className="text-[14px] font-black text-[var(--text-main)] leading-none">
            <span className="text-[var(--text-muted)] font-normal">{greeting} </span>
            {firstName}
          </span>
        </div>

        {/* Left Side: Avatar with Progress Ring (RTL End) */}
        <button 
          onClick={onOpenProfile}
          className="relative group flex items-center justify-center cursor-pointer select-none shrink-0"
          style={{ width: size, height: size }}
          aria-label="پروفایل کاربری"
        >
          {/* Neon Progress Ring SVG */}
          <svg 
            className="absolute inset-0 transform -rotate-90 overflow-visible" 
            width={size} 
            height={size}
          >
            {/* Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--border-subtle)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress */}
            {hasTasksToday && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="var(--color-primary)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ 
                  transition: 'stroke-dashoffset 1s ease-out',
                }}
              />
            )}
          </svg>

          {/* Avatar - w-10 = 40px */}
          <div className="w-10 h-10 bg-[var(--text-main)] rounded-full flex items-center justify-center text-[var(--bg-app-glass)] font-bold text-sm overflow-hidden relative z-10 border border-[var(--border-subtle)]">
            {avatarLetter || <UserIcon className="w-5 h-5"/>}
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </button>
      </div>
    </header>
  );
};
