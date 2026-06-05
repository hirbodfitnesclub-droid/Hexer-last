import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { Note } from '../../types';
import { PlusIcon, SearchIcon, HashIcon } from '../../components/icons';
import { NoteCard } from './components/NoteCard';
import { NoteEditorModal } from './components/NoteEditorModal';

export const NotesView: React.FC = () => {
  const { 
    notes, 
    projects, 
    tasks, 
    addNote, 
    updateNote, 
    deleteNote 
  } = useData();

  const [currentNote, setCurrentNote] = useState<Note | Partial<Note> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const openModalForNew = () => {
    setCurrentNote({ title: '', content: '', tags: [], project_id: undefined });
  };

  const handleSave = (noteToSave: Note | Partial<Note>) => {
    if (!noteToSave || (!noteToSave.title?.trim() && !noteToSave.content?.trim())) {
      setCurrentNote(null);
      return;
    }
    
    if ('id' in noteToSave && noteToSave.id) {
      updateNote(noteToSave as Note);
    } else {
      addNote(noteToSave as Omit<Note, 'id' | 'created_at' | 'updated_at' | 'user_id'>);
    }
    setCurrentNote(null);
  };

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const lowercasedQuery = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.title.toLowerCase().includes(lowercasedQuery) ||
      (note.content && note.content.toLowerCase().includes(lowercasedQuery)) ||
      (note.project_id && projectMap.get(note.project_id)?.title.toLowerCase().includes(lowercasedQuery)) ||
      (note.tags && note.tags.some(tag => tag.toLowerCase().includes(lowercasedQuery)))
    );
  }, [notes, searchQuery, projectMap]);

  return (
    <div className="min-h-full pb-32 bg-zinc-950 text-white relative flex flex-col h-full" dir="rtl">
      {/* Header Section */}
      <header className="sticky top-0 z-30 px-6 py-8 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 shrink-0">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-right">
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-purple-400">
              یادداشت‌ها
            </h1>
            <p className="text-zinc-500 text-xs mt-1 font-bold font-sans">فضایی زیبا برای ایده‌ها و خلاقیت‌های شما</p>
          </div>
          
          {/* Search Input */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-purple-400 transition-colors">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input 
              type="text"
              placeholder="جستجو در موضوعات یا برچسب‌ها..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-600 rounded-2xl py-2.5 pr-10 pl-4 outline-none focus:border-purple-500/50 transition-all font-medium text-xs text-right"
            />
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-8 max-w-[1600px] mx-auto w-full scroll-fade-edge">
        {filteredNotes.length > 0 ? (
          // Masonry Layout using CSS Columns
          <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
            {filteredNotes.map(note => (
              <NoteCard 
                key={note.id} 
                note={note} 
                project={note.project_id ? projectMap.get(note.project_id) : undefined}
                onEdit={setCurrentNote}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full"></div>
              <HashIcon className="relative w-14 h-14 text-zinc-800" />
            </div>
            <h3 className="text-sm font-bold text-zinc-400 mb-1">هنوز خالیست</h3>
            <p className="text-xs text-zinc-600 max-w-xs leading-relaxed font-semibold">
              ذهن شما پر از ایده‌های درخشان است. اولین یادداشت خود را ثبت کنید.
            </p>
          </div>
        )}
      </div>
    
      {/* Floating Action Button */}
      <button 
        onClick={openModalForNew} 
        className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20 hover:scale-105 transition-all duration-300 z-40"
        aria-label="New Note"
      >
        <PlusIcon className="w-7 h-7"/>
      </button>
    
      {currentNote && (
        <NoteEditorModal
          note={currentNote}
          isOpen={!!currentNote}
          onClose={() => setCurrentNote(null)}
          onSave={handleSave}
          onDelete={deleteNote}
          projects={projects}
          tasks={tasks}
          allNotes={notes}
        />
      )}
    </div>
  );
};

export default NotesView;
