import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { XIcon, SparklesIcon, CalendarIcon, WarningIcon } from '../../../components/icons';

export const RenewReminderModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const checkExpiryStatus = async () => {
      try {
        // Anti-Annoyance check (Do not disturb if dismissed today)
        const todayStr = new Date().toISOString().split('T')[0];
        const lastDismissedDate = localStorage.getItem('renew_reminder_dismissed_date');
        if (lastDismissedDate === todayStr) {
          return;
        }

        const { data: usageData, error } = await supabase.rpc('get_usage_status');
        if (!error && usageData && usageData.expires_at) {
          const expTime = new Date(usageData.expires_at).getTime();
          const nowTime = new Date().getTime();
          const diffMs = expTime - nowTime;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          // Trigger if <= 5 days are left (including expired / <= 0)
          if (diffDays <= 5) {
            setDaysRemaining(diffDays);
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error('Failed to parse subscription renew reminder:', err);
      }
    };

    checkExpiryStatus();
  }, []);

  const handleDismiss = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('renew_reminder_dismissed_date', todayStr);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex justify-center items-center p-4 font-sans animate-fade-in"
      role="alertdialog"
      aria-modal="true"
    >
      <div 
        className="bg-[var(--bg-card)] border border-error/20 max-w-md w-full rounded-2xl p-6 shadow-2xl relative space-y-5 text-right dir-rtl"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={handleDismiss} 
          className="absolute top-4 left-4 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg transition-colors"
          aria-label="بستن"
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* Alarm Graphic icon */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-xl bg-error/10 border border-error/25 flex items-center justify-center text-error shrink-0">
            <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--text-main)]">
              {isExpired ? 'اشتراک هوش مصنوعی شما منقضی شده است!' : 'هشدار نزدیک بودن تاریخ تمدید اشتراک'}
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-bold">برای ممانعت از قطع شدن دسترسی هوشمند</span>
          </div>
        </div>

        {/* Message body */}
        <p className="text-xs text-[var(--text-muted)] leading-relaxed font-semibold">
          {isExpired ? (
            'اعتبار اشتراک هکسر شما تموم شده و دسترسی شما به پروژه‌ها، برنامه‌ریزی و بخش‌های مختلف محدود شده؛ لطفاً نسبت به تمدیدش اقدام کنی.'
          ) : (
            `تنها ${daysRemaining} روز تا پایان اعتبار طرح فعلی فضا و خدمات هوش مصنوعی هکسر شما باقی‌مانده است. با تمدید به موقع، از ادامه‌ی خدمات لذت ببرید.`
          )}
        </p>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button 
            onClick={() => {
              handleDismiss();
              // Navigate to billing/subscription tab inside view manager
              // or trigger the page update
              // Since we operate under view modes we can use standard navigation
              window.dispatchEvent(new CustomEvent('navigate_to_subscription'));
            }}
            className="flex-1 bg-error hover:bg-error/90 text-[var(--text-on-primary)] font-bold py-2.5 rounded-xl text-xs transition-colors text-center"
          >
            تمدید اشتراک 🚀
          </button>
          
          <button 
            onClick={handleDismiss}
            className="px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-muted)] rounded-xl font-bold text-xs transition-colors"
          >
            بعداً یادآوری کن
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenewReminderModal;
