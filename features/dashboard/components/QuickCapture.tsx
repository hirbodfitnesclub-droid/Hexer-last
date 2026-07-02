import React, { useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { getTehranDateString } from '../../../utils/dateUtils';
import { Priority } from '../../../types';
import { ListChecksIcon, NotebookIcon } from '../../../components/icons';
import { WidgetContainer } from './WidgetContainer';

export const QuickCapture: React.FC = () => {
  const { addTask, addNote, selectedDate } = useData();
  const [input, setInput] = useState('');

  const handleAction = (type: 'task' | 'note') => {
    if (!input.trim()) return;
    
    if (type === 'task') {
      addTask({
        title: input,
        priority: Priority.Medium,
        tags: [],
        due_date: getTehranDateString(selectedDate),
      });
    } else {
      addNote({
        title: `یادداشت سریع: ${input.substring(0, 20)}`,
        content: input,
        tags: ['سریع']
      });
    }
    setInput('');
  };

  return (
    <WidgetContainer>
      <h2 className="text-lg font-bold text-[var(--text-main)] mb-3">ثبت سریع</h2>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="یک ایده، فکر یا وظیفه را سریع ثبت کن..."
        className="w-full bg-[var(--bg-card)] p-3 rounded-lg text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] h-20 resize-none transition-all duration-300 border border-[var(--border-subtle)] focus:border-[var(--input-focus-ring)]"
      />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button 
          onClick={() => handleAction('task')} 
          disabled={!input.trim()} 
          className="flex items-center justify-center gap-2 w-full p-2.5 bg-primary rounded-lg text-[var(--text-on-primary)] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40 cursor-pointer"
        >
          <ListChecksIcon className="w-5 h-5"/> 
          <span>ثبت کار</span>
        </button>
        <button 
          onClick={() => handleAction('note')} 
          disabled={!input.trim()} 
          className="flex items-center justify-center gap-2 w-full p-2.5 bg-[var(--bg-card)] backdrop-blur-xl text-[var(--text-main)] border border-[var(--border-subtle)] rounded-lg font-semibold hover:bg-[var(--nav-hover-bg)] transition-colors disabled:opacity-40 cursor-pointer"
        >
          <NotebookIcon className="w-5 h-5"/> 
          <span>ثبت یادداشت</span>
        </button>
      </div>
    </WidgetContainer>
  );
};
