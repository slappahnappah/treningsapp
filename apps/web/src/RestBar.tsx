import { useEffect } from 'react';
import { formatClock } from '@stige/core';
import { audioContext, restDoneSignal, vibrate } from './audio';
import { useData } from './data';
import { setRestTimer } from './db';
import { useNow } from './hooks';

/**
 * Hviletimer. Tiden regnes fra lagrede tidsstempler, så den stemmer når appen
 * har vært i bakgrunnen. Lyden planlegges på lydklokka i det timeren starter.
 */
export function RestBar() {
  const { rest, settings } = useData();
  const now = useNow(250, !!rest);
  const endsAt = rest?.endsAt;
  const volume = settings.holdClock.volume;

  useEffect(() => {
    if (endsAt === undefined) return;
    let cancel = () => {};
    const schedule = () => {
      cancel();
      const remaining = (endsAt - Date.now()) / 1000;
      if (remaining > 0) cancel = restDoneSignal(volume, remaining);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void audioContext()?.resume();
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);

    // Reserve: hvis appen sov da tiden gikk ut, spilles signalet når den våkner.
    const timeout = window.setTimeout(
      () => {
        vibrate([200, 100, 200]);
        if (Date.now() - endsAt > 1500) restDoneSignal(volume);
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => {
      cancel();
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [endsAt, volume]);

  // En timer som gikk ut for lenge siden (appen ble lukket) ryddes bort.
  const stale = !!rest && now - rest.endsAt > 10 * 60_000;
  useEffect(() => {
    if (stale) void setRestTimer(undefined);
  }, [stale]);

  if (!rest || stale) return null;
  const remaining = Math.ceil((rest.endsAt - now) / 1000);
  const total = Math.max(1, (rest.endsAt - rest.startedAt) / 1000);
  const done = remaining <= 0;
  const progress = done ? 1 : 1 - remaining / total;
  const adjust = (sec: number) =>
    void setRestTimer({ ...rest, endsAt: Math.max(Date.now(), rest.endsAt + sec * 1000) });

  return (
    <div className={`restbar${done ? ' restbar-done' : ''}`} role="timer" aria-live="off">
      <div className="restbar-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="restbar-main">
        <div className="restbar-text">
          <span className="restbar-label">{done ? 'Hvilen er ferdig' : `Hvile · ${rest.label}`}</span>
          <span className="restbar-time">{done ? `+${formatClock(-remaining)}` : formatClock(remaining)}</span>
        </div>
        {done ? (
          <button className="btn" onClick={() => void setRestTimer(undefined)}>
            Lukk
          </button>
        ) : (
          <div className="restbar-buttons">
            <button className="btn" onClick={() => adjust(-15)} aria-label="15 sekunder kortere">
              −15
            </button>
            <button className="btn" onClick={() => adjust(15)} aria-label="15 sekunder lenger">
              +15
            </button>
            <button className="btn" onClick={() => void setRestTimer(undefined)}>
              Hopp over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
