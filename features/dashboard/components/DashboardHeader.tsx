import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
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
  
  const size = 44; 
  const strokeWidth = 3; 
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (todayProgress / 100) * circumference;
  
  const isComplete = hasTasksToday && todayProgress === 100;
  
  return (
    <header className="sticky top-0 z-50 w-full bg-gray-950/80 backdrop-blur-xl border-b border-white/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Right Side: Profile & Greeting (RTL Start) */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onOpenProfile}
            className="relative group flex items-center justify-center before:content-[''] before:absolute before:inset-[-8px] before:pointer-events-auto cursor-pointer"
            style={{ width: size, height: size }}
            aria-label="پروفایل کاربری"
          >
            {/* Neon Progress Ring SVG */}
            <svg 
              className="absolute inset-0 transform -rotate-90 overflow-visible" 
              width={size} 
              height={size}
              style={{ filter: isComplete ? 'drop-shadow(0 0 4px rgba(34,197,94,0.6))' : 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' }}
            >
              {/* Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress */}
              {hasTasksToday && (
                <>
                  <defs>
                    <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={isComplete ? "#4ade80" : "#a855f7"} />
                      <stop offset="100%" stopColor={isComplete ? "#22c55e" : "#3b82f6"} />
                    </linearGradient>
                  </defs>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#neonGradient)"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ 
                      transition: 'stroke-dashoffset 1s ease-out',
                    }}
                  />
                </>
              )}
            </svg>

            {/* Avatar - w-10 = 40px */}
            <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden relative z-10 border border-gray-800">
              {user?.email?.[0].toUpperCase() || <UserIcon className="w-5 h-5"/>}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </button>
          
          <div className="flex flex-col justify-center">
            <span className="text-white font-bold text-sm sm:text-base leading-none">سلام رفیق</span>
            <span className="text-gray-400 text-[10px] font-medium mt-1 leading-none">
              {hasTasksToday 
                ? (isComplete ? 'همه کارها تموم شد! 🎉' : `${todayProgress}% کارهای انجام‌شده`) 
                : 'برنامه‌ای برای این تاریخ ثبت نشده'}
            </span>
          </div>
        </div>

        {/* Left Side: Brand (RTL End) */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-purple-500 to-fuchsia-500 select-none">
            HEXER
          </h1>
        </div>
      </div>
    </header>
  );
};
