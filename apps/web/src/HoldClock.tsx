import { useEffect, useRef, useState } from 'react';
import { beep, playTone, tick, unlockAudio } from './audio';
import { useData } from './data';
import { saveSettings } from './db';
import { useNow } from './hooks';
import { Overlay } from './ui';
import { useWakeLock } from './wakeLock';

interface Props {
  title: string;
  subtitle?: string;
  onSave?: (seconds: number) => void;
  onClose: () => void;
}

const COUNTDOWNS = [0, 3, 5, 10];

/**
 * Holdeklokke: teller opp i hele sekunder med hørbart tikk hvert sekund og et
 * tydeligere pip hvert 10. sekund. Tiden regnes fra lagret starttidspunkt, og
 * tikkene planlegges på lydklokka, så de holder takten selv om skjermen hakker.
 */
export function HoldClock({ title, subtitle, onSave, onClose }: Props) {
  const { settings } = useData();
  const hold = settings.holdClock;
  const [startAt, setStartAt] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const now = useNow(100, startAt !== null);
  const scheduled = useRef<{ k: number; cancel: () => void }[]>([]);
  const holdRef = useRef(hold);
  holdRef.current = hold;

  useWakeLock(true);

  useEffect(() => {
    if (startAt === null) return;
    let nextK = -Math.round((startAt - Date.now()) / 1000);
    const pump = () => {
      const t = Date.now();
      const { volume, beepEverySec } = holdRef.current;
      // Etter en pause i bakgrunnen hopper vi fram til nåværende sekund.
      nextK = Math.max(nextK, Math.ceil((t - startAt) / 1000));
      while (startAt + nextK * 1000 < t + 1200) {
        const delay = Math.max(0, (startAt + nextK * 1000 - t) / 1000);
        const k = nextK;
        let cancel: () => void;
        if (k < 0) cancel = playTone({ freq: 440, durationSec: 0.12, volume, delaySec: delay, type: 'triangle' });
        else if (k === 0) cancel = playTone({ freq: 660, durationSec: 0.45, volume, delaySec: delay, type: 'triangle' });
        else if (beepEverySec > 0 && k % beepEverySec === 0) cancel = beep(volume, delay);
        else cancel = tick(volume, delay);
        scheduled.current.push({ k, cancel });
        nextK++;
      }
      const current = Math.floor((t - startAt) / 1000);
      scheduled.current = scheduled.current.filter((s) => s.k >= current);
    };
    pump();
    const id = window.setInterval(pump, 200);
    document.addEventListener('visibilitychange', pump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', pump);
      const current = (Date.now() - startAt) / 1000;
      for (const s of scheduled.current) if (s.k > current) s.cancel();
      scheduled.current = [];
    };
  }, [startAt]);

  const start = () => {
    unlockAudio();
    setResult(null);
    setStartAt(Date.now() + (hold.countdownSec ?? 0) * 1000);
  };
  const stop = () => {
    if (startAt === null) return;
    const sec = Math.floor((Date.now() - startAt) / 1000);
    setStartAt(null);
    setResult(sec > 0 ? sec : null);
  };

  const running = startAt !== null;
  const elapsed = running ? Math.floor((now - startAt) / 1000) : (result ?? 0);
  const counting = running && elapsed < 0;
  const patch = (p: Partial<typeof hold>) => void saveSettings({ holdClock: { ...hold, ...p } });

  return (
    <Overlay label="Holdeklokke" className="hold">
      <header className="hold-head">
        <div>
          <div className="hold-title">{title}</div>
          {subtitle && <div className="muted">{subtitle}</div>}
        </div>
        <button className="btn" onClick={onClose} disabled={running}>
          Lukk
        </button>
      </header>

      <div className={`hold-display${counting ? ' hold-counting' : ''}`} aria-live="off">
        <span className="hold-number">{counting ? -elapsed : elapsed}</span>
        <span className="hold-unit">{counting ? 'gjør deg klar' : 'sekunder'}</span>
      </div>

      {result !== null && !running && (
        <div className="hold-result">
          <button className="btn" onClick={() => setResult(Math.max(1, result - 1))} aria-label="Ett sekund mindre">
            −1
          </button>
          {onSave ? (
            <button className="btn btn-primary hold-save" onClick={() => onSave(result)}>
              Lagre {result} s
            </button>
          ) : (
            <span className="hold-save muted">Testmodus: tiden lagres ikke</span>
          )}
          <button className="btn" onClick={() => setResult(result + 1)} aria-label="Ett sekund mer">
            +1
          </button>
        </div>
      )}

      <button className={`hold-button${running ? ' hold-button-stop' : ''}`} onClick={running ? stop : start}>
        {running ? 'Stopp' : result !== null ? 'Start på nytt' : 'Start'}
      </button>

      <div className="hold-settings">
        <label className="field">
          <span>Volum</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={hold.volume}
            onChange={(e) => patch({ volume: Number(e.target.value) })}
          />
        </label>
        <label className="field field-check">
          <span>Pip hvert 10. sekund</span>
          <input
            type="checkbox"
            checked={hold.beepEverySec > 0}
            onChange={(e) => patch({ beepEverySec: e.target.checked ? 10 : 0 })}
          />
        </label>
        <div className="field">
          <span>Nedtelling før start</span>
          <div className="seg">
            {COUNTDOWNS.map((c) => (
              <button
                key={c}
                className={`seg-item${(hold.countdownSec ?? 0) === c ? ' seg-on' : ''}`}
                disabled={running}
                onClick={() => patch({ countdownSec: c })}
              >
                {c === 0 ? 'Av' : `${c} s`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
