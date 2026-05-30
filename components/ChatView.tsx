
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatMode, Citation, Task, Note, ActionResult, Project, Page } from '../types';
import { BotIcon, UserIcon, SendIcon, SparklesIcon, TargetIcon, LightbulbIcon, PencilIcon, NotebookIcon, ListChecksIcon, LinkIcon, CheckIcon, BriefcaseIcon, FlameIcon, PaperclipIcon, MicrophoneIcon, CalendarIcon, PlusIcon, XIcon, TrashIcon } from './icons';
import { supabase } from '../services/supabaseClient';
import { uploadChatMedia } from '../services/mediaService';


interface ChatViewProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  onEditTask: (task: Task) => void;
  onEditNote: (note: Note) => void;
  onEditProject: (project: Project) => void;
  setPage: (page: Page) => void;
  onInjectResult: (result: ActionResult) => void;
  onTriggerPaywall: (message: string) => void;
}

const suggestions = [
  { text: "برنامه امروزم چیه؟", icon: <CalendarIcon className="w-4 h-4 text-sky-400" /> },
  { text: "یک تسک جدید بساز برای...", icon: <ListChecksIcon className="w-4 h-4 text-green-400" /> },
  { text: "ایده‌های قبلیم رو مرور کن", icon: <LightbulbIcon className="w-4 h-4 text-yellow-400" /> },
];

const ChatView: React.FC<ChatViewProps> = ({ messages, setMessages, tasks, notes, projects, onEditTask, onEditNote, onEditProject, setPage, onInjectResult, onTriggerPaywall }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Image Upload States
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null); // Base64 data URL for UI preview
  const [selectedImageFile, setSelectedImageFile] = useState<Blob | null>(null); // actual binary file for upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Image Handling Logic ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            alert('لطفا فقط فایل تصویری انتخاب کنید.');
            return;
        }

        try {
            const compressed = await compressImage(file);
            setSelectedImagePreview(compressed);
            setSelectedImageFile(dataURLtoBlob(compressed));
            setRecordedAudio(null); // Clear audio if image selected (simplify UX)
        } catch (err) {
            console.error("Image processing failed", err);
            alert("خطا در پردازش تصویر.");
        }
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024; // Limit width to 1024px
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Compress to JPEG at 70% quality
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
  };

  const removeImage = () => {
      setSelectedImagePreview(null);
      setSelectedImageFile(null);
  };

  // --- Voice Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setSelectedImagePreview(null);
      setSelectedImageFile(null); // Clear image if recording starts
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("دسترسی به میکروفون امکان‌پذیر نیست.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
      setRecordedAudio(null);
      setIsRecording(false);
      audioChunksRef.current = [];
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  // -----------------------------

  const handleSendMessage = async (textOverride?: string) => {
    let textToSend = textOverride || input;

    if ((!textToSend.trim() && !recordedAudio && !selectedImageFile) || isLoading) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend || (recordedAudio ? '[پیام صوتی]' : '[تصویر]'),
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    let audioPathVal = null;
    let imagePathVal = null;

    try {
      // 1. Upload audio if available
      if (recordedAudio) {
        audioPathVal = await uploadChatMedia(recordedAudio, 'webm');
      }

      // 2. Upload image if available
      if (selectedImageFile) {
        const ext = 'jpeg'; // converted to jpeg by compressImage
        imagePathVal = await uploadChatMedia(selectedImageFile, ext);
      }

      setSelectedImagePreview(null);
      setSelectedImageFile(null);
      setRecordedAudio(null);

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: textToSend,
          history: messages.slice(-10), // Send last 10 messages for context
          mode: mode,
          audioPath: audioPathVal,
          imagePath: imagePathVal
        }
      });

      // Handle 402 Paywall gateway status code
      if (error && (error.status === 402 || (error.message && error.message.includes('402')))) {
        onTriggerPaywall('سقف مصرف دوره آزمایشی یا سهمیه ماهانه هوش مصنوعی شما تمام شده است. لطفاً جهت فعال‌سازی حساب خود اشتراک تهیه فرمایید.');
        throw new Error('402');
      }

      if (data?.error) {
        if (data.reason === 'quota_exceeded' || data.reason === 'trial_expired') {
          onTriggerPaywall('سقف مصرف دوره آزمایشی یا سهمیه ماهانه هوش مصنوعی شما تمام شده است. لطفاً جهت فعال‌سازی حساب خود اشتراک تهیه فرمایید.');
          throw new Error('402');
        }
        throw new Error(data.error);
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply,
        citations: data.citations,
        actionResults: data.actionResults // Updated to accept array
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Inject the action results immediately into the App state (Optimistic UI)
      if (data.actionResults && Array.isArray(data.actionResults)) {
          data.actionResults.forEach((result: ActionResult) => onInjectResult(result));
      }

    } catch (err: any) {
      console.error('Error sending message:', err);
      if (err.message === '402') {
         setMessages(prev => [...prev, {
           id: (Date.now() + 1).toString(),
           sender: 'ai',
           text: 'سقف مصرف سهمیه هوش مصنوعی شما تمام شده است. برای ادامه لطفا از طریق پنجره ارتقای حساب کاربری، اشتراک تهیه فرمایید.'
         }]);
      } else {
         setMessages(prev => [...prev, {
           id: (Date.now() + 1).toString(),
           sender: 'ai',
           text: 'متاسفانه مشکلی در پردازش درخواست پیش آمد. لطفاً دوباره تلاش کنید.'
         }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const processAndSendAudio = async () => {
    if (!recordedAudio) return;
    handleSendMessage("[پیام صوتی]");
  };

  // --- Handlers for Interactive Elements ---
  const handleCitationClick = (citation: Citation) => {
      if (citation.type === 'task') {
          const task = tasks.find(t => t.id === citation.id);
          if (task) onEditTask(task);
      } else if (citation.type === 'note') {
          const note = notes.find(n => n.id === citation.id);
          if (note) onEditNote(note);
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
           setPage(Page.Dashboard);
      }
  };


  // --- Render Helpers ---
  const ModeChip: React.FC<{ m: ChatMode, label: string, icon: React.ReactNode }> = ({ m, label, icon }) => (
    <button
      onClick={() => setMode(m)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        mode === m 
          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/50' 
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const CitationCard: React.FC<{ citation: Citation }> = ({ citation }) => (
      <button 
        onClick={() => handleCitationClick(citation)}
        className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/80 border border-white/5 hover:border-sky-500/30 rounded-lg p-2 transition-all group text-right w-full sm:w-auto"
      >
          <div className={`p-1.5 rounded-md ${citation.type === 'task' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
              {citation.type === 'task' ? <ListChecksIcon className="w-3.5 h-3.5"/> : <NotebookIcon className="w-3.5 h-3.5"/>}
          </div>
          <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate max-w-[150px]">{citation.title}</p>
              <p className="text-[10px] text-gray-500">منبع مرتبط</p>
          </div>
          <LinkIcon className="w-3 h-3 text-gray-600 group-hover:text-sky-400 transition-colors" />
      </button>
  );

  const ActionResultCard: React.FC<{ result: ActionResult }> = ({ result }) => {
      let icon = <CheckIcon className="w-5 h-5"/>;
      let color = "bg-green-500";
      let label = "آیتم ساخته شد";
      let title = "";

      if (result.type === 'task') {
          icon = <ListChecksIcon className="w-5 h-5 text-white"/>;
          color = "bg-green-500";
          label = "تسک جدید";
          title = (result.data as Task).title;
      } else if (result.type === 'note') {
          icon = <NotebookIcon className="w-5 h-5 text-white"/>;
          color = "bg-purple-500";
          label = "یادداشت جدید";
          title = (result.data as Note).title;
      } else if (result.type === 'project') {
          icon = <BriefcaseIcon className="w-5 h-5 text-white"/>;
          color = "bg-sky-500";
          label = "پروژه جدید";
          title = (result.data as Project).title;
      } else if (result.type === 'habit') {
          icon = <FlameIcon className="w-5 h-5 text-white"/>;
          color = "bg-orange-500";
          label = "عادت جدید";
          title = (result.data as any).name;
      }

      return (
          <div className="mt-3 flex">
              <button 
                onClick={() => handleActionResultClick(result)}
                className="flex items-center gap-3 bg-gray-800/80 border border-white/10 p-3 rounded-xl hover:bg-gray-700 transition-all group w-full sm:w-auto min-w-[200px]"
              >
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shadow-lg shadow-black/20`}>
                      {icon}
                  </div>
                  <div className="text-right flex-1">
                      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                      <p className="text-sm text-white font-bold group-hover:text-sky-300 transition-colors">{title}</p>
                  </div>
                  <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-white/10 transition-colors">
                      <LinkIcon className="w-4 h-4 text-gray-400 group-hover:text-white" />
                  </div>
              </button>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex flex-col gap-3 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BotIcon className="w-6 h-6 text-sky-400" />
            دستیار هوشمند
            </h2>
             <div className="flex gap-2">
                <ModeChip m="auto" label="خودکار" icon={<SparklesIcon className="w-3.5 h-3.5"/>} />
                <ModeChip m="action" label="دستور" icon={<TargetIcon className="w-3.5 h-3.5"/>} />
                <ModeChip m="memory" label="حافظه" icon={<LightbulbIcon className="w-3.5 h-3.5"/>} />
            </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 1 && (
            <div className="flex flex-col items-center justify-center py-10 opacity-0 animate-fade-in-up" style={{animationDelay: '0.2s', opacity: 1}}>
                 <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 bg-sky-500/20 rounded-full animate-pulse"></div>
                    <BotIcon className="w-10 h-10 text-sky-400" />
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2">چطور می‌تونم کمکت کنم؟</h3>
                 <p className="text-gray-400 text-sm mb-8 text-center max-w-xs">من می‌تونم کارهات رو مدیریت کنم، یادداشت بردارم و از حافظه‌ام برای جواب دادن به سوالاتت استفاده کنم.</p>
                 
                 <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
                    {suggestions.map((s, i) => (
                        <button 
                            key={i}
                            onClick={() => handleSendMessage(s.text)}
                            className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-sky-500/50 hover:bg-gray-800 transition-all text-right group"
                        >
                            <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-gray-700 transition-colors">{s.icon}</div>
                            <span className="text-sm text-gray-300 group-hover:text-white">{s.text}</span>
                        </button>
                    ))}
                 </div>
            </div>
        )}

        {messages.slice(1).map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} animate-fade-in-up`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-indigo-600' : 'bg-sky-600'}`}>
              {msg.sender === 'user' ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-white" />}
            </div>
            
            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-3.5 rounded-2xl text-sm leading-6 ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tl-none' 
                    : 'bg-gray-800 text-gray-100 rounded-tr-none border border-white/5'
                }`}>
                  {msg.text}
                </div>
                
                {/* Citations (Sources) */}
                {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {msg.citations.map((citation, idx) => (
                            <CitationCard key={idx} citation={citation} />
                        ))}
                    </div>
                )}

                {/* Action Results (Created Items) */}
                {msg.actionResults && msg.actionResults.length > 0 && (
                    <div className="flex flex-col gap-1 w-full">
                        {msg.actionResults.map((result, idx) => (
                            <ActionResultCard key={idx} result={result} />
                        ))}
                    </div>
                )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0">
               <BotIcon className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-800 p-3 rounded-2xl rounded-tr-none border border-white/5 flex items-center gap-2">
                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-950 border-t border-white/10">
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileSelect}
        />

        {/* Image Preview UI */}
        {selectedImagePreview && (
            <div className="mb-2 relative inline-block">
                <img src={selectedImagePreview} alt="Selected" className="h-20 w-auto rounded-lg border border-white/20" />
                <button 
                    onClick={removeImage}
                    className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                >
                    <XIcon className="w-3 h-3" />
                </button>
            </div>
        )}

        <div className={`relative flex items-center bg-gray-900 border transition-colors rounded-2xl p-1.5 ${isRecording ? 'border-red-500/50 bg-red-500/5' : 'border-gray-800 focus-within:border-sky-500/50'}`}>
            
            {recordedAudio ? (
                // Audio Preview Mode
                <div className="flex items-center gap-2 w-full px-2 py-1">
                    <button 
                        onClick={cancelRecording} 
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
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
                        disabled={isLoading}
                        className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-colors shadow-lg shadow-green-900/20"
                        title="ارسال پیام صوتی"
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            ) : (
                // Text Input Mode (supports text + image)
                <>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
                        disabled={isLoading || isRecording}
                    >
                        <PaperclipIcon className="w-5 h-5" />
                    </button>
                    
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={isRecording ? "در حال ضبط..." : selectedImagePreview ? "توضیحاتی برای تصویر بنویسید..." : "پیامی بنویسید..."}
                        className="flex-1 bg-transparent text-white placeholder-gray-500 px-3 py-2 focus:outline-none disabled:opacity-50"
                        disabled={isLoading || isRecording}
                    />
                    
                    {input.trim() || selectedImagePreview ? (
                        <button
                            onClick={() => handleSendMessage()}
                            disabled={isLoading}
                            className="p-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-500 transition-colors shadow-lg shadow-sky-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleMicClick}
                            className={`p-2.5 rounded-xl transition-all duration-300 ${
                                isRecording 
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            {isRecording ? <div className="w-5 h-5 flex items-center justify-center"><div className="w-2.5 h-2.5 bg-white rounded-sm"></div></div> : <MicrophoneIcon className="w-5 h-5" />}
                        </button>
                    )}
                </>
            )}
        </div>
        <p className="text-center text-[10px] text-gray-600 mt-2">
            دستیار هوشمند ممکن است اشتباه کند. اطلاعات مهم را بررسی کنید.
        </p>
      </div>
    </div>
  );
};

export default ChatView;
