import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { toJalaali, isSameTehranDay } from '../../../utils/dateUtils';
import { TrendingUpIcon, TrendingDownIcon } from '../../../components/icons';

export const ProductivityChart: React.FC = () => {
  const { tasks } = useData();

  // 1. Calculate Persian week days (Saturday to Friday) of the current week
  const weekDays = useMemo(() => {
    const today = new Date();
    // Get offset from Saturday: Sunday = 1, Monday = 2, ..., Friday = 6, Saturday = 0
    const offsetFromSaturday = (today.getDay() + 1) % 7;
    
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - offsetFromSaturday);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(saturday);
      d.setDate(saturday.getDate() + i);
      days.push(d);
    }
    return days.reverse();
  }, []);

  // 2. Compute progress percentage for each day of the current week (completed / total due)
  const weekData = useMemo(() => {
    return weekDays.map((day) => {
      // Find tasks due on this day
      const dayTasks = tasks.filter((t) => {
        return t.due_date && isSameTehranDay(t.due_date, day);
      });

      const completedCount = dayTasks.filter((t) => t.status === 'done').length;
      const progress = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;

      return {
        day,
        progress,
        isToday: isSameTehranDay(day, new Date()),
      };
    });
  }, [tasks, weekDays]);

  // 3. Compute Weekly Productivity Rate
  const weeklyRate = useMemo(() => {
    const currentWeekTasks = tasks.filter((t) => {
      return t.due_date && weekDays.some((wd) => isSameTehranDay(t.due_date!, wd));
    });
    const currentWeekCompleted = currentWeekTasks.filter((t) => t.status === 'done');
    return currentWeekTasks.length > 0
      ? Math.round((currentWeekCompleted.length / currentWeekTasks.length) * 100)
      : 0;
  }, [tasks, weekDays]);

  // 4. Compute Monthly Productivity Rate
  const monthlyRate = useMemo(() => {
    const todayJ = toJalaali(new Date());
    const currentMonthTasks = tasks.filter((t) => {
      if (!t.due_date) return false;
      const j = toJalaali(new Date(t.due_date));
      return j.jy === todayJ.jy && j.jm === todayJ.jm;
    });
    const currentMonthCompleted = currentMonthTasks.filter((t) => t.status === 'done');
    return currentMonthTasks.length > 0
      ? Math.round((currentMonthCompleted.length / currentMonthTasks.length) * 100)
      : 0;
  }, [tasks]);

  // Helper for converting numbers to Persian
  const toPersianNum = (num: number) => num.toLocaleString('fa-IR');

  // Chart configuration & coordinates
  const colWidth = 22;
  const colGap = 20; // gap between columns
  const colXStart = 1;
  const maxBarHeight = 90;
  const baselineY = 95;

  const points = useMemo(() => {
    return weekData.map((d, index) => {
      const x = colXStart + index * (colWidth + colGap) + colWidth / 2;
      const barHeight = (d.progress / 100) * maxBarHeight;
      const y = baselineY - Math.max(8, barHeight); // minimum height of 8 for curve visibility
      return { x, y };
    });
  }, [weekData]);

  // Generate path string for the line chart using Catmull-Rom to Cubic Bézier spline
  const pathD = useMemo(() => {
    const N = points.length;
    if (N === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < N - 1; i++) {
      const p_im1 = i - 1 >= 0 ? points[i - 1] : points[i];
      const p_i = points[i];
      const p_ip1 = points[i + 1];
      const p_ip2 = i + 2 < N ? points[i + 2] : points[i + 1];

      const cp1 = {
        x: p_i.x + (p_ip1.x - p_im1.x) / 6,
        y: p_i.y + (p_ip1.y - p_im1.y) / 6,
      };

      const cp2 = {
        x: p_ip1.x - (p_ip2.x - p_i.x) / 6,
        y: p_ip1.y - (p_ip2.y - p_i.y) / 6,
      };

      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${p_ip1.x.toFixed(2)} ${p_ip1.y.toFixed(2)}`;
    }
    return d;
  }, [points]);

  return (
    <div
      className="tile-ink rounded-[var(--radius-lg)] p-5 relative overflow-hidden flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-[200px] shrink-0"
      dir="rtl"
      id="productivity-chart-widget"
    >
      {/* Left Column: Integrated Week & Month Info */}
      <div className="w-full lg:w-[38%] bg-white/5 dark:bg-white/[0.04] border border-white/10 rounded-[20px] p-3 flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-stretch gap-3.5 lg:shrink-0 z-10">
        {/* Week Row */}
        <div className="flex items-center justify-between flex-1 lg:flex-none w-full">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
              <TrendingDownIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col text-right leading-tight">
              <span className="text-[11px] text-white/90 font-black">بهره‌وری</span>
              <span className="text-[9px] text-white/50 font-bold mt-0.5">هفته جاری</span>
            </div>
          </div>
          <span className="text-[10px] font-black bg-lime px-2.5 py-0.5 rounded-full text-black">
            {toPersianNum(weeklyRate)}٪
          </span>
        </div>

        {/* Separator */}
        <div className="border-r lg:border-t h-8 lg:h-0 border-white/[0.08]"></div>

        {/* Month Row */}
        <div className="flex items-center justify-between flex-1 lg:flex-none w-full">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <TrendingUpIcon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col text-right leading-tight">
              <span className="text-[11px] text-white/90 font-black">بهره‌وری</span>
              <span className="text-[9px] text-white/50 font-bold mt-0.5">ماه جاری</span>
            </div>
          </div>
          <span className="text-[10px] font-black bg-lime px-2.5 py-0.5 rounded-full text-black shadow-[0_2px_8px_rgb(var(--color-primary-rgb)/0.3)]">
            {toPersianNum(monthlyRate)}٪
          </span>
        </div>
      </div>

      {/* Right Column: Interactive SVG Chart */}
      <div className="flex-1 w-full relative z-10 select-none h-full flex items-center justify-center">
        <svg viewBox="0 0 280 120" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#D8F066" />
            </linearGradient>
          </defs>

          {/* Bar Chart Columns */}
          {weekData.map((d, index) => {
            const x = colXStart + index * (colWidth + colGap);
            const barHeight = (d.progress / 100) * maxBarHeight;
            const y = baselineY - barHeight;

            if (d.isToday) {
              return (
                <g key={index}>
                  {/* Outer dashed indicator for today's target container */}
                  <rect
                    x={x}
                    y={5}
                    width={colWidth}
                    height={maxBarHeight}
                    rx={8}
                    fill="none"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  {/* Solid inner actual progress for today */}
                  {barHeight > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={colWidth}
                      height={barHeight}
                      rx={8}
                      fill="rgba(255,255,255,0.9)"
                    />
                  )}
                </g>
              );
            }

            return (
              <g key={index}>
                {/* Progress bar */}
                {barHeight > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={colWidth}
                    height={barHeight}
                    rx={8}
                    fill="rgba(255,255,255,0.9)"
                  />
                )}
              </g>
            );
          })}

          {/* Dynamic Trend Overlay Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#waveGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Day Labels - Dynamically mapped from weekData to preserve order */}
          <g fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="bold" textAnchor="middle">
            {weekData.map((d, index) => {
              const x = colXStart + index * (colWidth + colGap) + colWidth / 2;
              const daysOfWeek = ['یکشنبه', 'دوشنبه', 'سهشنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
              const dayName = daysOfWeek[d.day.getDay()];
              return (
                <text key={index} x={x} y="115">
                  {dayName}
                </text>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ProductivityChart;