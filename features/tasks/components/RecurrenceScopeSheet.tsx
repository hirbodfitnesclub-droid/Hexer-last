import React from 'react';
import type { Task } from '../../../types';
import { describeRecurrenceFa } from '../../../utils/recurrenceUtils';

export type RecurrenceScopeChoice = 'skip' | 'edit_current' | 'edit_future' | 'stop';

interface RecurrenceScopeSheetProps {
  isOpen: boolean;
  task: Task;
  /** Number of open occurrences after this one, shown before a destructive choice. */
  futureOpenCount: number;
  busyChoice?: RecurrenceScopeChoice | null;
  onChoose: (choice: RecurrenceScopeChoice, options?: { keepCurrent?: boolean }) => void;
  onClose: () => void;
}

interface ChoiceConfig {
  choice: RecurrenceScopeChoice;
  label: string;
  detail: string;
  destructive?: boolean;
}

/**
 * Scope chooser for a repeating task. Editing one occurrence and editing the whole
 * series are different intentions, so the user picks explicitly instead of the app
 * guessing. Stopping and skipping name their consequence before they run.
 */
export const RecurrenceScopeSheet: React.FC<RecurrenceScopeSheetProps> = ({
  isOpen,
  task,
  futureOpenCount,
  busyChoice,
  onChoose,
  onClose,
}) => {
  const [confirming, setConfirming] = React.useState<RecurrenceScopeChoice | null>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setConfirming(null);
      return;
    }
    previouslyFocused.current = document.activeElement;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      // Return focus where it was, so keyboard users are not dropped at the top.
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const choices: ChoiceConfig[] = [
    { choice: 'edit_current', label: 'فقط همین نوبت', detail: 'تغییر روی این نوبت اعمال می‌شود و قانون تکرار دست‌نخورده می‌ماند.' },
    {
      choice: 'edit_future',
      label: 'این نوبت و نوبت‌های بعد',
      detail: futureOpenCount > 0
        ? `این نوبت و ${futureOpenCount} نوبت باز بعدی تغییر می‌کند. نوبت‌های انجام‌شده دست‌نخورده می‌مانند.`
        : 'قانون تکرار برای نوبت‌های بعدی تغییر می‌کند. نوبت‌های انجام‌شده دست‌نخورده می‌مانند.',
    },
    { choice: 'skip', label: 'رد کردن این نوبت', detail: 'این نوبت انجام‌شده حساب نمی‌شود و کار به نوبت بعدی منتقل می‌شود.' },
    { choice: 'stop', label: 'توقف تکرار', detail: 'نوبت‌های بعدی ساخته نمی‌شوند. تاریخچه انجام‌شده حفظ می‌شود.', destructive: true },
  ];

  const active = choices.find(item => item.choice === confirming);

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[80] flex justify-center items-end sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurrence-scope-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={event => event.stopPropagation()}
        className="bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
        dir="rtl"
      >
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] pt-safe">
          <h2 id="recurrence-scope-title" className="text-base font-bold text-[var(--text-main)]">
            این تغییر روی کدام نوبت‌ها اعمال شود؟
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {describeRecurrenceFa(task.recurrence, { dueDate: task.due_date })}
          </p>
        </div>

        {active ? (
          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-sm font-semibold text-[var(--text-main)]">{active.label}</p>
            <p className="text-xs text-[var(--text-muted)] leading-6">{active.detail}</p>
            {active.choice === 'stop' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onChoose('stop', { keepCurrent: true })}
                  disabled={busyChoice === 'stop'}
                  className="w-full min-h-[44px] rounded-xl bg-[var(--color-primary)] text-[var(--text-on-primary)] font-bold text-sm disabled:opacity-40"
                >
                  توقف تکرار و نگه‌داشتن این نوبت
                </button>
                <button
                  type="button"
                  onClick={() => onChoose('stop', { keepCurrent: false })}
                  disabled={busyChoice === 'stop'}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--semantic-error)]/30 text-[var(--semantic-error)] font-bold text-sm disabled:opacity-40"
                >
                  توقف تکرار و بستن این نوبت
                </button>
              </div>
            )}
            {active.choice !== 'stop' && (
              <button
                type="button"
                onClick={() => onChoose(active.choice)}
                disabled={busyChoice === active.choice}
                className="w-full min-h-[44px] rounded-xl bg-[var(--color-primary)] text-[var(--text-on-primary)] font-bold text-sm disabled:opacity-40"
              >
                تأیید
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] font-bold text-sm"
            >
              بازگشت
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-2">
            {choices.map(item => (
              <button
                key={item.choice}
                type="button"
                onClick={() => setConfirming(item.choice)}
                disabled={!!busyChoice}
                className={`w-full text-right p-3 rounded-xl border transition-colors min-h-[44px] disabled:opacity-40 ${
                  item.destructive
                    ? 'border-[var(--semantic-error)]/30 hover:bg-[var(--semantic-error-soft)]'
                    : 'border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)]'
                }`}
              >
                <span className={`block text-sm font-bold ${item.destructive ? 'text-[var(--semantic-error)]' : 'text-[var(--text-main)]'}`}>
                  {item.label}
                </span>
                <span className="block text-[11px] text-[var(--text-muted)] mt-1 leading-5">{item.detail}</span>
              </button>
            ))}
          </div>
        )}

        <div className="p-4 sm:p-5 pb-safe border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] font-bold text-sm"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecurrenceScopeSheet;
