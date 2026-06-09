import React from 'react';

export interface AnnouncementMeta {
  id: string;
  title: string;
  priority: number; // Higher is selected first
  version: number;  // If priorities are equal, newer version is selected first
}

export interface AnnouncementComponent {
  default: React.FC<{ isOpen: boolean; onClose: () => void }>;
  meta: AnnouncementMeta;
}
