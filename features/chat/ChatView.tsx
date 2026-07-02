import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { ChatMessage, ChatMode, Citation, Task, Note, ActionResult, Project, ChatSession, ExtractionProposal, Page } from '../../types';
import { BotIcon, UserIcon, SendIcon, SparklesIcon, TargetIcon, LightbulbIcon, PencilIcon, NotebookIcon, ListChecksIcon, LinkIcon, CheckIcon, BriefcaseIcon, FlameIcon, PaperclipIcon, MicrophoneIcon, CalendarIcon, PlusIcon, XIcon, TrashIcon } from '../../components/icons';
import { uploadChatMedia } from '../../services/mediaService';
import { sendChatMessage, extractFromMedia } from '../../services/geminiService';
import { compressImage, dataURLtoBlob } from '../../utils/imageUtils';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { getTehranDateString } from '../../utils/dateUtils';
import { linkTaskNote } from '../../services/linkService';
import { peekPendingDraft, clearPendingDraft } from './composerBridge';

// Helper to sanitize chat history to prevent leak of UUID database keys to Gemini model
const sanitizeHistoryMessage = (text: string): string => {
  if (!text) return "";
  // 1. Remove bracketed UUID expressions containing 'شناسه' (e.g. [شناسه تسک: ...])
  let sanitized = text.replace(/\[[^\]]*شناسه[^\]]*\]/g, "");
  // 2. Remove case-insensitive technical bracket tags [TASK], [NOTE], [PROJECT]
  sanitized = sanitized.replace(/\[(TASK|NOTE|PROJECT)\]/ig, "");
  // 3. Remove raw UUIDs to avoid any stray leaks
  sanitized = sanitized.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, "");
  return sanitized;
};

// Subcomponents
import { ModeChip } from './components/ModeChip';
import { CitationCard } from './components/CitationCard';
import { ActionResultCard } from './components/ActionResultCard';
import { ProposalCard } from './components/ProposalCard';
import { ChatHistoryDrawer } from './components/ChatHistoryDrawer';
import { MoreCitationsModal } from './components/MoreCitationsModal';
import { UsageMeter } from '../billing/components/UsageMeter';

interface ChatViewProps {
  onEditTask: (task: Task) => void;
  onEditNote: (note: Note) => void;
  onEditProject: (project: Project) => void;
}

const suggestions = [
  { text: "برنامه امروزم چیه؟", icon: <CalendarIcon className="w-4 h-4 text-primary" /> },
  { text: "یک تسک جدید بساز برای...", icon: <ListChecksIcon className="w-4 h-4 text-primary" /> },
  { text: "ایده‌های قبلیم رو مرور کن", icon: <LightbulbIcon className="w-4 h-4 text-primary" /> },
];

const ChatView: React.FC<ChatViewProps> = ({ onEditTask, onEditNote, onEditProject }) => {
  const { user } = useAuth();
  const {
    tasks,
    notes,
    projects,
    addNotification,
    setCurrentPage,
    injectAIProposalResult,
    addTask,
    addNote,
    showPaywall,
    setShowPaywall,
    setPaywallMessage
  } = useData();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('auto');
  
  // Search Semantic Filter States (Task I5)
  const [filterType, setFilterType] = useState<'all' | 'task' | 'note' | 'project'>('all');
  const [filterTime, setFilterTime] = useState<'all' | 'today' | 'last_week'>('all');

  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode);
    if (newMode !== 'memory') {
      setFilterType('all');
      setFilterTime('all');
    }
  };
  
  // Persistent Sessions & History state
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Proposal support state
  const [activeProposals, setActiveProposals] = useState<ExtractionProposal[]>([]);

  // More citations modal state
  const [selectedForMoreCitations, setSelectedForMoreCitations] = useState<Citation[]>([]);
  const [isMoreCitationsOpen, setIsMoreCitationsOpen] = useState(false);

  const handleShowMoreCitations = (citations: Citation[]) => {
    setSelectedForMoreCitations(citations);
    setIsMoreCitationsOpen(true);
  };

  // Hook up sound recorder
  const {
    isRecording,
    recordedAudio,
    setRecordedAudio,
    cancelRecording,
    handleMicClick
  } = useMediaRecorder();

  // Image Upload states
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftDispatchedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load today's active session on mount
  const loadActiveSession = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Clean token refresh sequentially before making subsequent API/RPC calls
      await supabase.auth.getSession();
      
      const { data: sess, error: sessErr } = await supabase.rpc('get_or_create_today_session');
      if (sessErr) throw sessErr;
      
      if (sess && sess.length > 0) {
        const session = sess[0] as ChatSession;
        setActiveSession(session);
        setIsReadOnly(false);

        // Fetch session messages
        const { data: msgs, error: msgsErr } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });
        
        if (msgsErr) throw msgsErr;

        if (msgs && msgs.length > 0) {
          const mapped: ChatMessage[] = msgs.map(m => ({
            id: m.id,
            sender: m.sender as 'user' | 'ai',
            text: m.text,
            mode: m.mode as ChatMode,
            citations: m.citations || [],
            actionResults: m.action_results || []
          }));
          setMessages(mapped);
        } else {
          setMessages([
            { id: 'initial', sender: 'ai', text: 'سلام! خوش آمدید. چطور می‌توانم در مدیریت کارهایتان به شما کمک کنم؟' }
          ]);
        }
      }
    } catch (err) {
      console.error('Error loading active session:', err);
      addNotification('خطا در بارگذاری اطلاعات چت امروز.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveSession();
  }, [user]);

  // Load old session in read-only mode
  const handleSelectSession = async (session: ChatSession) => {
    setIsLoading(true);
    try {
      setActiveSession(session);
      const todayStr = getTehranDateString(new Date());
      const isToday = session.session_date === todayStr;
      setIsReadOnly(!isToday);

      const { data: msgs, error: msgsErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });
      
      if (msgsErr) throw msgsErr;

      if (msgs && msgs.length > 0) {
        const mapped: ChatMessage[] = msgs.map(m => ({
          id: m.id,
          sender: m.sender as 'user' | 'ai',
          text: m.text,
          mode: m.mode as ChatMode,
          citations: m.citations || [],
          actionResults: m.action_results || []
        }));
        setMessages(mapped);
      } else {
        setMessages([]);
      }
      setActiveProposals([]); // Clear any editing proposals
    } catch (err) {
      console.error('Error loading selected session:', err);
      addNotification('خطا در بارگذاری اطلاعات چت قدیمی.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Image Handling ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        addNotification('لطفا فقط فایل تصویری انتخاب کنید.', 'error');
        return;
      }

      try {
        const compressed = await compressImage(file);
        setSelectedImagePreview(compressed);
        setSelectedImageFile(dataURLtoBlob(compressed));
        setRecordedAudio(null); // Simple single attachment logic
      } catch (err) {
        console.error("Image processing failed", err);
        addNotification("خطا در پردازش تصویر.", "error");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = () => {
    setSelectedImagePreview(null);
    setSelectedImageFile(null);
  };

  // --- Send Message ---
  const handleSendMessage = async (
    textOverride?: string,
    mediaOverride?: { imageFile?: Blob | null; audioFile?: Blob | null }
  ) => {
    const textToSend = textOverride || input;
    if (isReadOnly) return;

    const audioToSend = mediaOverride?.audioFile ?? recordedAudio;
    const imageToSend = mediaOverride?.imageFile ?? selectedImageFile;

    if ((!textToSend.trim() && !audioToSend && !imageToSend) || isLoading) return;

    if (!activeSession) {
      addNotification('گفتگو آماده نیست.', 'error');
      return;
    }

    // Append Filter Tokens in Memory Mode (Task I5)
    let textWithFilters = textToSend;
    if (mode === 'memory' && textToSend.trim() && !textOverride) {
      if (filterType === 'task') {
        textWithFilters += ' نوع:کار';
      } else if (filterType === 'note') {
        textWithFilters += ' نوع:یادداشت';
      } else if (filterType === 'project') {
        textWithFilters += ' نوع:پروژه';
      }

      if (filterTime === 'today') {
        textWithFilters += ' تاریخ:امروز';
      } else if (filterTime === 'last_week') {
        textWithFilters += ' تاریخ:هفته گذشته';
      }
    }

    const messageText = textWithFilters || (audioToSend ? '[پیام صوتی]' : '[تصویر]');
    
    setIsLoading(true);
    setInput('');

    let audioPathVal: string | null = null;
    let imagePathVal: string | null = null;

    try {
      // 1. Save user message to database first to maintain persistence integrity
      const { data: dbMsg, error: dbErr } = await supabase
        .from('chat_messages')
        .insert({
          session_id: activeSession.id,
          user_id: user.id,
          sender: 'user',
          text: messageText,
          mode: mode,
          citations: [],
          action_results: []
        })
        .select()
        .single();
      
      if (dbErr) throw dbErr;

      clearPendingDraft();

      const userChatMessage: ChatMessage = {
        id: dbMsg.id,
        sender: 'user',
        text: dbMsg.text,
        mode: dbMsg.mode as ChatMode,
        citations: [],
        actionResults: []
      };

      setMessages(prev => [...prev, userChatMessage]);

      // 2. Upload attachments
      if (audioToSend) {
        audioPathVal = await uploadChatMedia(audioToSend, 'webm');
      }

      if (imageToSend) {
        imagePathVal = await uploadChatMedia(imageToSend, 'jpeg');
      }

      // Cleanup local fields
      setSelectedImagePreview(null);
      setSelectedImageFile(null);
      setRecordedAudio(null);

      // 3. Make Gemini Request
      let data: any;
      try {
        if (audioPathVal || imagePathVal) {
          data = await extractFromMedia(audioPathVal || undefined, imagePathVal || undefined, textWithFilters);
        } else {
          // Sanitize chat history messages beforehand to prevent leakage of old IDs and patterns
          const sanitizedHistory = messages.map(msg => ({
            ...msg,
            text: msg.sender === 'ai' ? sanitizeHistoryMessage(msg.text) : msg.text
          }));
          data = await sendChatMessage(textWithFilters, sanitizedHistory, mode);
        }
      } catch (geminiErr: any) {
        if (geminiErr.message === '402') {
          setShowPaywall(true);
          setPaywallMessage('سقف مصرف دوره آزمایشی یا سهمیه ماهانه هوش مصنوعی شما تمام شده است. لطفاً جهت فعال‌سازی حساب خود اشتراک تهیه فرمایید.');
          throw new Error('402');
        }
        throw geminiErr;
      }

      // 4. Handle Proposals (if voice/image mode produced them, they go to UI, not DB directly)
      if (data.proposals && Array.isArray(data.proposals) && data.proposals.length > 0) {
        const enriched: ExtractionProposal[] = data.proposals.map((p: any, idx: number) => ({
          id: `proposal-${Date.now()}-${idx}`,
          kind: p.kind,
          draft: p.draft,
          confidence: p.confidence || 0.8,
          status: 'pending'
        }));
        setActiveProposals(prev => [...prev, ...enriched]);
      }

      // 5. Save AI response to DB
      const { data: dbAiMsg, error: dbAiErr } = await supabase
        .from('chat_messages')
        .insert({
          session_id: activeSession.id,
          user_id: user.id,
          sender: 'ai',
          text: data.reply || (data.proposals ? 'پیش‌نویس کارهای استخراج‌شده را برای شما در جعبه زیر قرار دادم. لطفاً بررسی و تأیید کنید:' : ''),
          mode: mode,
          citations: data.citations || [],
          action_results: data.actionResults || []
        })
        .select()
        .single();
      
      if (dbAiErr) throw dbAiErr;

      const aiChatMessage: ChatMessage = {
        id: dbAiMsg.id,
        sender: 'ai',
        text: dbAiMsg.text,
        mode: dbAiMsg.mode as ChatMode,
        citations: dbAiMsg.citations,
        actionResults: dbAiMsg.action_results
      };

      setMessages(prev => [...prev, aiChatMessage]);

      // Optimized/Atomic injection of created assets
      if (data.actionResults && Array.isArray(data.actionResults)) {
        data.actionResults.forEach((result: ActionResult) => {
          if (result.operation !== 'suggest_link') {
            injectAIProposalResult(result);
          }
        });
      }

    } catch (err: any) {
      console.error('Error sending message:', err);
      if (err.message === '402') {
        const paywallMessageAi: ChatMessage = {
          id: `paywall-err-${Date.now()}`,
          sender: 'ai',
          text: 'سقف مصرف سهمیه هوش مصنوعی شما تمام شده است. برای ادامه لطفا از طریق بخش مدیریت اشتراک، کاربری خود را ارتقا دهید.'
        };
        setMessages(prev => [...prev, paywallMessageAi]);
      } else {
        const generalErrorAi: ChatMessage = {
          id: `general-err-${Date.now()}`,
          sender: 'ai',
          text: 'متاسفانه مشکلی در پردازش درخواست پیش آمد. لطفاً دوباره تلاش کنید.'
        };
        setMessages(prev => [...prev, generalErrorAi]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSession || isReadOnly || isLoading || draftDispatchedRef.current) return;
    const draft = peekPendingDraft();
    if (draft && (draft.text?.trim() || draft.imageFile || draft.audioFile)) {
      draftDispatchedRef.current = true;
      handleSendMessage(draft.text || '', { imageFile: draft.imageFile, audioFile: draft.audioFile });
    }
  }, [activeSession, isReadOnly, isLoading]);

  const processAndSendAudio = async () => {
    if (!recordedAudio) return;
    handleSendMessage('[پیام صوتی]');
  };

  // --- Proposal Actions ---
  const handleUpdateProposal = (id: string, updated: Partial<ExtractionProposal['draft']>) => {
    setActiveProposals(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, draft: { ...p.draft, ...updated } };
      }
      return p;
    }));
  };

  const handleApproveProposal = async (id: string) => {
    const prop = activeProposals.find(p => p.id === id);
    if (!prop) return;

    try {
      if (prop.kind === 'task') {
        await addTask({
          title: prop.draft.title,
          description: prop.draft.description || null,
          priority: prop.draft.priority || 'medium',
          due_date: prop.draft.dueDate ? new Date(prop.draft.dueDate).toISOString() : null,
          project_id: prop.draft.project_id || null,
          tags: prop.draft.tags || []
        });
      } else if (prop.kind === 'note') {
        await addNote({
          title: prop.draft.title,
          content: prop.draft.content || null,
          project_id: prop.draft.project_id || null,
          tags: prop.draft.tags || []
        });
      }

      setActiveProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
      addNotification('پیشنهاد با موفقیت تایید و ایجاد شد.', 'success');
    } catch (err) {
      console.error('Error approving proposal:', err);
      addNotification('خطا در ذخیره‌سازی پیشنهاد.', 'error');
    }
  };

  const handleRejectProposal = (id: string) => {
    setActiveProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
    addNotification('پیشنهاد حذف شد.', 'success');
  };

  const handleApproveAll = async () => {
    const list = activeProposals.filter(p => p.status === 'pending');
    if (list.length === 0) return;

    let successfulCount = 0;
    for (const prop of list) {
      try {
        if (prop.kind === 'task') {
          await addTask({
            title: prop.draft.title,
            description: prop.draft.description || null,
            priority: prop.draft.priority || 'medium',
            due_date: prop.draft.dueDate ? new Date(prop.draft.dueDate).toISOString() : null,
            project_id: prop.draft.project_id || null,
            tags: prop.draft.tags || []
          });
        } else if (prop.kind === 'note') {
          await addNote({
            title: prop.draft.title,
            content: prop.draft.content || null,
            project_id: prop.draft.project_id || null,
            tags: prop.draft.tags || []
          });
        }
        successfulCount++;
      } catch (err) {
        console.error('Error approving bulk item:', err);
      }
    }

    setActiveProposals(prev => prev.map(p => p.status === 'pending' ? { ...p, status: 'approved' } : p));
    addNotification(`تعداد ${successfulCount} کار پیشنهادی با موفقیت تایید و ذخیره شدند.`, 'success');
  };

  // --- Smart Linker ---
  const [linkingTargetId, setLinkingTargetId] = useState<string | null>(null);
  const [selectedLinkNotes, setSelectedLinkNotes] = useState<{ [key: string]: string }>({});

  const handleApplyLink = async (actionId: string, itemId: string, targetType: 'task' | 'note') => {
    const selectedRelativeId = selectedLinkNotes[actionId];
    if (!selectedRelativeId) {
      addNotification('ابتدا آیتم مرتبط را برای اتصال انتخاب کنید.', 'error');
      return;
    }

    try {
      const taskId = targetType === 'task' ? itemId : selectedRelativeId;
      const noteId = targetType === 'note' ? itemId : selectedRelativeId;

      await linkTaskNote(taskId, noteId);
      addNotification('اتصال تسک و یادداشت با موفقیت برقرار شد.', 'success');
      setLinkingTargetId(actionId); // Mark as completed in visual UI
    } catch (err) {
      console.error('Failed to link items:', err);
      addNotification('متاسفانه ایجاد پیوند با خطا مواجه شد.', 'error');
    }
  };

  // --- Standard Event Handlers ---
  const handleCitationClick = (citation: Citation) => {
    if (citation.type === 'task') {
      const task = tasks.find(t => t.id === citation.id);
      if (task) onEditTask(task);
    } else if (citation.type === 'note') {
      const note = notes.find(n => n.id === citation.id);
      if (note) onEditNote(note);
    } else if (citation.type === 'project') {
      const project = projects.find(p => p.id === citation.id);
      if (project) onEditProject(project);
    }
  };

  const handleActionResultClick = (result: ActionResult) => {
    if (result.type === 'task') {
      onEditTask(result.data as Task);
    } else if (result.type === 'note') {
      onEditNote(result.data as Note);
    } else if (result.type === 'project') {
      onEditProject(result.data as Project);
    } else if (result.type === 'habit') {
      setCurrentPage(Page.Dashboard);
    }
  };

  return (
    <div className="flex flex-col h-full text-[var(--text-main)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col gap-3 backdrop-blur-xl sticky top-0 pt-safe z-10 w-full" style={{ background: 'var(--bg-app-glass)' }}>
        <div className="flex justify-between items-center w-full">
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <BotIcon className="w-6 h-6 text-primary" />
            دستیار هوشمند هکسر
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-xs bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              چت‌های این ماه
            </button>
            {isReadOnly && (
              <button
                onClick={loadActiveSession}
                className="text-xs bg-primary hover:bg-[var(--color-primary-hover)] text-[var(--text-on-primary)] font-bold px-3 py-1.5 rounded-lg transition-all"
              >
                بازگشت به چت امروز
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 w-full">
          <ModeChip mode="auto" currentMode={mode} label="خودکار" icon={<SparklesIcon className="w-3.5 h-3.5"/>} onClick={handleModeChange} />
          <ModeChip mode="action" currentMode={mode} label="دستور" icon={<TargetIcon className="w-3.5 h-3.5"/>} onClick={handleModeChange} />
          <ModeChip mode="memory" currentMode={mode} label="حافظه" icon={<LightbulbIcon className="w-3.5 h-3.5"/>} onClick={handleModeChange} />
        </div>

        {/* Compact AI Usage Quota Display */}
        <div className="pt-0.5 select-none w-full">
          <UsageMeter compact />
        </div>

        {/* Search Semantic Filter Toggles (Task I5) */}
        {mode === 'memory' && (
          <div className="flex flex-col gap-2 pt-1.5 border-t border-[var(--border-subtle)] w-full text-right" dir="rtl">
            {/* Filter Type Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] font-semibold ml-1 shrink-0">نوع فیلتر:</span>
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-primary text-[var(--text-on-primary)] border border-transparent font-semibold shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.15)]'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
                }`}
              >
                همه
              </button>
              <button
                onClick={() => setFilterType('task')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterType === 'task'
                    ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
                }`}
              >
                <ListChecksIcon className="w-2.5 h-2.5" />
                کارها
              </button>
              <button
                onClick={() => setFilterType('note')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterType === 'note'
                    ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
                }`}
              >
                <NotebookIcon className="w-2.5 h-2.5" />
                یادداشت‌ها
              </button>
              <button
                onClick={() => setFilterType('project')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterType === 'project'
                    ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
                }`}
              >
                <BriefcaseIcon className="w-2.5 h-2.5" />
                پروژه‌ها
              </button>
            </div>

            {/* Filter Time Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] font-semibold ml-1 shrink-0">بازه زمانی:</span>
              <button
                onClick={() => setFilterTime('all')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterTime === 'all'
                    ? 'bg-primary text-[var(--text-on-primary)] border border-transparent font-semibold shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.15)]'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
                }`}
              >
                همه زمان‌ها
              </button>
              <button
                onClick={() => setFilterTime('today')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterTime === 'today'
                    ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text(--text-main)]'
                }`}
              >
                <CalendarIcon className="w-2.5 h-2.5" />
                امروز
              </button>
              <button
                onClick={() => setFilterTime('last_week')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  filterTime === 'last_week'
                    ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                    : 'bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
                }`}
              >
                <CalendarIcon className="w-2.5 h-2.5" />
                هفته گذشته
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 1 && (
          <div className="flex flex-col items-center justify-center py-10 opacity-100 transition-opacity duration-300">
            <div className="w-20 h-20 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse"></div>
              <BotIcon className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">امروز چطور می‌تونم کمکت کنم؟</h3>
            <p className="text-[var(--text-muted)] text-sm mb-8 text-center max-w-xs">آماده‌ام بهت کمک کنم! متنت رو تایپ کن یا صدات رو بفرست 🎤</p>
            
            <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
              {suggestions.map((s, i) => (
                <button 
                  key={i}
                  disabled={isReadOnly}
                  onClick={() => handleSendMessage(s.text)}
                  className="flex items-center gap-3 p-3 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--nav-hover-bg)] transition-all text-right group disabled:opacity-50"
                >
                  <div className="p-2 bg-black/5 dark:bg-white/5 rounded-lg group-hover:bg-[var(--nav-hover-bg)] transition-colors">{s.icon}</div>
                  <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-main)] font-semibold">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Regular chats list */}
        {messages.slice(1).map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} transition-opacity duration-300`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-primary/20 text-primary border border-primary/30' : 'glass-card text-[var(--text-muted)]'}`}>
              {msg.sender === 'user' ? <UserIcon className="w-5 h-5 text-primary" /> : <BotIcon className="w-5 h-5 text-[var(--text-muted)]" />}
            </div>
            
            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-3.5 rounded-2xl text-sm leading-6 ${
                msg.sender === 'user' 
                  ? 'bg-lime text-[var(--text-on-primary)] rounded-tr-none text-right shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.15)]' 
                  : 'glass-card rounded-tl-none text-right text-[var(--text-main)]'
              }`} dir="rtl">
                {msg.text}
              </div>
              
              {/* Citations references */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="flex flex-col gap-2 mt-1 items-start">
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.slice(0, 5).map((citation, idx) => (
                      <CitationCard key={idx} citation={citation} onClick={handleCitationClick} />
                    ))}
                  </div>
                  {msg.citations.length > 5 && (
                    <button
                      onClick={() => handleShowMoreCitations(msg.citations)}
                      className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1.5 mt-1 transition-all bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-primary/30"
                      id={`view-more-${msg.id}`}
                    >
                      <PlusIcon className="w-3.5 h-3.5 text-primary" />
                      مشاهده نتایج مشابه بیشتر ({msg.citations.length - 5} مورد دیگر)
                    </button>
                  )}
                </div>
              )}

              {/* Action Results */}
              {msg.actionResults && msg.actionResults.length > 0 && (
                <div className="flex flex-col gap-2 w-full">
                  {msg.actionResults.map((result, idx) => {
                    const isSuggestedLink = result.operation === 'suggest_link';
                    const linkKey = `${msg.id}-${idx}`;
                    const linked = linkingTargetId === linkKey;

                    if (isSuggestedLink) {
                      return (
                        <div key={idx} className="mt-2 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] p-3.5 rounded-xl text-right w-full sm:w-auto min-w-[260px]" dir="rtl">
                          <p className="text-xs text-primary font-semibold mb-1 flex items-center gap-1.5">
                            <LinkIcon className="w-3.5 h-3.5" />
                            پیشنهاد پیوند معنایی هوشمند
                          </p>
                          <p className="text-sm font-bold text-[var(--text-main)] mb-2">{result.data.title}</p>
                          
                          {linked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">
                              <CheckIcon className="w-3.5 h-3.5" />
                              اتصال برپا شد
                            </span>
                          ) : (
                            <div className="space-y-3 mt-3">
                              <div>
                                <label className="text-[10px] text-[var(--text-muted)] block mb-1">
                                  اتصال این {result.type === 'task' ? 'کار' : 'یادداشت'} به:
                                </label>
                                <select
                                  value={selectedLinkNotes[linkKey] || ''}
                                  onChange={(e) => setSelectedLinkNotes(prev => ({ ...prev, [linkKey]: e.target.value }))}
                                  className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] rounded-lg p-2 focus:outline-none"
                                >
                                  <option value="">(انتخاب رقیب جهت اتصال)</option>
                                  {result.type === 'task' ? (
                                    notes.map(n => <option key={n.id} value={n.id}>یادداشت: {n.title}</option>)
                                  ) : (
                                    tasks.map(t => <option key={t.id} value={t.id}>کار: {t.title}</option>)
                                  )}
                                </select>
                              </div>
                              <button
                                onClick={() => handleApplyLink(linkKey, result.data.id, result.type as 'task' | 'note')}
                                className="text-xs bg-primary hover:bg-[var(--color-primary-hover)] font-bold px-3 py-1.5 rounded-lg text-[var(--text-on-primary)] transition-all flex items-center gap-1"
                              >
                                <CheckIcon className="w-3 h-3" />
                                ثبت اتصال دوطرفه
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <ActionResultCard key={idx} result={result} onClick={handleActionResultClick} />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Proposals Render (shows active unapproved/unrejected extracted entities) */}
        {activeProposals.length > 0 && (
          <ProposalCard
            proposals={activeProposals}
            projects={projects}
            onUpdateProposal={handleUpdateProposal}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            onApproveAll={handleApproveAll}
          />
        )}
        
        {/* Loading and Typing animation */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
              <BotIcon className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
            <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] p-3.5 rounded-2xl rounded-tr-none flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-primary/40 rounded-full animate-bounce"></div>
              <div className="w-2.5 h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input controls panel */}
      <div className="p-4 border-t border-[var(--border-subtle)] w-full text-right" dir="rtl">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileSelect}
        />

        {/* Image Attachment Preview bubble */}
        {selectedImagePreview && (
          <div className="mb-2 relative inline-block text-left">
            <img src={selectedImagePreview} alt="Selected Preview" className="h-20 w-auto rounded-lg border border-[var(--border-subtle)]" />
            <button 
              onClick={removeImage}
              className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Read-Only Banner */}
        {isReadOnly && (
          <div className="mb-3 p-2 bg-[var(--semantic-error-soft)] border border-red-500/20 text-[var(--semantic-error)] text-xs rounded-xl text-center font-semibold">
            این گفتگو به صورت آرشیو و فقط‌خواندنی است. برای چت جدید روی «بازگشت به چت امروز» کلیک کنید.
          </div>
        )}

        <div className={`relative flex items-center border transition-colors rounded-2xl p-1.5 ${
          isRecording ? 'border-error/50 bg-[var(--semantic-error-soft)]' : 'glass-card border-[var(--border-subtle)] focus-within:border-primary/50'
        }`}>
          {recordedAudio ? (
            // Recorded Audio confirmation bubble
            <div className="flex items-center gap-2 w-full px-2 py-1 flex-row-reverse">
              <button 
                onClick={cancelRecording} 
                className="p-2 text-[var(--semantic-error)] hover:bg-[var(--semantic-error-soft)] rounded-full transition-colors"
                title="حذف صدا"
              >
                <TrashIcon className="w-5 h-5"/>
              </button>
              <audio 
                src={URL.createObjectURL(recordedAudio)} 
                controls 
                className="flex-1 h-8"
              />
              <button
                onClick={processAndSendAudio}
                disabled={isLoading || isReadOnly}
                className="p-2.5 bg-lime text-[var(--text-on-primary)] rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)] animate-pulse"
                title="ارسال پیام صوتی"
              >
                <SendIcon className="w-5 h-5 transform rotate-180 text-[var(--text-on-primary)]" />
              </button>
            </div>
          ) : (
            // Core Text input and voice recorder
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)] rounded-xl transition-colors disabled:opacity-50"
                disabled={isLoading || isRecording || isReadOnly}
              >
                <PaperclipIcon className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isRecording ? "در حال ضبط صدا..." : isReadOnly ? "برای چت روی بازگشت به امروز کلیک کنید..." : selectedImagePreview ? "توضیحی بنویسید..." : "پیامی به دستیار بفرستید..."}
                className="flex-1 bg-transparent text-[var(--text-main)] placeholder-[var(--text-muted)] px-3 py-2 focus:outline-none disabled:opacity-50 text-right"
                disabled={isLoading || isRecording || isReadOnly}
                dir="rtl"
              />
              
              {input.trim() || selectedImagePreview ? (
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || isReadOnly}
                  className="p-2.5 bg-lime text-[var(--text-on-primary)] rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)] disabled:opacity-50"
                >
                  <SendIcon className="w-5 h-5 text-[var(--text-on-primary)]" />
                </button>
              ) : (
                <button
                  onClick={handleMicClick}
                  disabled={isReadOnly}
                  className={`p-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 ${
                    isRecording 
                      ? 'bg-[var(--semantic-error)] text-white shadow-lg shadow-red-500/30 animate-pulse' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)]'
                  }`}
                >
                  {isRecording ? (
                    <div className="w-5 h-5 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>
                    </div>
                  ) : (
                    <MicrophoneIcon className="w-5 h-5" />
                  )}
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-center text-[10px] text-[var(--text-muted)] opacity-60 mt-2">
          دستیار هوشمند تمام عیار در هر زمان آماده کمک به کارهای شماست.
        </p>
      </div>

      {/* Chat Log Drawer */}
      <ChatHistoryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectSession={handleSelectSession}
        selectedSessionId={activeSession?.id || null}
      />

      {/* More Citations Modal */}
      <MoreCitationsModal
        isOpen={isMoreCitationsOpen}
        onClose={() => setIsMoreCitationsOpen(false)}
        citations={selectedForMoreCitations}
        onCitationClick={handleCitationClick}
      />
    </div>
  );
};

export default ChatView;
