import React from 'react';
import { 
  computeStreaks, 
  weekdayBreakdown, 
  monthlyTrend, 
  weeklyHeatmap 
} from '../../../utils/habitStats';
import { 
  FlameIcon, 
  SparklesIcon, 
  ActivityIcon, 
  ClockIcon, 
  TargetIcon 
} from '../../../components/icons';

interface HabitStatsViewProps {
  completedDates: string[];
}

export const HabitStatsView: React.FC<HabitStatsViewProps> = ({ completedDates = [] }) => {
  const { currentStreak, longestStreak } = computeStreaks(completedDates);
  const breakdown = weekdayBreakdown(completedDates);
  const trend = monthlyTrend(completedDates);
  const heatmap = weeklyHeatmap(completedDates);

  const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
  const weekdayShortNames = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  // Calculate highest count for scaling
  const maxDayCount = Math.max(...Object.values(breakdown), 1);
  const maxMonthCount = Math.max(...trend.map(t => t.count), 1);

  return (
    <div className="space-y-6 text-right" dir="rtl" id="habit-stats-view">
      {/* 1. Streaks Dashboard */}
      <div className="grid grid-cols-2 gap-4" id="streaks-dashboard">
        {/* Current Streak */}
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/15 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-orange-500/15 rounded-full text-orange-500">
            <FlameIcon className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-[11px] text-zinc-400 font-bold mt-2 font-sans">زنجیره فعلی</span>
          <span className="text-2xl font-black text-orange-400 font-mono mt-1">
            {currentStreak} روز
          </span>
        </div>

        {/* Longest Streak */}
        <div className="bg-gradient-to-br from-sky-500/10 to-blue-500/5 border border-sky-500/15 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-sky-500/15 rounded-full text-sky-400">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <span className="text-[11px] text-zinc-400 font-bold mt-2 font-sans">طولانی‌ترین زنجیره</span>
          <span className="text-2xl font-black text-sky-400 font-mono mt-1">
            {longestStreak} روز
          </span>
        </div>
      </div>

      {/* 2. Weekly Heatmap (آخرین ۵ هفته) */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4" id="heatmap-container">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-orange-500" />
          <h4 className="text-sm font-bold text-white font-sans">نقشه فعالیت ۳۵ روز اخیر</h4>
        </div>
        
        <div className="space-y-2">
          {/* Weekday Short Name Header */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-zinc-500 font-bold">
            {weekdayShortNames.map((name, i) => (
              <div key={i}>{name}</div>
            ))}
          </div>

          {/* 35 levels grid from weeklyHeatmap */}
          <div className="grid grid-cols-7 gap-1.5" id="heatmap-grid">
            {heatmap.map((cell, idx) => (
              <div
                key={idx}
                title={cell.date}
                className={`aspect-square rounded-[4px] transition-all duration-300 ${
                  cell.level > 0
                    ? 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/10 border border-orange-400/20'
                    : 'bg-zinc-950 border border-white/[0.02]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold pt-1">
          <span>قدیمی‌تر</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-[2px] bg-zinc-950 border border-white/[0.02]" />
            <span>غیرفعال</span>
            <div className="w-2 h-2 rounded-[2px] bg-gradient-to-br from-orange-500 to-amber-500 ml-2" />
            <span>انجام‌شده</span>
          </div>
          <span>امروز</span>
        </div>
      </div>

      {/* 3. Weekday Breakdown (سهم روزهای هفته) */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-4" id="weekday-breakdown">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-sky-400" />
          <h4 className="text-sm font-bold text-white font-sans">توزیع انجام در روزهای هفته</h4>
        </div>

        <div className="space-y-3" id="breakdown-list">
          {weekdays.map((day, idx) => {
            const count = breakdown[idx] || 0;
            const percentage = maxDayCount > 0 ? (count / maxDayCount) * 100 : 0;
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-12 text-xs font-semibold text-zinc-400 text-right font-sans">{day}</span>
                <div className="flex-1 h-2.5 bg-zinc-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-l from-sky-500 to-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-6 text-xs text-zinc-500 font-mono text-left">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Monthly Trend (روند ۶ ماه گذشته) */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 space-y-5" id="monthly-trend">
        <div className="flex items-center gap-2">
          <TargetIcon className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-bold text-white font-sans"> روند ۶ ماه گذشته (جلالی)</h4>
        </div>

        <div className="flex justify-between items-end gap-3 px-2 h-32" id="trend-columns">
          {trend.map((t, idx) => {
            const percentage = maxMonthCount > 0 ? (t.count / maxMonthCount) * 100 : 0;
            return (
              <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end">
                <div 
                  className="w-3.5 bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all duration-500 relative group"
                  style={{ height: `${Math.max(percentage, 5)}%` }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-950 border border-white/10 px-1.5 py-0.5 rounded text-[9px] text-white font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {t.count} بار
                  </div>
                </div>
                <span className="text-[10px] text-zinc-400 font-bold mt-2 font-sans truncate w-full text-center">{t.month}</span>
                <span className="text-[10px] text-emerald-400 font-mono mt-0.5">{t.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
