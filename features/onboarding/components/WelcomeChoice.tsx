import React from 'react';
import { SparklesIcon, BotIcon } from '../../../components/icons';

interface WelcomeChoiceProps {
  name: string;
  onSeeWalkthrough: () => void;
  onSkip: () => void;
}

export const WelcomeChoice: React.FC<WelcomeChoiceProps> = ({
  name,
  onSeeWalkthrough,
  onSkip
}) => {
  return (
    <div
      id="welcome-choice-container"
      className="w-full max-w-md mx-auto p-6 flex flex-col justify-center items-center min-h-[400px] text-center"
      dir="rtl"
    >
      {/* Smart Welcome Icon with ambient background glow/shadow */}
      <div
        id="welcome-choice-icon-badge"
        className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-lg mb-8 p-1.5"
      >
        <div className="w-full h-full bg-neutral-950 rounded-2xl flex items-center justify-center">
          <BotIcon className="w-10 h-10 text-sky-400" />
        </div>
      </div>

      <div id="welcome-text-container" className="space-y-4 mb-10">
        <h2
          id="welcome-choice-title"
          className="text-2xl font-black text-white leading-tight tracking-tight"
        >
          سلام {name}!
        </h2>
        <p
          id="welcome-choice-body"
          className="text-sm text-neutral-400 leading-relaxed max-w-xs mx-auto font-medium"
        >
          میخوای تو چندتا اسلایدِ خیلی کوتاه، قلقِ کار با هکسر و رهایی از شلوغیِ ذهن رو بهت بگیم؟
        </p>
      </div>

      <div id="welcome-buttons-container" className="w-full space-y-4">
        {/* Recommended Action: Yes, see walkthrough */}
        <button
          id="see-walkthrough-btn"
          type="button"
          onClick={onSeeWalkthrough}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:opacity-90 active:scale-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 transition-all duration-200"
        >
          <SparklesIcon className="w-4 h-4 text-white" />
          <span>پایه‌ام، بریم! ✨</span>
        </button>

        {/* Skip Action: Just go to the app */}
        <button
          id="skip-to-app-btn"
          type="button"
          onClick={onSkip}
          className="w-full h-12 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white font-bold text-sm flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <span>بیخیال، میخوام برم تو اپ</span>
        </button>
      </div>
    </div>
  );
};

export default WelcomeChoice;
