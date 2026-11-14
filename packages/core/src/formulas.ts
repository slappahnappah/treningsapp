import type { Exercise, SetEntry, Workout } from './model';

/** Estimert 1RM (Epley) = vekt × (1 + reps / 30). */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/** Estimert 1RM med RPE: reps pluss reps i reserve (10 − RPE). */
export function epley1RMWithRpe(weightKg: number, reps: number, rpe: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + (reps + (10 - rpe)) / 30);
}

/** Estimert 1RM for et sett. Bruker RPE-formelen når RPE er logget. */
export function setE1RM(set: SetEntry): number {
  if (set.weightKg == null || set.reps == null) return 0;
  return set.rpe != null
    ? epley1RMWithRpe(set.weightKg, set.reps, set.rpe)
    : epley1RM(set.weightKg, set.reps);
}

/** Alt unntatt oppvarming teller som arbeidssett (arbeidssett, drop set og failure). */
export function isWorkingSet(set: SetEntry): boolean {
  return set.kind !== 'warmup';
}

/** Volum for ett sett: kg × reps, bare for weight_reps, ×2 når vekten oppgis per hånd. */
export function setVolume(exercise: Pick<Exercise, 'type' | 'perHand'>, set: SetEntry): number {
  if (exercise.type !== 'weight_reps') return 0;
  if (!set.done || !isWorkingSet(set)) return 0;
  const kg = set.weightKg ?? 0;
  const reps = set.reps ?? 0;
  return kg * reps * (exercise.perHand ? 2 : 1);
}

type ExerciseLookup = (exerciseId: string) => Pick<Exercise, 'type' | 'perHand'> | undefined;

export function workoutVolume(workout: Workout, getExercise: ExerciseLookup): number {
  let sum = 0;
  for (const we of workout.exercises) {
    const ex = getExercise(we.exerciseId);
    if (!ex) continue;
    for (const s of we.sets) sum += setVolume(ex, s);
  }
  return sum;
}

/**
 * Antall fullførte arbeidssett. For unilaterale øvelser teller venstre og høyre
 * side av samme sett som ett sett.
 */
export function countWorkingSets(sets: SetEntry[]): number {
  let plain = 0;
  let left = 0;
  let right = 0;
  for (const s of sets) {
    if (!s.done || !isWorkingSet(s)) continue;
    if (s.side === 'left') left++;
    else if (s.side === 'right') right++;
    else plain++;
  }
  return plain + Math.max(left, right);
}

export function workoutWorkingSets(workout: Workout): number {
  return workout.exercises.reduce((n, we) => n + countWorkingSets(we.sets), 0);
}
