import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Task, Priority, Project } from '../../../types';
import { TrashIcon, ListChecksIcon, NotebookIcon } from '../../../components/icons';
import { formatPersianDate } from '../../../utils/dateUtils';
import { useData } from '../../../contexts/DataContext';

const priorityConfig = {
  [Priority.High]: { color: 'red', label: 'زیاد', bg: 'bg-[var(--semantic-error-soft)]', text: 'text-[var(--semantic-error)]', border: 'border-[var(--semantic-error)]/30' },
  [Priority.Medium]: { color: 'yellow', label: 'متوسط', bg: 'bg-primary/10', text: 'text-[var(--color-primary)]', border: 'border-[var(--border-neon)]' },
  [Priority.Low]: { color: 'sky', label: 'کم', bg: 'bg-primary/10', text: 'text-[var(--color-primary)]', border: 'border-[var(--border-neon)]' },
};

interface TaskCardProps {
  task: Task & { project?: Project };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = React.memo(({ task, onToggle, onDelete, onEdit }) => {
  const { entityLinks } = useData();
  const currentPriority = task.priority || Priority.Medium;
  const { color: priorityColor } = priorityConfig[currentPriority] || priorityConfig[Priority.Medium];
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const isLinkedToNote = entityLinks.some(link => link.task_id === task.id);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimatingOut(true);
    setTimeout(() => {
      onToggle(task.id);
    }, 280);
  };

  const checklistTotal = task.checklist?.length || 0;
  const checklistCompleted = task.checklist?.filter(i => i.isCompleted).length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={isAnimatingOut ? { opacity: 0, scale: 0.95 } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 w-full ${task.status === 'done' ? 'opacity-55' : ''}`}
      dir="rtl"
    >
      <div className="pt-1.5 flex-shrink-0">
        <button
          onClick={handleToggle}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            task.status === 'done' 
              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--text-on-primary)]' 
              : 'border-[var(--text-muted)] hover:border-[var(--color-primary)] bg-[var(--bg-card)] text-transparent'
          }`}
          aria-label={task.status === 'done' ? 'لغو انجام کار' : 'علامت زدن به عنوان انجام شده'}
        >
          {task.status === 'done' && (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"></path>
            </svg>
          )}
        </button>
      </div>

      <div
        onClick={() => onEdit(task)}
        className="flex-1 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] p-4 rounded-xl relative overflow-hidden cursor-pointer hover:bg-[var(--nav-hover-bg)] transition-all group"
      >
        <p className={`font-medium transition-colors duration-300 break-words text-sm ml-8 text-right leading-relaxed ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
          {task.title}
        </p>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-[var(--text-muted)]">
          {task.project && (
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
              <div className={`w-1.5 h-1.5 rounded-full ${
                task.project.color === 'red' ? 'bg-red-500' :
                task.project.color === 'yellow' ? 'bg-yellow-500' :
                task.project.color === 'blue' ? 'bg-blue-500' :
                task.project.color === 'green' ? 'bg-success' : 'bg-primary'
              }`}></div>
              <span className="text-[var(--text-muted)] font-semibold">{task.project.title}</span>
            </div>
          )}

          {task.due_date && (
            <span className="bg-[var(--bg-card)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
              {formatPersianDate(task.due_date)}
            </span>
          )}

          {checklistTotal > 0 && (
            <div className={`flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)] ${checklistCompleted === checklistTotal ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'}`}>
              <ListChecksIcon className="w-3 h-3" />
              <span className="font-mono text-[10px]">{checklistCompleted}/{checklistTotal}</span>
            </div>
          )}

          {isLinkedToNote && (
            <div className="flex items-center gap-1 bg-primary/10 text-[var(--color-primary)] border border-[var(--border-neon)] px-2 py-0.5 rounded-md font-semibold" title="دارای یادداشت متصل">
              <NotebookIcon className="w-3 h-3 text-[var(--color-primary)]" />
              <span>یادداشت متصل</span>
            </div>
          )}
        </div>

        {/* Delete actions: Hover on desktop, always visible on mobile/touch interfaces */}
        <div className="absolute top-2 left-2 flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--semantic-error-soft)] text-[var(--text-muted)] hover:text-[var(--semantic-error)] border border-[var(--border-subtle)] hover:border-[var(--semantic-error)]/20 transition-all font-semibold"
            title="حذف کار"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color bar indicator for priority on the right border */}
        <div 
          className="absolute top-0 right-0 h-full w-1"
          style={{ 
            backgroundColor: priorityColor === 'red' ? 'var(--semantic-error)' : 'var(--color-primary)',
            opacity: 0.6
          }}
        ></div>
      </div>
    </motion.div>
  );
});

TaskCard.displayName = 'TaskCard';
