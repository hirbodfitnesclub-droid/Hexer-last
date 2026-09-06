import { describe, it, expect } from 'vitest';
import {
  tehranHourOf,
  isNoonDigestWindow,
  entrySummaryId,
  noonDigestId,
  entrySummaryTag,
  noonDigestTag,
} from '../../utils/notificationPolicy';
import {
  getEntrySummaryCopy,
  getNoonDigestCopy,
  getCombinedSummaryCopy,
} from '../../utils/notificationCopy';

describe('notification policy — Tehran digest window', () => {
  // Asia/Tehran is UTC+3:30 year-round (no DST since 2022).
  it('maps 08:30 UTC to hour 12 in Tehran', () => {
    expect(tehranHourOf(new Date('2026-09-06T08:30:00Z'))).toBe(12);
  });

  it('maps 08:29:59 UTC to hour 11 in Tehran', () => {
    expect(tehranHourOf(new Date('2026-09-06T08:29:59Z'))).toBe(11);
  });

  it('opens the digest window exactly at 12:00 Tehran', () => {
    expect(isNoonDigestWindow(new Date('2026-09-06T08:30:00Z'))).toBe(true);
    expect(isNoonDigestWindow(new Date('2026-09-06T08:29:59Z'))).toBe(false);
  });

  it('keeps the window open for the rest of the day', () => {
    expect(isNoonDigestWindow(new Date('2026-09-06T19:59:59Z'))).toBe(true); // 23:29 Tehran
  });
});

describe('notification policy — shared cross-layer identity', () => {
  it('builds stable entry-summary and noon-digest ids/tags', () => {
    expect(entrySummaryId('u1', '2026-09-06')).toBe('entry-summary-u1-2026-09-06');
    expect(noonDigestId('u1', '2026-09-06')).toBe('noon-digest-u1-2026-09-06');
    expect(entrySummaryTag('u1')).toBe('entry-summary-u1');
    expect(noonDigestTag('u1')).toBe('noon-digest-u1');
  });
});

describe('notification copy — digests', () => {
  it('entry summary embeds counts and omits the overdue part when zero', () => {
    const withOverdue = getEntrySummaryCopy(3, 2);
    expect(withOverdue.body).toContain('3');
    expect(withOverdue.body).toContain('2');

    const clean = getEntrySummaryCopy(1, 0);
    expect(clean.body).toContain('1');
    expect(clean.body).not.toContain('عقب‌افتاده');
  });

  it('noon digest embeds counts and omits the overdue part when zero', () => {
    const digest = getNoonDigestCopy(4, 0);
    expect(digest.title).toContain('نیم‌روز');
    expect(digest.body).toContain('4');
    expect(digest.body).not.toContain('عقب‌افتاده');
  });

  it('combined summary merges both messages into one', () => {
    const combined = getCombinedSummaryCopy(2, 1);
    expect(combined.body).toContain('2');
    expect(combined.body).toContain('تیک بزن');
  });
});
