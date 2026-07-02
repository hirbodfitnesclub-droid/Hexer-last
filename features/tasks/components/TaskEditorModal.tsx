import React, { useState, useEffect } from 'react';
import { Task, Priority, Project, Note, ChecklistItem } from '../../../types';
import { 
  XIcon, TrashIcon, CheckIcon, CalendarIcon, FlagIcon, 
  BriefcaseIcon, ClockIcon, PlusIcon, ListChecksIcon, 
  ChevronDownIcon, PencilIcon, NotebookIcon 
} from '../../../components/icons';
import PersianDatePicker from '../../../components/PersianDatePicker';
import TimePicker from '../../../components/TimePicker';
import { formatPersianDate } from '../../../utils/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { getLinkedNotes, unlinkTaskNote, linkTaskNote } from '../../../services/linkService';
import { LinkNotePicker } from './LinkNotePicker';

interface TaskEditorModalProps {
  task: Task | Partial<Task>;
  isOpen: boolean;
  projects: Project[];
  notes: Note[];
  onClose: () => void;
  onSave: (task: Task | Partial<Task>) => Promise<Task> | any;
  onDelete: (id: string) => void;
}

const priorityConfig = {
  [Priority.High]: { label: 'زیاد', color: 'red', text: 'text-error', bg: 'bg-error/10', badge: 'bg-error/10 text-error border-error/30' },
  [Priority.Medium]: { label: 'متوسط', color: 'yellow', text: 'text-primary', bg: 'bg-primary/10', badge: 'bg-primary/10 text-primary border-primary/30' },
  [Priority.Low]: { label: 'کم', color: 'sky', text: 'text-primary', bg: 'bg-primary/10', badge: 'bg-primary/10 text-primary border-primary/30' },
};

const PropertyRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }> = ({ icon, label, children, className }) => (
  <div className={`flex items-center p-2 rounded-lg transition-colors min-h-[44px] ${className}`}>
    <div className="flex items-center gap-3 w-28 flex-shrink-0 text-sm text-[var(--text-muted)]">
      {icon}
      <span>{label}</span>
    </div>
    <div className="flex-1 text-sm text-[var(--text-main)] font-medium">
      {children}
    </div>
  </div>
);

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({ 
  task, 
  isOpen, 
  projects, 
  notes, 
  onClose, 
  onSave, 
  onDelete 
}) => {
  const [formState, setFormState] = useState<Task | Partial<Task>>(task);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  
  // Explicit states for managing UI logic independently of the consolidated ISO string
  const [hasDate, setHasDate] = useState(false);
  const [hasTime, setHasTime] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [newItemText, setNewItemText] = useState('');
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([]);
  const [pendingLinkIds, setPendingLinkIds] = useState<string[]>([]);
  
  const isNew = !('id' in task);

  // Load linked notes
  const loadLinks = async () => {
    if (task.id) {
      try {
        const ln = await getLinkedNotes(task.id);
        setLinkedNotes(ln);
      } catch (err) {
        console.error('Failed to load linked notes:', err);
      }
    } else {
      setLinkedNotes([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormState(task);
      setMode(isNew ? 'edit' : 'view');
      setIsVisible(true);
      setNewItemText('');
      loadLinks();
      setPendingLinkIds([]);
      
      // Analyze existing due_date
      if (task.due_date) {
        setHasDate(true);
        const date = new Date(task.due_date);
        
        // Convert to Asia/Tehran hour & minute
        let h = date.getHours();
        let m = date.getMinutes();
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Tehran',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          });
          const parts = formatter.formatToParts(date);
          const hourPart = parts.find(p => p.type === 'hour')?.value;
          const minPart = parts.find(p => p.type === 'minute')?.value;
          if (hourPart) h = parseInt(hourPart);
          if (minPart) m = parseInt(minPart);
        } catch (e) {
          console.error('Error formatting time in Asia/Tehran timezone:', e);
        }

        const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        setSelectedTime(formattedTime);
        
        // Edge Case: Check if hour:minute is exactly 12:00 in Tehran timezone.
        // If it is 12:00, we treat it as Date-only (hasTime = false)
        // to avoid displaying noon by default, but allow setting time explicitly.
        if (h === 12 && m === 0) {
          setHasTime(false);
        } else {
          setHasTime(true);
        }
      } else {
        setHasDate(false);
        setHasTime(false);
        setSelectedTime('12:00');
      }
    } else {
      setIsVisible(false);
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, task]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!formState.title?.trim()) return;

    let finalDueDate: string | null = null;

    if (hasDate && formState.due_date) {
      const dateObj = new Date(formState.due_date);
      
      if (hasTime) {
        const [h, m] = selectedTime.split(':').map(Number);
        dateObj.setHours(h, m, 0, 0);
      } else {
        // If no time is selected, explicit midday is used as our Tehran date-only standard
        dateObj.setHours(12, 0, 0, 0); 
      }
      finalDueDate = dateObj.toISOString();
    }

    try {
      const savedTask = await onSave({ ...formState, due_date: finalDueDate });
      if (isNew && savedTask && savedTask.id && pendingLinkIds.length > 0) {
        for (const noteId of pendingLinkIds) {
          await linkTaskNote(savedTask.id, noteId);
        }
      }
    } catch (err) {
      console.error('Error saving task and committing links:', err);
    }
    onClose();
  };

  const handleDelete = () => {
    if ('id' in formState && formState.id) {
      onDelete(formState.id);
    }
    onClose();
  };

  const toggleStatus = () => {
    const newStatus = formState.status === 'done' ? 'todo' : 'done';
    const completed_at = newStatus === 'done' ? new Date().toISOString() : null;
    const updatedTask = { ...formState, status: newStatus, completed_at, id: formState.id };
    setFormState(updatedTask);
    if (mode === 'view' && !isNew) {
      onSave(updatedTask);
    }
  };

  // --- Checklist Logic ---
  const handleAddChecklistItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      isCompleted: false
    };
    setFormState(prev => ({
      ...prev,
      checklist: [...(prev.checklist || []), newItem]
    }));
    setNewItemText('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    const updatedChecklist = (formState.checklist || []).map(item => 
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );
    const updatedTask = { ...formState, checklist: updatedChecklist };
    setFormState(updatedTask);
    
    if (mode === 'view' && !isNew) {
      onSave(updatedTask);
    }
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    const updatedChecklist = (formState.checklist || []).filter(item => item.id !== itemId);
    setFormState(prev => ({ ...prev, checklist: updatedChecklist }));
  };

  const calculateProgress = () => {
    const items = formState.checklist || [];
    if (items.length === 0) return 0;
    const completed = items.filter(i => i.isCompleted).length;
    return Math.round((completed / items.length) * 100);
  };

  // --- Date/Time UI Handlers ---
  const handleAddDate = () => {
    setHasDate(true);
    setFormState(prev => ({...prev, due_date: new Date().toISOString()}));
  };

  const handleRemoveDate = () => {
    setHasDate(false);
    setHasTime(false);
    setFormState(prev => ({...prev, due_date: null}));
  };

  const handleAddTime = () => {
    setHasTime(true);
  };

  const handleRemoveTime = () => {
    setHasTime(false);
  };

  const handleAddLink = async (noteId: string) => {
    if (isNew) {
      setPendingLinkIds(prev => {
        if (prev.includes(noteId)) return prev;
        return [...prev, noteId];
      });
    } else if (formState.id) {
      try {
        await linkTaskNote(formState.id, noteId);
        loadLinks();
      } catch (err) {
        console.error('Error adding link:', err);
      }
    }
  };

  const handleRemoveLink = async (noteId: string) => {
    if (isNew) {
      setPendingLinkIds(prev => prev.filter(id => id !== noteId));
    } else if (formState.id) {
      try {
        await unlinkTaskNote(formState.id, noteId);
        loadLinks();
      } catch (err) {
        console.error('Error unlinking note:', err);
      }
    }
  };

  const displayedNotes = React.useMemo(() => {
    if (isNew) {
      return notes.filter(n => pendingLinkIds.includes(n.id));
    }
    return linkedNotes;
  }, [isNew, notes, pendingLinkIds, linkedNotes]);

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
        className={`bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] backdrop-blur-xl w-full max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl transition-all duration-300 ease-out flex flex-col h-[100dvh] sm:h-auto sm:max-h-[85vh] ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
      >
        {/* Header - Fixed */}
        <div className="p-4 sm:p-6 pt-safe border-b border-[var(--border-subtle)] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            {mode === 'view' ? (
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${priorityConfig[formState.priority || Priority.Medium].badge}`}>
                {priorityConfig[formState.priority || Priority.Medium].label}
              </div>
            ) : (
              <h2 className="text-base font-bold text-[var(--text-main)] font-sans">{isNew ? 'کار جدید' : 'ویرایش کار'}</h2>
            )}
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)] rounded-xl transition-colors"
          >
            <XIcon className="w-5 h-5"/>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-6 pb-6" dir="rtl">
          {mode === 'view' ? (
            // --- VIEW MODE ---
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <button
                  onClick={toggleStatus}
                  className={`mt-1.5 w-6 h-6 rounded-md border-2 flex shrink-0 items-center justify-center transition-all duration-300 ${
                    formState.status === 'done' ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--text-muted)] hover:border-[var(--color-primary)] bg-[var(--bg-card)]'
                  }`}
                >
                  {formState.status === 'done' && <CheckIcon className="w-4 h-4 text-[var(--text-on-primary)]"/>}
                </button>
                <div className="flex-1 text-right">
                  <h3 className={`text-xl font-bold leading-relaxed ${formState.status === 'done' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                    {formState.title}
                  </h3>
                  {formState.description && (
                    <p className="mt-4 text-[var(--text-muted)] text-sm leading-relaxed whitespace-pre-wrap">
                      {formState.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Checklist View */}
              {(formState.checklist && formState.checklist.length > 0) && (
                <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-[var(--text-main)]">
                      <ListChecksIcon className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="text-xs font-bold">زیرتسک‌ها ({formState.checklist.length})</span>
                    </div>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{calculateProgress()}%</span>
                  </div>
                  <div className="w-full bg-[var(--nav-hover-bg)] h-1 rounded-full mb-4 overflow-hidden">
                    <div 
                      className="bg-[var(--color-primary)] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${calculateProgress()}%` }}
                    ></div>
                  </div>
                  <div className="space-y-2.5">
                    {formState.checklist.map(item => (
                      <div key={item.id} className="flex items-start gap-3">
                        <button 
                          onClick={() => handleToggleChecklistItem(item.id)}
                          className={`mt-1 w-4 h-4 rounded border flex shrink-0 items-center justify-center transition-colors ${
                            item.isCompleted ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--text-muted)] hover:border-[var(--color-primary)] bg-[var(--bg-card)]'
                          }`}
                        >
                          {item.isCompleted && <CheckIcon className="w-3 h-3 text-[var(--text-on-primary)]"/>}
                        </button>
                        <span className={`text-sm text-right flex-1 leading-relaxed transition-colors ${item.isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Properties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formState.project_id && (
                  <div className="flex items-center gap-3 p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
                    <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg text-[var(--color-primary)] shrink-0">
                      <BriefcaseIcon className="w-5 h-5"/>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--text-muted)] font-bold">پروژه</p>
                      <p className="text-xs font-semibold text-[var(--text-main)]">
                        {projects.find(p => p.id === formState.project_id)?.title || 'نامشخص'}
                      </p>
                    </div>
                  </div>
                )}
                
                {formState.due_date && (
                  <div className="flex items-center gap-3 p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
                    <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg text-[var(--color-primary)] shrink-0">
                      <CalendarIcon className="w-5 h-5"/>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--text-muted)] font-bold">زمان انجام</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--text-main)]">{formatPersianDate(formState.due_date)}</span>
                        {hasTime && (
                          <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-1.5 py-0.5 rounded border border-[var(--border-neon)]">
                            {selectedTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>



              <div className="pt-6 flex gap-3">
                <button 
                  onClick={() => setMode('edit')} 
                  className="flex-1 bg-lime hover:opacity-90 text-[var(--text-on-primary)] py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <PencilIcon className="w-4 h-4"/>
                  <span>ویرایش کار</span>
                </button>
                <button 
                  onClick={handleDelete} 
                  className="px-5 py-3 bg-[var(--semantic-error-soft)] hover:opacity-85 text-[var(--semantic-error)] rounded-xl font-semibold transition-colors border border-[var(--semantic-error)]/15"
                >
                  <TrashIcon className="w-5 h-5"/>
                </button>
              </div>
            </div>
          ) : (
            // --- EDIT MODE WITH DVH SCROLL AND FORM FIELDS ---
            <div className="space-y-4">
              <input
                value={formState.title || ''}
                onChange={e => setFormState(s => ({ ...s, title: e.target.value }))}
                placeholder="عنوان کار را بنویسید..."
                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm font-semibold transition-all text-right"
                autoFocus
              />
              <textarea
                value={formState.description || ''}
                onChange={e => setFormState(s => ({ ...s, description: e.target.value }))}
                placeholder="توضیحات تکمیلی (اختیاری)..."
                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 min-h-[90px] resize-none transition-all text-right leading-relaxed"
                rows={3}
              />
              
              {/* Checklist Editor */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-[var(--text-muted)] text-xs font-bold">
                  <ListChecksIcon className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>زیرتسک‌ها</span>
                </div>
                <div className="space-y-2.5 mb-3 max-h-40 overflow-y-auto">
                  {formState.checklist && formState.checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2 group justify-between text-right">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.isCompleted ? 'bg-[var(--color-primary)]' : 'bg-[var(--text-muted)]'}`}></div>
                        <span className={`text-xs ${item.isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>{item.text}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteChecklistItem(item.id)} 
                        className="text-[var(--text-muted)] hover:text-[var(--semantic-error)] p-1 rounded hover:bg-[var(--nav-hover-bg)] transition-all text-sm"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleAddChecklistItem} 
                    className="p-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] rounded-lg text-[var(--text-main)] transition-colors shrink-0"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                  <input 
                    type="text" 
                    value={newItemText}
                    onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                    placeholder="افزودن آیتم چک‌لیست..." 
                    className="bg-transparent text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none flex-1 py-1 text-right"
                  />
                </div>
              </div>

              {/* Properties Section */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-1">
                {/* Date Picker row */}
                <PropertyRow icon={<CalendarIcon className="w-5 h-5" />} label="تاریخ ددلاین">
                  {hasDate ? (
                    <div className="flex items-center gap-2 w-full justify-end">
                      <PersianDatePicker 
                        value={formState.due_date} 
                        onChange={isoDate => setFormState(s => ({...s, due_date: isoDate}))} 
                      />
                      <button 
                        onClick={handleRemoveDate} 
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--semantic-error)] hover:bg-[var(--semantic-error-soft)] rounded-lg transition-colors" 
                        title="حذف تاریخ"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleAddDate} 
                      className="text-xs text-[var(--color-primary)] hover:opacity-80 flex items-center gap-1 font-bold py-1"
                    >
                      <PlusIcon className="w-3.5 h-3.5" /> افزودن تاریخ ددلاین
                    </button>
                  )}
                </PropertyRow>

                {/* Time picker row (conditionally shown if date exists) */}
                {hasDate && (
                  <PropertyRow icon={<ClockIcon className="w-5 h-5" />} label="تنظیم ساعت">
                    {hasTime ? (
                      <div className="flex items-center gap-2 w-full justify-end">
                        <TimePicker 
                          value={selectedTime}
                          onChange={setSelectedTime}
                        />
                         <button 
                          onClick={handleRemoveTime} 
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--semantic-error)] hover:bg-[var(--semantic-error-soft)] rounded-lg transition-colors" 
                          title="حذف ساعت"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={handleAddTime} 
                        className="text-xs text-[var(--color-primary)] hover:opacity-80 flex items-center gap-1 font-bold py-1"
                      >
                        <PlusIcon className="w-3.5 h-3.5" /> افزودن ساعت مشخص
                      </button>
                    )}
                  </PropertyRow>
                )}

                {/* Priority Selection */}
                <PropertyRow icon={<FlagIcon className="w-5 h-5" />} label="اولویت کار">
                  <div className="flex gap-2 w-full">
                     {Object.values(Priority).map(p => (
                      <button 
                        key={p} 
                        onClick={() => setFormState(s => ({...s, priority: p}))} 
                        className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${
                          formState.priority === p 
                            ? `${priorityConfig[p].bg} ${priorityConfig[p].text} ring-1 ring-inset ring-current` 
                            : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)]'
                        }`}
                      >
                        {priorityConfig[p].label}
                      </button>
                     ))}
                  </div>
                </PropertyRow>

                {/* Project Selection */}
                <PropertyRow icon={<BriefcaseIcon className="w-5 h-5" />} label="پروژه مرتبط">
                  <div className="relative w-full">
                    <select 
                      value={formState.project_id || ''} 
                      onChange={e => setFormState(s => ({...s, project_id: e.target.value || undefined}))} 
                      className="bg-transparent bg-[var(--bg-card)] w-full px-3 py-2 pr-8 rounded-lg outline-none focus:border-[var(--input-focus-ring)] text-xs text-[var(--text-main)] font-bold appearance-none cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-colors text-right"
                    >
                      <option value="" className="bg-[var(--bg-card)]">بدون پروژه</option>
                      {projects.map(p => <option key={p.id} value={p.id} className="bg-[var(--bg-card)]">{p.title}</option>)}
                    </select>
                    <ChevronDownIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]"/>
                  </div>
                </PropertyRow>
              </div>

              {/* TWO-WAY BIDIRECTIONAL NOTES LINKING SECTION */}
              <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-muted)]">یادداشت‌های مرتبط</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{displayedNotes.length} لینک شده</span>
                </div>

                {displayedNotes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {displayedNotes.map(n => (
                      <div key={n.id} className="flex items-center justify-between p-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] text-right">
                        <div className="flex items-center gap-2 min-w-0">
                          <NotebookIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                          <span className="text-xs text-[var(--text-main)] font-medium truncate">{n.title || 'یادداشت بدون عنوان'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(n.id)}
                          className="p-1 hover:text-[var(--semantic-error)] hover:bg-[var(--semantic-error-soft)] rounded text-[var(--text-muted)] transition-colors"
                          title="حذف پیوند"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)] block text-right">هیچ یادداشت مرتبطی وجود ندارد.</span>
                )}

                <div className="pt-2">
                  <LinkNotePicker 
                    notes={notes}
                    taskDueDate={formState.due_date}
                    onSelect={handleAddLink}
                    linkedNoteIds={displayedNotes.map(l => l.id)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions - Fixed shadow */}
        <div className="p-4 sm:p-6 pb-safe border-t border-[var(--border-subtle)] flex gap-3 shrink-0 bg-transparent">
          <button 
            onClick={handleSave} 
            className="flex-1 bg-lime hover:opacity-90 text-[var(--text-on-primary)] py-3 rounded-xl font-bold transition-all text-sm"
          >
            {isNew ? 'ساختن کار جدید' : 'ذخیره نهایی تغییرات'}
          </button>
          {!isNew && (
            <button 
              onClick={() => setMode('view')} 
              className="px-5 py-3 bg-[var(--bg-card)] backdrop-blur-xl hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] rounded-xl font-bold transition-colors text-sm border border-[var(--border-subtle)]"
            >
              انصراف
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskEditorModal;
