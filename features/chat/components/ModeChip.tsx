import React from 'react';
import { ChatMode } from '../../../types';

interface ModeChipProps {
  mode: ChatMode;
  currentMode: ChatMode;
  label: string;
  icon: React.ReactNode;
  onClick: (m: ChatMode) => void;
}

export const ModeChip: React.FC<ModeChipProps> = ({ mode, currentMode, label, icon, onClick }) => (
  <button
    onClick={() => onClick(mode)}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
      currentMode === mode 
        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/50 scale-[1.03] z-[2]' 
        : 'bg-neutral-900 border border-neutral-800 text-zinc-400 hover:bg-neutral-800 hover:text-white'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
