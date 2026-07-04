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
        <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-2">عنوان عادت روزمره</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="مثلاً: ورزش صبحگاهی یا نوشتن روزانه..."
          className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary font-semibold transition-all text-right"
          required
          autoFocus
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-2">تعداد در روز</label>
          <input
            type="number"
            min="1"
            value={targetCount}
            onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary text-right font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-2">تکرار دوره‌ای</label>
          <div className="relative">
            <select 
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary appearance-none text-right cursor-pointer"
            >
              <option value="daily" className="bg-[var(--bg-card)] text-[var(--text-main)]">روزانه</option>
              <option value="weekly" className="bg-[var(--bg-card)] text-[var(--text-main)]">هفتگی</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-2">توضیحات و ایجاد انگیزه (اختیاری)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="انگیزه یا هدف خود از انجام مرتب این کار را بنویسید..."
          rows={4}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all resize-none min-h-[100px] leading-relaxed"
        />
      </div>

      <div className="pt-4 flex gap-3 shrink-0">
        <button 
          type="submit"
          className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-[var(--text-on-primary)] py-3 rounded-xl font-bold transition-all text-sm cursor-pointer"
          disabled={!name.trim()}
        >
          {isNew ? 'ایجاد عادت جدید' : 'ذخیره تغییرات نهایی'}
        </button>
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel} 
            className="px-5 py-3 bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] rounded-xl font-bold transition-colors text-sm border border-[var(--border-subtle)] cursor-pointer"
          >
            انصراف
          </button>
        )}
      </div>
    </form>
  );
};
