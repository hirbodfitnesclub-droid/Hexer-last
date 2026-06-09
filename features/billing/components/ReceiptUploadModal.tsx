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
        className="bg-neutral-950 border border-neutral-800 rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.95)] w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden transform transition-all relative"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-950/40 via-neutral-950 to-neutral-950 p-5 shrink-0 border-b border-neutral-900 flex items-center justify-between">
          <div>
            <h3 className="text-white font-extrabold text-xs">ارسال رسید واریز (کارت به کارت)</h3>
            <p className="text-[10px] text-neutral-500 font-bold mt-0.5">بارگذاری امن مدارک تراکنش آفلاین</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={submitting}
            className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900 rounded-full border border-neutral-800 transition-all disabled:opacity-40"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* Card specs details block */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3 text-right">
            <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">حساب بانکی مقصد جهت کارت‌به‌کارت</span>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center bg-neutral-950/40 p-2 rounded-xl border border-neutral-800/40">
                <span className="text-zinc-400 font-medium">شماره کارت:</span>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <span className="text-indigo-400 font-black font-mono tracking-wider text-xs md:text-sm select-all">
                    6219 8619 1717 9755
                  </span>
                  <button 
                    onClick={handleCopyCard}
                    type="button"
                    className="p-1 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-850 rounded-lg transition-all active:scale-95 border border-neutral-800"
                    title="کپی شماره کارت"
                  >
                    <CopyIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between px-1">
                <span className="text-zinc-400 font-medium">نام بانک:</span>
                <span className="text-white font-extrabold">بلو بانک سامان</span>
              </div>
              <div className="flex justify-between px-1">
                <span className="text-zinc-400 font-medium">به نام:</span>
                <span className="text-white font-extrabold">آرش مکی</span>
              </div>
            </div>
          </div>

          {/* DND Drag-drop Area */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">بارگذاری عکس رسید پرداخت</label>
            
            {imagePreview ? (
              /* PREVIEW CONTAINER */
              <div className="relative rounded-2xl overflow-hidden border border-neutral-800 aspect-video group bg-neutral-950 flex items-center justify-center">
                <img 
                  src={imagePreview} 
                  alt="رسید تراکنش بانکی" 
                  className="max-h-full max-w-full object-contain"
                />
                {!submitting && (
                  <button 
                    onClick={clearSelectedFile}
                    className="absolute top-2 left-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all active:scale-95 border border-red-500/20"
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
                    ? 'border-indigo-500 bg-indigo-500/5' 
                    : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/10'
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
                
                <UploadIcon className="w-7 h-7 mx-auto text-neutral-500 mb-2.5" />
                <p className="text-xs text-zinc-300 font-bold">راست‌کلیک، رهاسازی یا کشیدن تصویر رسید</p>
                <p className="text-[10px] text-neutral-500 mt-1">حداکثر حجم مجاز: ۲ مگابایت</p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/25 p-3.5 rounded-xl flex items-start gap-2 text-right">
              <WarningIcon className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <span className="text-[10px] text-red-300 font-bold leading-relaxed">{errorMessage}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-900 flex-shrink-0">
          <button 
            onClick={handleSubmit}
            disabled={submitting || !selectedFile}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-indigo-950/20"
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
