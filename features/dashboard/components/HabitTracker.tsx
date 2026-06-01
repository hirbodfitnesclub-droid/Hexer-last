import React from 'react';
import { useData } from '../../../contexts/DataContext';
import { getTehranDateString } from '../../../utils/dateUtils';
import { CheckIcon, FlameIcon, PlusIcon } from '../../../components/icons';
import { WidgetContainer } from './WidgetContainer';

export const HabitTracker: React.FC = () => {
  const { habits, toggleHabitCompletion, editHabit, selectedDate } = useData();
  const selectedDateString = getTehranDateString(selectedDate);

  return (
    <WidgetContainer>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">رهگیر عادت‌ها</h2>
        <button 
          onClick={() => editHabit({ frequency: 'daily', target_count: 1 })} 
          className="p-1.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 hover:text-orange-200 rounded-lg transition-colors cursor-pointer"
          aria-label="ساخت عادت جدید"
        >
          <PlusIcon className="w-4 h-4"/>
        </button>
      </div>
      
      {habits.length > 0 ? (
        <div className="space-y-2">
          {habits.map(habit => {
            const isCompleted = habit.completedDates?.includes(selectedDateString) || false;
            return (
              <div 
                key={habit.id} 
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${isCompleted ? 'bg-green-500/20' : 'bg-gray-800/70 hover:bg-gray-800'}`}
              >
                <button 
                  onClick={() => toggleHabitCompletion(habit.id, selectedDateString)}
                  className={`w-6 h-6 flex-shrink-0 rounded-md flex items-center justify-center border-2 transition-all duration-300 cursor-pointer ${isCompleted ? 'bg-green-500 border-green-400' : 'border-gray-600 hover:border-orange-500'}`}
                >
                  {isCompleted && <CheckIcon className="w-4 h-4 text-white"/>}
                </button>
                <button 
                  onClick={() => editHabit(habit)} 
                  className={`text-sm flex-1 text-right transition-colors duration-300 cursor-pointer ${isCompleted ? 'text-green-300 line-through decoration-white/50 animate-pulse' : 'text-gray-300 hover:text-white'}`}
                >
                  {habit.name}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 text-sm flex flex-col items-center">
          <FlameIcon className="w-8 h-8 text-gray-700 mb-2"/>
          <p>هیچ عادتی ثبت نشده.</p>
          <button 
            onClick={() => editHabit({ frequency: 'daily', target_count: 1 })} 
            className="mt-2 text-xs text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
          >
            ساخت عادت جدید
          </button>
        </div>
      )}
    </WidgetContainer>
  );
};
