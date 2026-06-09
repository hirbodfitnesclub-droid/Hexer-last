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
        className="bg-neutral-950 border border-neutral-800 rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden transform transition-all relative"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-950/40 via-neutral-950 to-neutral-950 p-5 shrink-0 border-b border-neutral-900 flex items-center justify-between">
          <div>
            <h3 className="text-white font-extrabold text-xs">تعیین شیوه پرداخت و فاکتور</h3>
            <p className="text-[10px] text-neutral-500 font-bold mt-0.5">فاکتور و شیوه پرداخت</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900 rounded-full border border-neutral-800 transition-all"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content area */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* Summary of Plan selection */}
          <div className="p-3 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl text-right">
            <span className="text-[9px] text-neutral-500 font-bold">طرح منتخب</span>
            <div className="flex justify-between items-center mt-0.5">
              <span className="text-xs font-black text-white">{plan.name}</span>
              <span className="text-xs font-mono font-black text-indigo-400">{plan.priceTomansLabel}</span>
            </div>
          </div>

          {/* Promo Section */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">کد تخفیف (کوپن)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 right-3.5 flex items-center pr-1 pointer-events-none text-neutral-500">
                  <BookmarkIcon className="w-3.5 h-3.5" />
                </div>
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={e => setPromoCode(e.target.value)} 
                  placeholder="مثال: CODES10" 
                  className="w-full bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 focus:border-indigo-500 rounded-xl pr-10 pl-3 py-2 text-xs text-white placeholder-neutral-600 font-black tracking-wider transition-all"
                />
              </div>
              <button 
                onClick={handleApplyPromo}
                disabled={loadingCode || !promoCode.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-900 text-white disabled:text-neutral-600 rounded-xl text-xs font-black transition-all active:scale-95 border border-indigo-500/10"
              >
                {loadingCode ? '...' : 'اعمال'}
              </button>
            </div>
            
            {codeError && (
              <p className="text-[10px] text-red-400 font-bold leading-relaxed">{codeError}</p>
            )}
          </div>

          {/* Dynamic Invoice Breakdown */}
          {discountDetails && (
            <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span className="font-bold">قیمت پایه طرح:</span>
                <span className="font-mono">{formatToman(discountDetails.planPrice)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span className="font-bold">تخفیف اعمالی:</span>
                <span className="font-mono">- {formatToman(discountDetails.discountAmount)}</span>
              </div>
              <div className="h-px bg-neutral-800 my-1"></div>
              <div className="flex justify-between font-black text-white">
                <span>مبلغ نهایی پرداخت:</span>
                <span className="font-mono text-indigo-400">{formatToman(discountDetails.finalAmount)}</span>
              </div>
            </div>
          )}

          {/* Action branching based on invoice value */}
          {checkingOut ? (
            <div className="flex flex-col items-center justify-center py-4 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
              <p className="text-[10px] text-neutral-400 font-bold">درحال برقراری ارتباط با پورتال بانک...</p>
            </div>
          ) : isFullDiscount ? (
            /* BYPASS FLOW (100% DISCOUNT) */
            <div className="space-y-2 pt-2 animate-fade-in">
              <button 
                onClick={handleOnlineCheckout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:bg-emerald-500 rounded-xl text-white font-black text-xs shadow-md shadow-emerald-950/20 active:scale-95 transition-all"
              >
                <span>فعال‌سازی ۱۰۰٪ رایگان هکسر ✨</span>
              </button>
              <p className="text-[10px] text-neutral-500 font-bold text-center">بای‌پَس کامل پرداخت در وب، طرح آنی فعال خواهد گردید</p>
            </div>
          ) : (
            /* PAID OPTIONS FLOW */
            <div className="space-y-3 pt-2">
              <button 
                onClick={handleOnlineCheckout}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-black text-xs active:scale-95 transition-all shadow-md shadow-indigo-950/20"
              >
                <CreditCardIcon className="w-4 h-4 shrink-0" />
                <span>پرداخت آنلاین و آنی شتابی (زیبال) 💳</span>
              </button>
              
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-neutral-900"></div>
                <span className="flex-shrink mx-3 text-[10px] text-neutral-600 font-bold">کارت به کارت</span>
                <div className="flex-grow border-t border-neutral-900"></div>
              </div>

              <button 
                onClick={() => setShowReceipt(true)}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-300 font-black text-xs active:scale-95 transition-all"
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
