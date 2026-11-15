import { levelLabel } from './defaults';
import { formatNumber } from './format';
import { isWorkingSet, setE1RM, setE1RMPlain, setE1RMRpe, setVolume } from './formulas';
import type { Exercise, SetEntry, Side, Workout } from './model';

export interface ExerciseSession {
  workoutId: string;
  startedAt: string;
  isDeload: boolean;
  title?: string;
  sets: SetEntry[]; // fullførte sett, i rekkefølgen de står i økta
}

/** Alle ferdige økter der øvelsen har minst ett fullført sett. Nyeste først. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const sets = [...w.exercises]
      .sort((a, b) => a.order - b.order)
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets.filter((s) => s.done));
    if (sets.length === 0) continue;
    const session: ExerciseSession = { workoutId: w.id, startedAt: w.startedAt, isDeload: w.isDeload, sets };
    if (w.title) session.title = w.title;
    out.push(session);
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export interface RecordEntry {
  kind: 'e1rm' | 'e1rm_rpe' | 'heaviest' | 'most_reps' | 'most_weight' | 'least_assistance' | 'longest_hold';
  label: string;
  display: string;
  value: number;
  date: string;
  workoutId: string;
}

export interface RecordGroup {
  /** Tom for øvelser uten nivå og side. Ellers f.eks. «P2 tuck · venstre». */
  label: string;
  levelId?: string;
  side?: Side;
  records: RecordEntry[];
}

interface Candidate {
  set: SetEntry;
  session: ExerciseSession;
}

const SIDE_LABEL: Record<Side, string> = { left: 'venstre', right: 'høyre' };

/**
 * Rekorder for en øvelse. Oppvarmingssett teller ikke. Rekordene regnes per nivå
 * for level-øvelser og per side for unilaterale øvelser. Ved lik verdi vinner
 * den eldste, slik at en rekord bare byttes ut når den faktisk slås.
 */
export function exerciseRecords(exercise: Exercise, sessions: ExerciseSession[]): RecordGroup[] {
  const groups = new Map<string, { levelId?: string; side?: Side; items: Candidate[] }>();
  const oldestFirst = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const session of oldestFirst) {
    for (const set of session.sets) {
      if (!set.done || !isWorkingSet(set)) continue;
      const levelId = exercise.type === 'level' ? set.levelId : undefined;
      const key = `${levelId ?? ''}|${set.side ?? ''}`;
      let g = groups.get(key);
      if (!g) {
        g = { items: [] };
        if (levelId) g.levelId = levelId;
        if (set.side) g.side = set.side;
        groups.set(key, g);
      }
      g.items.push({ set, session });
    }
  }

  const levelOrder = (id?: string) => exercise.levels?.find((l) => l.id === id)?.order ?? 0;
  const out: RecordGroup[] = [];
  for (const g of groups.values()) {
    const level = exercise.levels?.find((l) => l.id === g.levelId);
    const parts = [
      level ? `${levelLabel(level)}${level.description ? ` ${level.description}` : ''}` : '',
      g.side ? SIDE_LABEL[g.side] : '',
    ].filter(Boolean);
    const group: RecordGroup = { label: parts.join(' · '), records: recordsFor(exercise, g.items) };
    if (g.levelId) group.levelId = g.levelId;
    if (g.side) group.side = g.side;
    if (group.records.length > 0) out.push(group);
  }
  // Høyeste nivå først, venstre før høyre.
  return out.sort(
    (a, b) => levelOrder(b.levelId) - levelOrder(a.levelId) || (a.side ?? '').localeCompare(b.side ?? ''),
  );
}

function best(
  items: Candidate[],
  score: (s: SetEntry) => number | undefined,
  tieBreak: (s: SetEntry) => number = () => 0,
): { c: Candidate; value: number } | undefined {
  let top: { c: Candidate; value: number } | undefined;
  for (const c of items) {
    const value = score(c.set);
    if (value === undefined || !(value > 0 || value === 0)) continue;
    if (
      !top ||
      value > top.value ||
      (value === top.value && tieBreak(c.set) > tieBreak(top.c.set))
    ) {
      top = { c, value };
    }
  }
  return top;
}

function recordsFor(exercise: Exercise, items: Candidate[]): RecordEntry[] {
  const out: RecordEntry[] = [];
  const push = (
    kind: RecordEntry['kind'],
    label: string,
    hit: { c: Candidate; value: number } | undefined,
    display: (s: SetEntry, value: number) => string,
  ) => {
    if (!hit || hit.value <= 0) return;
    out.push({
      kind,
      label,
      value: hit.value,
      display: display(hit.c.set, hit.value),
      date: hit.c.session.startedAt,
      workoutId: hit.c.session.workoutId,
    });
  };
  const reps = (s: SetEntry) => s.reps ?? 0;
  const kg = (s: SetEntry) => s.weightKg ?? 0;
  const seconds = exercise.type === 'time' || (exercise.type === 'level' && exercise.levelMetric === 'seconds');

  if (exercise.type === 'weight_reps') {
    push('e1rm', 'Estimert 1RM uten RPE', best(items, setE1RMPlain), (s, v) =>
      `${formatNumber(Math.round(v * 10) / 10)} kg (${formatNumber(kg(s))}×${reps(s)})`,
    );
    push('e1rm_rpe', 'Estimert 1RM med RPE', best(items, setE1RMRpe), (s, v) =>
      `${formatNumber(Math.round(v * 10) / 10)} kg (${formatNumber(kg(s))}×${reps(s)}, RPE ${formatNumber(s.rpe ?? 10)})`,
    );
    push('heaviest', 'Tyngste sett', best(items, (s) => (reps(s) > 0 ? kg(s) : undefined), reps), (s) =>
      `${formatNumber(kg(s))} kg × ${reps(s)}`,
    );
    push('most_reps', 'Flest reps', best(items, reps, kg), (s) => `${reps(s)} reps (${formatNumber(kg(s))} kg)`);
    return out;
  }

  if (seconds) {
    push('longest_hold', 'Lengste hold', best(items, (s) => s.durationSec), (s) => `${s.durationSec} s`);
    return out;
  }

  // bodyweight, assisted og level med reps
  push('most_reps', 'Flest reps', best(items, reps, kg), (s) =>
    kg(s) > 0 ? `${reps(s)} reps (+${formatNumber(kg(s))} kg)` : `${reps(s)} reps`,
  );
  if (exercise.type === 'assisted') {
    const assisted = items.filter((c) => reps(c.set) > 0 && c.set.assistanceKg != null);
    // Minst assistanse: snu fortegnet, slik at lavest verdi vinner.
    const hit = best(assisted, (s) => 1e6 - (s.assistanceKg ?? 0), reps);
    push('least_assistance', 'Minst assistanse', hit, (s) =>
      `−${formatNumber(s.assistanceKg ?? 0)} kg × ${reps(s)}`,
    );
  } else {
    push('most_weight', 'Mest ekstravekt', best(items, (s) => (reps(s) > 0 ? kg(s) : undefined), reps), (s) =>
      `+${formatNumber(kg(s))} kg × ${reps(s)}`,
    );
  }
  return out;
}

export interface SeriesPoint {
  date: string;
  value: number;
  workoutId: string;
}

function series(sessions: ExerciseSession[], value: (session: ExerciseSession) => number): SeriesPoint[] {
  return [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => ({ date: s.startedAt, value: value(s), workoutId: s.workoutId }))
    .filter((p) => p.value > 0);
}

const working = (session: ExerciseSession) => session.sets.filter((s) => s.done && isWorkingSet(s));

/**
 * Estimert 1RM for beste arbeidssett i hver økt, eldste først. `plain` ser bort
 * fra RPE, `rpe` tar bare med sett med RPE, og `auto` bruker RPE der den finnes.
 */
export function e1rmSeries(sessions: ExerciseSession[], mode: 'auto' | 'plain' | 'rpe' = 'auto'): SeriesPoint[] {
  const f = mode === 'plain' ? setE1RMPlain : mode === 'rpe' ? setE1RMRpe : setE1RM;
  return series(sessions, (s) => Math.max(0, ...working(s).map(f)));
}

/** Volum per økt, eldste først. */
export function volumeSeries(exercise: Pick<Exercise, 'type' | 'perHand'>, sessions: ExerciseSession[]): SeriesPoint[] {
  return series(sessions, (s) => s.sets.reduce((sum, set) => sum + setVolume(exercise, set), 0));
}

/** Beste reps eller lengste hold per økt, eventuelt for ett nivå. Eldste først. */
export function bestSeries(
  sessions: ExerciseSession[],
  metric: 'reps' | 'seconds',
  levelId?: string,
): SeriesPoint[] {
  return series(sessions, (s) =>
    Math.max(
      0,
      ...working(s)
        .filter((set) => !levelId || set.levelId === levelId)
        .map((set) => (metric === 'seconds' ? set.durationSec : set.reps) ?? 0),
    ),
  );
}
