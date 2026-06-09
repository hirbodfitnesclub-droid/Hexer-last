export const MAX_PER_DAY = 3;

export interface TimeSlot {
  id: number;
  label: string;
  startHour: number;
  endHour: number;
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: 1, label: 'morning', startHour: 6, endHour: 12 },
  { id: 2, label: 'afternoon', startHour: 12, endHour: 18 },
  { id: 3, label: 'evening', startHour: 18, endHour: 24 } // 18:00 to 24:00 (also handles 00:00 limit)
];

export const getTehranHour = (): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    hour: 'numeric',
    hour12: false
  });
  return parseInt(formatter.format(new Date()), 10);
};

export const getCurrentTimeSlot = (): TimeSlot | null => {
  const hour = getTehranHour();
  for (const slot of TIME_SLOTS) {
    if (hour >= slot.startHour && hour < slot.endHour) {
      return slot;
    }
  }
  return null;
};
