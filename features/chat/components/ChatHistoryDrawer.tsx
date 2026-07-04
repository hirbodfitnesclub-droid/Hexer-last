import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { formatPersianDate } from '../../../utils/dateUtils';
import { BotIcon, XIcon, CalendarIcon, CheckIcon } from '../../../components/icons';
import { ChatSession } from '../../../types';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (session: ChatSession) => void;
  selectedSessionId: string | null;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  isOpen,
  onClose,
  onSelectSession,
  selectedSessionId
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchSessions = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.rpc('get_chat_sessions', { p_limit: 30 });
          if (error) throw error;
          setSessions(data || []);
        } catch (err) {
          console.error('Error fetching chat sessions:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchSessions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 dark:bg-black/70 backdrop-blur-md transition-opacity">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-[var(--bg-card)] border-t border-[var(--border-subtle)] rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] z-10 transition-all duration-300">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center sticky top-0 bg-[var(--bg-card)] z-20 rounded-t-3xl">
          <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-primary-text" />
            تاریخچه گفتگوهای این ماه
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-black/5 dark:bg-white/5 hover:bg-[var(--nav-hover-bg)] rounded-full transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] py-10 text-xs">
              گفتگویی یافت نشد. اولین گفتگوی خود را همین امروز شروع کنید!
            </div>
          ) : (
            <div className="space-y-1.5">
              {sessions.map((session) => {
                const isActive = selectedSessionId === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-right transition-all ${
                      isActive
                        ? 'bg-primary/10 border-primary text-[var(--text-main)] font-bold'
                        : 'glass-card border-subtle text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20 text-primary-text' : 'glass-card border-subtle text-[var(--text-muted)]'}`}>
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">
                          گفتگوی {formatPersianDate(session.session_date)}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] opacity-75 mt-0.5">
                          تاریخ میلادی: {session.session_date}
                        </p>
                      </div>
                    </div>
                    {isActive && <CheckIcon className="w-4 h-4 text-primary-text" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="safe-spacer-bottom" />
        </div>
      </div>
    </div>
  );
};
