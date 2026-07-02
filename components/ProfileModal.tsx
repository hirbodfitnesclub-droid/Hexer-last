import React, { useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { UserIcon, XIcon, ShieldIcon, BellIcon, MoonIcon, SunIcon, LogOutIcon, DownloadIcon, UploadIcon, CheckIcon, BotIcon } from './icons';
import { exportUserData, importUserData } from '../services/backupService';
import { requestNotificationPermission, subscribeToPush, saveSubscription } from '../services/reminderService';
import { motion, AnimatePresence } from 'motion/react';
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
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    const handleToggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('hexer-theme', isDark ? 'dark' : 'light');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#121212' : '#F4F5F7');
        setIsDarkTheme(isDark);
    };

    // --- Notification States for Task H11 ---
    const [permissionState, setPermissionState] = useState<NotificationPermission>(() => 
        typeof window !== 'undefined' && 'Notification' in window 
            ? Notification.permission 
            : 'default'
    );
    const [showIosGuide, setShowIosGuide] = useState(false);

    const handleToggleNotification = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setStatus({ type: 'error', message: 'مرورگر شما از نوتیفیکیشن پشتیبانی نمی‌کند.' });
            return;
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

        if (isIOS && !isStandalone) {
            setShowIosGuide(prev => !prev);
            return;
        }

        if (Notification.permission === 'granted') {
            setStatus({ type: 'success', message: 'یادآورهای هوشمند هم‌اکنون برای شما فعال هستند.' });
            return;
        }

        if (Notification.permission === 'denied') {
            setStatus({ type: 'error', message: 'دسترسی در مرورگر مسدود شده است، از تنظیمات مرورگر باز کنید.' });
            return;
        }

        setStatus({ type: 'loading', message: 'در حال درخواست مجوز نوتیفیکیشن...' });
        try {
            const granted = await requestNotificationPermission();
            setPermissionState(Notification.permission);
            
            if (!granted) {
                setStatus({ type: 'error', message: 'مجوز نوتیفیکیشن صادر نشد.' });
                return;
            }

            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                console.warn('[Push] VITE_VAPID_PUBLIC_KEY is not defined.');
                setStatus({ type: 'success', message: 'مجوز صادر شد. (کلید عمومی پیکربندی نشده است)' });
                return;
            }

            setStatus({ type: 'loading', message: 'در حال ثبت اشتراک در سرور... ⏳' });
            const sub = await subscribeToPush(vapidKey);
            if (sub) {
                await saveSubscription(sub);
                setStatus({ type: 'success', message: 'فعال‌سازی با موفقیت انجام شد!' });
                localStorage.setItem('hexer-notification-prompt-dismissed', 'true');
            } else {
                setStatus({ type: 'success', message: 'مجوز صادر شد اما ثبت اشتراک در این مرورگر مقدور نیست.' });
            }
        } catch (error: any) {
            console.error('[Notification Setup Error]', error);
            setStatus({ type: 'error', message: error.message || 'خطا در فعال‌سازی نوتیفیکیشن' });
        }
    };

    if (!isOpen) return null;

    const displayName = (profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim();
    const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : null;

    const handleExport = async () => {
        setStatus({ type: 'loading', message: 'در حال بکاپگیری از اطلاعاتت... ⏳' });
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
            className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[90] p-0 sm:p-4 transition-all duration-300 transition-opacity duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--bg-card)] border-[var(--border-subtle)] sm:border rounded-t-3xl sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] w-full sm:max-w-sm flex flex-col h-[100dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden transform transition-all relative"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Visual Ambient Top Banner */}
                <div className="relative bg-gradient-to-br from-black/40 via-black/10 to-transparent p-6 pt-10 text-center flex-shrink-0 border-b border-[var(--border-subtle)]">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] bg-black/10 hover:bg-black/20 rounded-full transition-all border border-[var(--border-subtle)]"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    {/* Luxurious Avatar Container */}
                    <div className="w-20 h-20 mx-auto bg-[var(--bg-card)] rounded-full flex items-center justify-center border-4 border-[var(--border-subtle)] shadow-xl mb-3 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-primary/10 group-hover:opacity-30 transition-opacity duration-300"></div>
                        <span className="text-2xl font-black text-[var(--text-main)] relative z-10 font-mono tracking-wider">
                            {avatarLetter || <UserIcon className="w-8 h-8"/>}
                        </span>
                    </div>

                    <h3 className="text-[var(--text-main)] font-black text-base truncate px-4 font-mono">{user?.email || user?.phone || 'کاربر مهمان'}</h3>
                    
                    {/* Badge upgraded to premium glass pill */}
                    <button 
                        onClick={() => setIsSubModalOpen(true)}
                        className="mt-2 px-3 py-1 bg-primary text-[var(--text-on-primary)] hover:bg-[var(--color-primary-hover)] active:scale-95 transition-all rounded-full text-[10px] font-black shadow-md border-none"
                    >
                        {getPlanBadgeText()}
                    </button>
                </div>

                {/* Body details list */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    
                    {/* Status Feedback banner */}
                    {status.type && (
                        <div className={`p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 transition-opacity duration-300 ${
                            status.type === 'loading' ? 'bg-primary/10 text-primary border border-primary/20' :
                            status.type === 'success' ? 'bg-success/10 text-success border border-success/20' :
                            'bg-error/10 text-error border border-error/20'
                        }`}>
                            {status.type === 'loading' && <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>}
                            {status.type === 'success' && <CheckIcon className="w-3.5 h-3.5" />}
                            <span>{status.message}</span>
                        </div>
                    )}

                    {/* User Profile Form fields */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">نام و نام خانوادگی</label>
                            <input 
                                disabled 
                                type="text" 
                                value={profile?.full_name || "کاربر عزیز هکسر ✌️"} 
                                className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-muted)] cursor-not-allowed font-medium" 
                            />
                        </div>
                    </div>

                    <div className="h-px bg-[var(--border-subtle)] my-2"></div>

                    {/* Styled Settings Placeholders */}
                    <div className="space-y-1 font-sans">
                        <button 
                            type="button"
                            onClick={() => setIsTicketModalOpen(true)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--nav-hover-bg)] transition-all group cursor-pointer active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <BotIcon className="w-4 h-4" />
                                </div>
                                <span className="text-xs text-[var(--text-main)] font-bold">پشتیبانی و ارسال تیکت</span>
                            </div>
                        </button>
                        {/* مدیریت نوتیفیکیشن‌ها - تسک H11 */}
                        <div className="space-y-2">
                            <button 
                                type="button"
                                onClick={handleToggleNotification}
                                disabled={permissionState === 'denied'}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group active:scale-[0.98] ${
                                    permissionState === 'denied' 
                                        ? 'bg-black/5 dark:bg-white/5 opacity-50 cursor-not-allowed' 
                                        : 'hover:bg-[var(--nav-hover-bg)] cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                        permissionState === 'granted' 
                                            ? 'bg-success/10 text-success' 
                                            : permissionState === 'denied'
                                            ? 'bg-error/10 text-error'
                                            : 'bg-primary/10 text-primary'
                                    }`}>
                                        <BellIcon className="w-4 h-4" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-[var(--text-main)] font-semibold">
                                            {permissionState === 'granted' ? 'یادآورهای فعال' : 'روشن کردن یادآورها'}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-medium">
                                            {permissionState === 'granted' 
                                                ? 'نوتیفیکیشن هوشمند فعال است' 
                                                : permissionState === 'denied'
                                                ? 'دسترسی در مرورگر مسدود شده است'
                                                : 'دریافت یادآورهای هوشمند کارها'}
                                        </div>
                                    </div>
                                </div>
                                {permissionState === 'granted' && (
                                    <span className="text-[9px] bg-success/10 text-success px-2.5 py-0.5 rounded-full font-bold">فعال</span>
                                )}
                                {permissionState === 'denied' && (
                                    <span className="text-[9px] bg-error/10 text-error px-2.5 py-0.5 rounded-full font-bold">مسدود</span>
                                )}
                            </button>

                            {/* iOS installation walkthrough guide */}
                            <AnimatePresence>
                                {showIosGuide && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2.5 overflow-hidden text-right"
                                    >
                                        <div className="text-xs font-black text-primary flex items-center gap-2">
                                            <BellIcon className="w-3.5 h-3.5 inline" />
                                            <span>پیش‌نیاز نوتیفیکیشن در آیفون (iOS)</span>
                                        </div>
                                        <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                                            به دلیل تمایز سیستم‌عامل iOS، لطفاً جهت دریافت هشدارها ابتدا برنامه را به صفحه اصلی خود اضافه کنید:
                                        </p>
                                        <ol className="list-decimal list-inside text-[10px] text-[var(--text-main)] space-y-1.5 pr-1 font-medium leading-relaxed">
                                            <li>
                                                دکمه‌ی اشتراک‌گذاری پایین سافاری (<span className="text-primary font-semibold">Share</span>) را کلیک کنید.
                                            </li>
                                            <li>
                                                اسکرول کنید و گزینه‌ی <span className="text-primary font-semibold">«افزودن به صفحه اصلی (Add to Home Screen)»</span> را لمس کنید.
                                            </li>
                                            <li>
                                                اپلیکیشن را از روی صفحه اصلی جدید باز کرده و مجدداً برای فعال‌سازی در این بخش تلاش کنید.
                                            </li>
                                        </ol>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <button 
                            type="button"
                            onClick={handleToggleTheme}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--nav-hover-bg)] transition-all group cursor-pointer active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-colors duration-300 ${isDarkTheme ? 'bg-primary/10 text-primary' : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)]'}`}>
                                    {isDarkTheme ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-[var(--text-main)] font-semibold">تِم هکسر</div>
                                    <div className="text-[10px] text-[var(--text-muted)] font-medium">پوسته روشن یا تاریک</div>
                                </div>
                            </div>
                            {/* Toggle Switch Pill */}
                            <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isDarkTheme ? 'bg-primary' : 'bg-[var(--border-subtle)]'}`}>
                                <div className={`absolute top-0.5 bottom-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 ${isDarkTheme ? 'left-[18px]' : 'left-0.5'}`} />
                            </div>
                        </button>
                    </div>

                    <div className="h-px bg-[var(--border-subtle)] my-2"></div>

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
                            className="flex items-center justify-center gap-2 p-3 bg-black/5 dark:bg-white/5 hover:bg-[var(--nav-hover-bg)] rounded-xl transition-all border border-[var(--border-subtle)] group disabled:opacity-50 active:scale-95"
                        >
                            <DownloadIcon className="w-4 h-4 text-primary group-hover:translate-y-[1px] transition-transform" />
                            <span className="text-[11px] font-bold text-[var(--text-main)]">پشتیبان</span>
                        </button>
                        <button 
                            onClick={handleImportClick}
                            disabled={status.type === 'loading'}
                            className="flex items-center justify-center gap-2 p-3 bg-black/5 dark:bg-white/5 hover:bg-[var(--nav-hover-bg)] rounded-xl transition-all border border-[var(--border-subtle)] group disabled:opacity-50 active:scale-95"
                        >
                            <UploadIcon className="w-4 h-4 text-success group-hover:-translate-y-[1px] transition-transform" />
                            <span className="text-[11px] font-bold text-[var(--text-main)]">بازگردانی</span>
                        </button>
                    </div>

                    {/* Disconnect luxury button */}
                    <button 
                        onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 p-3 mt-4 bg-error/10 border border-error/20 rounded-xl text-error hover:bg-error/25 transition-all font-black text-xs uppercase"
                    >
                        <LogOutIcon className="w-3.5 h-3.5" />
                        <span>خروج از حساب</span>
                    </button>
                    
                    <div className="safe-spacer-bottom" />
                </div>
            </div>
            
            <SubscriptionModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} />
            <SupportTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} />
        </div>
    );
}

export default ProfileModal;
