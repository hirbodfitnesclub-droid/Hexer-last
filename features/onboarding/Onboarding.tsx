import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { completeOnboarding } from '../../services/profileService';
import NameStep from './components/NameStep';
import WelcomeChoice from './components/WelcomeChoice';
import SlideViewer from './components/SlideViewer';
import { WarningIcon } from '../../components/icons';

interface OnboardingProps {
  userId: string;
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ userId, onComplete }) => {
  const [phase, setPhase] = useState<'name' | 'choice' | 'slides'>('name');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Save changes to database and transition
  const handleFinishOnboarding = async (nameToSave: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      await completeOnboarding(nameToSave);
      onComplete();
    } catch (err: any) {
      console.error('[Onboarding] Error in handleFinishOnboarding:', err);
      setErrorMsg(
        err.message || 'انگار اینترنت قطع شده یا سرور جواب نمیده. یه چکی بکن و دوباره امتحان کن.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = (name: string) => {
    setFullName(name);
    setPhase('choice');
  };

  const handleSeeWalkthrough = () => {
    setPhase('slides');
  };

  // Variants for phase slide transitions
  const stepVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  return (
    <div
      id="onboarding-root-screen"
      className="fixed inset-0 bg-[var(--bg-base)] text-[var(--text-main)] overflow-hidden flex flex-col z-[100] preserve-safe-area"
      dir="rtl"
    >
      {/* Background Ambient Decorative Light Spot to convey a magical feels */}
      <div id="onboarding-ambient-light" className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Safe Frame */}
      <div
        id="onboarding-content-frame"
        className="flex-1 flex flex-col justify-between w-full max-w-lg mx-auto px-6 py-6 overflow-y-auto pt-safe pb-safe-content"
      >
        {/* Loading Overlay state */}
        <AnimatePresence>
          {loading && (
            <motion.div
              id="onboarding-loading-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[var(--bg-base)]/90 backdrop-blur-md z-[110] flex flex-col items-center justify-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <p className="text-sm font-bold text-[var(--text-muted)]">در حال آماده‌سازی مغزِ دومِ شما... 🧠</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Error Banner */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              id="onboarding-global-error-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/20 rounded-2xl p-4 flex items-start gap-3 mb-6"
            >
              <WarningIcon className="w-5 h-5 text-[var(--semantic-error)] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--semantic-error)]">یه مشکلی پیش اومده!</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed font-semibold">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => handleFinishOnboarding(fullName)}
                  className="text-xs font-black text-[var(--semantic-error)] opacity-90 hover:opacity-100 underline pt-1"
                >
                  دوباره تلاش کن
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Slide Transitions with AnimatePresence */}
        <div id="onboarding-active-module" className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {phase === 'name' && (
              <motion.div
                id="onboarding-phase-name"
                key="name-step"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <NameStep onSubmit={handleNameSubmit} />
              </motion.div>
            )}

            {phase === 'choice' && (
              <motion.div
                id="onboarding-phase-choice"
                key="welcome-choice"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <WelcomeChoice
                  name={fullName}
                  onSeeWalkthrough={handleSeeWalkthrough}
                  onSkip={() => handleFinishOnboarding(fullName)}
                />
              </motion.div>
            )}

            {phase === 'slides' && (
              <motion.div
                id="onboarding-phase-slides"
                key="slide-viewer"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full h-full flex flex-col"
              >
                <SlideViewer
                  onFinish={() => handleFinishOnboarding(fullName)}
                  onSkip={() => handleFinishOnboarding(fullName)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
