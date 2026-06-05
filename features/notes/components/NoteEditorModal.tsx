import React, { useState, useEffect } from 'react';
import { Note, Project, Task } from '../../../types';
import { 
  XIcon, TrashIcon, BriefcaseIcon, ChevronDownIcon, ChevronRightIcon,
  HashIcon, LightbulbIcon, ClockIcon, FileTextIcon, 
  PlusIcon, CheckIcon, ListChecksIcon 
} from '../../../components/icons';
import { getLinkedTasks, unlinkTaskNote } from '../../../services/linkService';
import { LinkTaskPicker } from './LinkTaskPicker';
import { useData } from '../../../contexts/DataContext';

interface NoteEditorModalProps {
  note: Note | Partial<Note>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Note | Partial<Note>) => void;
  onDelete: (id: string) => void;
  projects: Project[];
  tasks: Task[];
  allNotes: Note[];
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({ 
  note, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  projects,
  tasks,
  allNotes
}) => {
  const [formState, setFormState] = useState<Note | Partial<Note>>(note);
  const [isVisible, setIsVisible] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
  
  const isNew = !('id' in note);

  // Predefined quick tags
  const presetTags = [
    { label: 'ایده', icon: <LightbulbIcon className="w-3.5 h-3.5" />, color: 'yellow' },
    { label: 'برای بعد', icon: <ClockIcon className="w-3.5 h-3.5" />, color: 'sky' },
    { label: 'مقاله', icon: <FileTextIcon className="w-3.5 h-3.5" />, color: 'purple' },
  ];

  const loadLinks = async () => {
    if (note.id) {
      try {
        const lt = await getLinkedTasks(note.id);
        setLinkedTasks(lt);
      } catch (err) {
        console.error('Failed to load linked tasks:', err);
      }
    } else {
      setLinkedTasks([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormState(note);
      setIsVisible(true);
      loadLinks();
    } else {
      setIsVisible(false);
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, note]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    if (formState.title?.trim() || formState.content?.trim()) {
      onSave(formState);
    }
    onClose();
  };

  const handleDelete = () => {
    if ('id' in formState && formState.id) {
      onDelete(formState.id);
    }
    onClose();
  };

  // --- Tag Logic ---
  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !(formState.tags || []).includes(trimmed)) {
      setFormState(prev => ({ ...prev, tags: [...(prev.tags || []), trimmed] }));
    }
  };

  const removeTag = (tagName: string) => {
    setFormState(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tagName) }));
  };

  const togglePresetTag = (tagName: string) => {
    if ((formState.tags || []).includes(tagName)) {
      removeTag(tagName);
    } else {
      addTag(tagName);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
    }
  };

  const handleUnlink = async (taskId: string) => {
    if (note.id) {
      try {
        await unlinkTaskNote(taskId, note.id);
        loadLinks();
      } catch (err) {
        console.error('Error deleting task link:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4" 
      role="dialog" 
      aria-modal="true" 
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full rounded-t-3xl sm:rounded-[2rem] bg-zinc-950 border-t sm:border border-white/5 shadow-2xl flex flex-col h-[100dvh] sm:h-[90dvh] md:max-h-[92vh] max-w-3xl transition-all duration-300 ease-out overflow-hidden relative ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
      >
        {/* 1. Header: Minimalist Actions */}
        <div className="shrink-0 flex justify-between items-center px-6 py-4 sm:py-5 bg-zinc-950/80 backdrop-blur-md z-10 border-b border-white/5">
          <button 
            onClick={handleClose} 
            className="group flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
              <ChevronRightIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold font-sans hidden sm:block">بازگشت</span>
          </button>
          
          <div className="flex items-center gap-3">
             {!isNew && (
              <button 
                onClick={handleDelete}
                className="p-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/15"
                title="حذف یادداشت"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleSave} 
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold text-xs shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)] transition-all hover:scale-103"
            >
              {isNew ? 'ثبت یادداشت' : 'ذخیره تغییرات'}
            </button>
          </div>
        </div>

        {/* 2. Main Canvas: Creative Writing Area & Forms */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto px-6 py-6 sm:py-8 space-y-6" dir="rtl">
            <input
              value={formState.title || ''}
              onChange={e => setFormState(s => ({ ...s, title: e.target.value }))}
              placeholder="عنوان ایده یا یادداشت..."
              className="w-full bg-transparent border-none p-0 text-2xl sm:text-3.5xl font-black text-white placeholder-zinc-800 focus:ring-0 focus:outline-none leading-relaxed text-right font-sans"
              autoFocus
            />

            {/* TWO-WAY TASKS LINKING SECTION */}
            <div className="py-4 border-y border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">کارهای لینک‌شده</span>
                <span className="text-[10px] font-mono text-zinc-600">{linkedTasks.length} لینک شده</span>
              </div>

              {linkedTasks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {linkedTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-xl border border-white/5 text-right">
                      <div className="flex items-center gap-2 min-w-0">
                        <ListChecksIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-xs text-zinc-300 font-medium truncate">{t.title || 'کار بدون عنوان'}</span>
                      </div>
                      <button
                        onClick={() => handleUnlink(t.id)}
                        className="p-1 hover:text-red-400 hover:bg-red-500/10 rounded text-zinc-600 transition-colors"
                        title="حذف پیوند"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-zinc-600 block text-right">هیچ کاری به این یادداشت لینک نشده است.</span>
              )}

              <div className="pt-1">
                {!isNew && note.id ? (
                  <LinkTaskPicker 
                    noteId={note.id}
                    tasks={tasks}
                    noteCreatedAt={formState.created_at}
                    onLinkAdded={loadLinks}
                    linkedTaskIds={linkedTasks.map(l => l.id)}
                  />
                ) : (
                  <div className="text-[11px] text-zinc-500 bg-zinc-950/40 p-2.5 rounded-xl border border-white/5 text-right font-medium">
                    پس از ثبت یادداشت، امکان متصل کردن کار مرتبط فعال خواهد شد.
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={formState.content || ''}
              onChange={e => setFormState(s => ({ ...s, content: e.target.value }))}
              placeholder="شروع به نوشتن کنید..."
              className="w-full h-[35vh] sm:h-[40vh] bg-transparent border-none p-0 text-sm sm:text-base text-zinc-300 placeholder-zinc-800 focus:ring-0 focus:outline-none resize-none leading-relaxed font-light text-right"
            />
          </div>
        </div>

        {/* 3. Metadata Footer: The Control Center */}
        <div className="shrink-0 bg-zinc-900/80 backdrop-blur-2xl border-t border-white/5 p-4 sm:p-6 pb-20 sm:pb-6" dir="rtl">
          <div className="max-w-2xl mx-auto space-y-4">
            
            {/* Tags Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <HashIcon className="w-3 h-3 text-zinc-600" />
                <span>برچسب‌ها</span>
              </div>

              {/* Active Tags & Input */}
              <div className="flex flex-wrap items-center gap-2 bg-zinc-950/70 p-2 rounded-xl border border-white/5 focus-within:border-purple-500/30 transition-all">
                {formState.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/15 text-xs font-semibold">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-white text-purple-400 transition-colors">
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={formState.tags?.length ? "..." : "تگ جدید بنویسید (اینتر بزنید)..."}
                  className="flex-1 bg-transparent min-w-[120px] px-2 py-1 text-xs text-white placeholder-zinc-700 focus:outline-none text-right font-medium"
                />
              </div>

              {/* Preset Quick Tags */}
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                {presetTags.map(preset => {
                  const isActive = (formState.tags || []).includes(preset.label);
                  return (
                    <button
                      key={preset.label}
                      onClick={() => togglePresetTag(preset.label)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap
                        ${isActive 
                          ? 'bg-zinc-100 text-zinc-900 border-zinc-100' 
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}
                      `}
                    >
                      {preset.icon}
                      <span>{preset.label}</span>
                      {isActive && <CheckIcon className="w-3 h-3 ml-0.5 text-purple-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Project Selector */}
            <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative group w-full sm:w-64">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                  <BriefcaseIcon className="w-4 h-4" />
                </div>
                <select 
                  value={formState.project_id || ''} 
                  onChange={e => setFormState(s => ({...s, project_id: e.target.value || undefined}))} 
                  className="w-full bg-zinc-950 text-zinc-300 text-xs rounded-xl py-2 px-10 border border-zinc-800 outline-none focus:border-purple-500/50 appearance-none cursor-pointer transition-all hover:border-zinc-700 text-right font-bold"
                >
                  <option value="" className="bg-zinc-950 text-zinc-500">اتصال به پروژه (اختیاری)</option>
                  {projects.map(p => <option key={p.id} value={p.id} className="bg-zinc-950">{p.title}</option>)}
                </select>
                <ChevronDownIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-350 transition-colors"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditorModal;
