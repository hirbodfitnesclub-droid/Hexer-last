import { getTehranDateString } from '../../utils/dateUtils';

const STORAGE_KEY_IMPRESSIONS = 'announcements_impressions_v1';
const STORAGE_KEY_DISMISSED = 'announcements_dismissed_v1';

export interface ImpressionState {
  date: string;
  slotsShown: number[]; // Slot IDs shown on this date
}

export const getImpressions = (): ImpressionState => {
  const todayStr = getTehranDateString();
  try {
    const data = localStorage.getItem(STORAGE_KEY_IMPRESSIONS);
    if (data) {
      const parsed = JSON.parse(data) as ImpressionState;
      if (parsed.date === todayStr) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[Announcements] Error reading impressions storage:', e);
  }
  return { date: todayStr, slotsShown: [] };
};

export const recordImpression = (slotId: number) => {
  const todayStr = getTehranDateString();
  const current = getImpressions();
  
  if (current.date !== todayStr) {
    current.date = todayStr;
    current.slotsShown = [];
  }
  
  if (!current.slotsShown.includes(slotId)) {
    current.slotsShown.push(slotId);
  }
  
  try {
    localStorage.setItem(STORAGE_KEY_IMPRESSIONS, JSON.stringify(current));
  } catch (e) {
    console.error('[Announcements] Error writing impressions storage:', e);
  }
};

export const getDismissed = (): Record<string, number> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_DISMISSED);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('[Announcements] Error reading dismissed storage:', e);
    return {};
  }
};

export const dismissAnnouncement = (id: string, version: number) => {
  const dismissed = getDismissed();
  dismissed[id] = version;
  try {
    localStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(dismissed));
  } catch (e) {
    console.error('[Announcements] Error saving dismissed announcement:', e);
  }
};
