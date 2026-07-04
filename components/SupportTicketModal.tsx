import React, { useState, useEffect } from 'react';
import { XIcon, SendIcon, CheckIcon, BotIcon } from './icons';
import { submitTicket, getMyTickets, SupportTicket } from '../services/ticketService';

interface SupportTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ isOpen, onClose }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string }>({ type: null, message: '' });
    const [tickets, setTickets] = useState<SupportTicket[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadTickets();
        }
    }, [isOpen]);

    const loadTickets = async () => {
        try {
            const data = await getMyTickets();
            setTickets(data);
        } catch (err) {
            console.error('Error fetching older tickets:', err);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!subject.trim() || !message.trim()) {
            setStatus({ type: 'error', message: 'لطفاً تمامی فیلدها را به طور کامل پر کنید.' });
            return;
        }

        setStatus({ type: 'loading', message: 'در حال ارسال تیکت پشتیبانی... ✉️' });

        try {
            await submitTicket(subject.trim(), message.trim());
            setStatus({ type: 'success', message: 'تیکت شما با موفقیت ثبت شد؛ پاسخ آن به ایمیل شما ارسال خواهد شد.' });
            setSubject('');
            setMessage('');
            loadTickets();
        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: error.message || 'خطا در ارسال تیکت پشتیبانی. لطفاً پس از چند لحظه مجدداً تلاش کنید.' });
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 transition-all duration-300 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)] w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden transform transition-all relative"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Visual Ambient Top Banner */}
                <div className="relative bg-gradient-to-br from-primary/10 via-[var(--bg-card)] to-[var(--bg-card)] p-5 pt-8 text-center flex-shrink-0 border-b border-[var(--border-subtle)]">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)]/60 hover:bg-[var(--nav-hover-bg)] rounded-full transition-all border border-[var(--border-subtle)]"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    <h3 className="text-[var(--text-main)] font-black text-base font-sans mt-2">پشتیبانی هکسر</h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 font-sans">پیام شما به صورت آنی به تیم پشتیبانی تلگرام ارسال می‌شود.</p>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Status feedback */}
                    {status.type && (
                        <div className={`p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 animate-fade-in ${
                            status.type === 'loading' ? 'bg-primary/10 text-primary-text border border-primary/15' :
                            status.type === 'success' ? 'bg-success/10 text-success border border-success/15' :
                            'bg-error/10 text-error border border-error/15'
                        }`}>
                            {status.type === 'loading' && <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>}
                            {status.type === 'success' && <CheckIcon className="w-3.5 h-3.5" />}
                            <span>{status.message}</span>
                        </div>
                    )}

                    {/* Support Ticket Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">موضوع تیکت</label>
                            <input 
                                type="text"
                                placeholder="مثلاً: سوال در مورد ارتقای اشتراک پلاس"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                disabled={status.type === 'loading'}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] focus:border-primary/50 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] outline-none transition-colors font-medium focus:ring-1 focus:ring-primary/20" 
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">توضیحات تیکت</label>
                            <textarea 
                                rows={4}
                                placeholder="لطفاً جزئیات مشکل یا درخواست خود را وارد کنید..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                disabled={status.type === 'loading'}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] focus:border-primary/50 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] outline-none transition-colors font-medium resize-none focus:ring-1 focus:ring-primary/20" 
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="w-full h-11 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-[var(--text-on-primary)] rounded-xl text-xs font-black transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {status.type === 'loading' ? (
                                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
                            ) : (
                                <>
                                    <SendIcon className="w-3.5 h-3.5" />
                                    <span>ارسال تیکت پشتیبانی</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="h-px bg-[var(--border-subtle)] my-2"></div>

                    {/* Direct Telegram Support Button */}
                    <a
                        href="https://t.me/hexer_support"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-11 flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 text-primary-text hover:bg-primary/15 rounded-xl text-xs font-bold transition-all"
                    >
                        <BotIcon className="w-4 h-4 text-primary-text" />
                        <span>گفتگو مستقیم در تلگرام</span>
                    </a>

                    {/* Saved Tickets Section */}
                    {tickets.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">تاریخچه تیکت‌های شما</h4>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                {tickets.map(t => (
                                    <div key={t.id} className="p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-[var(--text-main)] truncate max-w-[180px]">{t.subject}</span>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                                                t.status === 'open' ? 'bg-primary/10 text-primary-text border border-primary/20' : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border border-[var(--border-subtle)]'
                                            }`}>
                                                {t.status === 'open' ? 'باز' : 'بسته شده'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">{t.message}</p>
                                        <span className="text-[8px] text-[var(--text-muted)] font-mono self-end">
                                            {t.created_at ? new Date(t.created_at).toLocaleDateString('fa-IR') : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportTicketModal;
