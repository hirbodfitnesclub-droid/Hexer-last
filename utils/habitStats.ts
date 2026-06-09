import { getTehranDateString, toJalaali, persianMonths } from './dateUtils';

/**
 * Utility helper to parse a Tehran YYYY-MM-DD date string safely.
 * Returns a JS Date object centered at noon to avoid timezone shift errors.
 */
const parseDate = (dStr: string): Date => {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

/**
 * Calculates current and longest completion streak for a habit.
 * 
 * @param completedDates Array of completion date strings in format YYYY-MM-DD
 * @returns { currentStreak: number, longestStreak: number }
 */
export const computeStreaks = (completedDates: string[]): { currentStreak: number; longestStreak: number } => {
  if (!completedDates || completedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Remove duplicates and sort chronologically
  const sorted = Array.from(new Set(completedDates)).sort();

  let longestStreak = 0;
  let currentTempStreak = 0;
  let prevDate: Date | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const currDate = parseDate(sorted[i]);
    if (prevDate === null) {
      currentTempStreak = 1;
    } else {
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentTempStreak++;
      } else if (diffDays > 1) {
        longestStreak = Math.max(longestStreak, currentTempStreak);
        currentTempStreak = 1;
      }
    }
    prevDate = currDate;
  }
  longestStreak = Math.max(longestStreak, currentTempStreak);

  // Calculate current active streak ending today or yesterday
  let currentStreak = 0;
  const todayStr = getTehranDateString();
  const todayDate = parseDate(todayStr);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getTehranDateString(yesterdayDate);

  if (sorted.length > 0) {
    const lastStr = sorted[sorted.length - 1];
    if (lastStr === todayStr || lastStr === yesterdayStr) {
      currentStreak = 1;
      let tempPrev = parseDate(lastStr);
      for (let i = sorted.length - 2; i >= 0; i--) {
        const curr = parseDate(sorted[i]);
        const diffTime = tempPrev.getTime() - curr.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
          tempPrev = curr;
        } else if (diffDays > 1) {
          break;
        }
      }
    }
  }

  return { currentStreak, longestStreak };
};

/**
 * Calculates habit completions frequency grouped by Persian weekdays.
 * 0: Saturday (شنبه), 1: Sunday (یکشنبه), ..., 6: Friday (جمعه)
 * 
 * @param completedDates Array of YYYY-MM-DD strings
 * @returns Record<number, number> Frequency of completions per weekday
 */
export const weekdayBreakdown = (completedDates: string[]): Record<number, number> => {
  const breakdown: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  completedDates.forEach(dStr => {
    const date = parseDate(dStr);
    const jsDay = date.getDay(); // 0 is Sunday, ..., 6 is Saturday
    const index = (jsDay + 1) % 7; // Sunday maps to 1, Saturday maps to 0, Friday to 6
    breakdown[index]++;
  });

  return breakdown;
};

/**
 * Calculates habit completions trend over the last 6 Jalaali months.
 * 
 * @param completedDates Array of YYYY-MM-DD strings
 * @returns Array of { month: string, count: number }
 */
export const monthlyTrend = (completedDates: string[]): Array<{ month: string; count: number }> => {
  const today = new Date();
  const currentJ = toJalaali(today);

  // Generate last 6 Jalaali months
  const trendList: Array<{ cy: number; cm: number; month: string; count: number }> = [];
  let tempY = currentJ.jy;
  let tempM = currentJ.jm;

  for (let i = 0; i < 6; i++) {
    trendList.push({
      cy: tempY,
      cm: tempM,
      month: persianMonths[tempM - 1],
      count: 0
    });
    tempM--;
    if (tempM === 0) {
      tempM = 12;
      tempY--;
    }
  }

  // Reverse to make it chronological (oldest to newest)
  trendList.reverse();

  // Populate counts
  completedDates.forEach(dStr => {
    try {
      const date = parseDate(dStr);
      const j = toJalaali(date);
      const matchIndex = trendList.findIndex(t => t.cy === j.jy && t.cm === j.jm);
      if (matchIndex !== -1) {
        trendList[matchIndex].count++;
      }
    } catch (e) {
      console.error('Error calculating monthly trend for date:', dStr, e);
    }
  });

  return trendList.map(t => ({ month: t.month, count: t.count }));
};

/**
 * Returns elements mapping the last 35 days (5 weeks) of completions.
 * 
 * @param completedDates Array of YYYY-MM-DD strings
 * @returns Array of { date: string, level: number } where level is 1 (completed) or 0 (not completed)
 */
export const weeklyHeatmap = (completedDates: string[]): Array<{ date: string; level: number }> => {
  const todayStr = getTehranDateString();
  const today = parseDate(todayStr);

  const heatmap: Array<{ date: string; level: number }> = [];
  const completedSet = new Set(completedDates);

  // Generate last 35 days
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = getTehranDateString(d);
    heatmap.push({
      date: dStr,
      level: completedSet.has(dStr) ? 1 : 0
    });
  }

  return heatmap;
};
