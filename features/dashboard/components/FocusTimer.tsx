import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../../../contexts/DataContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClockIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  ChevronDownIcon,
  SparklesIcon,
  PencilIcon,
  XIcon,
  CheckIcon,
} from '../../../components/icons';
import { linkTaskNote } from '../../../services/linkService';
import { newId } from '../../../utils/uuid';
import { isSameTehranDay } from '../../../utils/dateUtils';
import type { ChecklistItem } from '../../../types';

const STORED_FOCUS_KEY = 'hexer-focus-minutes';
const STORED_BREAK_KEY = 'hexer-break-minutes';
const MIN_MINUTES = 1;
const MAX_MINUTES = 99;
const WHEEL_ITEM_H = 44; // px — tap target ≥ 44 (Apple HIG)
const WHEEL_VISIBLE = 5;

function readStoredMinutes(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    const val = stored ? parseInt(stored, 10) : fallback;
    if (isNaN(val) || val < MIN_MINUTES) return fallback;
    return Math.min(MAX_MINUTES, val);
  } catch {
    return fallback;
  }
}

function clampMinutes(val: number): number {
  if (isNaN(val)) return MIN_MINUTES;
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(val)));
}

/* ─────────────────────────────────────────────────────────────
   Apple-style duration wheel (vertical snap; columns sit side-by-side)
   Tap center / selected value → type the number directly.
───────────────────────────────────────────────────────────── */
interface DurationWheelProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
  accent?: boolean;
}

const DurationWheel: React.FC<DurationWheelProps> = ({ value, onChange, label, accent }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammatic = useRef(false);
  const [isTyping, setIsTyping] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const values = useMemo(
    () => Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => i + MIN_MINUTES),
    []
  );

  const scrollToValue = useCallback((v: number, smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = clampMinutes(v) - MIN_MINUTES;
    isProgrammatic.current = true;
    el.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
    // release programmatic flag after animation / paint
    window.setTimeout(() => {
      isProgrammatic.current = false;
    }, smooth ? 280 : 40);
  }, []);

  // Initial + external sync
  useEffect(() => {
    if (isTyping) return;
    scrollToValue(value, false);
  }, [value, isTyping, scrollToValue]);

  useEffect(() => {
    if (isTyping && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isTyping]);

  const settleFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || isProgrammatic.current || isTyping) return;
    const raw = Math.round(el.scrollTop / WHEEL_ITEM_H);
    const next = clampMinutes(raw + MIN_MINUTES);
    const exactTop = (next - MIN_MINUTES) * WHEEL_ITEM_H;
    if (Math.abs(el.scrollTop - exactTop) > 0.5) {
      isProgrammatic.current = true;
      el.scrollTo({ top: exactTop, behavior: 'smooth' });
      window.setTimeout(() => {
        isProgrammatic.current = false;
      }, 220);
    }
    if (next !== value) onChange(next);
  }, [isTyping, onChange, value]);

  const handleScroll = () => {
    if (isProgrammatic.current || isTyping) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settleFromScroll, 90);
  };

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const commitType = () => {
    const parsed = clampMinutes(parseInt(draft.replace(/[^\d]/g, ''), 10));
    onChange(parsed);
    setDraft(String(parsed));
    setIsTyping(false);
    // next paint → scroll into place
    requestAnimationFrame(() => scrollToValue(parsed, true));
  };

  const padY = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_H;

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <span
        className={`text-[11px] font-black tracking-wide ${
          accent ? 'text-primary-text' : 'text-white/45'
        }`}
      >
        {label}
      </span>

      <div
        className="relative w-full max-w-[120px] h-[220px] select-none"
        style={{ height: WHEEL_ITEM_H * WHEEL_VISIBLE }}
      >
        {/* Selection band */}
        <div
          className="pointer-events-none absolute inset-x-1 rounded-2xl border border-white/15 bg-white/10 z-10"
          style={{
            top: padY,
            height: WHEEL_ITEM_H,
          }}
        />
        {/* Soft edge fades */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 z-20 bg-gradient-to-b from-[#16161A] to-transparent rounded-t-2xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 z-20 bg-gradient-to-t from-[#16161A] to-transparent rounded-b-2xl" />

        {isTyping ? (
          <div
            className="absolute inset-x-0 z-30 flex items-center justify-center"
            style={{ top: padY, height: WHEEL_ITEM_H }}
          >
            <input
              ref={inputRef}
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              onBlur={commitType}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitType();
                } else if (e.key === 'Escape') {
                  setDraft(String(value));
                  setIsTyping(false);
                }
              }}
              className="w-16 bg-transparent text-center text-2xl font-black text-white font-mono tabular-nums outline-none border-b-2 border-primary caret-primary"
              aria-label={`${label} — وارد کردن عدد`}
            />
          </div>
        ) : (
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            onClick={() => {
              setDraft(String(value));
              setIsTyping(true);
            }}
            className="h-full overflow-y-auto no-scrollbar overscroll-contain cursor-pointer"
            style={{
              scrollSnapType: 'y mandatory',
              WebkitOverflowScrolling: 'touch',
            }}
            role="listbox"
            aria-label={label}
            aria-valuenow={value}
          >
            <div style={{ height: padY }} aria-hidden />
            {values.map((n) => {
              const active = n === value;
              return (
                <div
                  key={n}
                  role="option"
                  aria-selected={active}
                  className={`flex items-center justify-center font-mono tabular-nums transition-colors duration-150 ${
                    active
                      ? 'text-white text-[28px] font-black'
                      : 'text-white/30 text-lg font-bold'
                  }`}
                  style={{
                    height: WHEEL_ITEM_H,
                    scrollSnapAlign: 'center',
                  }}
                >
                  {n}
                </div>
              );
            })}
            <div style={{ height: padY }} aria-hidden />
          </div>
        )}
      </div>

      <span className="text-[10px] text-white/35 font-bold">دقیقه</span>
    </div>
  );
};

interface DurationPickerModalProps {
  isOpen: boolean;
  focusMinutes: number;
  breakMinutes: number;
  onClose: () => void;
  onConfirm: (focus: number, brk: number) => void;
}

const DurationPickerModal: React.FC<DurationPickerModalProps> = ({
  isOpen,
  focusMinutes,
  breakMinutes,
  onClose,
  onConfirm,
}) => {
  const [draftFocus, setDraftFocus] = useState(focusMinutes);
  const [draftBreak, setDraftBreak] = useState(breakMinutes);

  // Reset drafts each open — preserves "cancel = discard"
  useEffect(() => {
    if (isOpen) {
      setDraftFocus(focusMinutes);
      setDraftBreak(breakMinutes);
    }
  }, [isOpen, focusMinutes, breakMinutes]);

  // Body scroll lock while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="تنظیم مدت تایمر"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-[#16161A] border border-white/10 rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden pb-safe-content"
            dir="rtl"
          >
            {/* Handle (mobile sheet cue) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <button
                type="button"
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition"
                aria-label="بستن"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-black text-white tracking-wide">تنظیم تایمر</h2>
              <button
                type="button"
                onClick={() => onConfirm(draftFocus, draftBreak)}
                className="min-w-[44px] min-h-[44px] -ml-2 rounded-full flex items-center justify-center text-primary-text hover:bg-primary/10 transition"
                aria-label="تأیید"
              >
                <CheckIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-center text-[11px] text-white/40 font-bold px-6 mb-1">
              بچرخان یا روی عدد بزن و تایپ کن
            </p>

            {/* Dual wheels — horizontal pair (Apple Timer grammar) */}
            <div className="flex items-stretch justify-center gap-2 px-4 pb-2 pt-1">
              <DurationWheel
                label="فوکوس"
                value={draftFocus}
                onChange={setDraftFocus}
                accent
              />
              <div className="w-px bg-white/10 my-10 shrink-0" aria-hidden />
              <DurationWheel
                label="استراحت"
                value={draftBreak}
                onChange={setDraftBreak}
              />
            </div>

            {/* Confirm CTA — large, thumb-friendly */}
            <div className="px-5 pt-2 pb-5">
              <button
                type="button"
                onClick={() => onConfirm(draftFocus, draftBreak)}
                className="w-full h-12 rounded-2xl bg-brand text-[var(--text-on-primary)] font-black text-sm active:scale-[0.98] transition shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.25)]"
              >
                تأیید · {draftFocus} / {draftBreak} دقیقه
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/* ───────────────────────────────────────────────────────────── */

export const FocusTimer: React.FC = () => {
  const { tasks, addTask, addNote, addNotification } = useData();

  const [focusMinutes, setFocusMinutes] = useState(() =>
    readStoredMinutes(STORED_FOCUS_KEY, 25)
  );
  const [breakMinutes, setBreakMinutes] = useState(() =>
    readStoredMinutes(STORED_BREAK_KEY, 5)
  );
  const [isDurationPickerOpen, setIsDurationPickerOpen] = useState(false);

  const FOCUS_SECONDS = focusMinutes * 60;
  const BREAK_SECONDS = breakMinutes * 60;

  const [timeLeft, setTimeLeft] = useState(() => readStoredMinutes(STORED_FOCUS_KEY, 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [isZenMode, setIsZenModeState] = useState(false);
  const setIsZenMode = (val: boolean) => {
    setIsZenModeState(val);
    window.dispatchEvent(new CustomEvent('hexer:zen-mode', { detail: val }));
  };
  const [selectedTask, setSelectedTask] = useState<{ id: string | null; title: string } | null>(
    null
  );
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);

  // Zen session inputs
  const [distractions, setDistractions] = useState<string[]>([]);
  const [distractionInput, setDistractionInput] = useState('');
  const [sessionNote, setSessionNote] = useState('');

  // Incomplete + today (or no due_date)
  const activeTasks = useMemo(() => {
    const today = new Date();
    return tasks.filter((t) => {
      if (t.status === 'done') return false;
      if (!t.due_date) return true;
      return isSameTehranDay(t.due_date, today);
    });
  }, [tasks]);

  const applyDurations = useCallback(
    (nextFocus: number, nextBreak: number) => {
      const f = clampMinutes(nextFocus);
      const b = clampMinutes(nextBreak);
      setFocusMinutes(f);
      setBreakMinutes(b);
      try {
        localStorage.setItem(STORED_FOCUS_KEY, String(f));
        localStorage.setItem(STORED_BREAK_KEY, String(b));
      } catch {
        /* private mode — ignore */
      }
      // Reset active segment to the new duration & pause (safe, predictable)
      setIsRunning(false);
      setTimeLeft(isBreak ? b * 60 : f * 60);
      setIsDurationPickerOpen(false);
    },
    [isBreak]
  );

  // Timer tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (!isBreak) {
              setIsBreak(true);
              return breakMinutes * 60;
            }
            setIsBreak(false);
            return focusMinutes * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isBreak, focusMinutes, breakMinutes]);

  const handleToggleMode = () => {
    setIsRunning(false);
    if (isBreak) {
      setIsBreak(false);
      setTimeLeft(FOCUS_SECONDS);
    } else {
      setIsBreak(true);
      setTimeLeft(BREAK_SECONDS);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExitFocus = async () => {
    setIsRunning(false);

    const distractionCount = distractions.length;
    const hasNote = sessionNote.trim() !== '';

    if (distractionCount === 0 && !hasNote) {
      setIsZenMode(false);
      return;
    }

    try {
      if (distractionCount > 0) {
        // Date-only for "today" — same convention as TaskEditorModal (local noon → ISO).
        const dueToday = new Date();
        dueToday.setHours(12, 0, 0, 0);

        await addTask({
          title: 'چیزایی که نیاز به بررسی دارن',
          priority: 'medium',
          tags: [],
          due_date: dueToday.toISOString(),
          checklist: distractions.map(
            (text) =>
              ({
                id: newId(),
                text,
                isCompleted: false,
              }) as ChecklistItem
          ),
        });
      }

      if (hasNote) {
        const noteTitle = selectedTask?.title
          ? `یادداشت تمرکز: ${selectedTask.title}`
          : 'یادداشت جلسه‌ی تمرکز';

        const createdNote = await addNote({
          title: noteTitle,
          content: sessionNote.trim(),
          tags: [],
        });

        const taskIdToLink = selectedTask?.id;
        if (taskIdToLink && createdNote?.id) {
          await linkTaskNote(taskIdToLink, createdNote.id);
        }
      }

      if (distractionCount > 0 && hasNote) {
        addNotification('جلسه تمرکز ذخیره شد (کارهای جدید و یادداشت ثبت شدند)', 'success');
      } else if (distractionCount > 0) {
        addNotification('جلسه تمرکز ذخیره شد (کارهای نیاز به بررسی ثبت شدند)', 'success');
      } else if (hasNote) {
        addNotification('یادداشت جلسه تمرکز با موفقیت ذخیره شد', 'success');
      }

      setDistractions([]);
      setDistractionInput('');
      setSessionNote('');
      setIsZenMode(false);
    } catch (error) {
      console.error('Error saving focus session:', error);
      addNotification('خطا در ذخیره‌ی جلسه‌ی تمرکز', 'error');
    }
  };

  const openDurationPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsDurationPickerOpen(true);
  };

  return (
    <div
      className="bg-[var(--ink-bg)] border border-white/10 text-white rounded-[var(--radius-lg)] p-4 relative overflow-hidden min-h-[160px] flex flex-col justify-between dark:border-[var(--border-neon)] dark:shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.15)] lg:mt-auto animate-fade-in"
      id="focus-timer-widget"
    >
      {/* Ambient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[var(--ink-bg)] via-black/20 to-white/5 opacity-40 pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top row */}
      <div className="flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-1.5 text-white/50 text-[11px] font-bold min-w-0">
          <ClockIcon className="w-3.5 h-3.5 text-primary-text shrink-0" />
          <span className="tracking-wider text-[11px] font-black text-white truncate">
            {isBreak ? 'استراحت کوتاه' : 'تمرکز عمیق'}
          </span>
          <button
            type="button"
            onClick={openDurationPicker}
            className="w-8 h-8 shrink-0 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/45 hover:text-white/80 transition active:scale-95"
            title="تنظیم زمان"
            aria-label="تنظیم مدت فوکوس و استراحت"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsZenMode(true)}
          className="bg-brand text-[var(--text-on-primary)] hover:bg-[var(--color-primary-hover)] text-[11px] font-extrabold px-3 py-1.5 rounded-full active:scale-95 transition-transform shrink-0"
        >
          ورود
        </button>
      </div>

      {/* Clock + controls — compact, never expands for settings */}
      <div className="flex items-center justify-between z-10 my-2 gap-2">
        <button
          type="button"
          onClick={openDurationPicker}
          className="text-white text-3xl font-black font-mono tracking-widest tabular-nums leading-none hover:text-primary transition-colors text-left"
          title="تنظیم زمان"
          aria-label={`زمان باقیمانده ${formatTime(timeLeft)} — برای تنظیم ضربه بزن`}
        >
          {formatTime(timeLeft)}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              setTimeLeft(isBreak ? BREAK_SECONDS : FOCUS_SECONDS);
            }}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 flex items-center justify-center transition active:scale-95"
            title="ریست تایمر"
            aria-label="ریست تایمر"
          >
            <RotateCcwIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="w-9 h-9 rounded-full bg-brand text-[var(--text-on-primary)] flex items-center justify-center transition hover:scale-105 active:scale-95 shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)]"
            aria-label={isRunning ? 'توقف' : 'شروع'}
          >
            {isRunning ? (
              <PauseIcon className="w-3.5 h-3.5 fill-current" />
            ) : (
              <PlayIcon className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Task selector */}
      <div className="relative z-20 shrink-0">
        <button
          type="button"
          onClick={() => setIsTaskPickerOpen(true)}
          className="w-full min-h-[36px] rounded-full bg-white/5 border border-white/10 hover:bg-white/10 px-3.5 flex items-center justify-between text-[11px] font-bold text-white/90 transition active:scale-[0.99]"
        >
          <span className="truncate max-w-[90%]">{selectedTask?.title ?? 'انتخاب تسک'}</span>
          <ChevronDownIcon className="w-3.5 h-3.5 text-white/50 shrink-0" />
        </button>
      </div>

      {/* Task picker — portaled to avoid glass-app overflow clip */}
      {typeof document !== 'undefined' &&
        createPortal(
      <AnimatePresence>
        {isTaskPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-white"
            onClick={() => setIsTaskPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#1e1e24] border border-white/10 rounded-2xl w-full max-w-sm p-5 flex flex-col max-h-[80vh] text-right shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                <span className="font-black text-sm text-primary-text">انتخاب تسک</span>
                <button
                  type="button"
                  onClick={() => setIsTaskPickerOpen(false)}
                  className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition"
                  aria-label="بستن"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-white/40 mb-1">گزینه‌های سریع</div>
                {(
                  [
                    { id: null, title: 'تمرکز آزاد' },
                    { id: null, title: 'مطالعه و یادگیری' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={() => {
                      setSelectedTask({ id: opt.id, title: opt.title });
                      setIsTaskPickerOpen(false);
                    }}
                    className="w-full flex items-center justify-start text-right px-3.5 py-2.5 text-xs font-bold rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 transition text-white/90 min-h-[44px]"
                  >
                    <span className="line-clamp-1 text-right w-full leading-normal">
                      {opt.title}
                    </span>
                  </button>
                ))}
              </div>

              <div className="h-px bg-white/5 my-3" />

              <div className="flex-1 overflow-y-auto soft-scroll flex flex-col gap-1.5 min-h-0">
                <div className="text-[10px] font-bold text-white/40 mb-1">کارهای فعال</div>
                {activeTasks.length > 0 ? (
                  activeTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTask({ id: t.id, title: t.title });
                        setIsTaskPickerOpen(false);
                      }}
                      className="w-full flex items-center justify-start text-right px-3.5 py-2.5 text-xs font-bold rounded-xl bg-white/5 hover:bg-primary/10 transition text-white/90 border border-transparent min-h-[44px]"
                    >
                      <span className="line-clamp-1 text-right w-full leading-normal">
                        {t.title}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-white/30 font-medium">
                    کار فعالی یافت نشد.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body
      )}

      {/* Immersive Zen Mode — portaled to body so glass-app overflow cannot clip top bar */}
      {typeof document !== 'undefined' &&
        createPortal(
      <AnimatePresence>
        {isZenMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-2xl flex flex-col text-white h-[100dvh] w-full overflow-hidden"
            dir="rtl"
          >
            {/* Top bar */}
            <div className="w-full max-w-md mx-auto flex items-center justify-between px-5 pt-app-safe shrink-0">
              <div className="flex items-center gap-2 text-white/60 min-w-0">
                <SparklesIcon className="w-5 h-5 text-primary-text animate-pulse shrink-0" />
                <span className="font-bold tracking-wide text-sm truncate">
                  {isBreak ? 'حالت استراحت' : 'حالت تمرکز'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={openDurationPicker}
                  className="min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition active:scale-95"
                  title="تنظیم زمان"
                  aria-label="تنظیم مدت تایمر"
                >
                  <PencilIcon className="w-4 h-4 text-white/80" />
                </button>
                <button
                  type="button"
                  onClick={handleExitFocus}
                  className="px-4 min-h-[36px] rounded-full bg-white/10 hover:bg-white/25 border border-white/10 text-xs font-bold transition active:scale-95"
                >
                  خروج
                </button>
              </div>
            </div>

            {/* Center: timer (flexible, can shrink on short screens) */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-5">
              <div className="relative w-[min(16rem,55vw)] h-[min(16rem,55vw)] max-w-[256px] max-h-[256px] flex items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full bg-primary/10 blur-xl transition-all duration-[4000ms] ease-in-out ${
                    isRunning ? 'scale-125 opacity-100' : 'scale-100 opacity-50'
                  }`}
                />
                <button
                  type="button"
                  onClick={openDurationPicker}
                  className={`w-[88%] h-[88%] rounded-full border border-primary/30 flex flex-col items-center justify-center bg-white/10 dark:bg-black/40 backdrop-blur-md transition-transform duration-[4000ms] ease-in-out ${
                    isRunning ? 'scale-105' : 'scale-95'
                  }`}
                  aria-label="تنظیم مدت تایمر"
                >
                  <span className="text-white text-[clamp(2rem,8vw,3rem)] font-black font-mono tracking-widest tabular-nums leading-none">
                    {formatTime(timeLeft)}
                  </span>
                  {selectedTask && (
                    <span className="text-[11px] text-white/60 font-bold mt-3 px-4 text-center truncate max-w-[90%]">
                      {selectedTask.title}
                    </span>
                  )}
                  <span className="text-[9px] text-white/30 font-bold mt-2">
                    {isBreak ? `استراحت ${breakMinutes}′` : `فوکوس ${focusMinutes}′`}
                  </span>
                </button>
              </div>

              {isRunning && (
                <span className="text-primary-text/80 text-xs font-medium tracking-wide animate-pulse mt-4">
                  {isBreak ? 'دم و بازدم آرام...' : 'متمرکز بمان...'}
                </span>
              )}
            </div>

            {/* Session card — only this scrolls if keyboard / small height */}
            <div className="w-full max-w-md mx-auto px-5 shrink-0 max-h-[32vh] overflow-y-auto no-scrollbar">
              <div className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-right">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-primary-text flex items-center gap-1.5">
                    <span>حواس‌پرتی‌ها</span>
                    <span className="text-[9px] text-white/40 font-normal">
                      (بعداً ساب‌تسک می‌شوند)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={distractionInput}
                      onChange={(e) => setDistractionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (distractionInput.trim()) {
                            setDistractions((prev) => [...prev, distractionInput.trim()]);
                            setDistractionInput('');
                          }
                        }
                      }}
                      placeholder="چیزی ذهنت رو مشغول کرده؟"
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary transition"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (distractionInput.trim()) {
                          setDistractions((prev) => [...prev, distractionInput.trim()]);
                          setDistractionInput('');
                        }
                      }}
                      className="w-10 shrink-0 bg-primary text-[var(--text-on-primary)] rounded-xl text-sm font-black hover:bg-[var(--color-primary-hover)] active:scale-95 transition"
                      aria-label="افزودن"
                    >
                      +
                    </button>
                  </div>
                  {distractions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5 max-h-[56px] overflow-y-auto soft-scroll p-1 bg-black/20 rounded-lg">
                      {distractions.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="flex items-center gap-1 bg-white/10 border border-white/10 text-white/90 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        >
                          <span className="truncate max-w-[120px]">{item}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDistractions((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="text-white/40 hover:text-error transition font-black text-[9px]"
                            aria-label="حذف"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-primary-text">
                    یادداشت‌های این تسک
                  </label>
                  <textarea
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                    placeholder="ایده‌ها، نکات یا دستاوردهای این جلسه..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary resize-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Bottom controls — single mode toggle (no stacked second rest button) */}
            <div className="w-full max-w-sm mx-auto flex items-center justify-center gap-5 px-5 pt-4 pb-safe shrink-0 mb-3">
              <button
                type="button"
                onClick={() => {
                  setIsRunning(false);
                  setTimeLeft(isBreak ? BREAK_SECONDS : FOCUS_SECONDS);
                }}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center transition active:scale-95"
                title="ریست تایمر"
                aria-label="ریست تایمر"
              >
                <RotateCcwIcon className="w-5 h-5 text-white/80" />
              </button>

              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className="w-16 h-16 rounded-full bg-brand text-[var(--text-on-primary)] flex items-center justify-center transition hover:scale-105 active:scale-95 shadow-[0_0_25px_rgb(var(--color-primary-rgb)/0.4)]"
                aria-label={isRunning ? 'توقف' : 'شروع'}
              >
                {isRunning ? (
                  <PauseIcon className="w-7 h-7 fill-current" />
                ) : (
                  <PlayIcon className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleMode}
                className="min-w-[48px] min-h-[44px] h-12 px-3 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center transition active:scale-95"
                title={isBreak ? 'بازگشت به تمرکز' : 'رفتن به استراحت'}
                aria-label={isBreak ? 'شروع فوکوس' : 'استراحت زودهنگام'}
              >
                <span className="text-[11px] font-black text-white/90 leading-none">
                  {isBreak ? 'فوکوس' : 'استراحت'}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
        document.body
      )}

      {/* Duration picker modal (shared by widget + zen) */}
      <DurationPickerModal
        isOpen={isDurationPickerOpen}
        focusMinutes={focusMinutes}
        breakMinutes={breakMinutes}
        onClose={() => setIsDurationPickerOpen(false)}
        onConfirm={applyDurations}
      />
    </div>
  );
};
