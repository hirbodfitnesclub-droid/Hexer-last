import React, { useState, useEffect } from 'react';
import { Note, Project, Task } from '../../../types';
import { 
  XIcon, TrashIcon, BriefcaseIcon, ChevronDownIcon, ChevronRightIcon,
  HashIcon, LightbulbIcon, ClockIcon, FileTextIcon, 
  PlusIcon, CheckIcon, ListChecksIcon 
} from '../../../components/icons';
import { getLinkedTasks, unlinkTaskNote, linkTaskNote } from '../../../services/linkService';
import { LinkTaskPicker } from './LinkTaskPicker';
import { useData } from '../../../contexts/DataContext';

interface NoteEditorModalProps {
  note: Note | Partial<Note>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Note | Partial<Note>) => Promise<Note> | any;
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
  const [pendingLinkIds, setPendingLinkIds] = useState<string[]>([]);
  
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
      setPendingLinkIds([]);
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

  const handleSave = async () => {
    if (formState.title?.trim() || formState.content?.trim()) {
      try {
        const savedNote = await onSave(formState);
        if (isNew && savedNote && savedNote.id && pendingLinkIds.length > 0) {
          for (const taskId of pendingLinkIds) {
            await linkTaskNote(taskId, savedNote.id);
          }
        }
      } catch (err) {
        console.error('Error saving note and committing links:', err);
      }
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

  const handleAddLink = async (taskId: string) => {
    if (isNew) {
      setPendingLinkIds(prev => {
        if (prev.includes(taskId)) return prev;
        return [...prev, taskId];
      });
    } else if (formState.id) {
      try {
        await linkTaskNote(taskId, formState.id);
        loadLinks();
      } catch (err) {
        console.error('Error adding link:', err);
      }
    }
  };

  const handleRemoveLink = async (taskId: string) => {
    if (isNew) {
      setPendingLinkIds(prev => prev.filter(id => id !== taskId));
    } else if (formState.id) {
      try {
        await unlinkTaskNote(taskId, formState.id);
        loadLinks();
      } catch (err) {
        console.error('Error unlinking task:', err);
      }
    }
  };

  const displayedTasks = React.useMemo(() => {
    if (isNew) {
      return tasks.filter(t => pendingLinkIds.includes(t.id));
    }
    return linkedTasks;
  }, [isNew, tasks, pendingLinkIds, linkedTasks]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4" 
      role="dialog" 
      aria-modal="true" 
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full rounded-t-3xl sm:rounded-[2rem] bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] shadow-2xl flex flex-col h-[100dvh] sm:h-[90dvh] md:max-h-[92vh] max-w-3xl transition-all duration-300 ease-out overflow-hidden relative ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
      >
        {/* 1. Header: Minimalist Actions */}
        <div className="shrink-0 flex justify-between items-center px-6 py-4 sm:py-5 pt-safe bg-[var(--bg-card)]/80 backdrop-blur-md z-10 border-b border-[var(--border-subtle)]">
          <button 
            onClick={handleClose} 
            className="group flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <div className="p-2 rounded-xl bg-[var(--nav-hover-bg)] group-hover:opacity-80 transition-colors">
              <ChevronRightIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold font-sans hidden sm:block">بازگشت</span>
          </button>
          
          <div className="flex items-center gap-3">
             {!isNew && (
              <button 
                onClick={handleDelete}
                className="p-2.5 text-error hover:bg-error/10 rounded-xl transition-all border border-transparent hover:border-error/15"
                title="حذف یادداشت"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleSave} 
              className="px-6 py-2.5 bg-lime hover:opacity-90 text-[var(--text-on-primary)] rounded-xl font-bold text-xs transition-all hover:scale-103"
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
              className="w-full bg-transparent border-none p-0 text-2xl sm:text-3.5xl font-black text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-0 focus:outline-none leading-relaxed text-right font-sans"
              autoFocus
            />

            <textarea
              value={formState.content || ''}
              onChange={e => setFormState(s => ({ ...s, content: e.target.value }))}
              placeholder="شروع به نوشتن کنید..."
              className="w-full h-[45vh] sm:h-[50vh] bg-transparent border-none p-0 text-sm sm:text-base text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-0 focus:outline-none resize-none leading-relaxed font-light text-right"
            />
          </div>
        </div>

        {/* 3. Metadata Footer: The Control Center */}
        <div className="shrink-0 bg-[var(--bg-card)]/80 backdrop-blur-2xl border-t border-[var(--border-subtle)] p-4 sm:p-6 pb-safe" dir="rtl">
          <div className="max-w-2xl mx-auto space-y-4 max-h-[35vh] overflow-y-auto pr-1">
            
            {/* TWO-WAY BIDIRECTIONAL TASKS LINKING SECTION */}
            <div className="p-4 bg-[var(--bg-card)]/40 border border-[var(--border-subtle)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)]">کارهای مرتبط</span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{displayedTasks.length} لینک شده</span>
              </div>

              {displayedTasks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {displayedTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] text-right">
                      <div className="flex items-center gap-2 min-w-0">
                        <ListChecksIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <span className="text-xs text-[var(--text-main)] font-medium truncate">{t.title || 'کار بدون عنوان'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(t.id)}
                        className="p-1 hover:text-error hover:bg-error/10 rounded text-[var(--text-muted)] transition-colors"
                        title="حذف پیوند"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)] block text-right">هیچ کاری به این یادداشت لینک نشده است.</span>
              )}

              <div className="pt-2">
                <LinkTaskPicker 
                  tasks={tasks}
                  noteCreatedAt={formState.created_at}
                  onSelect={handleAddLink}
                  linkedTaskIds={displayedTasks.map(l => l.id)}
                />
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
                <HashIcon className="w-3 h-3 text-[var(--text-muted)]" />
                <span>برچسب‌ها</span>
              </div>

              {/* Active Tags & Input */}
              <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-card)]/50 p-2 rounded-xl border border-[var(--border-subtle)] focus-within:border-primary/30 transition-all font-sans">
                {formState.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/15 text-xs font-semibold">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-[var(--text-main)] text-primary transition-colors">
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={formState.tags?.length ? "..." : "تگ جدید (اینتر)..."}
                  className="flex-1 bg-transparent min-w-[120px] px-2 py-1 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none text-right font-medium"
                />
              </div>

              {/* Preset Quick Tags */}
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                {presetTags.map(preset => {
                  const isActive = (formState.tags || []).includes(preset.label);
                  return (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => togglePresetTag(preset.label)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap
                        ${isActive 
                          ? 'bg-primary text-black border-primary' 
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-primary/40 hover:text-[var(--text-main)]'}
                      `}
                    >
                      {preset.icon}
                      <span>{preset.label}</span>
                      {isActive && <CheckIcon className="w-3 h-3 ml-0.5 text-black" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Project Selector */}
            <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative group w-full sm:w-64">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <BriefcaseIcon className="w-4 h-4" />
                </div>
                <select 
                  value={formState.project_id || ''} 
                  onChange={e => setFormState(s => ({...s, project_id: e.target.value || undefined}))} 
                  className="w-full bg-[var(--bg-card)] text-[var(--text-main)] text-xs rounded-xl py-2 px-10 border border-[var(--border-subtle)] outline-none focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/40 text-right font-bold focus:ring-1 focus:ring-primary/20"
                >
                  <option value="" className="bg-[var(--bg-card)] text-[var(--text-muted)]">اتصال به پروژه (اختیاری)</option>
                  {projects.map(p => <option key={p.id} value={p.id} className="bg-[var(--bg-card)]">{p.title}</option>)}
                </select>
                <ChevronDownIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditorModal;
