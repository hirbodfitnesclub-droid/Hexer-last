// utils/notificationPolicy.ts
// Pure policy helpers for the notification system (unit-tested).
//
// Product conventions honored here:
// - A task whose Tehran wall-clock is exactly 12:00 is DATE-ONLY (no explicit
//   time) and must never receive an individual push; date-only tasks are
//   covered by the entry summary + the noon digest only.
// - Exactly one noon digest per user per day, inside the 12:00+ Tehran window.
// - Exactly one entry summary per device per day, on first app open.
// - Timed tasks (explicit hour) always notify exactly at their due moment.

export const ENTRY_SUMMARY_GUARD_KEY = 'hexer_last_entry_summary_date';
export const NOON_DIGEST_GUARD_KEY = 'hexer_last_noon_digest_date';

/** Tehran hour (0-23) of the given moment. */
export function tehranHourOf(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  let h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  if (h === 24) h = 0;
  return h;
}

/**
 * Digest window opens at 12:00 Tehran and stays open for the rest of the day,
 * so a client that was closed at noon still mirrors the digest on next open
 * (guarded by the server ledger + local guard, still at most once per day).
 */
export function isNoonDigestWindow(now: Date): boolean {
  try {
    return tehranHourOf(now) >= 12;
  } catch {
    return false;
  }
}

/** Shared cross-layer identity: foreground, service worker and server ledger. */
export function entrySummaryId(userId: string, tehranDate: string): string {
  return `entry-summary-${userId}-${tehranDate}`;
}

export function noonDigestId(userId: string, tehranDate: string): string {
  return `noon-digest-${userId}-${tehranDate}`;
}

export function entrySummaryTag(userId: string): string {
  return `entry-summary-${userId}`;
}

export function noonDigestTag(userId: string): string {
  return `noon-digest-${userId}`;
}
