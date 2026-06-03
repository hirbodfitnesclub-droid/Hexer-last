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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-gray-950 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] z-10 animate-fade-in-up">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-gray-950 z-20 rounded-t-3xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-sky-400" />
            تاریخچه گفتگوهای این ماه
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-400"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-500 py-10 text-xs">
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
                        ? 'bg-sky-500/10 border-sky-500/30 text-white font-bold'
                        : 'bg-gray-900/60 border-white/5 hover:bg-gray-800 hover:border-white/10 text-gray-350'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-gray-400'}`}>
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">
                          گفتگوی {formatPersianDate(session.session_date)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          تاریخ میلادی: {session.session_date}
                        </p>
                      </div>
                    </div>
                    {isActive && <CheckIcon className="w-4 h-4 text-sky-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
