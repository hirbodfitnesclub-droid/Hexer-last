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
    <div className={`transition-all duration-300 ${isActive ? 'text-sky-400' : 'text-gray-500 hover:text-white'}`}>
      {icon}
    </div>
    <span className={`text-xs mt-1 transition-all duration-300 ${isActive ? 'text-sky-400 font-semibold' : 'text-gray-500'}`}>
      {label}
    </span>
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setPage }) => {
  return (
    <div className="fixed bottom-0 right-0 left-0 h-20 px-4 z-50">
      <div className="relative w-full h-full max-w-lg mx-auto">
        <div className="absolute bottom-4 right-0 left-0 h-16 bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 grid grid-cols-5 items-center">
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
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <button
                onClick={() => setPage(Page.Chat)}
                className="w-16 h-16 bg-gradient-to-br from-sky-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-sky-500/30 hover:scale-110 transition-transform duration-300 ring-4 ring-gray-950"
                aria-label="چت با هوش مصنوعی"
                >
                <SparklesIcon className="w-8 h-8"/>
            </button>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
