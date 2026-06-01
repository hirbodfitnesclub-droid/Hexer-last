import React from 'react';

interface WidgetProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const WidgetContainer: React.FC<WidgetProps> = ({ children, className, id }) => (
  <div 
    id={id}
    className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/30 transition-all duration-300 ${className || ''}`}
  >
    {children}
  </div>
);
