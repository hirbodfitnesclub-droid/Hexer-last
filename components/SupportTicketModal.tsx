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
                className="bg-neutral-950 border border-neutral-800 rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)] w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden transform transition-all relative"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Visual Ambient Top Banner */}
                <div className="relative bg-gradient-to-br from-indigo-950/60 via-slate-900 to-neutral-950 p-5 pt-8 text-center flex-shrink-0 border-b border-neutral-900">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900/60 hover:bg-neutral-800 rounded-full transition-all border border-neutral-800/45"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    <h3 className="text-white font-black text-base font-sans mt-2">پشتیبانی هکسر</h3>
                    <p className="text-[11px] text-neutral-400 mt-1 font-sans">پیام شما به صورت آنی به تیم پشتیبانی تلگرام ارسال می‌شود.</p>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Status feedback */}
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

                    {/* Support Ticket Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">موضوع تیکت</label>
                            <input 
                                type="text"
                                placeholder="مثلاً: سوال در مورد ارتقای اشتراک پلاس"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                disabled={status.type === 'loading'}
                                className="w-full bg-neutral-900/40 border border-neutral-800 focus:border-indigo-500/50 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none transition-colors font-medium focus:ring-1 focus:ring-indigo-500/20" 
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">توضیحات تیکت</label>
                            <textarea 
                                rows={4}
                                placeholder="لطفاً جزئیات مشکل یا درخواست خود را وارد کنید..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                disabled={status.type === 'loading'}
                                className="w-full bg-neutral-900/40 border border-neutral-800 focus:border-indigo-500/50 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none transition-colors font-medium resize-none focus:ring-1 focus:ring-indigo-500/20" 
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {status.type === 'loading' ? (
                                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                            ) : (
                                <>
                                    <SendIcon className="w-3.5 h-3.5" />
                                    <span>ارسال تیکت پشتیبانی</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="h-px bg-neutral-900 my-2"></div>

                    {/* Direct Telegram Support Button */}
                    <a
                        href="https://t.me/hexer_support"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-11 flex items-center justify-center gap-2 bg-sky-950/30 border border-sky-800/30 text-sky-400 hover:bg-sky-950/50 rounded-xl text-xs font-bold transition-all"
                    >
                        <BotIcon className="w-4 h-4 text-sky-400" />
                        <span>گفتگو مستقیم در تلگرام</span>
                    </a>

                    {/* Saved Tickets Section */}
                    {tickets.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">تاریخچه تیکت‌های شما</h4>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                {tickets.map(t => (
                                    <div key={t.id} className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-xl flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-neutral-200 truncate max-w-[180px]">{t.subject}</span>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                                                t.status === 'open' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                            }`}>
                                                {t.status === 'open' ? 'باز' : 'بسته شده'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-neutral-400 line-clamp-2">{t.message}</p>
                                        <span className="text-[8px] text-neutral-600 font-mono self-end">
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
