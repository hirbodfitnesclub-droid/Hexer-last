import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { Page } from '../../../types';
import { BotIcon, MicrophoneIcon, PaperclipIcon, XIcon, SendIcon } from '../../../components/icons';
import { setPendingDraft } from '../../chat/composerBridge';
import { useMediaRecorder } from '../../chat/hooks/useMediaRecorder';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { compressImage, dataURLtoBlob } from '../../../utils/imageUtils';

export const AiComposerPanel: React.FC = () => {
  const { setCurrentPage, addNotification } = useData();
  const [input, setInput] = useState('');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    recordedAudio,
    setRecordedAudio,
    startRecording,
    stopRecording,
    handleMicClick
  } = useMediaRecorder();

  const [recordingTimer, setRecordingTimer] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      setRecordingTimer(0);
      interval = setInterval(() => {
        setRecordingTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const isMobile = useMediaQuery('(max-width: 640px)');
  const placeholderText = isMobile 
    ? 'تعریف کن؛ چه خبر از امروز؟' 
    : 'بگو هرچه دل تنگت میخواهد(حرف بزن، تایپ کن یا حتی اسکرین بده)';

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setRecordedAudio(null);
      } catch (err) {
        console.error("Image processing failed", err);
        addNotification("خطا در پردازش تصویر.", "error");
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setSelectedImagePreview(null);
    setSelectedImageFile(null);
  };

  const handleRemoveAudio = () => {
    setRecordedAudio(null);
    setRecordingTimer(0);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isRecording) {
      stopRecording();
      return;
    }

    const hasText = input.trim();
    const hasImage = !!selectedImageFile;
    const hasAudio = !!recordedAudio;

    if (!hasText && !hasImage && !hasAudio) return;

    setIsSubmitting(true);

    try {
      setPendingDraft({
        text: input.trim(),
        imageFile: selectedImageFile,
        audioFile: recordedAudio
      });

      // Reset local state
      setInput('');
      setSelectedImagePreview(null);
      setSelectedImageFile(null);
      setRecordedAudio(null);
      setRecordingTimer(0);

      setCurrentPage(Page.Chat);
    } catch (err) {
      console.error("Error setting pending draft:", err);
      addNotification("خطا در ثبت پیش‌نویس.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-panel p-4 min-h-[145px] rounded-[var(--radius-lg)] flex flex-col justify-between shrink-0 relative overflow-hidden transition-all duration-300 hover:border-primary/30" dir="rtl">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-primary opacity-0 dark:hover:opacity-5 blur-xl rounded-full transition duration-500 pointer-events-none"></div>

      {/* Header with bot icon and title */}
      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <BotIcon className="w-5 h-5 text-main dark:text-primary-text" />
          <h2 className="text-[16px] font-black leading-tight text-main">دستیار هوش مصنوعی هکسر</h2>
        </div>
        {/* Status/Badge */}
        {isRecording && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-error/10 text-error rounded-full text-[10px] sm:text-xs font-bold animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
            در حال ضبط ({recordingTimer} ثانیه)
          </div>
        )}
      </div>

      {/* Attachment Previews */}
      {(selectedImagePreview || (recordedAudio && !isRecording)) && (
        <div className="flex flex-wrap gap-2 px-1 z-10 my-1">
          {selectedImagePreview && (
            <div className="relative group/thumb w-12 h-12 rounded-md overflow-hidden border border-subtle">
              <img src={selectedImagePreview} alt="پیوست" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button 
                type="button" 
                onClick={handleRemoveImage}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition cursor-pointer"
              >
                <XIcon className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {recordedAudio && !isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-main border border-subtle rounded-lg text-xs font-medium relative group/audio">
              <span>صوت ضبط‌شده ({recordingTimer} ثانیه)</span>
              <button 
                type="button" 
                onClick={handleRemoveAudio}
                className="p-0.5 bg-black/30 hover:bg-black/50 text-white rounded-full transition cursor-pointer"
              >
                <XIcon className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main input form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-end z-10">
        <div className="relative flex items-center bg-[var(--bg-card)] border border-subtle rounded-[var(--radius-pill)] p-1 shadow-[var(--shadow-card)] focus-within:border-primary/50 transition-all">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholderText} 
            className="flex-1 bg-transparent border-none outline-none pr-3 pl-2 text-[14px] font-medium text-main placeholder-muted focus:ring-0 text-right min-w-0"
            dir="rtl"
            disabled={isSubmitting}
          />
          
          {/* Controls toolbar */}
          <div className="flex items-center gap-1.5 px-1 shrink-0">
            {/* hidden file input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            
            {/* attachment icon */}
            <button 
              type="button"
              onClick={handleAttachmentClick}
              disabled={isSubmitting}
              className="text-muted hover:text-main cursor-pointer transition p-1.5 rounded-full hover:bg-subtle active:scale-90 disabled:opacity-50"
              title="ضمیمه کردن تصویر"
            >
              <PaperclipIcon className="w-4 h-4" />
            </button>
            
            {/* microphone icon */}
            <button 
              type="button"
              onClick={() => {
                if (!isRecording) {
                  setSelectedImagePreview(null);
                  setSelectedImageFile(null);
                }
                handleMicClick();
              }}
              disabled={isSubmitting}
              className={`p-1.5 rounded-full transition active:scale-90 cursor-pointer ${isRecording ? 'text-error bg-error/10 animate-pulse' : 'text-muted hover:text-main hover:bg-subtle'}`}
              title={isRecording ? 'توقف ضبط' : 'ضبط صدا'}
            >
              <MicrophoneIcon className="w-4 h-4" />
            </button>

            {/* send button */}
            <button 
              type="submit" 
              disabled={isSubmitting || (!input.trim() && !selectedImageFile && !recordedAudio && !isRecording)}
              className="px-3 sm:px-4 py-2 bg-brand rounded-full text-xs font-bold text-on-primary transition hover:scale-105 active:scale-95 shrink-0 shadow-[var(--shadow-btn)] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none min-w-0"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
              ) : isMobile ? (
                <SendIcon className="w-4 h-4" />
              ) : (
                <>
                  <span>ارسال</span>
                  <SendIcon className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AiComposerPanel;
