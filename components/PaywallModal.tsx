import React, { useState } from 'react';
import { XIcon, CheckIcon, SparklesIcon } from './icons';
import { startCheckout } from '../services/billingService';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanCode?: string | null;
  message?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose, currentPlanCode = 'free', message }) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPlan = async (planCode: string) => {
    if (planCode === 'free') {
      return; // Free is already default signup plan, no checkout needed
    }
    setLoadingPlan(planCode);
    setError(null);
    try {
      await startCheckout(planCode);
    } catch (err: any) {
      console.error('Checkout failed:', err);
      setError(err?.message || 'خطا در ثبت درخواست پرداخت. لطفا دوباره تلاش کنید.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      code: 'free',
      name: 'طرح رایگان (Free)',
      price: 'رایگان',
      period: '۳ روزه',
      quota: '۳۰ درخواست اولیه',
      model: 'Hexer Ai',
      features: [
        'دسترسی رایگان ۳ روزه تستی',
        '۳۰ درخواست اولیه',
        'موتور هوش مصنوعی Gemini 3.1',
        'بدون محدودیت روزانه درخواست'
      ],
      popular: false,
      color: 'border-[var(--border-subtle)] bg-[var(--bg-card)]/50 text-[var(--text-muted)]',
      tag: 'تست رایگان',
      tagColor: 'bg-[var(--nav-hover-bg)] text-[var(--text-muted)]'
    },
    {
      code: 'starter',
      name: 'طرح استارتر (Starter)',
      price: '۹۹,۰۰۰',
      period: '۳۰ روزه',
      quota: '۳۰۰ درخواست هوشمند',
      model: 'Hexer Ai',
      features: [
        'دسترسی ۳۰ روزه پایدار تمدیدپذیر',
        '۳۰۰ درخواست هوشمند ماهانه',
        'بدون محدودیت روزانه درخواست',
        'تعریف نامحدود یادداشت‌ها و کارها'
      ],
      popular: false,
      color: 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-primary/40',
      tag: 'اقتصادی',
      tagColor: 'bg-[var(--nav-hover-bg)] text-[var(--text-main)]'
    },
    {
      code: 'plus',
      name: 'طرح پلاس (Plus) ✨',
      price: '۱۹۹,۰۰۰',
      period: '۳۰ روزه',
      quota: '۷۰۰ درخواست هوشمند',
      model: 'Hexer Ai',
      features: [
        'دسترسی ۳۰ روزه پایدار تمدیدپذیر',
        '۷۰۰ درخواست هوشمند ماهانه',
        'بدون محدودیت روزانه درخواست',
        'بارگذاری مستقیم تصاویر و صوت'
      ],
      popular: true,
      color: 'border-primary/40 bg-[var(--bg-card)] text-[var(--text-main)] ring-1 ring-primary/20 shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.15)]',
      tag: 'پیشنهاد هکسر ⚡',
      tagColor: 'bg-primary text-[var(--text-on-primary)] font-black'
    },
    {
      code: 'pro',
      name: 'طرح پرو (Pro) 🏆',
      price: '۳۶۹,۰۰۰',
      period: '۳۰ روزه',
      quota: '۱,۳۰۰ درخواست هوشمند',
      model: 'Hexer Ai',
      features: [
        'دسترسی ۳۰ روزه ممتاز و نامحدود',
        '۱,۳۰۰ درخواست هوشمند ماهانه',
        'بدون محدودیت روزانه درخواست',
        'پشتیبانی VIP و پردازش کارهای سنگین'
      ],
      popular: false,
      color: 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-primary/40',
      tag: 'کاربر پرو (Pro) 👑',
      tagColor: 'bg-primary/20 text-primary-text font-black'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 font-sans">
      
      {/* Absolute floating luxury ambient backdrops */}
      <div className="absolute top-[-10%] right-[-10%] w-[100vw] h-[100vw] rounded-full bg-primary/5 blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[-20%] w-[100vw] h-[100vw] rounded-full bg-primary/5 blur-[130px] pointer-events-none"></div>

      <div className="w-full sm:max-w-xl bg-[var(--bg-card)] border-[var(--border-subtle)] sm:border rounded-t-3xl sm:rounded-2xl shadow-2xl relative z-10 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-6 scrollbar-thin">
        
        {/* Header Navigation Area */}
        <div className="flex justify-between items-center mb-8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-subtle)]">
              <SparklesIcon className="w-3.5 h-3.5 text-primary-text" />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-mono text-[var(--text-muted)]">Premium Upgrade Portal</span>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all duration-300"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Text Area */}
        <div className="text-right mb-6 flex-shrink-0" dir="rtl">
          <h2 className="text-2xl font-black text-[var(--text-main)] leading-tight">
            بررسی <span className="text-primary-text">طرح‌های پریمیوم</span> هکسر
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">
            سهمیه هوش مصنوعی خود را شارژ کن تا بدون وقفه و در اوج سرعت، کارهات رو به بهینه‌ترین شکل مدیریت کنی.
          </p>
          
          {message && (
            <div className="mt-4 p-3 bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/20 rounded-xl text-[var(--semantic-error)] text-xs font-semibold">
              {message}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/30 text-[var(--semantic-error)] rounded-xl text-xs font-bold text-center flex-shrink-0">
            {error}
          </div>
        )}

        {/* Vertical Stack: Cards optimized specifically for Mobile viewport */}
        <div className="space-y-4 mb-8 flex-1">
          {plans.map((p) => {
            const isActive = currentPlanCode === p.code;
            const isLoading = loadingPlan === p.code;

            return (
              <div 
                key={p.code}
                className={`rounded-2xl border p-5 transition-all duration-300 relative overflow-hidden ${p.color} ${p.popular ? 'scale-[1.01]' : ''}`}
                dir="rtl"
              >
                {/* Decorative sheen bar for premium plans */}
                {p.code !== 'free' && (
                  <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>
                )}

                {/* Badges */}
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-extrabold ${p.tagColor}`}>
                    {p.tag}
                  </span>
                  {isActive && (
                    <span className="text-[10px] text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-md font-extrabold">
                      طرح فعلی شما
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-baseline mb-4">
                  <div>
                    <h3 className="text-base font-black text-[var(--text-main)]">{p.name}</h3>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                      {p.quota} — {p.model}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-xl font-black text-[var(--text-main)]">{p.price}</span>
                    {p.code !== 'free' && <span className="text-[9px] text-[var(--text-muted)] mr-0.5">/ {p.period}</span>}
                  </div>
                </div>

                {/* Condensed bullet points so it fits brilliantly on mobile layout */}
                <ul className="space-y-2.5 mb-5 select-none">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-[var(--text-main)]">
                      <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckIcon className="w-2.5 h-2.5 text-success" />
                      </div>
                      <span className="font-medium opacity-90">{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* Call-to-action Button */}
                <button
                  disabled={isActive || isLoading || (loadingPlan !== null) || p.code === 'free'}
                  onClick={() => handleSelectPlan(p.code)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    isActive 
                      ? 'bg-success/10 text-success border border-success/20 cursor-not-allowed'
                      : p.code === 'free'
                      ? 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] cursor-not-allowed text-[10px]'
                      : p.popular
                      ? 'bg-primary hover:bg-[var(--color-primary-hover)] text-[var(--text-on-primary)] shadow-md shadow-primary/15 active:scale-95'
                      : 'bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] active:scale-95 border border-[var(--border-subtle)]'
                  } disabled:opacity-40 disabled:scale-100`}
                >
                  {isLoading ? (
                    <div className="w-4.5 h-4.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : isActive ? (
                    'در حال حاضر فعال است'
                  ) : p.code === 'free' ? (
                    'طرح آغازین بدون ارتقا'
                  ) : (
                    'خرید و افزایش سهمیه 🚀'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Disclaimer */}
        <p className="text-center text-[9px] text-[var(--text-muted)] mt-2 font-medium flex-shrink-0" dir="rtl">
          پرداخت از درگاه امن شتابی زیبال با کلیه کارت‌های بانکی کشور انجام می‌شود.
        </p>
      </div>
    </div>
  );
};

export default PaywallModal;

