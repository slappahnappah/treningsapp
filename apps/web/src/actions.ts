import {
  computeRestBeforeSec,
  findPreviousSets,
  indexWithinKind,
  dateKey,
  plannedSetsFor,
  restDurationSec,
  shouldStartRest,
  weekStartKey,
  type Exercise,
  type Routine,
  type SetEntry,
  type SetKind,
  type WarmupSuggestion,
  type Workout,
  type WorkoutExercise,
} from '@stige/core';
import { db, getDeloadWeeks, saveDeloadWeeks, setRestTimer } from './db';

const uid = () => crypto.randomUUID();

async function mutateWorkout(id: string, fn: (w: Workout) => void): Promise<Workout | undefined> {
  return db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return undefined;
    fn(w);
    await db.workouts.put(w);
    return w;
  });
}

function newSets(exercise: Exercise, kind: SetKind, levelId?: string): SetEntry[] {
  const base = (): SetEntry => {
    const s: SetEntry = { id: uid(), kind, done: false };
    const lvl = levelId ?? (exercise.type === 'level' ? exercise.levels?.[0]?.id : undefined);
    if (lvl) s.levelId = lvl;
    return s;
  };
  return exercise.unilateral
    ? [
        { ...base(), side: 'left' },
        { ...base(), side: 'right' },
      ]
    : [base()];
}

/** Starter en økt, tom eller fra en rutine. Nivået hentes fra forrige gang når det finnes. */
export async function startWorkout(routine?: Routine): Promise<string> {
  const [workouts, exercises, deloadWeeks] = await Promise.all([
    db.workouts.toArray(),
    db.exercises.toArray(),
    getDeloadWeeks(),
  ]);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const now = new Date();
  const workout: Workout = {
    id: uid(),
    startedAt: now.toISOString(),
    // Økter i en uke som er markert som lettuke, blir lettuke-økter.
    isDeload: deloadWeeks.includes(weekStartKey(now)),
    exercises: [],
  };
  if (routine) {
    workout.routineId = routine.id;
    workout.title = routine.name;
    for (const re of [...routine.exercises].sort((a, b) => a.order - b.order)) {
      if (!exMap.has(re.exerciseId)) continue;
      const prev = findPreviousSets(workouts, re.exerciseId);
      const we: WorkoutExercise = {
        id: uid(),
        exerciseId: re.exerciseId,
        order: workout.exercises.length,
        sets: re.plannedSets.map((p) => ({ ...p, id: uid(), done: false })),
      };
      if (re.supersetGroup) we.supersetGroup = re.supersetGroup;
      for (const s of we.sets) {
        const before = prev?.get(s.kind, s.side, indexWithinKind(we.sets, s.id));
        if (before?.levelId) s.levelId = before.levelId;
      }
      workout.exercises.push(we);
    }
  }
  await db.workouts.add(workout);
  return workout.id;
}

export async function addExercise(workoutId: string, exercise: Exercise): Promise<void> {
  const workouts = await db.workouts.toArray();
  const prev = findPreviousSets(workouts, exercise.id, workoutId);
  await mutateWorkout(workoutId, (w) => {
    const levelId = prev?.get('working', exercise.unilateral ? 'left' : undefined, 0)?.levelId;
    w.exercises.push({
      id: uid(),
      exerciseId: exercise.id,
      order: w.exercises.length,
      sets: newSets(exercise, 'working', levelId),
    });
  });
}

export async function removeExercise(workoutId: string, weId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    w.exercises = w.exercises.filter((x) => x.id !== weId);
    w.exercises.forEach((x, i) => (x.order = i));
  });
}

export async function addSet(workoutId: string, weId: string, exercise: Exercise): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const we = w.exercises.find((x) => x.id === weId);
    if (!we) return;
    const last = we.sets[we.sets.length - 1];
    const kind: SetKind = last && last.kind !== 'warmup' ? last.kind : 'working';
    we.sets.push(...newSets(exercise, kind === 'drop' || kind === 'failure' ? 'working' : kind, last?.levelId));
  });
}

/** Sletter et sett. For unilaterale øvelser slettes begge sider av settet. */
export async function removeSet(workoutId: string, weId: string, setId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const we = w.exercises.find((x) => x.id === weId);
    if (!we) return;
    const ids = pairIds(we.sets, setId);
    we.sets = we.sets.filter((s) => !ids.includes(s.id));
  });
}

export async function setKind(workoutId: string, weId: string, setId: string, kind: SetKind): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const we = w.exercises.find((x) => x.id === weId);
    if (!we) return;
    const ids = pairIds(we.sets, setId);
    for (const s of we.sets) if (ids.includes(s.id)) s.kind = kind;
  });
}

function pairIds(sets: SetEntry[], setId: string): string[] {
  const i = sets.findIndex((s) => s.id === setId);
  const s = sets[i];
  if (!s) return [];
  if (s.side === 'left' && sets[i + 1]?.side === 'right') return [s.id, sets[i + 1]!.id];
  if (s.side === 'right' && sets[i - 1]?.side === 'left') return [sets[i - 1]!.id, s.id];
  return [s.id];
}

export type SetPatch = Partial<
  Pick<SetEntry, 'weightKg' | 'assistanceKg' | 'reps' | 'durationSec' | 'levelId' | 'rpe'>
>;

export async function patchSet(workoutId: string, weId: string, setId: string, patch: SetPatch): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const set = w.exercises.find((x) => x.id === weId)?.sets.find((s) => s.id === setId);
    if (!set) return;
    for (const [k, v] of Object.entries(patch) as [keyof SetPatch, number | string | undefined][]) {
      if (v === undefined) delete set[k];
      else (set as unknown as Record<string, unknown>)[k] = v;
    }
  });
}

/** Har settet det som trengs for å hakes av? */
export function isSetComplete(exercise: Exercise, set: SetEntry): boolean {
  const seconds = exercise.type === 'time' || (exercise.type === 'level' && exercise.levelMetric === 'seconds');
  if (seconds) return (set.durationSec ?? 0) > 0;
  if (exercise.type === 'weight_reps') return set.weightKg != null && (set.reps ?? 0) > 0;
  return (set.reps ?? 0) > 0;
}

/**
 * Haker av et sett (eller fjerner haken). Tomme felt fylles med `fallback`
 * (verdiene fra forrige gang). Returnerer false hvis settet mangler verdier.
 * Måler faktisk pause og starter hviletimeren når runden er ferdig.
 */
export async function toggleSet(
  workoutId: string,
  weId: string,
  setId: string,
  exercise: Exercise,
  fallback: SetPatch = {},
  live = true,
): Promise<boolean> {
  let ok = true;
  let restSec = 0;
  const exercises = await db.exercises.toArray();
  const restOf = (id: string) => exercises.find((e) => e.id === id)?.defaultRestSec;

  await mutateWorkout(workoutId, (w) => {
    const we = w.exercises.find((x) => x.id === weId);
    const set = we?.sets.find((s) => s.id === setId);
    if (!we || !set) return;

    if (set.done) {
      set.done = false;
      delete set.completedAt;
      delete set.restBeforeSec;
      return;
    }

    const filled: SetEntry = { ...set };
    for (const [k, v] of Object.entries(fallback) as [keyof SetPatch, number | string | undefined][]) {
      if (filled[k] === undefined && v !== undefined) (filled as unknown as Record<string, unknown>)[k] = v;
    }
    if (!isSetComplete(exercise, filled)) {
      ok = false;
      return;
    }
    Object.assign(set, filled);
    if (!live) {
      // Retting av en ferdig økt: ingen tidsstempler, pause eller hviletimer.
      set.done = true;
      return;
    }
    const now = new Date().toISOString();
    const rest = computeRestBeforeSec(w, weId, setId, now);
    set.done = true;
    set.completedAt = now;
    if (rest !== undefined) set.restBeforeSec = rest;
    if (shouldStartRest(w, weId, setId)) restSec = restDurationSec(w, we, restOf);
  });

  if (ok && restSec > 0) {
    const now = Date.now();
    await setRestTimer({ startedAt: now, endsAt: now + restSec * 1000, label: exercise.name });
  }
  return ok;
}

/** Fullfører økta. Sett som ikke er haket av fjernes, og øvelser uten sett fjernes. */
export async function finishWorkout(workoutId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    for (const we of w.exercises) we.sets = we.sets.filter((s) => s.done);
    w.exercises = w.exercises.filter((we) => we.sets.length > 0);
    w.exercises.forEach((x, i) => (x.order = i));
    w.endedAt = new Date().toISOString();
  });
  await setRestTimer(undefined);
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await db.workouts.delete(workoutId);
  await setRestTimer(undefined);
}

export async function setDeload(workoutId: string, isDeload: boolean): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    w.isDeload = isDeload;
  });
}

export async function setDefaultRest(exerciseId: string, sec: number): Promise<void> {
  await db.exercises.update(exerciseId, { defaultRestSec: Math.max(0, sec) });
}

/** Legger oppvarmingssett først i øvelsen, med vekt og reps fra forslaget. */
export async function addWarmupSets(workoutId: string, weId: string, suggestions: WarmupSuggestion[]): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const we = w.exercises.find((x) => x.id === weId);
    if (!we) return;
    const sets: SetEntry[] = suggestions.map((s) => ({
      id: uid(),
      kind: 'warmup',
      weightKg: s.weightKg,
      reps: s.reps,
      done: false,
    }));
    const firstWorking = we.sets.findIndex((s) => s.kind !== 'warmup');
    we.sets.splice(firstWorking === -1 ? we.sets.length : firstWorking, 0, ...sets);
  });
}

/** Kobler øvelsen sammen med den neste til et supersett, eller løser den fra supersettet. */
export async function toggleSuperset(workoutId: string, weId: string): Promise<void> {
  await mutateWorkout(workoutId, (w) => {
    const list = [...w.exercises].sort((a, b) => a.order - b.order);
    const i = list.findIndex((x) => x.id === weId);
    const we = list[i];
    if (!we) return;
    if (we.supersetGroup) {
      const group = we.supersetGroup;
      delete we.supersetGroup;
      const rest = list.filter((x) => x.supersetGroup === group);
      if (rest.length === 1) delete rest[0]!.supersetGroup;
      return;
    }
    const next = list[i + 1];
    if (!next) return;
    const group = next.supersetGroup ?? uid();
    we.supersetGroup = group;
    next.supersetGroup = group;
  });
}

/** Markerer en hel uke som lettuke (eller fjerner markeringen), også for øktene i uka. */
export async function setWeekDeload(weekStart: string, on: boolean): Promise<void> {
  const weeks = await getDeloadWeeks();
  await saveDeloadWeeks(on ? [...weeks, weekStart] : weeks.filter((w) => w !== weekStart));
  await db.transaction('rw', db.workouts, async () => {
    const all = await db.workouts.toArray();
    for (const w of all) {
      if (weekStartKey(w.startedAt) === weekStart && w.isDeload !== on) {
        await db.workouts.update(w.id, { isDeload: on });
      }
    }
  });
}

export async function saveNote(date: string, text: string): Promise<void> {
  if (text.trim() === '') await db.diary.delete(date);
  else await db.diary.put({ date, text });
}

/** Lager en rutine av en ferdig økt: samme øvelser, samme antall sett og samme nivå. */
export async function saveAsRoutine(workout: Workout, name: string): Promise<void> {
  const exercises = await db.exercises.toArray();
  const routine: Routine = { id: uid(), name, exercises: [] };
  for (const we of [...workout.exercises].sort((a, b) => a.order - b.order)) {
    const ex = exercises.find((e) => e.id === we.exerciseId);
    if (!ex) continue;
    const count = (warm: boolean) =>
      we.sets.filter((s) => (s.kind === 'warmup') === warm && s.side !== 'right').length;
    const levelId = we.sets[0]?.levelId;
    const planned = [...plannedSetsFor(ex, 'warmup', count(true)), ...plannedSetsFor(ex, 'working', count(false))].map(
      (p) => (levelId ? { ...p, levelId } : p),
    );
    const re: Routine['exercises'][number] = { exerciseId: ex.id, order: routine.exercises.length, plannedSets: planned };
    if (we.supersetGroup) re.supersetGroup = we.supersetGroup;
    routine.exercises.push(re);
  }
  await db.routines.add(routine);
}

export { dateKey };
