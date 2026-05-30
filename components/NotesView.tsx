
import React, { useState, useMemo } from 'react';
import { Note, Project, Task } from '../types';
import { PlusIcon, SearchIcon, HashIcon } from './icons';
import NoteEditorModal from './NoteEditorModal';
import { formatPersianDate } from '../utils/dateUtils';

// --- Redesigned Note Card: "Luxury Glass" ---
const NoteCard: React.FC<{
    note: Note;
    project?: Project;
    onEdit: (note: Note) => void;
}> = ({ note, project, onEdit }) => {
    return (
        <div 
            onClick={() => onEdit(note)}
            className="group break-inside-avoid mb-6 cursor-pointer relative"
        >
            {/* Background & Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/20 to-fuchsia-600/20 rounded-[2rem] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
            
            <div className="relative bg-zinc-900 border border-white/5 rounded-[1.75rem] overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-purple-500/30">
                {/* Decoration: Project Indicator */}
                {project && (
                    <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-${project.color}-500 to-transparent opacity-50`}></div>
                )}

                <div className="p-6 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4">
                        <h3 className="text-xl font-bold text-white leading-snug tracking-tight group-hover:text-purple-100 transition-colors">
                            {note.title || "بدون عنوان"}
                        </h3>
                        {project && (
                            <span className="flex-shrink-0 text-[10px] font-bold tracking-wider uppercase text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-md border border-white/5">
                                {project.title}
                            </span>
                        )}
                    </div>

                    {/* Content Preview */}
                    <p className="text-zinc-400 text-sm font-light leading-relaxed line-clamp-6 opacity-90 group-hover:text-zinc-300 transition-colors">
                        {note.content}
                    </p>

                    {/* Footer: Meta & Tags */}
                    <div className="pt-4 mt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[10px] text-zinc-600 font-mono">
                            {formatPersianDate(note.created_at)}
                        </span>
                        
                        {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 justify-end">
                                {note.tags.slice(0, 3).map(tag => (
                                    <div key={tag} className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-zinc-800/80 text-[10px] text-zinc-400 group-hover:bg-purple-500/10 group-hover:text-purple-300 transition-colors">
                                        <span className="opacity-50">#</span>
                                        {tag}
                                    </div>
                                ))}
                                {note.tags.length > 3 && (
                                    <span className="text-[10px] text-zinc-600">+{note.tags.length - 3}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main NotesView Component ---
const NotesView: React.FC<{
  notes: Note[];
  projects: Project[];
  tasks: Task[];
  deleteNote: (id: string) => void;
  addNote: (note: Omit<Note, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => void;
  updateNote: (note: Note) => void;
}> = ({ notes, projects, tasks, addNote, updateNote, deleteNote }) => {
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
            (projectMap.get(note.project_id || '')?.title.toLowerCase().includes(lowercasedQuery)) ||
            (note.tags && note.tags.some(tag => tag.toLowerCase().includes(lowercasedQuery)))
        );
    }, [notes, searchQuery, projectMap]);

  return (
    <div className="min-h-full pb-32 bg-zinc-950 text-white relative">
        {/* Header Section */}
        <div className="sticky top-0 z-30 px-6 py-8 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-purple-400">
                        یادداشت‌ها
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1 font-medium">فضایی برای ایده‌های بی‌پایان</p>
                </div>
                
                {/* Search Input */}
                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
                    </div>
                    <input 
                        type="text"
                        placeholder="جستجو..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-600 rounded-2xl py-3 pr-12 pl-4 outline-none focus:border-purple-500/50 focus:bg-zinc-900/80 transition-all duration-300 shadow-inner"
                    />
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="px-4 sm:px-8 pt-8 max-w-[1600px] mx-auto">
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
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-0 animate-fade-in-up" style={{animationDelay: '0.1s', opacity: 1}}>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full"></div>
                        <HashIcon className="relative w-20 h-20 text-zinc-800" />
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-300 mb-2">هنوز خالیست</h3>
                    <p className="text-zinc-600 max-w-xs leading-relaxed">
                        ذهن شما پر از ایده است. اولین یادداشت خود را همین حالا ثبت کنید.
                    </p>
                </div>
            )}
        </div>
      
       {/* Floating Action Button */}
       <button 
            onClick={openModalForNew} 
            className="fixed bottom-24 right-8 w-16 h-16 bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-500/40 hover:scale-110 hover:rotate-90 transition-all duration-500 z-40 group"
       >
            <PlusIcon className="w-8 h-8"/>
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
