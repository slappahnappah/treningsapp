import type { SetEntry, Workout, WorkoutExercise } from './model';

/** Øvelsene som deler pause: øvelsen selv, eller hele supersettet den er del av. */
export function restGroup(workout: Workout, we: WorkoutExercise): WorkoutExercise[] {
  if (!we.supersetGroup) return [we];
  return workout.exercises
    .filter((x) => x.supersetGroup === we.supersetGroup)
    .sort((a, b) => a.order - b.order);
}

/**
 * Partneren til et sett på en unilateral øvelse: settet for den andre siden som
 * står rett ved siden av. Parene dannes fra toppen, og rekkefølgen på sidene
 * kan være venstre–høyre eller høyre–venstre.
 */
export function pairPartner(sets: SetEntry[], setId: string): { partner: SetEntry; isSecond: boolean } | undefined {
  for (let i = 0; i < sets.length; i++) {
    const a = sets[i]!;
    const b = sets[i + 1];
    if (a.side && b?.side && a.side !== b.side) {
      if (a.id === setId) return { partner: b, isSecond: false };
      if (b.id === setId) return { partner: a, isSecond: true };
      i++;
    }
  }
  return undefined;
}

/**
 * Faktisk pause før et sett: tiden fra forrige sett ble haket av (i samme øvelse,
 * eller i samme supersett) til dette settet hakes av, minus settets egen varighet.
 * Den andre siden av et unilateralt sett får ingen pause når den første siden nettopp er gjort,
 * fordi man går rett fra den ene siden til den andre.
 */
export function computeRestBeforeSec(
  workout: Workout,
  workoutExerciseId: string,
  setId: string,
  completedAt: string,
): number | undefined {
  const we = workout.exercises.find((x) => x.id === workoutExerciseId);
  if (!we) return undefined;
  const set = we.sets.find((s) => s.id === setId);
  if (!set) return undefined;

  const pair = pairPartner(we.sets, setId);
  if (pair?.isSecond && pair.partner.done) return undefined;

  const now = Date.parse(completedAt);
  let prev: number | undefined;
  for (const other of restGroup(workout, we)) {
    for (const s of other.sets) {
      if (s.id === setId || !s.done || !s.completedAt) continue;
      const t = Date.parse(s.completedAt);
      if (t <= now && (prev === undefined || t > prev)) prev = t;
    }
  }
  if (prev === undefined) return undefined;
  const rest = (now - prev) / 1000 - (set.durationSec ?? 0);
  return Math.max(0, Math.round(rest));
}

/** Snittpause over sett som har målt pause. */
export function averageRestSec(sets: SetEntry[]): number | undefined {
  const rests = sets
    .filter((s) => s.done && s.restBeforeSec != null)
    .map((s) => s.restBeforeSec as number);
  if (rests.length === 0) return undefined;
  return rests.reduce((a, b) => a + b, 0) / rests.length;
}

/**
 * Skal hviletimeren starte etter at dette settet er haket av?
 * - Unilateralt: først når begge sider er gjort.
 * - Supersett: først når siste øvelse i runden er haket av.
 */
export function shouldStartRest(workout: Workout, workoutExerciseId: string, setId: string): boolean {
  const we = workout.exercises.find((x) => x.id === workoutExerciseId);
  if (!we) return false;
  if (!we.sets.some((s) => s.id === setId)) return false;

  const pair = pairPartner(we.sets, setId);
  if (pair && !pair.partner.done) return false;

  const group = restGroup(workout, we);
  if (group.length > 1) {
    // Runden er ferdig når alle øvelsene i supersettet har like mange fullførte sett.
    const doneCounts = group.map((g) => roundsDone(g.sets));
    const mine = roundsDone(we.sets);
    return doneCounts.every((c) => c >= mine);
  }
  return true;
}

function roundsDone(sets: SetEntry[]): number {
  let plain = 0;
  let left = 0;
  let right = 0;
  for (const s of sets) {
    if (!s.done) continue;
    if (s.side === 'left') left++;
    else if (s.side === 'right') right++;
    else plain++;
  }
  return plain + Math.min(left, right);
}

/** Hviletid for runden: lengste standardhvile blant øvelsene i supersettet. */
export function restDurationSec(
  workout: Workout,
  we: WorkoutExercise,
  getDefaultRest: (exerciseId: string) => number | undefined,
): number {
  const values = restGroup(workout, we).map((g) => getDefaultRest(g.exerciseId) ?? 0);
  return Math.max(0, ...values);
}
