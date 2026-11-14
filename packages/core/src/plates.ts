import type { Settings } from './model';

export interface PlateLoad {
  perSide: number[]; // plater per side, tyngste først
  totalKg: number; // faktisk vekt med disse platene
  remainderKg: number; // det som ikke lot seg laste (mål − faktisk)
}

/** Plater per side for en målvekt, med ubegrenset antall av hver tilgjengelige plate. */
export function platesPerSide(targetKg: number, barKg: number, platesKg: number[]): PlateLoad {
  const plates = [...platesKg].filter((p) => p > 0).sort((a, b) => b - a);
  let left = Math.round(((targetKg - barKg) / 2) * 1000);
  const perSide: number[] = [];
  if (left > 0) {
    for (const p of plates) {
      const g = Math.round(p * 1000);
      while (left >= g) {
        perSide.push(p);
        left -= g;
      }
    }
  }
  const loaded = perSide.reduce((a, b) => a + b, 0) * 2;
  const totalKg = barKg + loaded;
  return { perSide, totalKg, remainderKg: Math.max(0, round2(targetKg - totalKg)) };
}

/** Runder en vekt til nærmeste vekt som kan lastes med de tilgjengelige platene. */
export function roundToLoadable(targetKg: number, barKg: number, platesKg: number[]): number {
  if (targetKg <= barKg) return barKg;
  const smallest = Math.min(...platesKg.filter((p) => p > 0));
  if (!Number.isFinite(smallest)) return barKg;
  const step = smallest * 2;
  const rounded = barKg + Math.round((targetKg - barKg) / step) * step;
  // Kontroller at vekten faktisk kan lastes (platene trenger ikke være multipler av den minste).
  const down = platesPerSide(rounded, barKg, platesKg);
  return down.remainderKg === 0 ? rounded : down.totalKg;
}

export interface WarmupSuggestion {
  weightKg: number;
  reps: number;
}

/** Oppvarmingsforslag: stang × 10, deretter prosentene i innstillingene, rundet til plateoppsett. */
export function warmupSuggestions(
  workKg: number,
  settings: Pick<Settings, 'barKg' | 'platesKg' | 'warmupScheme'>,
): WarmupSuggestion[] {
  const out: WarmupSuggestion[] = [{ weightKg: settings.barKg, reps: 10 }];
  for (const step of settings.warmupScheme) {
    const kg = roundToLoadable((workKg * step.percent) / 100, settings.barKg, settings.platesKg);
    const last = out[out.length - 1];
    if (kg >= workKg || (last && kg <= last.weightKg)) continue;
    out.push({ weightKg: kg, reps: step.reps });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
