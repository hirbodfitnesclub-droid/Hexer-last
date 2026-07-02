// components/Auth.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { SparklesIcon, ClockIcon, WarningIcon, CheckIcon, ChevronRightIcon } from './icons';

const AuthComponent: React.FC = () => {
  // Modes: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  // Steps within a mode (for signup and forgot password flows)
  const [step, setStep] = useState<'input' | 'verify' | 'new_password'>('input');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [timer, setTimer] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Marketing attribution state
  const [attribution, setAttribution] = useState<{
    anonymous_id?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  }>({});

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const anonId = searchParams.get('anon_id') || searchParams.get('anonymous_id');
      const utmSource = searchParams.get('utm_source');
      const utmMedium = searchParams.get('utm_medium');
      const utmCampaign = searchParams.get('utm_campaign');
      const utmContent = searchParams.get('utm_content');
      const utmTerm = searchParams.get('utm_term');

      if (anonId) localStorage.setItem('marketing_anonymous_id', anonId);
      if (utmSource) localStorage.setItem('marketing_utm_source', utmSource);
      if (utmMedium) localStorage.setItem('marketing_utm_medium', utmMedium);
      if (utmCampaign) localStorage.setItem('marketing_utm_campaign', utmCampaign);
      if (utmContent) localStorage.setItem('marketing_utm_content', utmContent);
      if (utmTerm) localStorage.setItem('marketing_utm_term', utmTerm);

      const finalAnonId = anonId || localStorage.getItem('marketing_anonymous_id') || '';
      const finalUtmSource = utmSource || localStorage.getItem('marketing_utm_source') || '';
      const finalUtmMedium = utmMedium || localStorage.getItem('marketing_utm_medium') || '';
      const finalUtmCampaign = utmCampaign || localStorage.getItem('marketing_utm_campaign') || '';
      const finalUtmContent = utmContent || localStorage.getItem('marketing_utm_content') || '';
      const finalUtmTerm = utmTerm || localStorage.getItem('marketing_utm_term') || '';

      setAttribution({
        anonymous_id: finalAnonId || undefined,
        utm_source: finalUtmSource || undefined,
        utm_medium: finalUtmMedium || undefined,
        utm_campaign: finalUtmCampaign || undefined,
        utm_content: finalUtmContent || undefined,
        utm_term: finalUtmTerm || undefined,
      });
    } catch (e) {
      console.error('[Attribution] Failed to parse URL or read localStorage', e);
    }
  }, []);

  // Countdown timer for SMS Resend logic
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Normalize Persian/Arabic digits to English and strip non-digit characters
  const cleanPhoneInput = (val: string): string => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let clean = val;
    for (let i = 0; i < 10; i++) {
      clean = clean.replace(new RegExp(farsiDigits[i], 'g'), i.toString());
      clean = clean.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
    }
    return clean.replace(/\D/g, '');
  };

  // Safe Iranian mobile phone validation: must start with 9 and have exactly 10 decimals after phone code conversion
  const isValidIranianPhone = (phoneStr: string): boolean => {
    let localNum = phoneStr;
    if (localNum.startsWith('0098')) localNum = localNum.slice(4);
    else if (localNum.startsWith('98')) localNum = localNum.slice(2);
    else if (localNum.startsWith('0')) localNum = localNum.slice(1);

    return localNum.length === 10 && localNum.startsWith('9');
  };

  // Convert phone to E.164 standard format starting with +98 for Supabase GoTrue Auth
  const formatPhoneToE164 = (phoneStr: string): string => {
    let cleaned = phoneStr;
    if (cleaned.startsWith('09')) {
      cleaned = cleaned.slice(1);
    } else if (cleaned.startsWith('98')) {
      cleaned = cleaned.slice(2);
    } else if (cleaned.startsWith('0098')) {
      cleaned = cleaned.slice(4);
    }
    return '+98' + cleaned;
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanedPhone = cleanPhoneInput(phone);
    if (!isValidIranianPhone(cleanedPhone)) {
      setError('لطفاً یک شماره موبایل معتبر (مثلاً 09123456789) وارد کنید.');
      return;
    }

    if (mode !== 'forgot' && password.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    setLoading(true);
    try {
      const e164 = formatPhoneToE164(cleanedPhone);
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          phone: e164,
          password,
        });
        if (err) throw err;
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          phone: e164,
          password,
          options: {
            data: {
              anonymous_id: attribution.anonymous_id || null,
              utm_source: attribution.utm_source || null,
              utm_medium: attribution.utm_medium || null,
              utm_campaign: attribution.utm_campaign || null,
              utm_content: attribution.utm_content || null,
              utm_term: attribution.utm_term || null,
            }
          }
        });
        if (err) throw err;
        setStep('verify');
        setTimer(60);
        setMessage('کد تایید به شماره شما پیامک شد.');
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.signInWithOtp({
          phone: e164,
        });
        if (err) throw err;
        setStep('verify');
        setTimer(60);
        setMessage('کد یکبار مصرف بازیابی رمز عبور پیامک شد.');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let friendlyError = err.message || 'خطایی در پردازش اطلاعات رخ داد.';
      
      const errMsg = err.message?.toLowerCase() || '';
      if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid_grant')) {
        friendlyError = 'شماره موبایل یا رمز عبور نادرست است. اگر هنوز ثبت‌نام نکرده‌اید، ابتدا گزینه‌ی «ثبت‌نام کنید» را بزنید.';
      } else if (errMsg.includes('user not found')) {
        friendlyError = 'حساب کاربری با این شماره یافت نشد. لطفاً ابتدا ثبت‌نام کنید.';
      } else if (errMsg.includes('user already registered')) {
        friendlyError = 'این شماره موبایل قبلاً ثبت‌نام شده است. لطفاً وارد شوید.';
      }
      
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const otpDigits = cleanPhoneInput(verificationCode);
    if (otpDigits.length !== 6) {
      setError('لطفاً کد تایید ۶ رقمی را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const cleanedPhone = cleanPhoneInput(phone);
      const e164 = formatPhoneToE164(cleanedPhone);

      if (mode === 'signup') {
        const { error: err } = await supabase.auth.verifyOtp({
          phone: e164,
          token: otpDigits,
          type: 'sms',
        });
        if (err) throw err;
        setMessage('ثبت‌نام با موفقیت تایید شد! در حال ورود به حساب...');
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.verifyOtp({
          phone: e164,
          token: otpDigits,
          type: 'sms',
        });
        if (err) throw err;
        setStep('new_password');
        setMessage('کد بازیابی تایید شد. لطفا رمز عبور جدید خود را وارد کنید.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'کد امنیتی وارد شده منقضی شده یا اشتباه است.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    if (password !== newPassword) {
      setError('رمز عبور جدید و تکرار آن همخوانی ندارند.');
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password: password,
      });
      if (err) throw err;
      setMessage('رمز عبور شما با موفقیت تغییر کرد! خوش آمدید.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'خطا در ثبت رمز عبور جدید.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const cleanedPhone = cleanPhoneInput(phone);
      const e164 = formatPhoneToE164(cleanedPhone);

      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          phone: e164,
          password,
          options: {
            data: {
              anonymous_id: attribution.anonymous_id || null,
              utm_source: attribution.utm_source || null,
              utm_medium: attribution.utm_medium || null,
              utm_campaign: attribution.utm_campaign || null,
              utm_content: attribution.utm_content || null,
              utm_term: attribution.utm_term || null,
            }
          }
        });
        if (err) throw err;
        setMessage('کد تایید جدید برای شما پیامک شد.');
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.signInWithOtp({
          phone: e164,
        });
        if (err) throw err;
        setMessage('کد بازیابی جدید پیامک شد.');
      }
      setTimer(60);
      setVerificationCode('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ارسال مجدد کد ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (newMode: 'login' | 'signup' | 'forgot') => {
    setMode(newMode);
    setStep('input');
    setError(null);
    setMessage(null);
    setVerificationCode('');
    setPassword('');
    setNewPassword('');
  };

  return (
    <div dir="rtl" className="flex items-center justify-center min-h-screen bg-[var(--bg-base)] p-4">
      {/* Keyboard-friendly scroll container for Mobile PWAs with exact z-index safety */}
      <div id="auth-card-container" className="w-full max-w-sm mx-auto bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl p-6 shadow-2xl max-h-[96dvh] overflow-y-auto space-y-6">
        
        {/* Title Block */}
        <div className="text-center space-y-2">
          <img src="/icon-192.png" alt="Hexer App Logo" className="w-16 h-16 mx-auto rounded-2xl object-cover shadow-lg border border-[var(--border-subtle)]" referrerPolicy="no-referrer" />
          <h1 className="text-xl font-bold text-[var(--text-main)] tracking-tight">به Hexer خوش اومدی</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {mode === 'login' && 'وارد حساب کاربری خود شوید'}
            {mode === 'signup' && step === 'input' && 'یک حساب کاربری جدید ایجاد کنید'}
            {mode === 'signup' && step === 'verify' && 'کد تایید فرستاده شده را وارد کنید'}
            {mode === 'forgot' && step === 'input' && 'شماره موبایل خود را وارد کنید'}
            {mode === 'forgot' && step === 'verify' && 'کد تایید فرستاده شده را وارد کنید'}
            {mode === 'forgot' && step === 'new_password' && 'رمز عبور جدیدت رو وارد کن'}
          </p>
        </div>

        {/* Message and Error Toasts */}
        {error && (
          <div className="flex items-start gap-2 bg-[var(--semantic-error-soft)] border border-[var(--semantic-error)]/20 p-3 rounded-lg text-xs text-[var(--semantic-error)]">
            <WarningIcon className="w-4 h-4 text-[var(--semantic-error)] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 p-3 rounded-lg text-xs text-primary">
            <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* Form Switchboard */}
        {step === 'input' && (
          <form onSubmit={handleInitialSubmit} className="space-y-4">
            {/* Phone input */}
            <div>
              <label htmlFor="phone" className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">شماره موبایل</label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-center text-[var(--text-main)] text-sm font-mono placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="09123456789"
              />
            </div>

            {/* Password input (only shown for login / signup) */}
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="auth-password" className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">رمز عبور</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-center text-[var(--text-main)] text-sm font-mono placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="رمز عبور (حداقل ۸ کاراکتر)"
                />
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-[var(--text-on-primary)] hover:opacity-90 font-semibold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-md"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4.5 w-4.5 border-t-2 border-b-2 border-[var(--text-on-primary)]"></div>
              ) : (
                <>
                  {mode === 'login' && 'ورود به حساب'}
                  {mode === 'signup' && 'ارسال پیامک تایید'}
                  {mode === 'forgot' && 'ارسال کد بازیابی'}
                </>
              )}
            </button>
          </form>
        )}

        {/* Step: OTP verification code */}
        {step === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="text-center">
              <span className="text-xs text-[var(--text-muted)]">کد ارسال شده به شماره </span>
              <span className="text-xs text-primary font-mono font-bold">{phone}</span>
              <span className="text-xs text-[var(--text-muted)]"> را وارد نمایید:</span>
            </div>

            <div>
              <input
                id="otp-verification-code"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-center text-[var(--text-main)] text-lg font-mono tracking-widest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:[var(--text-muted)]/30"
                placeholder="──────"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={loading}
                className="hover:text-[var(--text-main)] flex items-center gap-1 transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
                <span>ویرایش شماره</span>
              </button>

              {timer > 0 ? (
                <div className="flex items-center gap-1 opacity-85">
                  <ClockIcon className="w-3.5 h-3.5 text-primary animate-pulse" />
                  <span>ارسال مجدد ({timer} ثانیه)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-primary hover:opacity-80 font-medium transition-colors"
                >
                  ارسال مجدد کد تایید
                </button>
              )}
            </div>

            <button
              id="verify-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-[var(--text-on-primary)] hover:opacity-90 font-semibold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4.5 w-4.5 border-t-2 border-b-2 border-[var(--text-on-primary)]"></div>
              ) : (
                'تایید کد'
              )}
            </button>
          </form>
        )}

        {/* Step: New Password setup */}
        {step === 'new_password' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password-field" className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">رمز عبور جدید</label>
              <input
                id="new-password-field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
                className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-center text-[var(--text-main)] text-sm font-mono placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="رمز عبور (حداقل ۸ کاراکتر)"
              />
            </div>

            <div>
              <label htmlFor="new-password-confirm" className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">تکرار رمز عبور جدید</label>
              <input
                id="new-password-confirm"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
                className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-center text-[var(--text-main)] text-sm font-mono placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="رمز عبور (حداقل ۸ کاراکتر)"
              />
            </div>

            <button
              id="new-password-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-[var(--text-on-primary)] hover:opacity-90 font-semibold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4.5 w-4.5 border-t-2 border-b-2 border-[var(--text-on-primary)]"></div>
              ) : (
                'ذخیره و ورود'
              )}
            </button>
          </form>
        )}

        {/* Footer Navigation Switchers */}
        {step === 'input' && (
          <div className="text-xs text-center text-[var(--text-muted)] space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
            {mode === 'login' ? (
              <>
                <p>
                  یافت نشد؟{' '}
                  <button type="button" onClick={() => toggleMode('signup')} className="font-semibold text-primary hover:underline">
                    ثبت‌نام کنید
                  </button>
                </p>
                <button type="button" onClick={() => toggleMode('forgot')} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                  فراموشی رمز عبور؟
                </button>
              </>
            ) : mode === 'signup' ? (
              <p>
                حساب کاربری دارید؟{' '}
                <button type="button" onClick={() => toggleMode('login')} className="font-semibold text-primary hover:underline">
                  وارد شوید
                </button>
              </p>
            ) : (
              <button type="button" onClick={() => toggleMode('login')} className="font-semibold text-primary hover:underline flex items-center justify-center gap-1 mx-auto">
                <span>بازگشت به ورود</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthComponent;
