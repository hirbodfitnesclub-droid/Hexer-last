import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Task, Priority, Project } from '../../../types';
import { TrashIcon, ListChecksIcon } from '../../../components/icons';
import { formatPersianDate } from '../../../utils/dateUtils';

const priorityConfig = {
  [Priority.High]: { color: 'red', label: 'زیاد', bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/30' },
  [Priority.Medium]: { color: 'yellow', label: 'متوسط', bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/30' },
  [Priority.Low]: { color: 'sky', label: 'کم', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/30' },
};

interface TaskCardProps {
  task: Task & { project?: Project };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = React.memo(({ task, onToggle, onDelete, onEdit }) => {
  const currentPriority = task.priority || Priority.Medium;
  const { color: priorityColor } = priorityConfig[currentPriority] || priorityConfig[Priority.Medium];
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

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
              ? 'bg-sky-500 border-sky-500 text-white' 
              : 'border-zinc-700 hover:border-sky-500 bg-zinc-900/40 text-transparent'
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
        className="flex-1 bg-zinc-900/60 p-4 rounded-xl border border-white/5 relative overflow-hidden cursor-pointer hover:bg-zinc-900/95 hover:border-zinc-800 transition-all group"
      >
        <p className={`font-medium transition-colors duration-300 break-words text-sm ml-8 text-right leading-relaxed ${task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
          {task.title}
        </p>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-zinc-500">
          {task.project && (
            <div className="flex items-center gap-1.5 bg-zinc-800/40 px-2 py-0.5 rounded-md border border-white/5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                task.project.color === 'red' ? 'bg-red-500' :
                task.project.color === 'yellow' ? 'bg-yellow-500' :
                task.project.color === 'blue' ? 'bg-blue-500' :
                task.project.color === 'green' ? 'bg-green-500' : 'bg-sky-500'
              }`}></div>
              <span className="text-zinc-400 font-semibold">{task.project.title}</span>
            </div>
          )}

          {task.due_date && (
            <span className="bg-zinc-800/30 px-2 py-0.5 rounded-md border border-white/5">
              {formatPersianDate(task.due_date)}
            </span>
          )}

          {checklistTotal > 0 && (
            <div className={`flex items-center gap-1.5 bg-zinc-800/30 px-2 py-0.5 rounded-md border border-white/5 ${checklistCompleted === checklistTotal ? 'text-green-400' : 'text-zinc-500'}`}>
              <ListChecksIcon className="w-3 h-3" />
              <span className="font-mono text-[10px]">{checklistCompleted}/{checklistTotal}</span>
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
            className="p-1.5 rounded-lg bg-zinc-850 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all font-semibold"
            title="حذف کار"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color bar indicator for priority on the right border */}
        <div className={`absolute top-0 right-0 h-full w-1 ${
          priorityColor === 'red' ? 'bg-red-500' :
          priorityColor === 'yellow' ? 'bg-yellow-500' : 'bg-sky-500'
        }/60`}></div>
      </div>
    </motion.div>
  );
});

TaskCard.displayName = 'TaskCard';
