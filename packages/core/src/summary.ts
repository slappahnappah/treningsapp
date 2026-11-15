import { levelLabel } from './defaults';
import { isWorkingSet, workoutVolume, workoutWorkingSets } from './formulas';
import type { Exercise, SetEntry, Workout } from './model';

export type SummaryTarget = 'whoop' | 'bevel';

export interface SummaryOptions {
  target?: SummaryTarget;
  /** Tidssone for klokkeslettene. Standard er enhetens tidssone. */
  timeZone?: string;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** Navnet øvelsen har i den valgte appen. Uten kobling brukes det engelske navnet. */
export function externalName(exercise: Exercise, target?: SummaryTarget): string {
  return (target && exercise.externalNames[target]?.trim()) || exercise.nameEn || exercise.name;
}

function setText(exercise: Exercise, set: SetEntry, showLevel: boolean): string {
  let text: string;
  const reps = set.reps ?? 0;
  switch (exercise.type) {
    case 'weight_reps':
      text = `${num(set.weightKg ?? 0)}×${reps}`;
      break;
    case 'bodyweight':
      text = `BW${set.weightKg ? `+${num(set.weightKg)}` : ''}×${reps}`;
      break;
    case 'assisted':
      text = `BW${set.assistanceKg ? `−${num(set.assistanceKg)}` : ''}×${reps}`;
      break;
    case 'time':
      text = `${set.durationSec ?? 0}s`;
      break;
    case 'level': {
      const value =
        exercise.levelMetric === 'seconds'
          ? `${set.durationSec ?? 0}s`
          : set.weightKg
            ? `+${num(set.weightKg)}×${reps}`
            : `${reps}`;
      const level = exercise.levels?.find((l) => l.id === set.levelId);
      text = showLevel && level ? `${levelLabel(level)} ${value}` : value;
      break;
    }
  }
  if (set.kind === 'drop') text += ' (drop)';
  if (set.kind === 'failure') text += ' (failure)';
  return text;
}

/** Slår sammen venstre og høyre side av samme sett til «5/4». */
function setTexts(exercise: Exercise, sets: SetEntry[], showLevel: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]!;
    const next = sets[i + 1];
    if (s.side && next?.side && next.side !== s.side) {
      // Skrives alltid som venstre/høyre, uansett hvilken side som ble tatt først.
      const [l, r] = s.side === 'left' ? [s, next] : [next, s];
      // Nivået skrives én gang når begge sider har samme nivå.
      const same = l.levelId === r.levelId;
      const left = setText(exercise, l, showLevel);
      const right = setText(exercise, r, showLevel && !same);
      out.push(`${left}/${right}`);
      i++;
    } else if (s.side) {
      const t = setText(exercise, s, showLevel);
      out.push(s.side === 'left' ? `${t}/–` : `–/${t}`);
    } else {
      out.push(setText(exercise, s, showLevel));
    }
  }
  return out;
}

function exerciseLine(exercise: Exercise, sets: SetEntry[], target?: SummaryTarget): string {
  const levelIds = new Set(sets.map((s) => s.levelId));
  const uniform = exercise.type === 'level' && levelIds.size === 1;
  const level = uniform ? exercise.levels?.find((l) => l.id === sets[0]?.levelId) : undefined;

  let name = externalName(exercise, target);
  if (level) name += ` (${levelLabel(level)})`;
  if (exercise.type === 'assisted') name += ' (assisted)';
  if (exercise.perHand) name += ' (per hand)';
  if (exercise.unilateral) name += ' (L/R)';

  const showLevel = exercise.type === 'level' && !uniform;
  const warm = setTexts(exercise, sets.filter((s) => !isWorkingSet(s)), showLevel);
  const work = setTexts(exercise, sets.filter(isWorkingSet), showLevel);
  const parts: string[] = [];
  if (warm.length) parts.push(`warm-up ${warm.join(', ')}`);
  if (work.length) parts.push(work.join(', '));
  return `${name}: ${parts.join('; ')}`;
}

/** Kopierbart øktsammendrag for Whoop og Bevel (byggebriefen, kapittel 6). */
export function buildSummary(
  workout: Workout,
  getExercise: (id: string) => Exercise | undefined,
  options: SummaryOptions = {},
): string {
  const tz = options.timeZone ? { timeZone: options.timeZone } : {};
  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...tz });
  const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...tz });
  const start = new Date(workout.startedAt);
  const end = workout.endedAt ? new Date(workout.endedAt) : undefined;

  let head = `Strength workout${workout.isDeload ? ' (deload)' : ''} – ${dateFmt.format(start)}, ${timeFmt.format(start)}`;
  if (end) {
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    head += `–${timeFmt.format(end)} (${minutes} min)`;
  }

  // Samme øvelse kan stå to ganger i økta (oppvarming og arbeidssett). De samles på én linje.
  const order: string[] = [];
  const byExercise = new Map<string, SetEntry[]>();
  for (const we of [...workout.exercises].sort((a, b) => a.order - b.order)) {
    const done = we.sets.filter((s) => s.done);
    if (done.length === 0) continue;
    if (!byExercise.has(we.exerciseId)) {
      byExercise.set(we.exerciseId, []);
      order.push(we.exerciseId);
    }
    byExercise.get(we.exerciseId)!.push(...done);
  }
  const lines: string[] = [];
  for (const id of order) {
    const ex = getExercise(id);
    if (ex) lines.push(exerciseLine(ex, byExercise.get(id)!, options.target));
  }

  const volume = workoutVolume(workout, getExercise);
  let foot = `Working sets: ${workoutWorkingSets(workout)}`;
  if (volume > 0) foot += ` · Volume: ${thousands(volume)} kg (weighted sets only)`;

  return `${head}\n\n${lines.join('\n')}\n\n${foot}`;
}

function thousands(n: number): string {
  const [int, dec] = num(n).split('.');
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${grouped}.${dec}` : grouped;
}
