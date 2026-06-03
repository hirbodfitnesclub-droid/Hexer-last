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
      model: 'Gemini 3.1 Lite',
      features: [
        'دسترسی رایگان ۳ روزه تستی',
        '۳۰ درخواست اولیه خلاقانه',
        'موتور هوش مصنوعی Gemini 3.1',
        'بدون محدودیت روزانه درخواست'
      ],
      popular: false,
      color: 'border-neutral-800 bg-neutral-900/30 text-neutral-400',
      tag: 'تست رایگان',
      tagColor: 'bg-neutral-800 text-neutral-400'
    },
    {
      code: 'starter',
      name: 'طرح استارتر (Starter)',
      price: '۹۹,۰۰۰',
      period: '۳۰ روزه',
      quota: '۳۰۰ درخواست هوشمند',
      model: 'Gemini 3.1 Lite',
      features: [
        'دسترسی ۳۰ روزه پایدار تمدیدپذیر',
        '۳۰۰ درخواست هوشمند ماهانه',
        'بدون محدودیت روزانه درخواست',
        'تعریف نامحدود یادداشت‌ها و کارها'
      ],
      popular: false,
      color: 'border-zinc-800 bg-neutral-900/40 text-white hover:border-zinc-700',
      tag: 'اقتصادی',
      tagColor: 'bg-zinc-800 text-zinc-300'
    },
    {
      code: 'plus',
      name: 'طرح پلاس (Plus) ✨',
      price: '۱۹۹,۰۰۰',
      period: '۳۰ روزه',
      quota: '۷۰۰ درخواست هوشمند',
      model: 'Gemini 3.1 Lite',
      features: [
        'دسترسی ۳۰ روزه پایدار تمدیدپذیر',
        '۷۰۰ درخواست هوشمند ماهانه',
        'بدون محدودیت روزانه درخواست',
        'بارگذاری مستقیم تصاویر و صوت'
      ],
      popular: true,
      color: 'border-[#00d2ff]/30 bg-neutral-900/60 text-white ring-1 ring-[#00d2ff]/10 shadow-[0_0_30px_rgba(0,210,255,0.03)]',
      tag: 'پیشنهاد هکسر ⚡',
      tagColor: 'bg-[#00d2ff] text-neutral-950 font-black'
    },
    {
      code: 'pro',
      name: 'طرح پرو (Pro) 🏆',
      price: '۳۶۹,۰۰۰',
      period: '۳۰ روزه',
      quota: '۱,۳۰۰ درخواست هوشمند',
      model: 'Gemini 3.1 Lite',
      features: [
        'دسترسی ۳۰ روزه ممتاز و نامحدود',
        '۱,۳۰۰ درخواست هوشمند ماهانه',
        'بدون محدودیت روزانه درخواست',
        'پشتیبانی VIP و پردازش کارهای سنگین'
      ],
      popular: false,
      color: 'border-fuchsia-500/30 bg-neutral-900/50 text-white ring-1 ring-fuchsia-500/10 shadow-[0_0_40px_rgba(217,70,239,0.05)]',
      tag: 'کاربر سنترال 👑',
      tagColor: 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-black'
    }
  ];

  return (
    <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-xl flex flex-col justify-start z-[100] overflow-y-auto px-5 py-6 font-sans">
      
      {/* Absolute floating luxury ambient backdrops */}
      <div className="absolute top-[-10%] right-[-10%] w-[100vw] h-[100vw] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[-20%] w-[100vw] h-[100vw] rounded-full bg-pink-500/5 blur-[130px] pointer-events-none"></div>

      <div className="w-full max-w-md mx-auto relative z-10 flex flex-col min-h-full justify-between pb-8">
        
        {/* Header Navigation Area */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center border border-neutral-800">
              <SparklesIcon className="w-3.5 h-3.5 text-fuchsia-400" />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-mono text-neutral-500">Premium Upgrade Portal</span>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all duration-300"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Text Area */}
        <div className="text-right mb-6" dir="rtl">
          <h2 className="text-2xl font-black text-white leading-tight">
            بررسی <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] via-indigo-400 to-fuchsia-500">طرح‌های پریمیوم</span> هکسر
          </h2>
          <p className="text-xs text-neutral-400 mt-2 font-medium">
            سهمیه هوش مصنوعی خود را شارژ کن تا بدون وقفه و در اوج سرعت، کارهایت را مدیریت کنی و زمان را جلو بندازی.
          </p>
          
          {message && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs font-semibold">
              {message}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-600/20 border border-red-500/30 text-red-100 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* Vertical Stack: Cards optimized specifically for Mobile viewport */}
        <div className="space-y-4 mb-8">
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
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-extrabold">
                      طرح فعلی شما
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-baseline mb-4">
                  <div>
                    <h3 className="text-base font-black text-white">{p.name}</h3>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1">
                      {p.quota} — {p.model}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-xl font-black text-white">{p.price}</span>
                    {p.code !== 'free' && <span className="text-[9px] text-neutral-400 mr-0.5">/ {p.period}</span>}
                  </div>
                </div>

                {/* Condensed bullet points so it fits brilliantly on mobile layout */}
                <ul className="space-y-2.5 mb-5 select-none">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-neutral-300">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckIcon className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <span className="font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* Call-to-action Button */}
                <button
                  disabled={isActive || isLoading || (loadingPlan !== null) || p.code === 'free'}
                  onClick={() => handleSelectPlan(p.code)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    isActive 
                      ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed'
                      : p.code === 'free'
                      ? 'bg-neutral-900 text-neutral-600 border border-neutral-800/50 cursor-not-allowed text-[10px]'
                      : p.popular
                      ? 'bg-[#00d2ff] hover:bg-[#00c0eb] text-neutral-950 shadow-lg shadow-[#00d2ff]/10 active:scale-95'
                      : 'bg-neutral-800 hover:bg-neutral-750 text-white active:scale-95 border border-neutral-700/40'
                  } disabled:opacity-40 disabled:scale-100`}
                >
                  {isLoading ? (
                    <div className="w-4.5 h-4.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : isActive ? (
                    'در حال حاضر فعال است'
                  ) : p.code === 'free' ? (
                    'طرح آغازین بدون ارتقا'
                  ) : (
                    'خرید آنی و ارتقای کوئتا 🚀'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Disclaimer */}
        <p className="text-center text-[9px] text-neutral-600 mt-2 font-medium" dir="rtl">
          پرداخت از درگاه امن شتابی زیبال با کلیه کارت‌های بانکی کشور انجام می‌شود.
        </p>
      </div>
    </div>
  );
};

export default PaywallModal;
