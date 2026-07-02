import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { isSameTehranDay, getTehranDateString, compareTehranDates } from '../../../utils/dateUtils';
import { Priority } from '../../../types';
import { CheckIcon, ListChecksIcon } from '../../../components/icons';

const formatTime = (dateInput: Date | string | undefined | null) => {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const timeStr = formatter.format(date);
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (h === 24) h = 0;
    
    if ((h === 12 && m === 0) || (h === 0 && m === 0)) {
      return '';
    }
    
    const formattedHours = String(h).padStart(2, '0').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
    const formattedMinutes = String(m).padStart(2, '0').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
    return `${formattedHours}:${formattedMinutes}`;
  } catch (e) {
    console.error('Error formatting time in Asia/Tehran timezone:', e);
    return '';
  }
};

const getTehranDayMinutes = (dateInput: Date | string): number => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return 1440;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const timeStr = formatter.format(date);
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (h === 24) h = 0;
    return h * 60 + m;
  } catch (e) {
    return 1440;
  }
};

const hasTime = (dueDate: Date | string | undefined | null): boolean => {
  if (!dueDate) return false;
  return formatTime(dueDate) !== '';
};

interface TodaysPlanProps {
  onOpenOverdueModal: () => void;
}

export const TodaysPlan: React.FC<TodaysPlanProps> = ({ onOpenOverdueModal }) => {
  const { tasks, selectedDate, toggleTaskCompletion } = useData();

  const overdueCount = useMemo(() => {
    const todayStr = getTehranDateString(new Date());
    return tasks.filter(t => 
      t.status !== 'done' && 
      t.due_date && 
      compareTehranDates(t.due_date, todayStr) < 0
    ).length;
  }, [tasks]);

  const todaysTasks = useMemo(() => {
    return tasks
      .filter(t => t.due_date && isSameTehranDay(t.due_date, selectedDate))
      .sort((a, b) => {
        // 1. Completed tasks always at the bottom
        const aDone = a.status === 'done';
        const bDone = b.status === 'done';
        if (aDone !== bDone) {
          return aDone ? 1 : -1;
        }

        // 2. Timed tasks before untimed tasks
        const aHasTime = hasTime(a.due_date);
        const bHasTime = hasTime(b.due_date);
        if (aHasTime !== bHasTime) {
          return aHasTime ? -1 : 1;
        }

        if (aHasTime) {
          // 3. Timed tasks sorted ascending by minutes of Tehran day
          const aMins = getTehranDayMinutes(a.due_date!);
          const bMins = getTehranDayMinutes(b.due_date!);
          return aMins - bMins;
        } else {
          // 4. Untimed tasks sorted by priority (High -> Medium -> Low)
          const priorityWeight = (p: string | undefined | null) => {
            if (!p) return 2;
            const val = String(p).toLowerCase();
            if (val === 'high') return 0;
            if (val === 'medium') return 1;
            return 2; // low
          };
          return priorityWeight(a.priority) - priorityWeight(b.priority);
        }
      });
  }, [tasks, selectedDate]);

  return (
    <div className="glass-panel rounded-[var(--radius-lg)] p-5 h-full flex flex-col" id="todays-plan-panel">
      <div className="flex items-center justify-between mb-4" dir="rtl">
        <h2 className="text-lg font-bold text-[var(--text-main)]">برنامه امروز</h2>
        {overdueCount > 0 && (
          <button 
            onClick={onOpenOverdueModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/20 text-[var(--semantic-error)] text-xs font-bold hover:scale-[1.03] active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-error"></span>
            </span>
            <span>عقب افتاده ({overdueCount.toLocaleString('fa-IR')})</span>
          </button>
        )}
      </div>
      {todaysTasks.length > 0 ? (
        <div className="flex-1 min-h-0 max-h-[19rem] overflow-y-auto soft-scroll space-y-3 pl-2">
          {todaysTasks.map((task, index) => {
            return (
              <div 
                key={task.id} 
                className={`relative flex gap-3 items-stretch pb-3 ${task.status === 'done' ? 'opacity-60' : ''}`}
              >
                {/* Time Column (Right) */}
                <div className="w-12 flex items-start justify-end pt-3 shrink-0">
                  <span className="font-mono font-bold text-xs text-[var(--text-muted)]">
                    {formatTime(task.due_date)}
                  </span>
                </div>
                
                {/* Axis Column (Middle) */}
                <div className="relative flex flex-col items-center w-6 shrink-0">
                  {todaysTasks.length > 1 && (
                    index === 0 ? (
                      <div className="absolute top-[20px] -bottom-[12px] w-[1.5px] bg-subtle z-0"></div>
                    ) : index === todaysTasks.length - 1 ? (
                      <div className="absolute -top-[12px] bottom-[calc(100%-20px)] w-[1.5px] bg-subtle z-0"></div>
                    ) : (
                      <div className="absolute -top-[12px] -bottom-[12px] w-[1.5px] bg-subtle z-0"></div>
                    )
                  )}
                  {task.status === 'done' ? (
                    <div className="absolute top-3 z-10 w-4 h-4 rounded-full bg-success text-white flex items-center justify-center border-2 border-subtle">
                      <CheckIcon className="w-2.5 h-2.5 text-white stroke-[3px]" />
                    </div>
                  ) : (
                    <div className="absolute top-3 z-10 w-4 h-4 rounded-full bg-primary text-black flex items-center justify-center border-2 border-subtle">
                      <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                    </div>
                  )}
                </div>

                {/* Card Column (Left) */}
                <div className="flex-1 glass-card p-3 rounded-[var(--radius-md)] flex items-center gap-3">
                  <button
                    onClick={() => toggleTaskCompletion(task.id)}
                    className={`task-check w-5 h-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition ${task.status === 'done' ? 'is-done' : 'border-[var(--text-muted)] hover:border-[var(--text-main)]'}`}
                    aria-label={task.status === 'done' ? `لغو انجام ${task.title}` : `انجام ${task.title}`}
                  >
                    {task.status === 'done' && <CheckIcon className="w-3 h-3 text-black stroke-[3px]"/>}
                  </button>
                  <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                    {task.title}
                  </span>
                  <div 
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      task.priority === Priority.High 
                        ? 'bg-error shadow-[0_0_8px_rgb(var(--error-rgb)/0.5)]' 
                        : task.priority === Priority.Medium 
                        ? 'bg-warning shadow-[0_0_8px_rgb(var(--warning-rgb)/0.5)]' 
                        : 'bg-primary/80 shadow-[0_0_8px_rgb(var(--color-primary-rgb)/0.3)]'
                    }`}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--text-muted)] text-sm">
          <ListChecksIcon className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)] opacity-60" />
          <p>در این تاریخ کاری ثبت نشده است.</p>
        </div>
      )}
    </div>
  );
};
