import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SparklesIcon, CheckIcon } from './icons';

interface OnboardingProps {
  userId: string;
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ userId, onComplete }) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTopics = [
    { label: 'مدیریت زمان ⏳', value: 'time_management' },
    { label: 'برنامه‌نویسی و توسعه 💻', value: 'coding' },
    { label: 'بهره‌وری بالا ⚡', value: 'productivity' },
    { label: 'آموزش و مطالعه 📚', value: 'learning' },
    { label: 'تمرکز بی‌نهایت 🧠', value: 'focus' },
    { label: 'کارهای روزمره 📝', value: 'daily' },
    { label: 'ورزش و سلامتی 🏃‍♂️', value: 'fitness' },
    { label: 'ایده‌پردازی و استارتاپ 🚀', value: 'startup' },
  ];

  const handleTopicToggle = (topicVal: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicVal)
        ? prev.filter(t => t !== topicVal)
        : [...prev, topicVal]
    );
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!fullName.trim()) {
        setError('لطفا اسم باحالت رو برامون بنویس! ✨');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('لطفا نام و نام خانوادگی خود را وارد کنید.');
      setStep(1);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          onboarding_completed: true
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      onComplete();
    } catch (err: any) {
      console.error('Failed to update onboarding:', err);
      setError(err?.message || 'خطایی در ثبت اطلاعات رخ داد. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col justify-between p-6 z-50 overflow-hidden font-sans select-none">
      {/* Decorative background glow elements for premium cyber-vibe */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-pink-600/10 blur-[120px] pointer-events-none"></div>

      {/* Progress Bar & Header */}
      <div className="w-full max-w-md mx-auto pt-4 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 p-[1px] shadow-lg shadow-sky-500/10">
              <div className="w-full h-full bg-neutral-950 rounded-xl flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-bold">هکسر // خوش‌آمدگویی ✨</span>
          </div>
          <span className="text-xs font-mono text-neutral-500">{step} / ۳</span>
        </div>

        {/* Liquid Progress Bar */}
        <div className="h-[3px] w-full bg-neutral-900 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-sky-400 via-indigo-500 to-pink-500 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Main Content Area Container (Mobile-First optimized viewport height) */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center py-6 relative z-15">
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs text-center font-semibold animate-shake">
            {error}
          </div>
        )}

        {/* Step 1: Username & Initial Spark */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="space-y-2">
              <span className="text-xs font-bold text-sky-450 bg-sky-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">شروع ماجراجویی 🚀</span>
              <h1 className="text-3xl font-black text-white leading-tight">
                ورود به دنیای <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">هکسر</span>
              </h1>
              <p className="text-sm text-neutral-400 font-medium">برای شروع، اسمی که دوست داری صدات کنیم رو بنویس.</p>
            </div>

            <div className="space-y-2 pt-4">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-bold">نام و نام خانوادگی *</label>
              <div className="relative group">
                <input
                  type="text"
                  required
                  placeholder="مثلا: آرش ملکی 😎"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-neutral-900/60 border border-neutral-800 focus:border-sky-400 rounded-2xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none transition-all duration-300 backdrop-blur-md shadow-inner text-base font-medium"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 opacity-0 group-focus-within:opacity-10 pointer-events-none transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: What is your Magic / Focus? */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="space-y-2">
              <span className="text-xs font-bold text-indigo-455 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">شخصی‌سازی فضا 🛸</span>
              <h1 className="text-3xl font-black text-white leading-tight">
                تخصص یا <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-450">وایب کاریت</span> چیه؟
              </h1>
              <p className="text-sm text-neutral-400 font-medium">این بخش به هکسر کمک می‌کنه تا دستیار شخصی‌تری برات بسازه.</p>
            </div>

            <div className="space-y-2 pt-4">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-bold">نقش یا تخصص شما 🪐</label>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="مثلا: دیزاینر خفن، جادوگر فرانت‌اند..."
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full bg-neutral-900/60 border border-neutral-800 focus:border-indigo-400 rounded-2xl px-5 py-4 text-white placeholder-neutral-600 focus:outline-none transition-all duration-300 backdrop-blur-md shadow-inner text-base font-medium"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-400 to-pink-500 opacity-0 group-focus-within:opacity-10 pointer-events-none transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Alignment & Vibe Sync */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="space-y-2">
              <span className="text-xs font-bold text-pink-450 bg-pink-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">هم‌راستایی فرکانس 🪐</span>
              <h1 className="text-3xl font-black text-white leading-tight">
                حوزه‌های <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-amber-400">تمرکز اصلیت</span>؟
              </h1>
              <p className="text-sm text-neutral-400 font-medium">هر چندتا هدف یا حوزه‌ای که برات اولویت داره رو کلیک کن.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-4">
              {availableTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic.value);
                return (
                  <button
                    key={topic.value}
                    type="button"
                    onClick={() => handleTopicToggle(topic.value)}
                    className={`text-xs px-4 py-3.5 rounded-2xl border text-right transition-all duration-300 flex items-center justify-between ${
                      isSelected 
                        ? 'bg-gradient-to-tr from-pink-500/10 to-amber-500/10 border-pink-500/50 text-white font-extrabold shadow-lg shadow-pink-500/5 scale-[1.02]' 
                        : 'border-neutral-850 bg-neutral-900/40 text-neutral-400 hover:border-neutral-800 hover:text-white'
                    }`}
                  >
                    <span>{topic.label}</span>
                    {isSelected && <CheckIcon className="w-4 h-4 text-pink-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-md mx-auto pb-6 relative z-10 flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(prev => prev - 1)}
            className="flex-1 border border-neutral-850 hover:border-neutral-700 text-neutral-400 hover:text-white font-black py-4 rounded-2xl transition-all duration-300 active:scale-95 text-sm uppercase font-mono"
            dir="rtl"
          >
            عقب
          </button>
        )}
        
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="flex-[2] bg-white text-black hover:bg-neutral-200 font-black py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl shadow-white/5 active:scale-95 text-sm flex items-center justify-center gap-2"
          >
            <span>ادامه</span>
            <span className="font-bold">←</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-[2] bg-gradient-to-r from-sky-400 via-indigo-500 to-pink-500 hover:opacity-90 text-white font-black py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl shadow-indigo-500/10 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>بریم تو کارش! ✨</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
