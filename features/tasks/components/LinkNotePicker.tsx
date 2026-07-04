import React, { useState, useMemo } from 'react';
import { Note } from '../../../types';
import { SearchIcon, PlusIcon, NotebookIcon } from '../../../components/icons';
import { isSameTehranDay } from '../../../utils/dateUtils';

interface LinkNotePickerProps {
  notes: Note[];
  taskDueDate?: string | null;
  onSelect: (noteId: string) => void;
  linkedNoteIds: string[];
}

export const LinkNotePicker: React.FC<LinkNotePickerProps> = ({
  notes,
  taskDueDate,
  onSelect,
  linkedNoteIds
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeNotes = useMemo(() => {
    return notes.filter(n => !linkedNoteIds.includes(n.id));
  }, [notes, linkedNoteIds]);

  const suggestions = useMemo(() => {
    if (!taskDueDate) return [];
    return activeNotes.filter(n => isSameTehranDay(n.created_at, taskDueDate)).slice(0, 5);
  }, [activeNotes, taskDueDate]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return activeNotes.filter(n => 
      n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [activeNotes, searchQuery]);

  const handleLink = (noteId: string) => {
    onSelect(noteId);
    setSearchQuery('');
    setShowPicker(false);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {!showPicker ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 text-xs text-primary-text hover:text-primary-hover font-bold bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-xl transition-all"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>لینک یادداشت مرتبط</span>
        </button>
      ) : (
        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-bold text-[var(--text-muted)]">اتصال یادداشت وجود دارد</span>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              انصراف
            </button>
          </div>

          {/* Direct Suggestions based on Tehran Same Day */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">پیشنهادی (هم‌زمان با ددلاین کار):</span>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestions.map(note => (
                  <button
                    type="button"
                    key={note.id}
                    onClick={() => handleLink(note.id)}
                    className="flex items-center gap-2 p-2 bg-[var(--bg-card)] hover:bg-primary/10 border border-[var(--border-subtle)] hover:border-primary/20 text-right rounded-lg text-xs text-[var(--text-muted)] group transition-all"
                  >
                    <NotebookIcon className="w-3.5 h-3.5 text-primary-text" />
                    <span className="flex-1 truncate group-hover:text-primary-text transition-colors">{note.title || 'بدون عنوان'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Field */}
          <div className="relative group">
            <SearchIcon className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-primary-text transition-colors" />
            <input
              type="text"
              placeholder="جستجوی یادداشت بر اساس عنوان..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] rounded-xl py-2.5 pr-9 pl-3 outline-none focus:border-primary/50 transition-all font-medium text-right"
            />
          </div>

          {/* Filtered notes result */}
          {searchQuery.trim() && (
            <div className="max-h-40 overflow-y-auto space-y-1 select-none pr-1">
              {filteredNotes.length > 0 ? (
                filteredNotes.map(note => (
                  <button
                    type="button"
                    key={note.id}
                    onClick={() => handleLink(note.id)}
                    className="w-full flex items-center gap-2 p-2 bg-[var(--bg-card)] hover:bg-primary/10 rounded-lg text-right text-xs text-[var(--text-muted)] hover:text-primary-text transition-all border border-transparent hover:border-primary/10"
                  >
                    <NotebookIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="flex-1 truncate">{note.title || 'بدون عنوان'}</span>
                  </button>
                ))
              ) : (
                <span className="text-[10px] text-[var(--text-muted)] text-center block py-2">نتیجه‌ای یافت نشد.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
