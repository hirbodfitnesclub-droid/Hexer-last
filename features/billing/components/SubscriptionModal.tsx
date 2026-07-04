import React, { useState, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import * as billingService from '../../../services/billingService';
import { ManualPaymentState, Plan as PlanType } from '../../../types';
import { CpuIcon, SparklesIcon, CheckIcon, ShieldCheckIcon, CreditCardIcon, XIcon, WarningIcon } from '../../../components/icons';
import PaymentMethodModal from './PaymentMethodModal';
import { UsageMeter } from './UsageMeter';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceRials: number;
  priceTomansLabel: string;
  durationLabel: string;
  isPopular: boolean;
  features: string[];
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const { subscription, setSubscription, addNotification } = useData();
  const [manualState, setManualState] = useState<ManualPaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const plans: Plan[] = [
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

  const fetchStatus = async () => {
    try {
      const state = await billingService.getManualPaymentState();
      setManualState(state);
      
      // Also refresh the main subscription to reflect changes if manual payment was approved
      const currentSub = await billingService.getSubscription();
      setSubscription(currentSub);
    } catch (err) {
      console.error('Error fetching billing state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getPlanNameInFarsi = (code: string) => {
    if (code === 'starter') return 'طرح استارتر (Starter) ⚡';
    if (code === 'plus') return 'طرح پلاس (Plus) ✨';
    if (code === 'pro') return 'طرح حرفه‌ای (Pro) 🏆';
    return 'نسخه رایگان (Free) 🌱';
  };

  const isPending = manualState?.state === 'pending' || subscription?.status === 'pending_manual';

  return (
    <div 
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-end justify-center z-[100] p-0 transition-opacity duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="flex flex-col w-full max-w-xl h-[100dvh] rounded-t-3xl overflow-hidden bg-[var(--bg-card)] border-t border-[var(--border-subtle)] transform transition-all duration-300 relative shadow-2xl"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header — ثابت، shrink نمی‌شود */}
        <div className="p-4 pt-safe border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-[var(--text-main)]">
              ارتقا بستر کاربری و اشتراک
            </h2>
            <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">مدیریت اشتراک و تراکنش‌های هکسر</p>
          </div>
          
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] border border-[var(--border-subtle)] rounded-full transition-all"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content — اسکرول‌پذیر، min-h-0 حیاتی است */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-5 scrollbar-thin">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
              <p className="text-xs text-[var(--text-muted)] font-bold">در حال دریافت اطلاعات اشتراک... ⏳</p>
            </div>
          ) : isPending ? (
            /* --- STATE 1: PENDING MANUAL STATUS (LOCKED) --- */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-warning/20 blur-xl animate-pulse"></div>
                <div className="w-20 h-20 bg-warning/10 border border-warning/20 rounded-full flex items-center justify-center text-warning animate-pulse relative z-10">
                  <WarningIcon className="w-10 h-10" />
                </div>
              </div>
              
              <div className="space-y-3 max-w-md">
                <h3 className="text-base font-black text-warning">در انتظار تایید رسید</h3>
                <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                  رسید پرداخت شما در انتظار تایید ادمین پشتیبانی است. لطفاً چند دقیقه دیگر بازگردید...
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-[10px] font-bold text-warning">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping"></span>
                    وضعیت فعلی: بررسی مدارک ارسالی
                  </span>
                </div>
              </div>
              
              <p className="text-[10px] text-[var(--text-muted)] font-bold">
                تمام دسترسی‌ها و تراکنش‌های همزمان موقتاً جهت حفظ صحت فاکتور قفل می‌باشند.
              </p>
            </div>
          ) : (
            /* --- NORMAL OR REJECTED STATE --- */
            <>
              {/* USAGE METER */}
              <UsageMeter />

              {/* STATE 2: REJECTED BANNER */}
              {manualState?.state === 'rejected' && (
                <div className="bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/20 p-4 rounded-2xl flex items-start gap-3 text-right animate-fade-in relative overflow-hidden">
                  <div className="p-2 bg-[var(--semantic-error-soft)] rounded-xl text-[var(--semantic-error)] shrink-0 mt-0.5">
                    <WarningIcon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-[var(--semantic-error)]">درخواست قبلی رد شد</h4>
                    <p className="text-[11px] text-[var(--semantic-error)] font-medium leading-relaxed">
                      رسید یا پرداخت قبلی شما تایید نشد. علت: <span className="font-bold underline">{manualState.reason || 'مدرک ارسالی نامعتبر است'}</span>. لطفا مجددا اقدام فرمایید.
                    </p>
                  </div>
                </div>
              )}

              {/* ACTIVE SUBSCRIPTION OVERVIEW */}
              <div className="bg-[var(--bg-card)]/50 border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col justify-between gap-3 text-right relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">پکیج فعلی شما</span>
                    <h4 className="text-xs font-black text-[var(--text-main)]">{getPlanNameInFarsi(subscription?.plan_code || 'free')}</h4>
                  </div>
                  {subscription && subscription.plan_code !== 'free' && subscription.status === 'active' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-success/10 border border-success/20 text-[9px] font-bold text-success">
                      فعال و معتبر
                    </span>
                  )}
                </div>

                {subscription && subscription.plan_code !== 'free' && (
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span className="font-medium">تاریخ پایان اعتبار:</span>
                    <span className="font-bold font-mono">
                      {new Date(subscription.expires_at).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                )}
              </div>

              {/* LIST OF PLANS */}
              <div className="space-y-4 pt-1">
                <h3 className="text-xs font-extrabold text-[var(--text-muted)]">طرح‌های ارتقای هکسر</h3>
                
                <div className="space-y-4">
                  {plans.map(plan => {
                    const isActivePlan = subscription?.plan_code === plan.code;
                    const hasActiveNonFree = subscription && subscription.plan_code !== 'free' && subscription.status === 'active';
                    const isButtonDisabled = hasActiveNonFree && !isActivePlan;

                    return (
                      <div 
                        key={plan.id}
                        className={`rounded-2xl border flex flex-col relative overflow-hidden text-right transition-all duration-300 ${
                          plan.isPopular 
                            ? 'bg-[var(--bg-card)] border-primary/40 ring-1 ring-primary/20 shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.15)]' 
                            : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-primary/30'
                        } ${isButtonDisabled ? 'opacity-40' : ''}`}
                      >
                        {plan.isPopular && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
                        )}

                        <div className="p-4 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-[var(--text-main)] text-xs">{plan.name}</h4>
                              {plan.isPopular && (
                                <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[8px] font-black text-primary-text font-sans">
                                  محبوب‌ترین
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-lg font-black text-[var(--text-main)] font-mono">{plan.priceTomansLabel}</span>
                              <span className="text-[9px] text-[var(--text-muted)] font-bold">/ {plan.durationLabel}</span>
                            </div>
                            
                            <p className="text-[9px] text-[var(--text-muted)] opacity-85 font-bold font-mono mt-0.5">
                              برابر با {plan.priceRials.toLocaleString('fa-IR')} ریال
                            </p>

                            <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] space-y-2">
                              {plan.features.map((feat, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <CheckIcon className="w-3.5 h-3.5 text-primary-text shrink-0 mt-0.5" />
                                  <span className="text-[10px] text-[var(--text-main)] leading-relaxed opacity-90">{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2">
                            {isActivePlan ? (
                              <button
                                onClick={() => setSelectedPlan(plan)}
                                className="w-full py-2 rounded-xl text-[11px] font-bold bg-[var(--nav-hover-bg)] hover:bg-[var(--bg-card)] text-[var(--text-main)] transition-all shadow-sm active:scale-95 border border-[var(--border-subtle)]"
                              >
                                تمدید مجدد طرح
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (!isButtonDisabled) setSelectedPlan(plan);
                                }}
                                disabled={isButtonDisabled}
                                className={`w-full py-2 rounded-xl text-[11px] font-bold transition-all shadow-sm ${
                                  plan.isPopular 
                                    ? 'bg-primary hover:bg-[var(--color-primary-hover)] text-[var(--text-on-primary)] shadow-md shadow-primary/15 active:scale-95' 
                                    : 'bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-main)] active:scale-95'
                                } disabled:opacity-40 disabled:pointer-events-none`}
                              >
                                خرید و ارتقای آنی
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer — ثابت، shrink نمی‌شود، pb-safe برای notch */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/80 text-center shrink-0 pb-safe">
          <div className="flex flex-col items-center justify-center gap-1.5 text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <ShieldCheckIcon className="w-4 h-4 text-primary-text" />
              <span className="text-[9px] font-bold">تضمین پرداخت امن در شبکه شتاب کشور</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Selection Level 2 Modal */}
      {selectedPlan && (
        <PaymentMethodModal
          isOpen={!!selectedPlan}
          onClose={() => setSelectedPlan(null)}
          plan={selectedPlan}
          onSuccess={() => {
            setSelectedPlan(null);
            onClose();
            fetchStatus();
          }}
        />
      )}
    </div>
  );
};

export default SubscriptionModal;
