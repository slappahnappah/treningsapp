import { useEffect, useState } from 'react';

/** Gjeldende tid i ms, oppdatert med jevne mellomrom og når appen blir synlig igjen. */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const update = () => setNow(Date.now());
    update();
    const id = window.setInterval(update, intervalMs);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', update);
    };
  }, [intervalMs, enabled]);
  return now;
}
