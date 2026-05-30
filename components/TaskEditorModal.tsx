
import React, { useState, useEffect } from 'react';
import { Task, Priority, Project, Note, ChecklistItem } from '../types';
import { XIcon, TrashIcon, CheckIcon, CalendarIcon, FlagIcon, BriefcaseIcon, ClockIcon, PlusIcon, ListChecksIcon, ChevronDownIcon, PencilIcon } from './icons';
import PersianDatePicker from './PersianDatePicker';
import TimePicker from './TimePicker';
import { formatPersianDate } from '../utils/dateUtils';

interface TaskEditorModalProps {
  task: Task | Partial<Task>;
  isOpen: boolean;
  projects: Project[];
  notes: Note[];
  onClose: () => void;
  onSave: (task: Task | Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const priorityConfig = {
  [Priority.High]: { label: 'زیاد', color: 'red', text: 'text-red-300', bg: 'bg-red-500/20', badge: 'bg-red-500/10 text-red-300 border-red-500/30' },
  [Priority.Medium]: { label: 'متوسط', color: 'yellow', text: 'text-yellow-300', bg: 'bg-yellow-500/20', badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' },
  [Priority.Low]: { label: 'کم', color: 'sky', text: 'text-sky-300', bg: 'bg-sky-500/20', badge: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
};

const TaskEditorModal: React.FC<TaskEditorModalProps> = ({ task, isOpen, projects, notes, onClose, onSave, onDelete }) => {
    const [formState, setFormState] = useState<Task | Partial<Task>>(task);
    const [isVisible, setIsVisible] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    
    // Explicit states for managing UI logic independently of the consolidated ISO string
    const [hasDate, setHasDate] = useState(false);
    const [hasTime, setHasTime] = useState(false);
    const [selectedTime, setSelectedTime] = useState<string>('12:00');
    
    const [newItemText, setNewItemText] = useState('');
    
    const isNew = !('id' in task);

    useEffect(() => {
        if (isOpen) {
            setFormState(task);
            setMode(isNew ? 'edit' : 'view');
            setIsVisible(true);
            setNewItemText('');
            
            // Analyze existing due_date
            if (task.due_date) {
                setHasDate(true);
                const date = new Date(task.due_date);
                
                // Heuristic: If time is exactly 00:00:00 or 12:00:00 (default fallback), 
                // we might treat it as "no time set" for display, 
                // OR we can rely on a separate flag if we had one. 
                // For now, if it exists, we assume user might want to see it, 
                // but let's defaulting 'hasTime' to false if it was just a date-pick.
                // However, to be safe and explicit:
                // We'll calculate the time string.
                const h = date.getHours();
                const m = date.getMinutes();
                
                // Set the picker to this time
                setSelectedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                
                // If it's a new task, we start with no time. If editing, we assume time exists if it's not the default noon/midnight.
                // BUT simplifying: let's enable time if it's editing an existing task with date.
                // Or better: Let user explicitly remove time. For now, enable it if date exists.
                // Refined Logic: Check if the user *explicitly* set a time previously. 
                // Since we don't have a 'hasTime' DB column, we'll default to hasTime=true if editing, false if new.
                setHasTime(!isNew); 
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

    const handleSave = () => {
        if (!formState.title?.trim()) return;

        let finalDueDate: string | null = null;

        if (hasDate && formState.due_date) {
            // formState.due_date comes from PersianDatePicker as an ISO string (usually set to noon or midnight depending on util)
            const dateObj = new Date(formState.due_date);
            
            if (hasTime) {
                const [h, m] = selectedTime.split(':').map(Number);
                dateObj.setHours(h, m, 0, 0);
            } else {
                // If no time selected, set to 12:00:00 to avoid timezone date shifts when converting to UTC/Display
                // This is a safe "middle of the day" approach for date-only fields stored as timestamp
                dateObj.setHours(12, 0, 0, 0); 
            }
            finalDueDate = dateObj.toISOString();
        }

        onSave({ ...formState, due_date: finalDueDate });
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
        // Default to today
        setFormState(prev => ({...prev, due_date: new Date().toISOString()}));
    };

    const handleRemoveDate = () => {
        setHasDate(false);
        setHasTime(false);
        setFormState(prev => ({...prev, due_date: null}));
    };

    const handleAddTime = () => {
        setHasTime(true);
        // Default time is already in selectedTime state
    };

    const handleRemoveTime = () => {
        setHasTime(false);
    };

    const PropertyRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }> = ({ icon, label, children, className }) => (
        <div className={`flex items-center p-2 rounded-lg transition-colors min-h-[44px] ${className}`}>
            <div className="flex items-center gap-3 w-28 flex-shrink-0 text-sm text-slate-400">
                {icon}
                <span>{label}</span>
            </div>
            <div className="flex-1 text-sm text-slate-200 font-medium">
                {children}
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex justify-center items-center p-2 sm:p-4" role="dialog" aria-modal="true" onClick={handleClose}>
            <div
                onClick={e => e.stopPropagation()}
                className={`bg-slate-900 border border-slate-700/80 w-full max-w-xl rounded-2xl shadow-2xl transition-all duration-300 ease-out flex flex-col max-h-[85vh] ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
                {/* Header - Fixed */}
                <div className="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {mode === 'view' ? (
                             <div className={`px-3 py-1 rounded-full text-xs font-bold border ${priorityConfig[formState.priority || Priority.Medium].badge}`}>
                                {priorityConfig[formState.priority || Priority.Medium].label}
                             </div>
                        ) : (
                            <h2 className="text-lg font-bold text-white">{isNew ? 'کار جدید' : 'ویرایش کار'}</h2>
                        )}
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><XIcon className="w-5 h-5"/></button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto pb-32">
                    {mode === 'view' ? (
                        // --- VIEW MODE ---
                        <div className="p-6 space-y-6">
                            <div className="flex items-start gap-4">
                                <button
                                    onClick={toggleStatus}
                                    className={`mt-1 w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300 ${formState.status === 'done' ? 'bg-sky-500 border-sky-400' : 'border-slate-600 hover:border-sky-500'}`}
                                >
                                    {formState.status === 'done' && <CheckIcon className="w-4 h-4 text-white"/>}
                                </button>
                                <div className="flex-1">
                                    <h3 className={`text-2xl font-bold leading-tight ${formState.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>
                                        {formState.title}
                                    </h3>
                                    {formState.description && (
                                        <p className="mt-4 text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                                            {formState.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Checklist View */}
                            {(formState.checklist && formState.checklist.length > 0) && (
                                <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <ListChecksIcon className="w-4 h-4" />
                                            <span className="text-sm font-semibold">چک‌لیست</span>
                                        </div>
                                        <span className="text-xs text-slate-500">{calculateProgress()}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700/50 h-1.5 rounded-full mb-4 overflow-hidden">
                                        <div 
                                            className="bg-green-500 h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${calculateProgress()}%` }}
                                        ></div>
                                    </div>
                                    <div className="space-y-2">
                                        {formState.checklist.map(item => (
                                            <div key={item.id} className="flex items-start gap-3 group">
                                                <button 
                                                    onClick={() => handleToggleChecklistItem(item.id)}
                                                    className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${item.isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-600 hover:border-green-400'}`}
                                                >
                                                    {item.isCompleted && <CheckIcon className="w-3 h-3 text-white"/>}
                                                </button>
                                                <span className={`text-sm flex-1 transition-colors ${item.isCompleted ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                                    {item.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {formState.project_id && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                                            <BriefcaseIcon className="w-5 h-5"/>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">پروژه</p>
                                            <p className="text-sm font-semibold text-slate-200">
                                                {projects.find(p => p.id === formState.project_id)?.title || 'نامشخص'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                {formState.due_date && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                            <CalendarIcon className="w-5 h-5"/>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">زمان انجام</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-200">{formatPersianDate(formState.due_date)}</span>
                                                {hasTime && (
                                                    <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                                                        {selectedTime}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button onClick={() => setMode('edit')} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20">
                                    <PencilIcon className="w-5 h-5"/>
                                    <span>ویرایش</span>
                                </button>
                                <button onClick={handleDelete} className="px-5 py-3 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-xl font-semibold transition-colors border border-slate-700 hover:border-red-500/30">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    ) : (
                        // --- EDIT MODE ---
                        <div className="flex flex-col h-full">
                            <div className="p-4 sm:p-6 space-y-4">
                                <input
                                    value={formState.title || ''}
                                    onChange={e => setFormState(s => ({ ...s, title: e.target.value }))}
                                    placeholder="عنوان کار را بنویسید..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-lg font-semibold transition-all"
                                    autoFocus
                                />
                                <textarea
                                    value={formState.description || ''}
                                    onChange={e => setFormState(s => ({ ...s, description: e.target.value }))}
                                    placeholder="توضیحات تکمیلی (اختیاری)..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px] resize-none transition-all"
                                    rows={3}
                                />
                                
                                {/* Checklist Edit */}
                                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">
                                        <ListChecksIcon className="w-4 h-4" />
                                        <span>زیرتسک‌ها</span>
                                    </div>
                                    <div className="space-y-2 mb-3">
                                        {formState.checklist && formState.checklist.map(item => (
                                            <div key={item.id} className="flex items-center gap-2 group">
                                                <div className={`w-1.5 h-1.5 rounded-full ${item.isCompleted ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                                                <span className={`text-sm flex-1 ${item.isCompleted ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{item.text}</span>
                                                <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleAddChecklistItem} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors">
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                        <input 
                                            type="text" 
                                            value={newItemText}
                                            onChange={e => setNewItemText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                                            placeholder="افزودن آیتم..." 
                                            className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none flex-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 border-t border-slate-800/60 bg-slate-950/30 space-y-3 flex-1">
                                {/* Date Selection */}
                                <PropertyRow icon={<CalendarIcon className="w-5 h-5" />} label="تاریخ">
                                    {hasDate ? (
                                        <div className="flex items-center gap-2 w-full">
                                            <PersianDatePicker 
                                                value={formState.due_date} 
                                                onChange={isoDate => setFormState(s => ({...s, due_date: isoDate}))} 
                                            />
                                            <button onClick={handleRemoveDate} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="حذف تاریخ">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={handleAddDate} className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold">
                                            <PlusIcon className="w-4 h-4" /> افزودن تاریخ
                                        </button>
                                    )}
                                </PropertyRow>

                                {/* Time Selection - Only visible if Date is selected */}
                                {hasDate && (
                                    <PropertyRow icon={<ClockIcon className="w-5 h-5" />} label="ساعت">
                                        {hasTime ? (
                                            <div className="flex items-center gap-2 w-full">
                                                <TimePicker 
                                                    value={selectedTime}
                                                    onChange={setSelectedTime}
                                                />
                                                 <button onClick={handleRemoveTime} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="حذف ساعت">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={handleAddTime} className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold">
                                                <PlusIcon className="w-4 h-4" /> افزودن ساعت
                                            </button>
                                        )}
                                    </PropertyRow>
                                )}

                                <PropertyRow icon={<FlagIcon className="w-5 h-5" />} label="اولویت">
                                    <div className="flex gap-2 w-full">
                                         {Object.values(Priority).map(p => (
                                            <button key={p} onClick={() => setFormState(s => ({...s, priority: p}))} className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all ${formState.priority === p ? `${priorityConfig[p].bg} ${priorityConfig[p].text} ring-1 ring-inset ring-current` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{priorityConfig[p].label}</button>
                                        ))}
                                    </div>
                                </PropertyRow>
                                <PropertyRow icon={<BriefcaseIcon className="w-5 h-5" />} label="پروژه">
                                    <div className="relative w-full">
                                        <select value={formState.project_id || ''} onChange={e => setFormState(s => ({...s, project_id: e.target.value || undefined}))} className="bg-slate-800/60 w-full px-3 py-2 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm text-white font-medium appearance-none cursor-pointer border border-slate-700 hover:border-slate-600 transition-colors">
                                            <option value="" className="bg-slate-900">بدون پروژه</option>
                                            {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.title}</option>)}
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/>
                                    </div>
                                </PropertyRow>
                            </div>

                            <div className="p-4 sm:p-6 border-t border-slate-800/60 flex gap-3 flex-shrink-0">
                                <button onClick={handleSave} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-sky-900/20">
                                    {isNew ? 'ساختن کار' : 'ذخیره تغییرات'}
                                </button>
                                {!isNew && (
                                    <button onClick={() => setMode('view')} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors">
                                        انصراف
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskEditorModal;
