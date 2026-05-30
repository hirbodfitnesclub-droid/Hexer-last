import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const NetworkBanner: React.FC = () => {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[9999] flex justify-center pointer-events-none select-none font-sans">
      <div 
        className="bg-neutral-900/80 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-full shadow-[0_12px_40px_-12px_rgba(245,158,11,0.25)] flex items-center justify-between gap-3 text-[11px] font-bold backdrop-blur-md max-w-sm w-full animate-fade-in pointer-events-auto"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          {/* Heartbeat glowing signal */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>امواج قطع شد! آفلاین کار کن 📡</span>
        </div>
        <span className="text-[10px] text-neutral-400 font-medium">ذخیره خودکار در اتصال بعدی</span>
      </div>
    </div>
  );
};

export default NetworkBanner;
