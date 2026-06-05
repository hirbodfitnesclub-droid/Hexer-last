import React, { useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { UserIcon, XIcon, ShieldIcon, BellIcon, MoonIcon, LogOutIcon, DownloadIcon, UploadIcon, CheckIcon, BotIcon } from './icons';
import { exportUserData, importUserData } from '../services/backupService';
import SubscriptionModal from '../features/billing/components/SubscriptionModal';
import SupportTicketModal from './SupportTicketModal';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    signOut: () => void;
    subscription?: any;
    onTriggerUpgrade?: () => void;
    profile?: any;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, signOut, subscription, onTriggerUpgrade, profile }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string }>({ type: null, message: '' });
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setStatus({ type: 'loading', message: 'در حال تهیه فایل پشتیبان لوکس شما... ✨' });
        try {
            await exportUserData();
            setStatus({ type: 'success', message: 'پشتیبان‌گیری رمزنگاری‌شده شما کامل شد.' });
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'خطا در پشتیبان‌گیری' });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setStatus({ type: 'loading', message: 'در حال رمزگشایی و بازگردانی هکسر...' });
            try {
                await importUserData(e.target.files[0]);
                setStatus({ type: 'success', message: 'اطلاعات هکسر با موفقیت همگام‌سازی شد.' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (error: any) {
                setStatus({ type: 'error', message: error.message || 'خطا در بازگردانی اطلاعات' });
            }
        }
    };

    const getPlanBadgeText = () => {
        if (!subscription) return 'نسخه رایگان (ارتقا ⚡)';
        switch (subscription.plan_code) {
            case 'starter': return 'طرح استارتر (Starter) ⚡';
            case 'plus': return 'طرح پلاس (Plus) ✨';
            case 'pro': return 'طرح حرفه‌ای (Pro) 🏆';
            default: return 'نسخه رایگان (ارتقا ⚡)';
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[90] p-4 transition-all duration-300 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-neutral-950 border border-neutral-800 rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)] w-full max-w-sm flex flex-col max-h-[85vh] overflow-hidden transform transition-all relative"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Visual Ambient Top Banner */}
                <div className="relative bg-gradient-to-br from-indigo-950 via-purple-950 to-neutral-950 p-6 pt-10 text-center flex-shrink-0 border-b border-neutral-900">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900/60 hover:bg-neutral-800 rounded-full transition-all border border-neutral-800/40"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    {/* Luxurious Avatar Container */}
                    <div className="w-20 h-20 mx-auto bg-neutral-950 rounded-full flex items-center justify-center border-4 border-neutral-900 shadow-xl mb-3 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#00d2ff] via-fuchsia-500 to-indigo-600 rounded-full opacity-15 group-hover:opacity-30 transition-opacity duration-300"></div>
                        <span className="text-2xl font-black text-white relative z-10 font-mono tracking-wider">
                            {user?.email?.[0].toUpperCase() || <UserIcon className="w-8 h-8"/>}
                        </span>
                    </div>

                    <h3 className="text-white font-black text-base truncate px-4 font-mono">{user?.email}</h3>
                    
                    {/* Badge upgraded to premium glass pill */}
                    <button 
                        onClick={() => setIsSubModalOpen(true)}
                        className="mt-2 px-3 py-1 bg-neutral-900 hover:bg-neutral-800 active:scale-95 transition-all rounded-full text-[9px] font-black text-sky-400 border border-neutral-800/80 shadow-md shadow-black/30"
                    >
                        {getPlanBadgeText()}
                    </button>
                </div>

                {/* Body details list */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    
                    {/* Status Feedback banner */}
                    {status.type && (
                        <div className={`p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 animate-fade-in ${
                            status.type === 'loading' ? 'bg-sky-500/10 text-sky-300 border border-sky-500/15' :
                            status.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15' :
                            'bg-red-500/10 text-red-300 border border-red-500/15'
                        }`}>
                            {status.type === 'loading' && <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>}
                            {status.type === 'success' && <CheckIcon className="w-3.5 h-3.5" />}
                            <span>{status.message}</span>
                        </div>
                    )}

                    {/* User Profile Form fields */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">نام و نام خانوادگی</label>
                            <input 
                                disabled 
                                type="text" 
                                value={profile?.full_name || "کاربر خوش‌سلیقه هکسر"} 
                                className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-400 cursor-not-allowed font-medium" 
                            />
                        </div>
                    </div>

                    <div className="h-px bg-neutral-900 my-2"></div>

                    {/* Styled Settings Placeholders */}
                    <div className="space-y-1 font-sans">
                        <button 
                            type="button"
                            onClick={() => setIsTicketModalOpen(true)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900/50 transition-all group cursor-pointer active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                    <BotIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs text-neutral-300 font-bold">پشتیبانی و ارسال تیکت</span>
                            </div>
                        </button>
                        <button disabled className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900/50 transition-all group cursor-not-allowed opacity-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                    <BellIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs text-neutral-300 font-bold">مدیریت هشدارهای هوشمند</span>
                            </div>
                        </button>
                        <button disabled className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900/50 transition-all group cursor-not-allowed opacity-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                                    <MoonIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs text-neutral-300 font-bold">ویژوال و تم لوکس سیاه</span>
                            </div>
                        </button>
                    </div>

                    <div className="h-px bg-neutral-900 my-2"></div>

                    {/* Luxury backup actions */}
                    <div className="grid grid-cols-2 gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept=".json" 
                            className="hidden" 
                        />
                        <button 
                            onClick={handleExport}
                            disabled={status.type === 'loading'}
                            className="flex items-center justify-center gap-2 p-3 bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all border border-neutral-800 group disabled:opacity-50 active:scale-95"
                        >
                            <DownloadIcon className="w-4 h-4 text-[#00d2ff] group-hover:translate-y-[1px] transition-transform" />
                            <span className="text-[11px] font-bold text-neutral-300">پشتیبان</span>
                        </button>
                        <button 
                            onClick={handleImportClick}
                            disabled={status.type === 'loading'}
                            className="flex items-center justify-center gap-2 p-3 bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all border border-neutral-800 group disabled:opacity-50 active:scale-95"
                        >
                            <UploadIcon className="w-4 h-4 text-emerald-400 group-hover:-translate-y-[1px] transition-transform" />
                            <span className="text-[11px] font-bold text-neutral-300">بازگردانی</span>
                        </button>
                    </div>

                    {/* Disconnect luxury button */}
                    <button 
                        onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 p-3 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/25 transition-all font-black text-xs uppercase"
                    >
                        <LogOutIcon className="w-3.5 h-3.5" />
                        <span>خروج لوکس از حساب کاربری</span>
                    </button>
                    
                </div>
            </div>
            
            <SubscriptionModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} />
            <SupportTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} />
        </div>
    );
}

export default ProfileModal;
