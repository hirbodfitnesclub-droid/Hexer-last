import React from 'react';
import { Page } from '../types';
import { HomeIcon, ListChecksIcon, NotebookIcon, SparklesIcon, BriefcaseIcon } from './icons';

interface BottomNavProps {
  currentPage: Page;
  setPage: (page: Page) => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: Page;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-full h-full transition-colors duration-300">
    <div className={`transition-all duration-300 ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
      {icon}
    </div>
    <span className={`text-xs mt-1 transition-all duration-300 ${isActive ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-muted)]'}`}>
      {label}
    </span>
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setPage }) => {
  return (
    <div className="fixed bottom-0 right-0 left-0 h-[calc(var(--bottom-nav-space)+var(--safe-area-inset-bottom))] px-4 z-50 pointer-events-none pb-safe">
      <div className="relative w-full h-full max-w-lg mx-auto">
        <div className="absolute bottom-[calc(1rem+var(--safe-area-inset-bottom))] right-0 left-0 h-16 glass-app border border-[var(--border-subtle)] rounded-2xl shadow-2xl shadow-black/50 grid grid-cols-5 items-center pointer-events-auto bg-[var(--bg-app-glass)]">
            <NavItem
              icon={<HomeIcon className="w-6 h-6" />}
              label={Page.Dashboard}
              isActive={currentPage === Page.Dashboard}
              onClick={() => setPage(Page.Dashboard)}
            />
            <NavItem
              icon={<ListChecksIcon className="w-6 h-6" />}
              label={Page.Tasks}
              isActive={currentPage === Page.Tasks}
              onClick={() => setPage(Page.Tasks)}
            />
            {/* Placeholder for the central button */}
            <div /> 
            <NavItem
              icon={<NotebookIcon className="w-6 h-6" />}
              label={Page.Notes}
              isActive={currentPage === Page.Notes}
              onClick={() => setPage(Page.Notes)}
            />
            <NavItem
              icon={<BriefcaseIcon className="w-6 h-6" />}
              label={Page.Projects}
              isActive={currentPage === Page.Projects}
              onClick={() => setPage(Page.Projects)}
            />
        </div>
        <div className="absolute left-1/2 bottom-[calc(1.3rem+var(--safe-area-inset-bottom))] -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-1.5">
            <button
                onClick={() => setPage(Page.Chat)}
                className={`w-14 h-14 bg-lime rounded-full flex items-center justify-center text-[var(--text-on-primary)] shadow-lg shadow-[0_0_15px_rgba(216,240,102,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 ring-4 ring-[var(--bg-card)] cursor-pointer ${
                  currentPage === Page.Chat ? 'scale-105 shadow-[0_0_20px_rgba(216,240,102,0.5)]' : ''
                }`}
                aria-label="چت با هوش مصنوعی"
                >
                <SparklesIcon className="w-7 h-7"/>
            </button>
            <span className={`text-[10px] font-bold leading-none transition-colors duration-300 ${
              currentPage === Page.Chat ? 'text-lime' : 'text-[var(--text-muted)]'
            }`}>
              دستیار
            </span>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
