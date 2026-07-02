import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { WifiIcon } from './icons';

export const NetworkBanner: React.FC = () => {
  const isOnline = useNetworkStatus();

  // If online, render nothing as required by Anti-Pattern 79 & UX specifications.
  if (isOnline) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[9999] flex justify-center pointer-events-none select-none font-sans">
      <div 
        className="bg-[var(--semantic-error)] text-white px-4 py-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-2 text-xs font-bold backdrop-blur-md animate-fade-in pointer-events-auto"
        dir="rtl"
      >
        {/* Pulsing white indicator representing offline status */}
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
        </span>
        <WifiIcon className="w-4 h-4 text-white animate-pulse" />
        <span>شما آفلاین هستید. تغییرات ذخیره می‌شوند.</span>
      </div>
    </div>
  );
};

export default NetworkBanner;
