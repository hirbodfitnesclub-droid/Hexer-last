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
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
      currentMode === mode 
        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-450/55' 
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
