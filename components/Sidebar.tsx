import React from 'react';
import { Page } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { HomeIcon, ListChecksIcon, NotebookIcon, BriefcaseIcon, SparklesIcon } from './icons';

interface SidebarProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  onOpenProfile: () => void;
  className?: string;
}

const toggleTheme = () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('hexer-theme', isDark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#121212' : '#F4F5F7');
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setPage,
  onOpenProfile,
  className = '',
}) => {
  const { user } = useAuth();
  const { profile } = useData();

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'کاربر';
  const avatarLetter = fullName.trim().charAt(0).toUpperCase();
  const firstName = fullName.split(' ')[0] || 'کاربر';

  return (
    <aside className={`w-[240px] flex flex-col h-full shrink-0 overflow-hidden ${className}`} id="desktop-sidebar">
      <div className="flex items-center gap-3 p-4 mb-2 shrink-0">
        <div className="w-10 h-10 rounded-[var(--radius-md)] tile-ink flex items-center justify-center font-black text-xl">
          H
        </div>
        <span className="font-black text-2xl tracking-tight text-[var(--text-main)]">
          HEXER
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        <button
          onClick={() => setPage(Page.Dashboard)}
          className={
            currentPage === Page.Dashboard
              ? "nav-active flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] w-full text-right cursor-pointer"
              : "flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)] rounded-[var(--radius-md)] font-medium transition w-full text-right cursor-pointer"
          }
          id="nav-btn-dashboard"
        >
          <HomeIcon className="w-5 h-5" />
          <span>خانه</span>
        </button>

        <button
          onClick={() => setPage(Page.Tasks)}
          className={
            currentPage === Page.Tasks
              ? "nav-active flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] w-full text-right cursor-pointer"
              : "flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)] rounded-[var(--radius-md)] font-medium transition w-full text-right cursor-pointer"
          }
          id="nav-btn-tasks"
        >
          <ListChecksIcon className="w-5 h-5" />
          <span>کارها</span>
        </button>

        <button
          onClick={() => setPage(Page.Notes)}
          className={
            currentPage === Page.Notes
              ? "nav-active flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] w-full text-right cursor-pointer"
              : "flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)] rounded-[var(--radius-md)] font-medium transition w-full text-right cursor-pointer"
          }
          id="nav-btn-notes"
        >
          <NotebookIcon className="w-5 h-5" />
          <span>یادداشت‌ها</span>
        </button>

        <button
          onClick={() => setPage(Page.Projects)}
          className={
            currentPage === Page.Projects
              ? "nav-active flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] w-full text-right cursor-pointer"
              : "flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)] rounded-[var(--radius-md)] font-medium transition w-full text-right cursor-pointer"
          }
          id="nav-btn-projects"
        >
          <BriefcaseIcon className="w-5 h-5" />
          <span>پروژه‌ها</span>
        </button>

        <button
          onClick={() => setPage(Page.Chat)}
          className={
            currentPage === Page.Chat
              ? "nav-active flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] w-full text-right cursor-pointer"
              : "flex items-center gap-3 px-4 py-3 text-[var(--text-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)] rounded-[var(--radius-md)] font-medium transition w-full text-right cursor-pointer"
          }
          id="nav-btn-chat"
        >
          <SparklesIcon className="w-5 h-5" />
          <span>چت</span>
        </button>
      </nav>

      <div className="mt-auto px-2 pb-6">
        <div className="glass-card p-3.5 rounded-[var(--radius-md)] flex items-center justify-between">
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer text-right min-w-0 flex-1"
            id="profile-trigger-btn"
          >
            <div
              className="w-8 h-8 rounded-full bg-lime flex items-center justify-center font-bold text-sm shrink-0"
              style={{ color: 'var(--text-on-primary)' }}
            >
              {avatarLetter}
            </div>
            <div className="text-sm font-semibold text-[var(--text-main)] truncate">
              {firstName}
            </div>
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full hover:bg-[var(--nav-hover-bg)] text-muted flex items-center justify-center transition cursor-pointer shrink-0"
            id="theme-toggle-btn"
          >
            <svg
              className="w-4 h-4 theme-icon-light"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              className="w-4 h-4 theme-icon-dark"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
