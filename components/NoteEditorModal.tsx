
import React, { useState, useEffect } from 'react';
import { Note, Project, Task } from '../types';
import { XIcon, TrashIcon, BriefcaseIcon, ChevronDownIcon, HashIcon, NotebookIcon, LightbulbIcon, ClockIcon, FileTextIcon, PlusIcon, CheckIcon } from './icons';

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

const NoteEditorModal: React.FC<NoteEditorModalProps> = ({ note, isOpen, onClose, onSave, onDelete, projects }) => {
    const [formState, setFormState] = useState<Note | Partial<Note>>(note);
    const [isVisible, setIsVisible] = useState(false);
    const [tagInput, setTagInput] = useState('');
    
    const isNew = !('id' in note);

    // Predefined quick tags
    const presetTags = [
        { label: 'ایده', icon: <LightbulbIcon className="w-3.5 h-3.5" />, color: 'yellow' },
        { label: 'برای بعد', icon: <ClockIcon className="w-3.5 h-3.5" />, color: 'sky' },
        { label: 'مقاله', icon: <FileTextIcon className="w-3.5 h-3.5" />, color: 'purple' },
    ];

    useEffect(() => {
        if (isOpen) {
            setFormState(note);
            setIsVisible(true);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[60] flex justify-center items-center" role="dialog" aria-modal="true" onClick={handleClose}>
            <div
                onClick={e => e.stopPropagation()}
                className={`w-full h-full md:h-auto md:max-h-[95vh] md:max-w-3xl md:rounded-[2rem] bg-zinc-950 border-0 md:border border-white/5 shadow-2xl flex flex-col transition-all duration-300 ease-out overflow-hidden relative ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
                {/* 1. Header: Minimalist Actions */}
                <div className="flex-shrink-0 flex justify-between items-center px-6 py-5 bg-zinc-950/80 backdrop-blur-md z-10">
                    <button 
                        onClick={handleClose} 
                        className="group flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                            <ChevronDownIcon className="w-5 h-5 rotate-90" />
                        </div>
                        <span className="text-sm font-medium hidden sm:block">بازگشت</span>
                    </button>
                    
                    <div className="flex items-center gap-3">
                         {!isNew && (
                            <button 
                                onClick={handleDelete}
                                className="p-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
                                title="حذف یادداشت"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={handleSave} 
                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold text-sm shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)] transition-all hover:scale-105"
                        >
                            {isNew ? 'ثبت یادداشت' : 'ذخیره تغییرات'}
                        </button>
                    </div>
                </div>

                {/* 2. Main Canvas: Creative Writing Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
                        <input
                            value={formState.title || ''}
                            onChange={e => setFormState(s => ({ ...s, title: e.target.value }))}
                            placeholder="عنوان ایده..."
                            className="w-full bg-transparent border-none p-0 text-3xl sm:text-4xl font-black text-white placeholder-zinc-700 focus:ring-0 focus:outline-none leading-tight"
                            autoFocus
                        />
                        <textarea
                            value={formState.content || ''}
                            onChange={e => setFormState(s => ({ ...s, content: e.target.value }))}
                            placeholder="شروع به نوشتن کنید..."
                            className="w-full h-[50vh] bg-transparent border-none p-0 text-lg text-zinc-300 placeholder-zinc-700 focus:ring-0 focus:outline-none resize-none leading-relaxed font-light"
                        />
                    </div>
                </div>

                {/* 3. Metadata Footer: The Control Center */}
                <div className="flex-shrink-0 bg-zinc-900/50 backdrop-blur-2xl border-t border-white/5 p-4 sm:p-6">
                    <div className="max-w-2xl mx-auto space-y-5">
                        
                        {/* Tags Section: Redesigned */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">
                                <HashIcon className="w-3 h-3" />
                                <span>تگ‌ها و دسته‌بندی</span>
                            </div>

                            {/* Active Tags & Input */}
                            <div className="flex flex-wrap items-center gap-2 bg-zinc-950/50 p-2 rounded-xl border border-white/5 focus-within:border-purple-500/30 focus-within:bg-zinc-900 transition-all">
                                {formState.tags?.map(tag => (
                                    <span key={tag} className="animate-fade-in inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-medium group">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="hover:text-white transition-colors">
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input 
                                    type="text" 
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    placeholder={formState.tags?.length ? "..." : "افزودن تگ (اینتر بزنید)"}
                                    className="flex-1 bg-transparent min-w-[120px] px-2 py-1 text-sm text-white placeholder-zinc-600 focus:outline-none"
                                />
                            </div>

                            {/* Preset Quick Tags */}
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                {presetTags.map(preset => {
                                    const isActive = (formState.tags || []).includes(preset.label);
                                    return (
                                        <button
                                            key={preset.label}
                                            onClick={() => togglePresetTag(preset.label)}
                                            className={`
                                                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap
                                                ${isActive 
                                                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100 shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                                                    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'}
                                            `}
                                        >
                                            {preset.icon}
                                            {preset.label}
                                            {isActive && <CheckIcon className="w-3 h-3 ml-1 text-purple-600" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Project Selector (Simplified) */}
                        <div className="flex items-center gap-4 pt-2 border-t border-white/5 mt-4">
                             <div className="relative group w-full sm:w-64">
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                                    <BriefcaseIcon className="w-4 h-4" />
                                </div>
                                <select 
                                    value={formState.project_id || ''} 
                                    onChange={e => setFormState(s => ({...s, project_id: e.target.value || undefined}))} 
                                    className="w-full bg-zinc-900 text-zinc-300 text-sm rounded-xl py-2.5 pr-10 pl-4 border border-zinc-800 focus:border-purple-500/50 focus:bg-zinc-900/80 focus:ring-0 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                                >
                                    <option value="" className="bg-zinc-900 text-zinc-500">انتخاب پروژه (اختیاری)</option>
                                    {projects.map(p => <option key={p.id} value={p.id} className="bg-zinc-900">{p.title}</option>)}
                                </select>
                                <ChevronDownIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-300 transition-colors"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NoteEditorModal;
