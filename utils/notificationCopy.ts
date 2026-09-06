// utils/notificationCopy.ts
// Pure helper functions for generating friendly Gen-Z styled Persian notification copy

const DAILY_NUDGE_TEXTS = [
  "سلااام! رفیق هکسر رو فراموش نکردی که؟ کارهایِ امروزت منتظرتن! 🚀",
  "چطوری رفیق! بدو بیا هکسر رو چک کن، امروز کلی هدف داری که باید تیک بزنی! 😉",
  "امروز قراره بترکونی یا چی؟ کارهاتو ردیف کردی؟ یه سر به هکسر بزن. 🌟",
  "برنامه‌هات برای امروز چیه؟ هکسر آماده‌ست تا کمکت کنه تیکِ همه‌شون رو بزنی. ⚡",
  "سلام رفیق! نذار کارهات کوه بشن. همین الان بیا و یکی‌شون رو تموم کن. ✌️"
];

/**
 * Returns a random Gen-Z themed daily nudge string
 */
export function getRandomDailyNudge(): string {
  const index = Math.floor(Math.random() * DAILY_NUDGE_TEXTS.length);
  return DAILY_NUDGE_TEXTS[index];
}

/**
 * Custom copy generator for time-due tasks
 */
export function getTaskReminderMessage(title: string): string {
  const copies = [
    `سررسید کار "${title}" رسید! انجامش دادی رفیق؟ بدو ثبتش کن! ⭐`,
    `تیک بزن بره! مهلت انجام کار "${title}" رسیده. بدو عقب نمونی! ⚡`,
    `یادت نره: وقتش رسیده که کار "${title}" رو تموم کنی! 🎯`,
    `رفیق، کار "${title}" آماده‌ی تموم شدنه. همین الان تیکش رو بزن! 🔥`
  ];
  return copies[Math.floor(Math.random() * copies.length)];
}

/**
 * Morning entry summary — shown once on first app open of the day.
 * Deterministic (no randomness): digests must be predictable and testable.
 */
export function getEntrySummaryCopy(
  openToday: number,
  overdue: number
): { title: string; body: string } {
  const title = '☀️ برنامه‌ی امروزت';
  const overduePart = overdue > 0 ? ` و ${overdue} کار عقب‌افتاده` : '';
  return {
    title,
    body: `صبح بخیر رفیق! امروز ${openToday} کار داری${overduePart}؛ بزن بریم تیکشون بزنیم! 💪`,
  };
}

/**
 * Noon digest — exactly one per user per day after 12:00 Tehran.
 * Reminds the user to review today's list and tick off what is done.
 */
export function getNoonDigestCopy(
  openToday: number,
  overdue: number
): { title: string; body: string } {
  const title = '🕛 یادآوری نیم‌روز';
  const overduePart = overdue > 0 ? ` (${overdue}‌تاش عقب‌افتاده‌ست)` : '';
  return {
    title,
    body: `نیم‌روز شد! ${openToday} کار امروزت مونده${overduePart}؛ یه سر به لیستت بزن و انجام‌شده‌ها رو تیک بزن! ✅`,
  };
}

/**
 * Combined summary — used only when the first open of the day happens after
 * 12:00 and the noon digest has not been delivered yet, so the user still
 * receives a single notification instead of two back-to-back ones.
 */
export function getCombinedSummaryCopy(
  openToday: number,
  overdue: number
): { title: string; body: string } {
  const entry = getEntrySummaryCopy(openToday, overdue);
  return {
    title: entry.title,
    body: `${entry.body} 🕛 نیم‌روز هم گذشته؛ انجام‌شده‌ها رو تیک بزن! ✅`,
  };
}
