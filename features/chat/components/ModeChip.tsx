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
        ? 'bg-primary text-[var(--text-on-primary)] shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)] ring-2 ring-primary/50 scale-[1.03] z-[2]' 
        : 'glass-card border-subtle text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
