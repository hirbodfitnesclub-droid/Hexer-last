import React, { useState, useEffect } from 'react';
import { getCurrentTimeSlot, MAX_PER_DAY } from './config';
import { getImpressions, getDismissed, dismissAnnouncement, recordImpression } from './storage';

// Discover all temporary modals in the target directory (excluding nested archive/)
const modules = import.meta.glob('./TemporaryModals/*.tsx', { eager: true }) as Record<string, any>;

export const AnnouncementManager: React.FC = () => {
  const [activeAnnouncement, setActiveAnnouncement] = useState<{
    Component: React.FC<{ isOpen: boolean; onClose: () => void }>;
    id: string;
    version: number;
  } | null>(null);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const currentSlot = getCurrentTimeSlot();
    if (!currentSlot) return;

    // Check overall daily impressions and if this slot has played already
    const impressions = getImpressions();
    if (impressions.slotsShown.length >= MAX_PER_DAY) return;
    if (impressions.slotsShown.includes(currentSlot.id)) return;

    // Retrieve user dismissed memory
    const dismissed = getDismissed();

    // Map modules into list of candidates
    const candidates: {
      Component: React.FC<{ isOpen: boolean; onClose: () => void }>;
      id: string;
      priority: number;
      version: number;
    }[] = [];

    for (const path in modules) {
      // In Vite's non-recursive glob, archive subfolder files won't match,
      // but let's include a defensive guard just in case or for safety.
      if (path.includes('/archive/')) continue;

      const mod = modules[path];
      if (mod && mod.default && mod.meta) {
        const { id, priority, version } = mod.meta;

        // Skip if this version (or a newer one) of the modal has been dismissed
        if (dismissed[id] !== undefined && dismissed[id] >= version) {
          continue;
        }

        candidates.push({
          Component: mod.default,
          id,
          priority: priority ?? 0,
          version: version ?? 1,
        });
      }
    }

    if (candidates.length === 0) return;

    // Sort: Priority (descending), then Version (descending)
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.version - a.version;
    });

    const selected = candidates[0];

    setActiveAnnouncement({
      Component: selected.Component,
      id: selected.id,
      version: selected.version,
    });
    setIsOpen(true);

    // Commit impression on first display
    recordImpression(currentSlot.id);
  }, []);

  if (!activeAnnouncement || !isOpen) return null;

  const handleClose = () => {
    dismissAnnouncement(activeAnnouncement.id, activeAnnouncement.version);
    setIsOpen(false);
  };

  const { Component } = activeAnnouncement;
  return <Component isOpen={isOpen} onClose={handleClose} />;
};

export default AnnouncementManager;
