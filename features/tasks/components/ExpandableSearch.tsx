import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { SearchIcon, XIcon } from '../../../components/icons';

/**
 * ExpandableSearch — جستجوی جمع‌شونده‌ی دسکتاپ صفحه‌ی کارها (RTL).
 *
 * قرارداد رفتاری (مبنای تست واحد):
 * - بسته + کوئری خالی => با کلیک روی آیکون یا کلید `/` باز می‌شود و فوکوس می‌گیرد.
 * - باز + `Esc` => فقط اگر کوئری خالی است بسته می‌شود و فوکوس به آیکون برمی‌گردد.
 * - blur => فقط اگر کوئری خالی است بسته می‌شود؛ اگر کوئری دارد باز می‌ماند.
 * - اگر از بیرون کوئری مقدار گرفت (مثلاً حفظ state) => خودکار باز می‌شود.
 */

export const EXPANDABLE_SEARCH_STORAGE_KEY = 'hexer:tasks-search-seen-v1';
export const EXPANDABLE_SEARCH_INPUT_ID_FALLBACK = 'task-search-input';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function shouldAutoOpenOnExternalQuery(args: { isOpen: boolean; query: string }): boolean {
  return !args.isOpen && args.query.trim().length > 0;
}

export function shouldCloseOnBlur(args: { query: string }): boolean {
  return args.query.trim().length === 0;
}

export function shouldCloseOnEscape(args: { query: string }): boolean {
  return args.query.trim().length === 0;
}

/** آیا target برای شورت‌کات `/` قابل چشم‌پوشی است (داخل فیلد متنی هستیم)؟ */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return EDITABLE_TAGS.has(target.tagName);
}

interface ExpandableSearchProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  inputId?: string;
  /** عرض حالت باز؛ پیش‌فرض هم‌ارز باکس قبلی (w-56) */
  className?: string;
}

export const ExpandableSearch: React.FC<ExpandableSearchProps> = ({
  value,
  onChange,
  placeholder = 'جستجو در کارها...',
  inputId,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => value.trim().length > 0);
  const [hasSeen, setHasSeen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(EXPANDABLE_SEARCH_STORAGE_KEY) === '1';
    } catch {
      // اگر storage در دسترس نباشد، پالس را نشان نده تا مزاحم نشود.
      return true;
    }
  });

  const generatedId = useId();
  const resolvedInputId = inputId ?? `${EXPANDABLE_SEARCH_INPUT_ID_FALLBACK}-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const markSeen = useCallback(() => {
    setHasSeen(true);
    try {
      window.localStorage.setItem(EXPANDABLE_SEARCH_STORAGE_KEY, '1');
    } catch {
      /* storage اختیاری است؛ سکوت */
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    markSeen();
  }, [markSeen]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // باز شدن خودکار وقتی از بیرون کوئری مقدار می‌گیرد.
  useEffect(() => {
    if (shouldAutoOpenOnExternalQuery({ isOpen, query: value })) {
      setIsOpen(true);
    }
  }, [isOpen, value]);

  // فوکوس خودکار روی باز شدن؛ برگشت فوکوس به آیکون روی بسته شدن با Esc.
  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // شورت‌کات سراسری `/` و `Ctrl/Cmd+K` — فقط وقتی داخل فیلد متنی نیستیم.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as EventTarget | null;
      if (isEditableTarget(target)) return;

      const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;
      const isCmdK =
        (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K' || e.key === 'ک');

      if (isSlash || isCmdK) {
        e.preventDefault();
        // اگر مودال ویرایشگر باز است، سرچ پس‌زمینه را ندزد.
        const dialogOpen = !!document.querySelector('[role="dialog"]');
        if (dialogOpen) return;
        open();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open ]);

  const handleTriggerClick = () => open();

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (shouldCloseOnEscape({ query: value })) {
        close();
        // دکمه‌ی تریگر تازه mount می‌شود؛ فوکوس را به تیک بعد موکول کن.
        window.setTimeout(() => triggerRef.current?.focus(), 60);
      } else {
        // کوئری دارد: فقط متن را پاک کن ولی باز بمان.
        onChange('');
      }
    }
  };

  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return; // حرکت داخل خود باکس (مثلاً دکمه پاک‌کن)
    if (shouldCloseOnBlur({ query: value })) {
      close();
    }
  };

  const showPulse = !hasSeen && !isOpen;

  return (
    <div
      dir="rtl"
      onBlur={handleContainerBlur}
      className={`relative hidden lg:block h-[38px] shrink-0 overflow-hidden rounded-xl transition-[width] duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
        isOpen ? 'w-56 xl:w-64' : 'w-[38px]'
      } ${className}`}
      style={{ transformOrigin: 'left center' }}
    >
      {!isOpen ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTriggerClick}
          aria-expanded={false}
          aria-controls={resolvedInputId}
          aria-label="جستجو در کارها"
          aria-keyshortcuts="/"
          title="جستجو در کارها ( / )"
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--input-focus-ring)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors motion-reduce:transition-none"
        >
          <SearchIcon className="w-4 h-4" />
          {showPulse && (
            <span className="absolute top-1.5 left-1.5 flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]" />
            </span>
          )}
        </button>
      ) : (
        <div className="absolute inset-0 group animate-[expandSearchIn_250ms_cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none">
          <input
            ref={inputRef}
            id={resolvedInputId}
            type="text"
            role="searchbox"
            aria-label="جستجو در کارها"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full h-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl py-2 px-10 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--input-focus-ring)] transition-[opacity,border-color] duration-[200ms] delay-[80ms] motion-reduce:transition-none motion-reduce:delay-0 font-medium text-xs text-right opacity-100"
          />
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-[var(--color-primary-text)] transition-colors">
            <SearchIcon className="w-4 h-4" />
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                inputRef.current?.focus();
              }}
              aria-label="پاک کردن جستجو"
              className="absolute inset-y-0 left-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <style>{`@keyframes expandSearchIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
};

export default ExpandableSearch;
