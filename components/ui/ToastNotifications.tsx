import React from 'react';
import { XIcon, CheckIcon } from '../icons';

export interface AppNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
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
          className={`flex items-center justify-between gap-4 p-4 rounded-xl shadow-2xl shadow-black/50 animate-fade-in-up border ${
            n.type === 'success'
              ? 'bg-green-600/20 border-green-500/30 text-green-200'
              : 'bg-red-600/20 border-red-500/30 text-red-200'
          } backdrop-blur-xl`}
        >
          <CheckIcon className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{n.message}</p>
            {n.action && (
              <button
                onClick={n.action.onClick}
                className="mt-1 text-xs font-bold underline opacity-80 hover:opacity-100"
              >
                {n.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => onRemove(n.id)}
            className="p-1 opacity-60 hover:opacity-100 font-mono"
            aria-label="بستن"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
};
