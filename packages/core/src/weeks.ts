import { addDays, weekStartKey } from './dates';
import { workoutVolume, workoutWorkingSets } from './formulas';
import type { Exercise, Workout } from './model';

export interface WeekStats {
  /** Mandagen i uka, YYYY-MM-DD. */
  weekStart: string;
  workouts: number;
  workingSets: number;
  /** Kg × reps for arbeidssett på øvelser med vekt × reps. */
  volumeKg: number;
  minutes: number;
  /** Uka er markert som lettuke, eller alle øktene i den er lettuke-økter. */
  isDeload: boolean;
}

/**
 * Økter, arbeidssett, volum og tid per uke for de siste `count` ukene,
 * eldste først. Uker uten trening er med, med null i alle felt.
 */
export function weeklyStats(
  workouts: Workout[],
  getExercise: (id: string) => Pick<Exercise, 'type' | 'perHand'> | undefined,
  options: { count?: number; now?: Date; deloadWeeks?: Iterable<string> } = {},
): WeekStats[] {
  const count = Math.max(1, options.count ?? 12);
  const last = weekStartKey(options.now ?? new Date());
  const marked = new Set(options.deloadWeeks ?? []);
  const weeks = new Map<string, WeekStats & { deloadWorkouts: number }>();
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = addDays(last, -7 * i);
    weeks.set(weekStart, { weekStart, workouts: 0, workingSets: 0, volumeKg: 0, minutes: 0, isDeload: false, deloadWorkouts: 0 });
  }
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const week = weeks.get(weekStartKey(w.startedAt));
    if (!week) continue;
    week.workouts++;
    week.workingSets += workoutWorkingSets(w);
    week.volumeKg += workoutVolume(w, getExercise);
    week.minutes += Math.max(0, Math.round((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 60000));
    if (w.isDeload) week.deloadWorkouts++;
  }
  return [...weeks.values()].map(({ deloadWorkouts, ...week }) => ({
    ...week,
    isDeload: marked.has(week.weekStart) || (week.workouts > 0 && deloadWorkouts === week.workouts),
  }));
}
