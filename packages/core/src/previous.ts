import type { SetEntry, SetKind, Side, Workout } from './model';

export interface PreviousSets {
  workoutId: string;
  startedAt: string;
  /** Forrige sett med samme settype, side og plass i rekken, hvis det finnes. */
  get(kind: SetKind, side: Side | undefined, indexWithinKind: number): SetEntry | undefined;
}

const groupKey = (kind: SetKind, side: Side | undefined) =>
  `${kind === 'warmup' ? 'warmup' : 'work'}:${side ?? '-'}`;

/**
 * Forrige gang øvelsen ble gjort: siste ferdige økt som har minst ett fullført sett.
 * Oppvarmingssett og arbeidssett holdes fra hverandre, slik at oppvarmingen ikke
 * forhåndsutfyller arbeidssettene når samme øvelse står to ganger i økta.
 */
export function findPreviousSets(
  workouts: Workout[],
  exerciseId: string,
  excludeWorkoutId?: string,
): PreviousSets | undefined {
  const candidates = workouts
    .filter((w) => w.endedAt && w.id !== excludeWorkoutId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const w of candidates) {
    const groups = new Map<string, SetEntry[]>();
    for (const we of [...w.exercises].sort((a, b) => a.order - b.order)) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        const key = groupKey(s.kind, s.side);
        const list = groups.get(key) ?? [];
        list.push(s);
        groups.set(key, list);
      }
    }
    if (groups.size === 0) continue;
    return {
      workoutId: w.id,
      startedAt: w.startedAt,
      get: (kind, side, i) => groups.get(groupKey(kind, side))?.[i],
    };
  }
  return undefined;
}

/** Plassen til et sett blant settene med samme settype og side i øvelsen. */
export function indexWithinKind(sets: SetEntry[], setId: string): number {
  const target = sets.find((s) => s.id === setId);
  if (!target) return 0;
  const key = groupKey(target.kind, target.side);
  let i = 0;
  for (const s of sets) {
    if (s.id === setId) return i;
    if (groupKey(s.kind, s.side) === key) i++;
  }
  return i;
}
