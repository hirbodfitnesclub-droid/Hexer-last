import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SparklesIcon } from './icons';

const AuthComponent: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('ثبت‌نام موفقیت‌آمیز بود! لطفاً ایمیل خود را برای تایید حساب کاربری بررسی کنید.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // The onAuthStateChange listener in AuthContext will handle the redirect.
      }
    } catch (err: any) {
      setError(err.message || 'خطایی رخ داد.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 p-4">
      <div className="w-full max-w-md mx-auto bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
            <SparklesIcon className="w-12 h-12 mx-auto text-sky-400 mb-2"/>
            <h1 className="text-2xl font-bold text-white">به دستیار هوشمند خوش آمدید</h1>
            <p className="text-gray-400 mt-1">{isSignUp ? 'برای شروع یک حساب کاربری جدید بسازید.' : 'برای ادامه وارد حساب خود شوید.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-300 block mb-2">ایمیل</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-300 block mb-2">رمز عبور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="••••••••"
            />
          </div>
          
          {error && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</p>}
          {message && <p className="text-sm text-green-300 bg-green-500/10 p-3 rounded-lg">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white font-semibold py-2.5 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
                isSignUp ? 'ثبت‌نام' : 'ورود'
            )}
          </button>
        </form>

        <p className="text-sm text-center text-gray-400">
          {isSignUp ? 'حساب کاربری دارید؟' : 'هنوز حساب نساخته‌اید؟'}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }} className="font-semibold text-sky-400 hover:underline">
            {isSignUp ? 'وارد شوید' : 'ثبت‌نام کنید'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthComponent;
