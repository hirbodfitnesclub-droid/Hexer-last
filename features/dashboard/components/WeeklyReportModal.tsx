import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../../../contexts/DataContext';
import { Task } from '../../../types';
import { 
  XIcon, CheckIcon, WarningIcon, CalendarIcon, 
  FlameIcon, ClipboardListIcon, NotebookIcon 
} from '../../../components/icons';
import { 
  getTehranDateString, 
  formatPersianDate, 
  compareTehranDates 
} from '../../../utils/dateUtils';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose }) => {
  const { tasks } = useData();
  const [activeTab, setActiveTab] = useState<'done' | 'todo'>('done');

  // Time boundaries for the current Jalaali week (Saturday - Friday) in Tehran Time
  const weekBoundaries = useMemo(() => {
    // 1. Get currentTime in Asia/Tehran
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const tehranNow = new Date(utc + (3600000 * 3.5));
    
    // 2. Day of week (0: Sunday, 1: Monday, ..., 6: Saturday)
    const dayOfWeek = tehranNow.getDay();
    const daysSinceSat = (dayOfWeek + 1) % 7;

    const satDate = new Date(tehranNow);
    satDate.setDate(tehranNow.getDate() - daysSinceSat);
    satDate.setHours(0, 0, 0, 0);

    const friDate = new Date(satDate);
    friDate.setDate(satDate.getDate() + 6);
    friDate.setHours(23, 59, 59, 999);

    const satStr = getTehranDateString(satDate);
    const friStr = getTehranDateString(friDate);

    return {
      satStr,
      friStr,
      formattedSat: formatPersianDate(satDate),
      formattedFri: formatPersianDate(friDate)
    };
  }, []);

  const { satStr, friStr } = weekBoundaries;

  // Helper checking if a date fallback to YYYY-MM-DD falls within Sat-Fri
  const isDateInThisWeek = (dateString: string | null | undefined) => {
    if (!dateString) return false;
    const dStr = getTehranDateString(new Date(dateString));
    return dStr >= satStr && dStr <= friStr;
  };

  // 1. DONE THIS WEEK tasks
  const doneThisWeek = useMemo(() => {
    return tasks.filter(t => t.status === 'done' && isDateInThisWeek(t.completed_at));
  }, [tasks, satStr, friStr]);

  // 2. TODO THIS WEEK tasks (not done, but due this week)
  const todoThisWeek = useMemo(() => {
    return tasks.filter(t => t.status !== 'done' && isDateInThisWeek(t.due_date));
  }, [tasks, satStr, friStr]);

  const totalCount = doneThisWeek.length + todoThisWeek.length;

  // Health Score calculations: completed on time vs completed overdue
  const stats = useMemo(() => {
    const todayStr = getTehranDateString(new Date());

    // Completed on time: either had no due date, or completed_at <= due_date
    const onTimeDoneTasks = doneThisWeek.filter(t => {
      if (!t.due_date) return true;
      const completedStr = getTehranDateString(new Date(t.completed_at || ''));
      const dueStr = getTehranDateString(new Date(t.due_date));
      return completedStr <= dueStr;
    });

    const healthScore = totalCount > 0 
      ? Math.round((onTimeDoneTasks.length / totalCount) * 100) 
      : 100;

    return {
      onTimeCount: onTimeDoneTasks.length,
      delayedDoneCount: doneThisWeek.length - onTimeDoneTasks.length,
      healthScore
    };
  }, [doneThisWeek, totalCount]);

  // Donut chart stroke attributes
  const completionPercentage = totalCount > 0 
    ? Math.round((doneThisWeek.length / totalCount) * 100) 
    : 0;
  const strokeCircumference = 2 * Math.PI * 32; // ~201.06
  const strokeDashoffset = strokeCircumference - (strokeCircumference * completionPercentage) / 100;

  // Background color / text for health rating
  const healthRating = useMemo(() => {
    const score = stats.healthScore;
    if (score >= 80) return { label: 'عالی', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 50) return { label: 'خوب', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' };
    if (score >= 20) return { label: 'نیاز به بهبود', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' };
    return { label: 'بحرانی', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
  }, [stats.healthScore]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Sheet container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.5 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-lg bg-zinc-950/90 border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardListIcon className="w-5 h-5 text-sky-400" />
                گزارش عملکرد هفتگی
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                دوره هفته جاری: {weekBoundaries.formattedSat} الی {weekBoundaries.formattedFri}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-6 overflow-y-auto flex-1 space-y-6">
            {/* Health & Visual Stats Block */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 sm:p-6 flex flex-row items-center justify-around gap-4 sm:gap-6">
              {/* Donut Progress Chart */}
              <div className="relative flex items-center justify-center flex-shrink-0">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="32"
                    className="stroke-zinc-800"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="32"
                    className="stroke-sky-400 transition-all duration-1000 ease-out"
                    strokeWidth="8"
                    strokeDasharray={strokeCircumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                {/* Embedded percentage details */}
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-black text-white font-mono">{completionPercentage}%</span>
                  <span className="text-[9px] text-zinc-400">انجام شده</span>
                </div>
              </div>

              {/* Status score banner */}
              <div className="text-right space-y-1 sm:space-y-2">
                <span className="text-[10px] sm:text-xs text-zinc-400 block font-semibold">امتیاز بهره‌وری</span>
                <div className="flex items-baseline justify-start gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-white font-mono">{stats.healthScore}</span>
                  <span className="text-[10px] sm:text-sm text-zinc-500 font-medium select-none">/ ۱۰۰</span>
                </div>
                <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border inline-block ${healthRating.bg} ${healthRating.color}`}>
                  وضعیت هفته: {healthRating.label}
                </div>
              </div>
            </div>

            {/* General Counts Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-2xl font-black text-white block font-mono">{doneThisWeek.length}</span>
                <span className="text-[10px] text-zinc-400 block mt-1">کل کارهای انجام‌شده</span>
              </div>
              <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-2xl font-black text-emerald-400 block font-mono">{stats.onTimeCount}</span>
                <span className="text-[10px] text-zinc-400 block mt-1">به‌موقع</span>
              </div>
              <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-2xl font-black text-amber-500 block font-mono">{stats.delayedDoneCount}</span>
                <span className="text-[10px] text-zinc-400 block mt-1">با تاخیر</span>
              </div>
            </div>

            {/* Custom Tab selectors */}
            <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTab('done')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'done' 
                    ? 'bg-zinc-800 text-sky-400 shadow' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                انجام شده‌ها ({doneThisWeek.length})
              </button>
              <button
                onClick={() => setActiveTab('todo')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'todo' 
                    ? 'bg-zinc-800 text-sky-400 shadow' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                انجام نشده‌ها ({todoThisWeek.length})
              </button>
            </div>

            {/* Tab contents */}
            <div>
              <AnimatePresence mode="wait">
                {activeTab === 'done' ? (
                  <motion.div
                    key="done-tasks"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-2"
                  >
                    {doneThisWeek.length === 0 ? (
                      <div className="py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
                        <CheckIcon className="w-8 h-8 text-zinc-650 mb-2 opacity-40 animate-pulse" />
                        <span className="text-xs">هیچ کاری در این هفته انجام نشده است.</span>
                      </div>
                    ) : (
                      doneThisWeek.map(t => {
                        // Check if done late: t.due_date exists and completed_at > due_date
                        let isLate = false;
                        if (t.due_date) {
                          const completedStr = getTehranDateString(new Date(t.completed_at || ''));
                          const dueStr = getTehranDateString(new Date(t.due_date));
                          if (completedStr > dueStr) isLate = true;
                        }

                        return (
                          <div 
                            key={t.id} 
                            className="bg-zinc-900/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 text-right"
                          >
                            <div className="flex-1 min-w-0 pr-1">
                              <span className="text-xs text-white font-medium line-clamp-1 leading-normal ml-2">{t.title}</span>
                              <div className="flex items-center gap-1.5 mt-1">
                                {t.due_date && (
                                  <span className="text-[9px] text-zinc-500 font-semibold">
                                    موعد: {formatPersianDate(t.due_date)}
                                  </span>
                                )}
                                <span className="text-[9px] text-emerald-500/80 font-bold">
                                  انجام: {formatPersianDate(t.completed_at)}
                                </span>
                              </div>
                            </div>
                            {isLate ? (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-md flex-shrink-0">
                                انجام با تاخیر
                              </span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-md flex-shrink-0">
                                به‌موقع
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="todo-tasks"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-2"
                  >
                    {todoThisWeek.length === 0 ? (
                      <div className="py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
                        <CheckIcon className="w-8 h-8 text-emerald-600/40 mb-2 opacity-55" />
                        <span className="text-xs text-emerald-400 font-medium">عالی! هیچ کار موعدداری در این هفته باقی نمانده.</span>
                      </div>
                    ) : (
                      todoThisWeek.map(t => {
                        // Check if overdue: todayStr > t.due_date
                        const todayStr = getTehranDateString(new Date());
                        const dueStr = getTehranDateString(new Date(t.due_date || ''));
                        const isOverdue = todayStr > dueStr;

                        return (
                          <div 
                            key={t.id} 
                            className="bg-zinc-900/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 text-right"
                          >
                            <div className="flex-1 min-w-0 pr-1">
                              <span className="text-xs text-white font-medium line-clamp-1 leading-normal ml-2">{t.title}</span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[9px] text-zinc-400 font-semibold gap-1 flex items-center">
                                  <CalendarIcon className="w-2.5 h-2.5 text-zinc-500" />
                                  سررسید: {formatPersianDate(t.due_date)}
                                </span>
                              </div>
                            </div>
                            {isOverdue ? (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex-shrink-0 animate-pulse">
                                عقب افتاده
                              </span>
                            ) : (
                              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-bold px-2 py-0.5 rounded-md flex-shrink-0">
                                در جریان
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Spacer to prevent overlap with the floating AI button on mobile devices */}
            <div className="h-24 sm:hidden" aria-hidden="true" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
