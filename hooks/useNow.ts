import { useState, useEffect } from 'react';

/**
 * Live "now" clock.
 *
 * Re-renders the consumer every `intervalMs` plus on window focus and on
 * tab visibility change (covers laptop sleep/wake). Used by Tehran-calendar
 * UI so the "today" dot / week strip roll over at Tehran midnight even when
 * the tab stays open for days. Cheap: default tick is 60s.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const id = window.setInterval(refresh, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
