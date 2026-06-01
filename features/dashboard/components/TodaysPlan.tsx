import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { isSameTehranDay } from '../../../utils/dateUtils';
import { Priority } from '../../../types';
import { CheckIcon, ListChecksIcon } from '../../../components/icons';
import { WidgetContainer } from './WidgetContainer';

export const TodaysPlan: React.FC = () => {
  const { tasks, selectedDate, toggleTaskCompletion } = useData();

  const todaysTasks = useMemo(() => {
    return tasks
      .filter(t => t.due_date && isSameTehranDay(t.due_date, selectedDate))
      .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
  }, [tasks, selectedDate]);

  return (
    <WidgetContainer>
      <h2 className="text-lg font-bold text-white mb-4">برنامه امروز</h2>
      {todaysTasks.length > 0 ? (
        <div className="max-h-64 overflow-y-auto pl-2 space-y-3">
          {todaysTasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center gap-3 transition-opacity duration-300 ${task.status === 'done' ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => toggleTaskCompletion(task.id)}
                className={`w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${task.status === 'done' ? 'bg-sky-500 border-sky-400' : 'border-gray-600 hover:border-sky-500'}`}
                aria-label={task.status === 'done' ? `لغو انجام ${task.title}` : `انجام ${task.title}`}
              >
                {task.status === 'done' && <CheckIcon className="w-3.5 h-3.5 text-white"/>}
              </button>
              <span className={`flex-1 text-sm ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                {task.title}
              </span>
              <div 
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.priority === Priority.High 
                    ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' 
                    : task.priority === Priority.Medium 
                    ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]' 
                    : 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                }`}
              ></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500 text-sm">
          <ListChecksIcon className="w-10 h-10 mx-auto mb-2 text-gray-600" />
          <p>در این تاریخ کاری ثبت نشده است.</p>
        </div>
      )}
    </WidgetContainer>
  );
};
