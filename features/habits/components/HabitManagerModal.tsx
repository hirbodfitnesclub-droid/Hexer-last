import React, { useState, useEffect } from 'react';
import { Habit } from '../../../types';
import { XIcon, TrashIcon, FlameIcon } from '../../../components/icons';
import { HabitForm } from './HabitForm';
import { HabitStatsView } from './HabitStatsView';

interface HabitManagerModalProps {
  habit: Habit | Partial<Habit>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit | Partial<Habit>) => void;
  onDelete: (id: string) => void;
}

export const HabitManagerModal: React.FC<HabitManagerModalProps> = ({ 
  habit, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete 
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'manage'>('stats');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isNew = !('id' in habit);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(isNew ? 'manage' : 'stats');
      setShowDeleteConfirm(false);
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, habit, isNew]);

  if (!isOpen) return null;

  const handleDeleteConfirm = () => {
    if ('id' in habit && habit.id) {
      onDelete(habit.id);
    }
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4" 
      role="dialog" 
      aria-modal="true" 
      onClick={onClose}
      id="habit-manager-modal-overlay"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] backdrop-blur-xl w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl transition-all duration-300 ease-out flex flex-col h-[100dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden relative ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
        id="habit-manager-modal-sheet"
      >
        {/* Deletion Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-[70] flex flex-col items-center justify-center p-6 text-center" dir="rtl" id="delete-confirmation-screen">
            <div className="p-4 bg-error/10 text-error rounded-full mb-4">
              <TrashIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-[var(--text-main)] font-sans">حذف این عادت؟</h3>
            <p className="text-[var(--text-muted)] text-xs mt-2 max-w-[280px] leading-relaxed">
              آیا مطمئن هستید که می‌خواهید عادت «{habit.name}» را برای همیشه حذف کنید؟ تمامی رکوردهای انجام آن نیز حذف خواهند شد.
            </p>
            <div className="flex gap-3 mt-6 w-full max-w-[280px]">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-error hover:opacity-90 text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                بله، حذف شود
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] border border-[var(--border-subtle)] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        )}

        {/* Header - Fixed */}
        <div className="p-5 pt-safe border-b border-[var(--border-subtle)] flex justify-between items-center shrink-0" dir="rtl" id="modal-header">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary-text shrink-0">
              <FlameIcon className="w-5 h-5"/>
            </div>
            <h2 className="text-sm font-extrabold text-[var(--text-main)] font-sans">
              {isNew ? 'عادت جدید' : habit.name}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)] rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            <XIcon className="w-5 h-5"/>
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 scroll-fade-edge" id="modal-scroll-area">
          {/* Tabs switch bar - only displayed for existing habits */}
          {!isNew && (
            <div className="flex bg-[var(--bg-card)]/50 p-1 rounded-xl border border-[var(--border-subtle)] mb-5 shrink-0" dir="rtl" id="tab-selectors">
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'stats' 
                    ? 'bg-primary text-on-primary' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                گزارش و آمار
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'manage' 
                    ? 'bg-primary text-on-primary' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                ویرایش عادت
              </button>
            </div>
          )}

          {/* Tab content rendering */}
          {isNew ? (
            <HabitForm 
              habit={habit} 
              onSave={onSave} 
              onCancel={onClose} 
              isNew={true} 
            />
          ) : activeTab === 'stats' ? (
            <HabitStatsView completedDates={habit.completedDates || []} />
          ) : (
            <div className="space-y-6">
              <HabitForm 
                habit={habit} 
                onSave={onSave} 
                onCancel={onClose} 
                isNew={false} 
              />
              
              {/* Danger Zone Deletion Section */}
              <div className="border-t border-[var(--border-subtle)] pt-5 text-right" dir="rtl">
                <h4 className="text-xs font-bold text-error mb-1">منطقه حساس</h4>
                <p className="text-[10px] text-[var(--text-muted)] mb-3">حذف عادت غیر قابل بازگشت است و تمام رکوردهای آن را حذف می‌کند.</p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 bg-error/10 hover:bg-error/20 text-error border border-error/20 hover:border-error/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>حذف کامل این عادت</span>
                </button>
              </div>
            </div>
          )}
          
          <div className="safe-spacer-bottom" />
        </div>
      </div>
    </div>
  );
};
