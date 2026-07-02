import React, { useState } from 'react';
import { startCheckout } from '../../../services/billingService';
import { CpuIcon, SparklesIcon, CheckIcon, ShieldCheckIcon, CreditCardIcon } from '../../../components/icons';
import { UsageMeter } from '../components/UsageMeter';

interface Plan {
  id: string;
  code: string;
  name: string;
  priceRials: number;
  priceTomansLabel: string;
  durationLabel: string;
  isPopular: boolean;
  features: string[];
}

export const SubscriptionPage: React.FC = () => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const plans: Plan[] = [
    {
      id: 'free',
      code: 'free',
      name: 'طرح رایگان (Free)',
      priceRials: 0,
      priceTomansLabel: 'رایگان',
      durationLabel: '۳ روزه',
      isPopular: false,
      features: [
        'سهمیه ۳۰ درخواست اولیه هوشمند',
        'بدون محدودیت تعداد درخواست روزانه',
        'مدل هوش مصنوعی پیشرفته gemini-3.1-flash-lite',
        'دسترسی ۳ روزه آزمایشی برای ارزیابی قابلیت‌ها'
      ]
    },
    {
      id: 'starter',
      code: 'starter',
      name: 'طرح استارتر (Starter)',
      priceRials: 990000,
      priceTomansLabel: '۹۹ هزار تومان',
      durationLabel: 'ماهانه (۳۰ روزه)',
      isPopular: false,
      features: [
        '۳۰۰ درخواست هوشمند مجاز ماهانه',
        'بدون محدودیت تعداد درخواست روزانه',
        'مدل هوش مصنوعی پیشرفته gemini-3.1-flash-lite',
        'ساخت و مدیریت نامحدود یادداشت‌ها و کارها',
        'پشتیبان‌گیری امن و همگام‌سازی سریع پایگاه داده'
      ]
    },
    {
      id: 'plus',
      code: 'plus',
      name: 'طرح پلاس (Plus) ✨',
      priceRials: 1990000,
      priceTomansLabel: '۱۹۹ هزار تومان',
      durationLabel: 'ماهانه (۳۰ روزه)',
      isPopular: true,
      features: [
        '۷۰۰ درخواست هوشمند مجاز ماهانه',
        'بدون محدودیت تعداد درخواست روزانه',
        'مدل هوش مصنوعی پیشرفته gemini-3.1-flash-lite',
        'بارگذاری مستقیم عکس، اسکرین‌شات و صوت',
        'پشتیبان‌گیری رمزنگاری‌شده و امنیت اولویت بالا'
      ]
    },
    {
      id: 'pro',
      code: 'pro',
      name: 'طرح پرو (Pro) 🏆',
      priceRials: 3690000,
      priceTomansLabel: '۳۶۹ هزار تومان',
      durationLabel: 'ماهانه (۳۰ روزه)',
      isPopular: false,
      features: [
        '۱,۳۰۰ درخواست هوشمند مجاز ماهانه',
        'بدون محدودیت تعداد درخواست روزانه',
        'مدل هوش مصنوعی پیشرفته gemini-3.1-flash-lite',
        'درک همزمان چندرسانه‌ای‌های شلوغ و سنگین',
        'پشتیبانی VIP اختصاصی ۲۴ ساعته در هفت روز هفته'
      ]
    }
  ];

  const handleSubscribe = async (planCode: string) => {
    if (planCode === 'free') return;
    try {
      setLoadingPlan(planCode);
      setErrorMsg(null);
      await startCheckout(planCode);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'خطا در برقراری ارتباط با درگاه پرداخت بانکی زیبال. لطفا مجددا تلاش کنید.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-full pb-32 bg-transparent text-[var(--text-main)] relative flex flex-col h-full" dir="rtl">
      {/* Header Container */}
      <header className="sticky top-0 pt-safe z-30 px-6 py-8 border-b border-[var(--border-subtle)] shrink-0" style={{ background: 'var(--bg-app-glass)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-[1600px] mx-auto text-right">
          <h1 className="text-3xl font-black text-[var(--text-main)]">
            ارتقا بستر کاربری و اشتراک
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1.5 font-bold font-sans">با تغییر پکیج، قفل نامحدود ایده‌ها و پروژه‌ها را آزاد و امن کنید</p>
        </div>
      </header>

      {/* Main content body with dynamic columns */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-8 max-w-5xl mx-auto w-full space-y-10">
        
        {/* Current status quota meter widget */}
        <div className="max-w-xl mx-auto">
          <UsageMeter />
        </div>

        {errorMsg && (
          <div className="bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/25 p-4 rounded-xl text-xs text-[var(--semantic-error)] font-bold text-center leading-relaxed max-w-xl mx-auto">
            {errorMsg}
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 gap-6 pt-2">
          {plans.map(plan => (
            <div 
              key={plan.id}
              className={`rounded-2xl border flex flex-col relative overflow-hidden h-full min-w-0 max-w-full break-words text-right transition-all duration-300 hover:-translate-y-1 ${
                plan.isPopular 
                  ? 'bg-[var(--bg-card)] border-primary/40 ring-1 ring-primary/20 shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.15)]' 
                  : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-primary/30'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
              )}

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4 text-right">
                  <div className="flex justify-between items-start">
                    <h3 className="font-extrabold text-[var(--text-main)] text-sm font-sans">{plan.name}</h3>
                    {plan.isPopular && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[8px] font-black text-primary font-sans">
                        محبوب‌ترین
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-[var(--text-main)] font-mono">{plan.priceTomansLabel}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold">برای دوره زمان کاربری {plan.durationLabel}</p>
                    {plan.priceRials > 0 && (
                      <p className="text-[9px] text-[var(--text-muted)] opacity-85 font-bold font-mono">برابر با {plan.priceRials.toLocaleString('fa-IR')} ریال</p>
                    )}
                  </div>

                  {/* Feature listing list */}
                  <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <CheckIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium leading-relaxed text-[var(--text-main)] opacity-90">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  {plan.code === 'free' ? (
                    <div className="w-full text-center border border-[var(--border-subtle)] p-2.5 rounded-xl text-[var(--text-muted)] text-xs font-bold leading-relaxed bg-black/5 dark:bg-white/5">
                      کاربری عادی فعال است
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.code)}
                      disabled={loadingPlan !== null}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        plan.isPopular 
                          ? 'bg-primary hover:bg-[var(--color-primary-hover)] text-[var(--text-on-primary)] shadow-md shadow-primary/15' 
                          : 'bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)]'
                      } disabled:opacity-50`}
                    >
                      {loadingPlan === plan.code ? 'کمی صبر کنید...' : 'فعال‌سازی و تمدید طرح'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security / payment trust footer credentials info */}
        <div className="border-t border-[var(--border-subtle)] pt-6 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold">تضمین پرداخت امن تحت درگاه رسمی بانکی شبکه شتاب (زیبال)</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold">فعال‌سازی آنی حساب و خدمات پس از بازگشت موفق تراکنش</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
