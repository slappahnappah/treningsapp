// Lyd med Web Audio API. Safari på iPhone krever at lyden «låses opp» av et trykk,
// så unlockAudio() kalles på hvert trykk (se main.tsx) og på Start i holdeklokka.

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

// Lyd selv om lydbryteren på iPhone står på lydløs. Styres fra innstillingene.
// Standard er av: da blandes pipene inn i musikk og podkast fra andre apper,
// i stedet for å ta over lyden og sette dem på pause.
let throughMute = false;
let unlocked = false;
let keepers = 0;
let silent: HTMLAudioElement | null = null;

/** Et kort, stille lydklipp (WAV) som kan gå i sløyfe. */
function silentClip(): string {
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const text = (at: number, t: string) => [...t].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); // 8 bit, der 128 er stillhet
  text(36, 'data');
  v.setUint32(40, samples, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/**
 * Stille lyd i sløyfe mens en økt eller holdeklokka er i gang, bare når lyd
 * gjennom lydbryteren er slått på. På iPhone gjør den at pipene går i
 * mediekanalen, som ikke dempes av lydbryteren. Prisen er at musikk og podkast
 * fra andre apper stopper, så den brukes aldri ellers.
 */
function syncKeepAlive(): void {
  const want = keepers > 0 && throughMute && unlocked;
  try {
    if (want) {
      if (!silent) {
        silent = new Audio(silentClip());
        silent.loop = true;
        silent.setAttribute('playsinline', '');
      }
      if (silent.paused) void silent.play().catch(() => undefined);
    } else if (silent && !silent.paused) {
      silent.pause();
    }
  } catch {
    // ikke støttet
  }
}

function applySession(): void {
  // Nyere Safari: «ambient» blander pipene inn i annen lyd (musikk, podkast) og følger lydbryteren.
  // «playback» gir lyd også på lydløs, men setter annen lyd på pause.
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    const type = throughMute ? 'playback' : 'ambient';
    if (session && session.type !== type) session.type = type;
  } catch {
    // ikke støttet
  }
}

export function configureAudio(options: { throughMute: boolean }): void {
  throughMute = options.throughMute;
  applySession();
  syncKeepAlive();
}

// Sett lydøkta før noe lyd spilles, så appen aldri tar over lyden fra andre apper.
applySession();

/** Holder lyden våken så lenge noe trenger den. Returnerer en funksjon som slipper taket. */
export function keepAudioAlive(): () => void {
  keepers++;
  syncKeepAlive();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    keepers--;
    syncKeepAlive();
  };
}

/** Må kalles fra et trykk (klikk, slipp eller tast). Safari godtar ikke lyd ellers. */
export function unlockAudio(): void {
  const c = audioContext();
  if (!c) return;
  applySession();
  if (c.state !== 'running') void c.resume().catch(() => undefined);
  if (!unlocked) {
    // Et stille lydklipp fra et trykk låser opp avspilling i Safari.
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  }
  syncKeepAlive();
}

/** Spiller av med en gang lyden er klar, også når den må vekkes først. */
export function whenAudioReady(play: () => void): void {
  const c = audioContext();
  if (!c) return;
  if (c.state === 'running') play();
  else
    void c
      .resume()
      .then(play)
      .catch(() => undefined);
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
