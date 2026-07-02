import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserIcon } from '../../../components/icons';

interface NameStepProps {
  onSubmit: (fullName: string) => void;
}

export const NameStep: React.FC<NameStepProps> = ({ onSubmit }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  const isFormValid = firstName.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setError('اسمت رو کامل ننوشتی!');
      return;
    }
    setError('');
    onSubmit(lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim());
  };

  return (
    <div
      id="name-step-container"
      className="w-full max-w-md mx-auto p-6 flex flex-col justify-center items-center min-h-[400px]"
      dir="rtl"
    >
      {/* Icon Badge with soft gradient */}
      <div
        id="name-step-icon-badge"
        className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] flex items-center justify-center shadow-md mb-6"
      >
        <UserIcon className="w-8 h-8 text-primary" />
      </div>

      <div id="name-step-header" className="text-center space-y-2 mb-8">
         <h2
          id="name-step-title"
          className="text-2xl font-black text-[var(--text-main)] leading-tight tracking-tight"
        >
          سلام! 👋
        </h2>
        <p
          id="name-step-subtitle"
          className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto"
        >
          هکسر قراره دستیارِ شخصیت باشه؛ پس اول با هم آشنا بشیم.
        </p>
      </div>

      <form
        id="name-step-form"
        onSubmit={handleSubmit}
        className="w-full space-y-5"
      >
        <div id="first-name-group" className="space-y-1.5">
          <label
            id="first-name-label"
            htmlFor="first-name-input"
            className="text-xs font-bold text-[var(--text-muted)] block pr-1"
          >
            نام
          </label>
          <input
            id="first-name-input"
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (error) setError('');
            }}
            placeholder="مثلاً: سینا"
            className="w-full h-12 px-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] text-[var(--text-main)] placeholder-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm transition-all duration-200"
          />
        </div>

        <div id="last-name-group" className="space-y-1.5">
          <label
            id="last-name-label"
            htmlFor="last-name-input"
            className="text-xs font-bold text-[var(--text-muted)] block pr-1"
          >
            نام خانوادگی <span className="text-[10px] text-[var(--text-muted)] opacity-70 font-normal mr-1">(اختیاری)</span>
          </label>
          <input
            id="last-name-input"
            type="text"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (error) setError('');
            }}
            placeholder="مثلاً: رادمان"
            className="w-full h-12 px-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] text-[var(--text-main)] placeholder-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm transition-all duration-200"
          />
        </div>

        {/* Error message slot with Framer Motion */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              id="name-step-error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-[var(--semantic-error)] text-xs font-bold text-right pr-1"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button with touch target constraint */}
        <button
          id="name-step-submit-btn"
          type="submit"
          disabled={!isFormValid}
          className={`w-full h-12 rounded-2xl font-black text-sm transition-all duration-300 active:scale-95 flex items-center justify-center ${
            isFormValid
              ? 'bg-primary text-[var(--text-on-primary)] hover:opacity-90 shadow-md'
              : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)]/50 border border-[var(--border-subtle)]/50 cursor-not-allowed'
          }`}
        >
          بریم مرحله بعد
        </button>
      </form>
    </div>
  );
};

export default NameStep;
