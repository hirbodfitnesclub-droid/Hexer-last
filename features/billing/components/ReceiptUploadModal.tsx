import React, { useState, useRef } from 'react';
import { Plan } from './SubscriptionModal';
import * as billingService from '../../../services/billingService';
import { useData } from '../../../contexts/DataContext';
import { XIcon, UploadIcon, CheckIcon, WarningIcon, CopyIcon } from '../../../components/icons';

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
  discountCode: string | null;
  onSuccess: () => void;
}

export const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({ isOpen, onClose, plan, discountCode, onSuccess }) => {
  const { addNotification, setSubscription } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleCopyCard = () => {
    navigator.clipboard.writeText("6219861917179755");
    addNotification("شماره کارت با موفقیت کپی شد.", "success");
  };

  const handleFile = (file: File) => {
    setErrorMessage(null);
    if (!file.type.startsWith('image/')) {
      setErrorMessage("فرمت فایل نامعتبر است. لطفاً فقط تصویر رسید را انتخاب کنید.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("حجم فایل انتخاب شده بیش از ۲ مگابایت است. لطفاً تصویر کوچک‌تری انتخاب کنید.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage("لطفاً تصویر رسید پرداخت خود را بارگذاری کنید.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await billingService.submitManualPayment(
        plan.code,
        discountCode,
        selectedFile
      );

      addNotification("رسید بانکی شما با موفقیت ثبت و ارسال شد. ادمین پشتیبانی در اسرع وقت اقدام خواهد کرد.", "success");
      
      // Refresh user subscription local states
      const refreshedSub = await billingService.getSubscription();
      setSubscription(refreshedSub);

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "خطا در بارگذاری رسید یا تایید دیتابیس سرور.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4 transition-opacity duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.95)] w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden transform transition-all relative"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-[var(--bg-card)] to-[var(--bg-card)] p-5 shrink-0 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h3 className="text-[var(--text-main)] font-extrabold text-xs">ارسال رسید واریز (کارت به کارت)</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">بارگذاری امن مدارک تراکنش آفلاین</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={submitting}
            className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] rounded-full border border-[var(--border-subtle)] transition-all disabled:opacity-40"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* Card specs details block */}
          <div className="bg-[var(--bg-card)]/60 border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3 text-right">
            <span className="text-[9px] text-[var(--text-muted)] font-bold block uppercase tracking-wider">حساب بانکی مقصد جهت کارت‌به‌کارت</span>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-[var(--border-subtle)]/45">
                <span className="text-[var(--text-muted)] font-medium">شماره کارت:</span>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <span className="text-primary-text font-black font-mono tracking-wider text-xs md:text-sm select-all">
                    6219 8619 1717 9755
                  </span>
                  <button 
                    onClick={handleCopyCard}
                    type="button"
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-[var(--nav-hover-bg)] rounded-lg transition-all active:scale-95 border border-[var(--border-subtle)]"
                    title="کپی شماره کارت"
                  >
                    <CopyIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between px-1">
                <span className="text-[var(--text-muted)] font-medium">نام بانک:</span>
                <span className="text-[var(--text-main)] font-extrabold">بلو بانک سامان</span>
              </div>
              <div className="flex justify-between px-1">
                <span className="text-[var(--text-muted)] font-medium">به نام:</span>
                <span className="text-[var(--text-main)] font-extrabold">آرش مکی</span>
              </div>
            </div>
          </div>

          {/* DND Drag-drop Area */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-[var(--text-muted)] block uppercase tracking-wider">بارگذاری عکس رسید پرداخت</label>
            
            {imagePreview ? (
              /* PREVIEW CONTAINER */
              <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] aspect-video group bg-black/40 flex items-center justify-center">
                <img 
                  src={imagePreview} 
                  alt="رسید تراکنش بانکی" 
                  className="max-h-full max-w-full object-contain"
                />
                {!submitting && (
                  <button 
                    onClick={clearSelectedFile}
                    className="absolute top-2 left-2 p-1.5 bg-error hover:bg-error/90 text-[var(--text-on-primary)] rounded-full transition-all active:scale-95 border border-error/20"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              /* DND TARGET ZONE */
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80 bg-black/5 dark:bg-white/5'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                <UploadIcon className="w-7 h-7 mx-auto text-[var(--text-muted)] mb-2.5" />
                <p className="text-xs text-[var(--text-muted)] font-bold">راست‌کلیک، رهاسازی یا کشیدن تصویر رسید</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">حداکثر حجم مجاز: ۲ مگابایت</p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="bg-error/10 border border-error/25 p-3.5 rounded-xl flex items-start gap-2 text-right">
              <WarningIcon className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" />
              <span className="text-[10px] text-error font-bold leading-relaxed">{errorMessage}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--border-subtle)] flex-shrink-0">
          <button 
            onClick={handleSubmit}
            disabled={submitting || !selectedFile}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-[var(--text-on-primary)] rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-primary/20"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"></div>
                <span>در حال فشرده‌سازی و ارسال...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                <span>ارسال و ثبت نهایی رسید پرداخت</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptUploadModal;
