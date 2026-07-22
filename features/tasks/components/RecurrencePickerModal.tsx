import React, { useEffect, useMemo, useState } from 'react';
import { TaskRecurrence } from '../../../types';
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from '../../../components/icons';
import PersianDatePicker from '../../../components/PersianDatePicker';
import {
  canContinueRecurrence,
  computeNextDueDate,
  formatNextDuePreview,
  normalizeRecurrence,
  tehranTodayNoonIso,
  WEEKDAYS_FA,
} from '../../../utils/recurrenceUtils';
import {
  getDaysInPersianMonth,
  getTehranDateString,
  persianMonths,
  toJalaali,
} from '../../../utils/dateUtils';

type EndUi = 'never' | 'on_date' | 'after_n';
type TypeUi = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface RecurrencePickerModalProps {
  isOpen: boolean;
  value: TaskRecurrence | null;
  onChange: (v: TaskRecurrence | null) => void;
  onClose: () => void;
  anchorDueDate?: string | null;
}

const SelectWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative flex-1 min-w-0">
    {children}
    <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
      <ChevronDownIcon className="w-4 h-4" />
    </div>
  </div>
);

const TypeRow: React.FC<{
  label: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ label, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors text-right ${
      selected
        ? 'bg-primary/10 border-[var(--border-neon)] text-[var(--color-primary-text)]'
        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)]'
    }`}
  >
    <span>{label}</span>
    {selected && <CheckIcon className="w-4 h-4 text-[var(--color-primary-text)] shrink-0" />}
  </button>
);

const ChipToggle: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
}> = ({ label, active, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl border text-xs font-bold transition-colors ${
      active
        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--text-on-primary)]'
        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)]'
    }`}
  >
    {label}
  </button>
);

function typeOf(r: TaskRecurrence | null): TypeUi {
  if (!r) return 'none';
  return r.type;
}

function endOf(r: TaskRecurrence | null): { mode: EndUi; n: number; dateIso: string | null } {
  if (!r?.end) return { mode: 'never', n: 5, dateIso: null };
  if (r.end.kind === 'on_date') {
    return {
      mode: 'on_date',
      n: 5,
      dateIso: (() => {
        try {
          const [Y, M, D] = r.end.date.split('-').map(Number);
          return new Date(Date.UTC(Y, M - 1, D, 9, 0, 0)).toISOString();
        } catch {
          return tehranTodayNoonIso();
        }
      })(),
    };
  }
  return { mode: 'after_n', n: Math.max(1, (r.end.remaining ?? 0) + 1), dateIso: null };
}

export const RecurrencePickerModal: React.FC<RecurrencePickerModalProps> = ({
  isOpen,
  value,
  onChange,
  onClose,
  anchorDueDate,
}) => {
  const [typeUi, setTypeUi] = useState<TypeUi>('none');
  const [weekdays, setWeekdays] = useState<number[]>([6]);
  const [monthDays, setMonthDays] = useState<number[]>([1]);
  const [yearDates, setYearDates] = useState<Array<{ month: number; day: number }>>([
    { month: 1, day: 1 },
  ]);
  const [endMode, setEndMode] = useState<EndUi>('never');
  const [endN, setEndN] = useState(5);
  const [endDateIso, setEndDateIso] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const n = normalizeRecurrence(value);
    setTypeUi(typeOf(n));
    if (n?.type === 'weekly') setWeekdays([...n.weekdays]);
    else setWeekdays([6]);
    if (n?.type === 'monthly') setMonthDays([...n.days]);
    else setMonthDays([1]);
    if (n?.type === 'yearly') setYearDates(n.dates.map((d) => ({ ...d })));
    else {
      const j = toJalaali(new Date());
      setYearDates([{ month: j.jm, day: j.jd }]);
    }
    const e = endOf(n);
    setEndMode(e.mode);
    setEndN(e.n);
    setEndDateIso(e.dateIso ?? tehranTodayNoonIso());
  }, [isOpen, value]);

  const draft: TaskRecurrence | null = useMemo(() => {
    if (typeUi === 'none') return null;
    let base: TaskRecurrence | null = null;
    if (typeUi === 'daily') base = { type: 'daily' };
    if (typeUi === 'weekly') base = { type: 'weekly', weekdays: [...weekdays] };
    if (typeUi === 'monthly') base = { type: 'monthly', days: [...monthDays] };
    if (typeUi === 'yearly') base = { type: 'yearly', dates: yearDates.map((d) => ({ ...d })) };
    if (!base) return null;

    if (endMode === 'on_date' && endDateIso) {
      base = {
        ...base,
        end: { kind: 'on_date', date: getTehranDateString(new Date(endDateIso)) },
      };
    } else if (endMode === 'after_n') {
      const N = Math.min(999, Math.max(1, Math.floor(endN) || 1));
      base = { ...base, end: { kind: 'after_n', remaining: N - 1 } };
    }
    return normalizeRecurrence(base);
  }, [typeUi, weekdays, monthDays, yearDates, endMode, endN, endDateIso]);

  const selectionInvalid =
    typeUi === 'weekly'
      ? weekdays.length === 0
      : typeUi === 'monthly'
        ? monthDays.length === 0
        : typeUi === 'yearly'
          ? yearDates.length === 0
          : false;

  const preview = useMemo(() => {
    if (!draft || selectionInvalid) return null;
    const anchor = anchorDueDate || tehranTodayNoonIso();
    const next = computeNextDueDate(anchor, draft);
    if (!next) return { ok: false as const, text: 'نوبت بعدی قابل محاسبه نیست' };
    if (!canContinueRecurrence(draft, next)) {
      return { ok: false as const, text: 'با این تنظیمات نوبت بعدی ساخته نمی‌شود' };
    }
    return { ok: true as const, text: `نوبت بعدی: ${formatNextDuePreview(next)}` };
  }, [draft, selectionInvalid, anchorDueDate]);

  if (!isOpen) return null;

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const toggleMonthDay = (d: number) => {
    setMonthDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const jy = toJalaali(new Date()).jy;

  const handleConfirm = () => {
    if (selectionInvalid) return;
    onChange(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[70] flex justify-center items-end sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] w-full max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh]"
        dir="rtl"
      >
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex justify-between items-center shrink-0 pt-safe">
          <h2 className="text-base font-bold text-[var(--text-main)]">تکرار</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--nav-hover-bg)] rounded-xl"
            aria-label="بستن"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-5">
          <div className="space-y-2">
            <TypeRow label="بدون تکرار" selected={typeUi === 'none'} onSelect={() => setTypeUi('none')} />
            <TypeRow label="هر روز" selected={typeUi === 'daily'} onSelect={() => setTypeUi('daily')} />
            <TypeRow
              label="برخی روزها در هفته"
              selected={typeUi === 'weekly'}
              onSelect={() => setTypeUi('weekly')}
            />
            <TypeRow
              label="برخی روزها در ماه"
              selected={typeUi === 'monthly'}
              onSelect={() => setTypeUi('monthly')}
            />
            <TypeRow
              label="برخی روزهای سال"
              selected={typeUi === 'yearly'}
              onSelect={() => setTypeUi('yearly')}
            />
          </div>

          {typeUi === 'weekly' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[var(--text-muted)]">روزهای هفته</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS_FA.map((w) => (
                  <ChipToggle
                    key={w.jsDay}
                    label={w.label}
                    active={weekdays.includes(w.jsDay)}
                    onToggle={() => toggleWeekday(w.jsDay)}
                  />
                ))}
              </div>
              {weekdays.length === 0 && (
                <p className="text-[11px] text-[var(--semantic-error)]">حداقل یک روز را انتخاب کن</p>
              )}
            </div>
          )}

          {typeUi === 'monthly' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[var(--text-muted)]">روزهای ماه</p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <ChipToggle
                    key={d}
                    label={String(d)}
                    active={monthDays.includes(d)}
                    onToggle={() => toggleMonthDay(d)}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                در ماه‌های جلالی کوتاه‌تر روی آخرین روز ماه می‌افتد
              </p>
              {monthDays.length === 0 && (
                <p className="text-[11px] text-[var(--semantic-error)]">حداقل یک روز را انتخاب کن</p>
              )}
            </div>
          )}

          {typeUi === 'yearly' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[var(--text-muted)]">تاریخ‌های سال (جلالی)</p>
              {yearDates.map((row, idx) => {
                const maxD = getDaysInPersianMonth(jy, row.month);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <SelectWrap>
                      <select
                        value={row.day}
                        onChange={(e) => {
                          const day = Math.min(parseInt(e.target.value, 10), maxD);
                          setYearDates((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, day } : r))
                          );
                        }}
                        className="w-full bg-[var(--bg-card)] appearance-none px-3 py-2.5 rounded-lg text-[var(--text-main)] border border-[var(--border-subtle)] text-sm"
                      >
                        {Array.from({ length: maxD }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </SelectWrap>
                    <SelectWrap>
                      <select
                        value={row.month}
                        onChange={(e) => {
                          const month = parseInt(e.target.value, 10);
                          const md = getDaysInPersianMonth(jy, month);
                          setYearDates((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { month, day: Math.min(r.day, md) }
                                : r
                            )
                          );
                        }}
                        className="w-full bg-[var(--bg-card)] appearance-none px-3 py-2.5 rounded-lg text-[var(--text-main)] border border-[var(--border-subtle)] text-sm"
                      >
                        {persianMonths.map((name, i) => (
                          <option key={name} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </SelectWrap>
                    {yearDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setYearDates((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 min-h-[44px] min-w-[44px] text-[var(--text-muted)] hover:text-[var(--semantic-error)]"
                        aria-label="حذف تاریخ"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const j = toJalaali(new Date());
                  setYearDates((prev) => [...prev, { month: j.jm, day: j.jd }]);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-text)] min-h-[44px]"
              >
                <PlusIcon className="w-4 h-4" />
                افزودن تاریخ
              </button>
            </div>
          )}

          {typeUi !== 'none' && (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
              <p className="text-xs font-bold text-[var(--text-muted)]">پایان تکرار</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['never', 'بدون پایان'],
                    ['on_date', 'در تاریخ'],
                    ['after_n', 'بعد از N بار'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEndMode(k)}
                    className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold transition-colors ${
                      endMode === k
                        ? 'bg-primary/10 border-[var(--border-neon)] text-[var(--color-primary-text)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {endMode === 'on_date' && (
                <PersianDatePicker
                  value={endDateIso}
                  onChange={(iso) => setEndDateIso(iso)}
                />
              )}
              {endMode === 'after_n' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">تعداد نوبت (شامل همین):</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={endN}
                    onChange={(e) => setEndN(parseInt(e.target.value, 10) || 1)}
                    className="w-24 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] text-center font-mono min-h-[44px]"
                  />
                </div>
              )}
            </div>
          )}

          {typeUi !== 'none' && preview && (
            <div
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold border ${
                preview.ok
                  ? 'bg-primary/10 border-[var(--border-neon)] text-[var(--color-primary-text)]'
                  : 'bg-[var(--semantic-error-soft)] border-[var(--semantic-error)]/20 text-[var(--semantic-error)]'
              }`}
            >
              {preview.text}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 pb-safe border-t border-[var(--border-subtle)] flex gap-3 shrink-0">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectionInvalid}
            className="flex-1 min-h-[44px] bg-[var(--color-primary)] text-[var(--text-on-primary)] rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            تأیید
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] rounded-xl font-bold text-sm"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecurrencePickerModal;
