import React from 'react';
import { XIcon, CheckIcon, InfoIcon, WarningIcon } from '../icons';

export interface AppNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastNotificationsProps {
  notifications: AppNotification[];
  onRemove: (id: number) => void;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({ notifications, onRemove }) => {
  return (
    <div className="fixed bottom-24 right-4 z-[100] w-full max-w-sm space-y-3" id="toast-container">
      {notifications.map(n => (
        <div
          key={n.id}
          id={`toast-${n.id}`}
          className="flex items-center justify-between gap-4 p-4 rounded-xl shadow-2xl bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] text-[var(--text-main)] animate-fade-in-up"
        >
          {n.type === 'success' ? (
            <CheckIcon className="w-6 h-6 flex-shrink-0 text-[var(--semantic-success)]" />
          ) : n.type === 'error' ? (
            <WarningIcon className="w-6 h-6 flex-shrink-0 text-[var(--semantic-error)]" />
          ) : (
            <InfoIcon className="w-6 h-6 flex-shrink-0 text-[var(--color-primary)]" />
          )}
          <div className="flex-1 text-sm">
            <p className="font-semibold text-[var(--text-main)]">{n.message}</p>
            {n.action && (
              <button
                onClick={n.action.onClick}
                className="mt-1 text-xs font-bold underline text-[var(--color-primary)] opacity-90 hover:opacity-100 transition-opacity"
              >
                {n.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => onRemove(n.id)}
            className="p-1 opacity-60 hover:opacity-100 font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
            aria-label="بستن"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
};
