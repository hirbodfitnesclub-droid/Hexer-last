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
          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-bold bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 px-3 py-1.5 rounded-xl transition-all"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>لینک یادداشت مرتبط</span>
        </button>
      ) : (
        <div className="bg-zinc-950/60 p-4 rounded-xl border border-white/5 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-xs font-bold text-zinc-400">اتصال یادداشت وجود دارد</span>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              انصراف
            </button>
          </div>

          {/* Direct Suggestions based on Tehran Same Day */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">پیشنهادی (هم‌زمان با ددلاین کار):</span>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestions.map(note => (
                  <button
                    type="button"
                    key={note.id}
                    onClick={() => handleLink(note.id)}
                    className="flex items-center gap-2 p-2 bg-zinc-900/60 hover:bg-purple-950/20 border border-white/5 hover:border-purple-500/20 text-right rounded-lg text-xs text-zinc-300 group transition-all"
                  >
                    <NotebookIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span className="flex-1 truncate group-hover:text-purple-300 transition-colors">{note.title || 'بدون عنوان'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Field */}
          <div className="relative group">
            <SearchIcon className="w-4 h-4 text-zinc-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-purple-400 transition-colors" />
            <input
              type="text"
              placeholder="جستجوی یادداشت بر اساس عنوان..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 rounded-xl py-2.5 pr-9 pl-3 outline-none focus:border-purple-500/50 transition-all font-medium text-right"
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
                    className="w-full flex items-center gap-2 p-2 bg-zinc-900/40 hover:bg-purple-950/20 rounded-lg text-right text-xs text-zinc-300 hover:text-purple-300 transition-all border border-transparent hover:border-purple-500/10"
                  >
                    <NotebookIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="flex-1 truncate">{note.title || 'بدون عنوان'}</span>
                  </button>
                ))
              ) : (
                <span className="text-[10px] text-zinc-600 text-center block py-2">نتیجه‌ای یافت نشد.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
