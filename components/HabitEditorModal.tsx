
import React, { useState, useEffect } from 'react';
import { Habit } from '../types';
import { XIcon, TrashIcon, CheckIcon, FlameIcon, RepeatIcon, PencilIcon, TargetIcon } from './icons';

interface HabitEditorModalProps {
  habit: Habit | Partial<Habit>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit | Partial<Habit>) => void;
  onDelete: (id: string) => void;
}

const HabitEditorModal: React.FC<HabitEditorModalProps> = ({ habit, isOpen, onClose, onSave, onDelete }) => {
    const [formState, setFormState] = useState<Habit | Partial<Habit>>(habit);
    const [isVisible, setIsVisible] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    
    const isNew = !('id' in habit);

    useEffect(() => {
        if (isOpen) {
            setFormState(habit);
            setMode(isNew ? 'edit' : 'view');
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, habit]);

    const handleClose = () => {
        onClose();
        setMode('view');
    };

    const handleSave = () => {
        if (formState.name?.trim()) {
            onSave(formState);
            onClose();
        }
    };

    const handleDelete = () => {
        if ('id' in formState && formState.id) {
            onDelete(formState.id);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true" onClick={handleClose}>
            <div
                onClick={e => e.stopPropagation()}
                className={`bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-2xl shadow-2xl transition-all duration-300 ease-out flex flex-col max-h-[90vh] ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                            <FlameIcon className="w-5 h-5"/>
                        </div>
                        <h2 className="text-lg font-bold text-white">
                            {isNew ? 'عادت جدید' : (mode === 'edit' ? 'ویرایش عادت' : 'جزئیات عادت')}
                        </h2>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><XIcon className="w-5 h-5"/></button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {mode === 'view' ? (
                        // --- VIEW MODE ---
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">{formState.name}</h3>
                                {formState.description && <p className="text-slate-400 text-sm">{formState.description}</p>}
                            </div>
                            
                            <div className="flex gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-sm text-slate-300">
                                    <RepeatIcon className="w-4 h-4 text-sky-400"/>
                                    <span>{formState.frequency === 'weekly' ? 'هفتگی' : 'روزانه'}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-sm text-slate-300">
                                    <TargetIcon className="w-4 h-4 text-green-400"/>
                                    <span>{formState.target_count || 1} بار در روز</span>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setMode('edit')} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                                    <PencilIcon className="w-4 h-4"/>
                                    <span>ویرایش</span>
                                </button>
                                <button onClick={handleDelete} className="px-4 py-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-xl font-semibold transition-colors border border-slate-700 hover:border-red-500/30">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    ) : (
                        // --- EDIT MODE ---
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">عنوان عادت</label>
                                <input
                                    value={formState.name || ''}
                                    onChange={e => setFormState(s => ({ ...s, name: e.target.value }))}
                                    placeholder="مثلاً: ورزش صبحگاهی"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">تکرار</label>
                                    <select 
                                        value={formState.frequency || 'daily'}
                                        onChange={e => setFormState(s => ({ ...s, frequency: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                                    >
                                        <option value="daily">روزانه</option>
                                        <option value="weekly">هفتگی</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5">تعداد در روز</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formState.target_count || 1}
                                        onChange={e => setFormState(s => ({ ...s, target_count: parseInt(e.target.value) || 1 }))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">توضیحات (اختیاری)</label>
                                <textarea
                                    value={formState.description || ''}
                                    onChange={e => setFormState(s => ({ ...s, description: e.target.value }))}
                                    placeholder="هدف یا انگیزه..."
                                    rows={3}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button onClick={handleSave} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-orange-900/20">
                                    ذخیره تغییرات
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

export default HabitEditorModal;
