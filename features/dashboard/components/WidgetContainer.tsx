import React from 'react';

interface WidgetProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const WidgetContainer: React.FC<WidgetProps> = ({ children, className, id }) => (
  <div 
    id={id}
    className={`bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-4 sm:p-5 ${className || ''}`}
  >
    {children}
  </div>
);
