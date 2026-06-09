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
