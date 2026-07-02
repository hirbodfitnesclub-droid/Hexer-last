import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../../../contexts/DataContext';
import { compareTehranDates, getTehranDateString, formatPersianDate } from '../../../utils/dateUtils';
import { Task, Priority } from '../../../types';
import { 
  X, Calendar, ArrowRight, CheckCircle2, 
  Sparkles, CalendarDays, ArrowUpRight, HelpCircle, Flame, Clock
} from 'lucide-react';

interface OverdueTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const priorityConfig: Record<string, { label: string; badge: string }> = {
  [Priority.High]: { label: 'زیاد', badge: 'bg-error/10 text-error border-error/30 dark:border-error/20' },
  [Priority.Medium]: { label: 'متوسط', badge: 'bg-primary/10 text-primary border-primary/30 dark:border-primary/20' },
  [Priority.Low]: { label: 'کم', badge: 'bg-primary/10 text-primary border-primary/30 dark:border-primary/20' },
};

export const OverdueTasksModal: React.FC<OverdueTasksModalProps> = ({ isOpen, onClose }) => {
  const { tasks, projects, updateTask, addNotification } = useData();

  const todayStr = useMemo(() => getTehranDateString(new Date()), []);

  // Filter overdue tasks: not done, has due_date, and due_date is before today
  const overdueTasks = useMemo(() => {
    return tasks.filter(t => 
      t.status !== 'done' && 
      t.due_date && 
      compareTehranDates(t.due_date, todayStr) < 0
    ).sort((a, b) => compareTehranDates(a.due_date, b.due_date));
  }, [tasks, todayStr]);

  // Helper to shift a task's date to today or tomorrow while keeping its original time if it had any
  const getUpdatedDueDate = (task: Task, target: 'today' | 'tomorrow'): string => {
    const targetDate = new Date();
    if (target === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    if (task.due_date) {
      const originalDate = new Date(task.due_date);
      // To see if it has an explicit time, we check if hour/minute are not exactly 12:00 in Asia/Tehran timezone.
      // But we can safely copy the hours/minutes/seconds of the original Date to preserve the exact time setup.
      targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds(), 0);
    } else {
      targetDate.setHours(12, 0, 0, 0);
    }

    return targetDate.toISOString();
  };

  const handleMoveToToday = async (task: Task) => {
    try {
      const updatedDate = getUpdatedDueDate(task, 'today');
      await updateTask({
        id: task.id,
        due_date: updatedDate
      });
      addNotification(`کار «${task.title}» به امروز انتقال یافت`, 'success');
    } catch (error) {
      console.error('Error shifting task to today:', error);
      addNotification('خطا در انتقال کار به امروز', 'error');
    }
  };

  const handleMoveAllToToday = async () => {
    if (overdueTasks.length === 0) return;
    try {
      const promises = overdueTasks.map(task => {
        const updatedDate = getUpdatedDueDate(task, 'today');
        return updateTask({ id: task.id, due_date: updatedDate });
      });
      await Promise.all(promises);
      addNotification('تمامی کارهای عقب‌افتاده به امروز منتقل شدند', 'success');
      onClose();
    } catch (error) {
      console.error('Error shifting all tasks to today:', error);
      addNotification('خطا در انتقال کارها', 'error');
    }
  };

  const handleMoveAllToTomorrow = async () => {
    if (overdueTasks.length === 0) return;
    try {
      const promises = overdueTasks.map(task => {
        const updatedDate = getUpdatedDueDate(task, 'tomorrow');
        return updateTask({ id: task.id, due_date: updatedDate });
      });
      await Promise.all(promises);
      addNotification('تمامی کارهای عقب‌افتاده به فردا منتقل شدند', 'success');
      onClose();
    } catch (error) {
      console.error('Error shifting all tasks to tomorrow:', error);
      addNotification('خطا در انتقال کارها', 'error');
    }
  };

  const handleTaskClick = (task: Task) => {
    // Open the global TaskEditorModal via our decoupled event system
    window.dispatchEvent(new CustomEvent('hexer:open-task-editor', { detail: task }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] backdrop-blur-xl w-full max-w-2xl rounded-t-[28px] sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[80vh] z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-[var(--border-subtle)] flex flex-col gap-4 shrink-0" dir="rtl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-error/10 text-error rounded-xl">
                    <Flame className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="text-right">
                    <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)]">کارهای عقب افتاده</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {overdueTasks.length > 0 
                        ? `${overdueTasks.length.toLocaleString('fa-IR')} کار از روزهای قبل باقی مانده است.`
                        : 'هیچ کار عقب‌افتاده‌ای ندارید.'
                      }
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)] rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Header Actions - Move All */}
              {overdueTasks.length > 0 && (
                <div className="flex gap-2 sm:gap-3 w-full">
                  <button
                    onClick={handleMoveAllToToday}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-lime hover:opacity-90 text-[var(--text-on-primary)] text-xs sm:text-sm font-bold transition-all shadow-sm shadow-lime/10"
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span className="hidden sm:inline">انتقال همه به امروز</span>
                    <span className="sm:hidden">همه به امروز</span>
                  </button>

                  <button
                    onClick={handleMoveAllToTomorrow}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="hidden sm:inline">انتقال همه به فردا</span>
                    <span className="sm:hidden">همه به فردا</span>
                  </button>
                </div>
              )}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 soft-scroll" dir="rtl">
              {overdueTasks.length > 0 ? (
                <div className="space-y-3">
                  {overdueTasks.map(task => {
                    const project = projects.find(p => p.id === task.project_id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="group flex items-center justify-between p-3.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-error/30 dark:hover:border-error/20 hover:bg-[var(--nav-hover-bg)] rounded-xl transition-all duration-200 cursor-pointer text-right gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          {/* Title & Priority */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm sm:text-base text-[var(--text-main)] group-hover:text-primary transition-colors leading-relaxed truncate">
                              {task.title}
                            </h4>
                            {task.priority && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityConfig[task.priority]?.badge || 'bg-subtle/10 text-subtle'}`}>
                                {priorityConfig[task.priority]?.label || 'متوسط'}
                              </span>
                            )}
                          </div>

                          {/* Details (Project & Due Date) */}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-muted)] flex-wrap">
                            {/* Project tag if available */}
                            {project && (
                              <div className="flex items-center gap-1 font-semibold">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                                  style={{ backgroundColor: project.color }}
                                />
                                <span className="text-[11px]">{project.title}</span>
                              </div>
                            )}

                            {/* Overdue Date */}
                            <div className="flex items-center gap-1.5 text-error font-semibold">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[11px]">عقب‌افتاده از {formatPersianDate(task.due_date)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick action button */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleMoveToToday(task);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--nav-hover-bg)] hover:bg-lime hover:text-[var(--text-on-primary)] text-[var(--text-main)] text-xs font-bold transition-all border border-[var(--border-subtle)]"
                          title="انتقال به امروز"
                        >
                          <CalendarDays className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">انتقال به امروز</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-16 h-16 bg-lime/10 text-lime rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">همه‌چیز روی روال است!</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-md leading-relaxed">
                    تبریک می‌گوییم! هیچ کار عقب‌افتاده‌ای از روزهای قبل ندارید. برنامه‌های امروزتان را پرقدرت شروع کنید.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] shrink-0 bg-transparent flex justify-end">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded-xl font-bold transition-all text-sm"
              >
                بستن پنجره
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
