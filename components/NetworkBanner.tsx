import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useData } from '../contexts/DataContext';
import { RefreshCw, WifiOff } from 'lucide-react';

export const NetworkBanner: React.FC = () => {
  const isOnline = useNetworkStatus();
  const { isSyncing, pendingCount, flushOutbox } = useData();

  // If online, there's no ongoing sync, and no pending changes, render nothing.
  if (isOnline && !isSyncing && pendingCount === 0) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[9999] flex justify-center pointer-events-none select-none font-sans">
      <div 
        className="bg-neutral-900/90 border border-neutral-800 text-neutral-200 px-4 py-3 rounded-full shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4 text-[11px] font-bold backdrop-blur-md max-w-sm w-full animate-fade-in pointer-events-auto animate-duration-300"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              {/* Pulsing amber locator representing offline state */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-200">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>امواج قطع شد! آفلاین کار کن 📡</span>
              </span>
            </>
          ) : isSyncing ? (
            <>
              {/* Rotating gear/spin loader representing active sync */}
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              <span className="text-sky-300">در حال همگام‌سازی تغییرات... 🔄</span>
            </>
          ) : (
            <>
              {/* Online, but items are pending flush */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-300">آماده همگام‌سازی تغییرات معلق</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[9px] px-2 py-0.5 rounded-full">
              {pendingCount} تغییر معلق
            </span>
          )}

          {isOnline && pendingCount > 0 && !isSyncing && (
            <button
              onClick={() => flushOutbox().catch(e => console.warn('[Manual Sync] failed:', e))}
              className="bg-sky-500 hover:bg-sky-600 active:scale-95 text-[10px] text-white px-2.5 py-0.5 rounded-full cursor-pointer select-none font-medium transition"
              title="همگام‌سازی دستی"
            >
              همگام‌سازی
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkBanner;
