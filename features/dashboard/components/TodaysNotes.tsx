import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { isSameTehranDay } from '../../../utils/dateUtils';
import { NotebookIcon } from '../../../components/icons';

export const TodaysNotes: React.FC = () => {
  const { notes, selectedDate } = useData();

  const todaysNotes = useMemo(() => {
    return notes.filter(n => isSameTehranDay(n.created_at, selectedDate));
  }, [notes, selectedDate]);

  return (
    <div className="bg-black/30 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-inner flex gap-4 h-40">
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-20 text-center text-gray-400 border-l border-white/10 pr-2">
        <NotebookIcon className="w-8 h-8 mb-2 text-[var(--text-muted)]" />
        <span className="text-xs font-semibold select-none">یادداشت‌ها</span>
      </div>
      <div className="flex-1 overflow-hidden flex items-center">
        {todaysNotes.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 w-full snap-x scrollbar-thin">
            {todaysNotes.map(note => (
              <div 
                key={note.id} 
                className="w-48 h-28 flex-shrink-0 bg-gray-800/60 p-3 rounded-lg border border-white/5 flex flex-col snap-start transition-all duration-300 hover:border-primary/30"
              >
                <h4 className="font-semibold text-sm text-gray-200 truncate">{note.title}</h4>
                <p className="text-xs text-gray-400 mt-1 line-clamp-3 flex-1 overflow-hidden leading-relaxed">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <p className="text-gray-600 text-sm">امروز یادداشتی ثبت نشده.</p>
          </div>
        )}
      </div>
    </div>
  );
};
