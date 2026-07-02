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
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-[var(--border-neon)] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-primary/15 rounded-full text-[var(--color-primary)]">
            <FlameIcon className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-bold mt-2 font-sans">زنجیره فعلی</span>
          <span className="text-2xl font-black text-[var(--color-primary)] font-mono mt-1">
            {currentStreak} روز
          </span>
        </div>

        {/* Longest Streak */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-[var(--border-neon)] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-primary/15 rounded-full text-[var(--color-primary)]">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-bold mt-2 font-sans">طولانی‌ترین زنجیره</span>
          <span className="text-2xl font-black text-[var(--color-primary)] font-mono mt-1">
            {longestStreak} روز
          </span>
        </div>
      </div>

      {/* 2. Weekly Heatmap (آخرین ۵ هفته) */}
      <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4" id="heatmap-container">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-[var(--color-primary)]" />
          <h4 className="text-sm font-bold text-[var(--text-main)] font-sans">نقشه فعالیت ۳۵ روز اخیر</h4>
        </div>
        
        <div className="space-y-2">
          {/* Weekday Short Name Header */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-[var(--text-muted)] font-bold">
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
                    ? 'bg-gradient-to-br from-primary to-primary-hover shadow-md shadow-primary/10 border border-primary/20'
                    : 'bg-[var(--bg-base)] border border-[var(--border-subtle)]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center text-[9px] text-[var(--text-muted)] font-bold pt-1">
          <span>قدیمی‌تر</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-[2px] bg-[var(--bg-base)] border border-[var(--border-subtle)]" />
            <span>غیرفعال</span>
            <div className="w-2 h-2 rounded-[2px] bg-gradient-to-br from-primary to-primary-hover ml-2" />
            <span>انجام‌شده</span>
          </div>
          <span>امروز</span>
        </div>
      </div>

      {/* 3. Weekday Breakdown (سهم روزهای هفته) */}
      <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4" id="weekday-breakdown">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-[var(--color-primary)]" />
          <h4 className="text-sm font-bold text-[var(--text-main)] font-sans">توزیع انجام در روزهای هفته</h4>
        </div>

        <div className="space-y-3" id="breakdown-list">
          {weekdays.map((day, idx) => {
            const count = breakdown[idx] || 0;
            const percentage = maxDayCount > 0 ? (count / maxDayCount) * 100 : 0;
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-12 text-xs font-semibold text-[var(--text-muted)] text-right font-sans">{day}</span>
                <div className="flex-1 h-2.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-l from-primary to-primary-hover rounded-full transition-all duration-500" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-6 text-xs text-[var(--text-muted)] font-mono text-left">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Monthly Trend (روند ۶ ماه گذشته) */}
      <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl p-5 space-y-5" id="monthly-trend">
        <div className="flex items-center gap-2">
          <TargetIcon className="w-4 h-4 text-[var(--color-primary)]" />
          <h4 className="text-sm font-bold text-[var(--text-main)] font-sans"> روند ۶ ماه گذشته (جلالی)</h4>
        </div>

        <div className="flex justify-between items-end gap-3 px-2 h-32" id="trend-columns">
          {trend.map((t, idx) => {
            const percentage = maxMonthCount > 0 ? (t.count / maxMonthCount) * 100 : 0;
            return (
              <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end">
                <div 
                  className="w-3.5 bg-gradient-to-t from-primary to-primary-hover rounded-t-md transition-all duration-500 relative group"
                  style={{ height: `${Math.max(percentage, 5)}%` }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--bg-card)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded text-[9px] text-[var(--text-main)] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {t.count} بار
                  </div>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-bold mt-2 font-sans truncate w-full text-center">{t.month}</span>
                <span className="text-[10px] text-[var(--color-primary)] font-mono mt-0.5">{t.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
