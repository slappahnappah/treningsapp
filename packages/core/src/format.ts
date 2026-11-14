import { levelLabel } from './defaults';
import type { Exercise, SetEntry } from './model';

/** Tall uten unødvendige desimaler, med norsk desimalkomma. */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Leser et tall skrevet med komma eller punktum. Tom eller ugyldig tekst gir undefined. */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Sekunder som m:ss. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Kort visning av et sett: 100×5, BW×8, BW+10×5, BW−20×6, P2 12s, P3 ×5. */
export function formatSet(exercise: Exercise, set: SetEntry): string {
  const reps = set.reps != null ? `×${set.reps}` : '';
  const secs = set.durationSec != null ? `${set.durationSec}s` : '';
  switch (exercise.type) {
    case 'weight_reps':
      return `${set.weightKg != null ? formatNumber(set.weightKg) : '–'}${reps}`;
    case 'bodyweight':
      return `BW${set.weightKg ? `+${formatNumber(set.weightKg)}` : ''}${reps}`;
    case 'assisted':
      return `BW${set.assistanceKg ? `−${formatNumber(set.assistanceKg)}` : ''}${reps}`;
    case 'time':
      return secs || '–';
    case 'level': {
      const level = exercise.levels?.find((l) => l.id === set.levelId);
      const label = level ? levelLabel(level) : '';
      const extra = set.weightKg ? ` +${formatNumber(set.weightKg)}` : '';
      const value = exercise.levelMetric === 'seconds' ? secs : reps;
      return `${label}${extra} ${value}`.trim() || '–';
    }
  }
}
