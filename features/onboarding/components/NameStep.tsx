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
        className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-md mb-6"
      >
        <UserIcon className="w-8 h-8 text-neutral-400" />
      </div>

      <div id="name-step-header" className="text-center space-y-2 mb-8">
        <h2
          id="name-step-title"
          className="text-2xl font-black text-white leading-tight tracking-tight"
        >
          سلام! 👋
        </h2>
        <p
          id="name-step-subtitle"
          className="text-sm text-neutral-400 leading-relaxed max-w-xs mx-auto"
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
            className="text-xs font-bold text-neutral-400 block pr-1"
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
            className="w-full h-12 px-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 text-sm transition-all duration-200"
          />
        </div>

        <div id="last-name-group" className="space-y-1.5">
          <label
            id="last-name-label"
            htmlFor="last-name-input"
            className="text-xs font-bold text-neutral-400 block pr-1"
          >
            نام خانوادگی <span className="text-[10px] text-neutral-500 font-normal mr-1">(اختیاری)</span>
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
            className="w-full h-12 px-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 text-sm transition-all duration-200"
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
              className="text-red-500 text-xs font-bold text-right pr-1"
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
              ? 'bg-white text-black hover:bg-neutral-200 shadow-md shadow-white/5'
              : 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
          }`}
        >
          بریم مرحله بعد
        </button>
      </form>
    </div>
  );
};

export default NameStep;
