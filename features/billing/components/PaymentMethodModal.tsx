import React, { useState } from 'react';
import { Plan } from './SubscriptionModal';
import * as billingService from '../../../services/billingService';
import { useData } from '../../../contexts/DataContext';
import { XIcon, CreditCardIcon, CheckIcon, WarningIcon, BookmarkIcon } from '../../../components/icons';
import ReceiptUploadModal from './ReceiptUploadModal';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
  onSuccess: () => void;
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({ isOpen, onClose, plan, onSuccess }) => {
  const { addNotification } = useData();
  const [promoCode, setPromoCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  
  // Discount breakdown state
  const [discountDetails, setDiscountDetails] = useState<{
    valid: boolean;
    reason?: string;
    planPrice: number;
    discountAmount: number;
    finalAmount: number;
    isFullDiscount: boolean;
  } | null>(null);

  // Receipt Modal trigger
  const [showReceipt, setShowReceipt] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  if (!isOpen) return null;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setLoadingCode(true);
    setCodeError(null);
    try {
      const sanitized = promoCode.toUpperCase().trim();
      const rawResult = await billingService.previewDiscount(plan.code, sanitized);
      
      const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;

      if (result) {
        if (result.valid) {
          setDiscountDetails({
            valid: true,
            planPrice: Number(result.plan_price || plan.priceRials),
            discountAmount: Number(result.discount_amount || 0),
            finalAmount: Number(result.final_amount ?? plan.priceRials),
            isFullDiscount: !!result.is_full_discount,
          });
          setAppliedCode(sanitized);
          addNotification("کد تخفیف اعمال شد.", "success");
        } else {
          setCodeError(result.reason || "کد تخفیف معتبر نیست.");
          setDiscountDetails(null);
          setAppliedCode(null);
        }
      } else {
        setCodeError("سیستم تخفیف پاسخ معتبری بازنگرداند.");
      }
    } catch (err: any) {
      console.error(err);
      setCodeError(err.message || "خطا در بررسی کد تخفیف نمونه.");
    } finally {
      setLoadingCode(false);
    }
  };

  const handleOnlineCheckout = async () => {
    setCheckingOut(true);
    try {
      await billingService.startCheckout(plan.code, appliedCode || undefined);
    } catch (err: any) {
      console.error(err);
      addNotification(err.message || "خطا در اتصال به درگاه پرداخت آنلاین زیبال.", "error");
    } finally {
      setCheckingOut(false);
    }
  };

  // Prices formatting helper
  const formatToman = (rials: number) => {
    const tomans = Math.floor(rials / 10);
    return tomans.toLocaleString('fa-IR') + ' تومان';
  };

  const finalAmountToPay = discountDetails ? discountDetails.finalAmount : plan.priceRials;
  const isFullDiscount = discountDetails?.isFullDiscount || finalAmountToPay === 0;

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[110] p-4 transition-opacity duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden transform transition-all relative"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-[var(--bg-card)] to-[var(--bg-card)] p-5 shrink-0 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h3 className="text-[var(--text-main)] font-extrabold text-xs">تعیین شیوه پرداخت و فاکتور</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">فاکتور و شیوه پرداخت</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] rounded-full border border-[var(--border-subtle)] transition-all"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content area */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* Summary of Plan selection */}
          <div className="p-3 bg-[var(--bg-card)]/40 border border-[var(--border-subtle)] rounded-2xl text-right">
            <span className="text-[9px] text-[var(--text-muted)] font-bold">طرح منتخب</span>
            <div className="flex justify-between items-center mt-0.5">
              <span className="text-xs font-black text-[var(--text-main)]">{plan.name}</span>
              <span className="text-xs font-mono font-black text-primary-text">{plan.priceTomansLabel}</span>
            </div>
          </div>

          {/* Promo Section */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-[var(--text-muted)] block uppercase tracking-wider">کد تخفیف (کوپن)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 right-3.5 flex items-center pr-1 pointer-events-none text-[var(--text-muted)]">
                  <BookmarkIcon className="w-3.5 h-3.5" />
                </div>
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={e => setPromoCode(e.target.value)} 
                  placeholder="مثال: CODES10" 
                  className="w-full bg-[var(--bg-card)]/60 border border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80 focus:border-primary rounded-xl pr-10 pl-3 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] font-black tracking-wider transition-all"
                />
              </div>
              <button 
                onClick={handleApplyPromo}
                disabled={loadingCode || !promoCode.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-[var(--bg-card)] text-[var(--text-on-primary)] disabled:text-[var(--text-muted)] rounded-xl text-xs font-black transition-all active:scale-95 border border-primary/10"
              >
                {loadingCode ? '...' : 'اعمال'}
              </button>
            </div>
            
            {codeError && (
              <p className="text-[10px] text-error font-bold leading-relaxed">{codeError}</p>
            )}
          </div>

          {/* Dynamic Invoice Breakdown */}
          {discountDetails && (
            <div className="p-3 bg-[var(--bg-card)]/60 border border-[var(--border-subtle)] rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span className="font-bold">قیمت پایه طرح:</span>
                <span className="font-mono">{formatToman(discountDetails.planPrice)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span className="font-bold">تخفیف اعمالی:</span>
                <span className="font-mono">- {formatToman(discountDetails.discountAmount)}</span>
              </div>
              <div className="h-px bg-[var(--border-subtle)] my-1"></div>
              <div className="flex justify-between font-black text-[var(--text-main)]">
                <span>مبلغ نهایی پرداخت:</span>
                <span className="font-mono text-primary-text">{formatToman(discountDetails.finalAmount)}</span>
              </div>
            </div>
          )}

          {/* Action branching based on invoice value */}
          {checkingOut ? (
            <div className="flex flex-col items-center justify-center py-4 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              <p className="text-[10px] text-[var(--text-muted)] font-bold">درحال برقراری ارتباط با پورتال بانک...</p>
            </div>
          ) : isFullDiscount ? (
            /* BYPASS FLOW (100% DISCOUNT) */
            <div className="space-y-2 pt-2 animate-fade-in">
              <button 
                onClick={handleOnlineCheckout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-success hover:bg-success/90 rounded-xl text-[var(--text-on-primary)] font-black text-xs shadow-md shadow-success/20 active:scale-95 transition-all"
              >
                <span>فعال‌سازی ۱۰۰٪ رایگان هکسر ✨</span>
              </button>
              <p className="text-[10px] text-[var(--text-muted)] font-bold text-center">بای‌پَس کامل پرداخت در وب، طرح آنی فعال خواهد گردید</p>
            </div>
          ) : (
            /* PAID OPTIONS FLOW */
            <div className="space-y-3 pt-2">
              <button 
                onClick={handleOnlineCheckout}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-primary hover:bg-primary/90 rounded-xl text-[var(--text-on-primary)] font-black text-xs active:scale-95 transition-all shadow-md shadow-primary/20"
              >
                <CreditCardIcon className="w-4 h-4 shrink-0" />
                <span>پرداخت آنلاین و آنی شتابی (زیبال) 💳</span>
              </button>
              
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
                <span className="flex-shrink mx-3 text-[10px] text-[var(--text-muted)] font-bold">کارت به کارت</span>
                <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
              </div>

              <button 
                onClick={() => setShowReceipt(true)}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-main)] font-black text-xs active:scale-95 transition-all"
              >
                <span>آپلود رسید کارت به کارت 🧾</span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Level 3: Offline Receipt Upload Modal */}
      {showReceipt && (
        <ReceiptUploadModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          plan={plan}
          discountCode={appliedCode}
          onSuccess={() => {
            setShowReceipt(false);
            onSuccess();
          }}
        />
      )}
    </div>
  );
};

export default PaymentMethodModal;
