// Lyd med Web Audio API. Safari på iPhone krever at lyden «låses opp» av et trykk,
// så unlockAudio() kalles på første berøring og på Start i holdeklokka.

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = audioContext();
  if (!c) return;
  if (c.state !== 'running') void c.resume();
  // Et stille lydklipp fra et trykk låser opp avspilling i Safari.
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
}

export interface Tone {
  freq: number;
  durationSec: number;
  volume: number; // 0–1
  delaySec?: number; // fra nå
  type?: OscillatorType;
}

/** Planlegger en tone på lydklokka. Returnerer en funksjon som avbryter den. */
export function playTone(tone: Tone): () => void {
  const c = audioContext();
  if (!c) return () => undefined;
  const start = c.currentTime + Math.max(0, tone.delaySec ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = tone.type ?? 'sine';
  osc.frequency.value = tone.freq;
  const vol = Math.max(0.0001, Math.min(1, tone.volume));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.durationSec);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + tone.durationSec + 0.02);
  return () => {
    try {
      gain.gain.cancelScheduledValues(0);
      gain.gain.value = 0;
      osc.stop();
    } catch {
      // allerede stoppet
    }
  };
}

/** Kort tikk for holdeklokka. */
export function tick(volume: number, delaySec = 0): () => void {
  return playTone({ freq: 880, durationSec: 0.06, volume: volume * 0.7, delaySec, type: 'square' });
}

/** Tydeligere pip, for hvert 10. sekund. */
export function beep(volume: number, delaySec = 0): () => void {
  return playTone({ freq: 1320, durationSec: 0.22, volume, delaySec, type: 'square' });
}

/** Signalet når hviletiden er ute: tre pip. Returnerer en funksjon som avbryter. */
export function restDoneSignal(volume: number, delaySec = 0): () => void {
  const cancels = [0, 0.28, 0.56].map((d, i) =>
    playTone({
      freq: i === 2 ? 1175 : 880,
      durationSec: i === 2 ? 0.4 : 0.18,
      volume,
      delaySec: delaySec + d,
      type: 'triangle',
    }),
  );
  return () => cancels.forEach((c) => c());
}

/** Vibrasjon der nettleseren støtter det (ikke Safari på iPhone). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ikke støttet
  }
}
