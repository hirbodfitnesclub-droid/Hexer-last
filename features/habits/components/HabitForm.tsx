import React, { useState } from 'react';
import { Habit } from '../../../types';

interface HabitFormProps {
  habit: Habit | Partial<Habit>;
  onSave: (savedHabit: Habit | Partial<Habit>) => void;
  onCancel?: () => void;
  isNew: boolean;
}

export const HabitForm: React.FC<HabitFormProps> = ({ habit, onSave, onCancel, isNew }) => {
  const [name, setName] = useState(habit.name || '');
  const [targetCount, setTargetCount] = useState(habit.target_count || 1);
  const [frequency, setFrequency] = useState(habit.frequency || 'daily');
  const [description, setDescription] = useState(habit.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...habit,
      name: name.trim(),
      target_count: targetCount,
      frequency,
      description: description.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-right font-sans" dir="rtl" id="habit-form">
      <div>
        <label className="block text-[11px] font-bold text-zinc-400 mb-2">عنوان عادت روزمره</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="مثلاً: ورزش صبحگاهی یا نوشتن روزانه..."
          className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold transition-all text-right"
          required
          autoFocus
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-zinc-400 mb-2">تعداد در روز</label>
          <input
            type="number"
            min="1"
            value={targetCount}
            onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-zinc-955 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500 text-right font-mono"
            style={{ backgroundColor: '#09090b' }} // override custom config if needed, using tailwind classes is better though
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-zinc-400 mb-2">تکرار دوره‌ای</label>
          <div className="relative">
            <select 
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none text-right cursor-pointer"
            >
              <option value="daily" className="bg-zinc-950 text-white">روزانه</option>
              <option value="weekly" className="bg-zinc-950 text-white">هفتگی</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-zinc-400 mb-2">توضیحات و ایجاد انگیزه (اختیاری)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="انگیزه یا هدف خود از انجام مرتب این کار را بنویسید..."
          rows={4}
          className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all resize-none min-h-[100px] leading-relaxed"
        />
      </div>

      <div className="pt-4 flex gap-3 shrink-0">
        <button 
          type="submit"
          className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 hover:opacity-95 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-950/15 text-sm cursor-pointer"
          disabled={!name.trim()}
        >
          {isNew ? 'ایجاد عادت جدید' : 'ذخیره تغییرات نهایی'}
        </button>
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel} 
            className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-bold transition-colors text-sm border border-white/5 cursor-pointer"
          >
            انصراف
          </button>
        )}
      </div>
    </form>
  );
};
