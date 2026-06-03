import React, { useState, useEffect } from 'react';
import { Habit } from '../../types';
import { XIcon, TrashIcon, FlameIcon, RepeatIcon, PencilIcon, TargetIcon } from '../../../components/icons';

interface HabitEditorModalProps {
  habit: Habit | Partial<Habit>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit | Partial<Habit>) => void;
  onDelete: (id: string) => void;
}

export const HabitEditorModal: React.FC<HabitEditorModalProps> = ({ habit, isOpen, onClose, onSave, onDelete }) => {
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
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4" 
      role="dialog" 
      aria-modal="true" 
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-slate-900 border-t sm:border border-slate-700/80 w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl transition-all duration-300 ease-out flex flex-col h-[100dvh] sm:h-auto overflow-hidden ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
      >
        {/* Header - Fixed */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center shrink-0" dir="rtl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500 shrink-0">
              <FlameIcon className="w-5 h-5"/>
            </div>
            <h2 className="text-base font-extrabold text-white font-sans">
              {isNew ? 'عادت جدید' : (mode === 'edit' ? 'ویرایش عادت' : 'جزئیات عادت')}
            </h2>
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors shrink-0"
          >
            <XIcon className="w-5 h-5"/>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6 text-right" dir="rtl">
          {mode === 'view' ? (
            // --- VIEW MODE ---
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-white font-sans">{formState.name}</h3>
                {formState.description && (
                  <p className="text-zinc-400 text-xs mt-3 leading-relaxed font-semibold bg-zinc-950/20 border border-white/5 p-4 rounded-xl">
                    {formState.description}
                  </p>
                )}
              </div>
              
              <div className="flex gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-xl text-xs text-zinc-300 font-bold">
                  <RepeatIcon className="w-4 h-4 text-sky-400"/>
                  <span>تکرار: {formState.frequency === 'weekly' ? 'هفتگی' : 'روزانه'}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-xl text-xs text-zinc-300 font-bold">
                  <TargetIcon className="w-4 h-4 text-green-400"/>
                  <span>هدف: {formState.target_count || 1} بار در روز</span>
                </div>
              </div>

              <div className="pt-6 flex gap-3 shrink-0">
                <button 
                  onClick={() => setMode('edit')} 
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-950/15"
                >
                  <PencilIcon className="w-4 h-4"/>
                  <span>ویرایش عادت</span>
                </button>
                <button 
                  onClick={handleDelete} 
                  className="px-5 py-3 bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 rounded-xl font-semibold transition-colors border border-zinc-800 hover:border-red-500/15"
                >
                  <TrashIcon className="w-5 h-5"/>
                </button>
              </div>
            </div>
          ) : (
            // --- EDIT MODE WITH DVH FORM HANDLING ---
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-2">عنوان عادت روزمره</label>
                <input
                  value={formState.name || ''}
                  onChange={e => setFormState(s => ({ ...s, name: e.target.value }))}
                  placeholder="مثلاً: ورزش صبحگاهی یا نوشتن روزانه..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold transition-all text-right"
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-2">تعداد در روز</label>
                  <input
                    type="number"
                    min="1"
                    value={formState.target_count || 1}
                    onChange={e => setFormState(s => ({ ...s, target_count: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500 text-right font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-2">تکرار دوره‌ای</label>
                  <div className="relative">
                    <select 
                      value={formState.frequency || 'daily'}
                      onChange={e => setFormState(s => ({ ...s, frequency: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none text-right cursor-pointer"
                    >
                      <option value="daily" className="bg-slate-900">روزانه</option>
                      <option value="weekly" className="bg-slate-900">هفتگی</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-2">توضیحات و ایجاد انگیزه (اختیاری)</label>
                <textarea
                  value={formState.description || ''}
                  onChange={e => setFormState(s => ({ ...s, description: e.target.value }))}
                  placeholder="انگیزه یا هدف خود از انجام مرتب این کار را بنویسید..."
                  rows={4}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all resize-none min-h-[100px] leading-relaxed"
                />
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button 
                  onClick={handleSave} 
                  className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-950/15 text-sm"
                >
                  ذخیره تغییرات نهایی
                </button>
                {!isNew && (
                  <button 
                    onClick={() => setMode('view')} 
                    className="px-5 py-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl font-bold transition-colors text-sm border border-zinc-800"
                  >
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
