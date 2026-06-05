import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { CpuIcon, SparklesIcon, CalendarIcon, ActivityIcon } from '../../../components/icons';

interface UsageStatus {
  plan_code: string;
  display_name: string;
  monthly_quota: number;
  request_count: number;
  remaining: number;
  period_start: string | null;
  period_end: string | null;
  expires_at: string | null;
}

interface DailyUsage {
  usage_date: string;
  count: number;
}

export const UsageMeter: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [dailyLog, setDailyLog] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        // 1. Get total usage status
        const { data: usageData, error: usageErr } = await supabase.rpc('get_usage_status');
        if (!usageErr && usageData) {
          setUsage(Array.isArray(usageData) ? usageData[0] : usageData);
        }

        // 2. Get past 7 days daily usage (only if not compact)
        if (!compact) {
          const { data: dailyData, error: dailyErr } = await supabase.rpc('get_daily_usage', { p_days: 7 });
          if (!dailyErr && dailyData) {
            setDailyLog(dailyData);
          }
        }
      } catch (err) {
        console.error('Error loading usage meter stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [compact]);

  if (loading) {
    if (compact) {
      return (
        <div className="bg-zinc-900/40 rounded-xl border border-white/5 p-3 w-full animate-pulse flex items-center justify-between" dir="rtl">
          <span className="text-[10px] text-zinc-500 font-bold">درحال بارگذاری سهمیه مصرف...</span>
          <div className="w-20 bg-zinc-950 h-2 rounded-full"></div>
        </div>
      );
    }
    return (
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-white/5 animate-pulse flex flex-col items-center justify-center min-h-[140px]" dir="rtl">
        <CpuIcon className="w-6 h-6 text-zinc-700 animate-spin mb-2" />
        <span className="text-[10px] text-zinc-500 font-bold">درحال بارگذاری گزارش مصرف...</span>
      </div>
    );
  }

  // Fallbacks
  const limit = usage?.monthly_quota || 30;
  const count = usage?.request_count || 0;
  const remaining = Math.max(0, limit - count);
  const percent = limit > 0 ? Math.round((count / limit) * 100) : 100; // Cap at 100 for representation
  const boundedPercent = Math.min(100, Math.max(0, percent));

  if (compact) {
    return (
      <div className="bg-zinc-900/40 rounded-xl border border-white/5 p-2.5 w-full space-y-1.5 text-right" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-300">
            <CpuIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>سهمیه هوش مصنوعی:</span>
          </div>
          <span className="text-[10px] font-black text-purple-400 font-mono">
            {remaining} از {limit} باقی‌مانده
          </span>
        </div>
        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              boundedPercent > 85 ? 'bg-red-500 shadow-sm' :
              boundedPercent > 60 ? 'bg-yellow-500' : 'bg-sky-500'
            }`}
            style={{ width: `${boundedPercent}%` }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-5 space-y-4" dir="rtl">
      {/* Title */}
      <div className="flex items-center justify-between text-right">
        <div className="flex items-center gap-2">
          <CpuIcon className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-black text-zinc-300">سهمیه مصرف هوش مصنوعی</span>
        </div>
        {usage?.plan_code && usage.plan_code !== 'free' ? (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-black text-purple-300 flex items-center gap-1">
            <SparklesIcon className="w-2.5 h-2.5" /> {usage.display_name}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[9px] font-bold text-zinc-400">
            {usage?.display_name || 'رایگان'}
          </span>
        )}
      </div>

      {/* Progress Line */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 font-mono">
          <span>{count} درخواست مصرف شده</span>
          <span>{remaining} عدد باقی‌مانده از {limit}</span>
        </div>
        <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              boundedPercent > 85 ? 'bg-red-500 shadow-sm' :
              boundedPercent > 60 ? 'bg-yellow-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
            }`}
            style={{ width: `${boundedPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Daily Spark Graph (7 days usage logs) */}
      {dailyLog && dailyLog.length > 0 && (
        <div className="pt-2 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
            <ActivityIcon className="w-3.5 h-3.5 text-zinc-600" />
            <span>روند استفاده ۷ روز گذشته</span>
          </div>
          
          <div className="flex items-end justify-between h-10 w-full px-2 pt-1 font-semibold">
            {dailyLog.map((day, ix) => {
              const maxCount = Math.max(...dailyLog.map(d => d.count), 1);
              const barHeight = Math.min(100, Math.max(10, Math.round((day.count / maxCount) * 100)));
              
              // Get short day label or Persian date day
              const dParts = day.usage_date.split('-');
              const label = dParts.length > 2 ? dParts[2] : ix.toString();

              return (
                <div key={day.usage_date} className="flex flex-col items-center h-full flex-1 gap-1.5 group select-none">
                  <div className="w-2.5 bg-zinc-900 hover:bg-purple-500/30 border border-white/5 rounded-t-sm h-full flex items-end justify-center transition-all relative">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-indigo-500 rounded-t-sm transition-all duration-300" 
                      style={{ height: `${barHeight}%` }}
                    ></div>
                    {/* Hover Tooltip displaying transaction/request count */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-zinc-950 text-white border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-mono transition-opacity z-20 pointer-events-none whitespace-nowrap">
                      {day.count} درخواست
                    </div>
                  </div>
                  <span className="text-[8px] text-zinc-600 font-mono mt-0.5 group-hover:text-purple-400 transition-colors">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subscription Expiry indicator */}
      {usage?.expires_at && (
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-zinc-500">
          <div className="flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5 text-zinc-600" />
            <span>تاریخ پایان اشتراک:</span>
          </div>
          <span className="font-mono text-zinc-400">
            {new Date(usage.expires_at).toLocaleDateString('fa-IR')}
          </span>
        </div>
      )}
    </div>
  );
};

export default UsageMeter;
