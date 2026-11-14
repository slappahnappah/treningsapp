import { isWorkingSet } from './formulas';
import type { Exercise, ProgressionThresholds, SetEntry, Side } from './model';
import type { ExerciseSession } from './records';
import { averageRestSec } from './rest';

// Progresjon steg 1: sammenligning med forrige like økt (byggebriefen, kapittel 5).

export type ProgressStatus = 'up' | 'same' | 'down';

export interface Comparison {
  status: ProgressStatus;
  reason: string;
}

export interface ProgressResult extends Comparison {
  comparedTo: { workoutId: string; startedAt: string };
}

const working = (session: ExerciseSession) => session.sets.filter((s) => s.done && isWorkingSet(s));

function bySide(sets: SetEntry[]): Map<Side | 'both', SetEntry[]> {
  const map = new Map<Side | 'both', SetEntry[]>();
  for (const s of sets) {
    const key = s.side ?? 'both';
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return map;
}

/**
 * To forekomster av en øvelse er like når antall arbeidssett er det samme
 * (per side), begge eller ingen er lettuke, og snittpausen avviker med høyst
 * `restDiffSec` sekunder eller `restDiffPct` prosent. Mangler pausen i en av
 * øktene (for eksempel ved bare ett sett), stopper ikke det sammenligningen.
 */
export function areAlike(
  a: ExerciseSession,
  b: ExerciseSession,
  t: Pick<ProgressionThresholds, 'restDiffSec' | 'restDiffPct'>,
): boolean {
  if (a.isDeload !== b.isDeload) return false;
  const sa = bySide(working(a));
  const sb = bySide(working(b));
  if (sa.size === 0 || sa.size !== sb.size) return false;
  for (const [side, sets] of sa) if (sb.get(side)?.length !== sets.length) return false;

  const ra = averageRestSec(working(a));
  const rb = averageRestSec(working(b));
  if (ra === undefined || rb === undefined) return true;
  const diff = Math.abs(ra - rb);
  return diff <= t.restDiffSec || (rb > 0 && (diff / rb) * 100 <= t.restDiffPct);
}

function compareSets(
  exercise: Exercise,
  cur: SetEntry[],
  prev: SetEntry[],
  t: Pick<ProgressionThresholds, 'rpeDiff'>,
): Comparison {
  const seconds = exercise.type === 'time' || (exercise.type === 'level' && exercise.levelMetric === 'seconds');
  const unit = seconds ? 'sekunder' : 'reps';
  const weightWord = exercise.type === 'assisted' ? 'assistanse' : 'vekt';

  // Nivå: et høyere nivå er alltid fremgang.
  if (exercise.type === 'level') {
    const order = (s: SetEntry) => exercise.levels?.find((l) => l.id === s.levelId)?.order ?? 0;
    const diffs = cur.map((s, i) => order(s) - order(prev[i]!));
    const higher = diffs.some((d) => d > 0);
    const lower = diffs.some((d) => d < 0);
    if (higher && !lower) return { status: 'up', reason: 'Høyere nivå enn forrige gang' };
    if (higher || lower) return { status: 'same', reason: 'Annet nivå enn forrige gang, så øktene kan ikke rangeres' };
  }

  // Assistanse teller som negativ vekt: mindre assistanse er tyngre.
  const weight = (s: SetEntry) => (exercise.type === 'assisted' ? -(s.assistanceKg ?? 0) : (s.weightKg ?? 0));
  const amount = (s: SetEntry) => (seconds ? (s.durationSec ?? 0) : (s.reps ?? 0));
  const wDiffs = cur.map((s, i) => weight(s) - weight(prev[i]!));
  const sameWeight = wDiffs.every((d) => d === 0);
  const heavier = wDiffs.every((d) => d >= 0) && wDiffs.some((d) => d > 0);
  const total = (sets: SetEntry[]) => sets.reduce((sum, s) => sum + amount(s), 0);
  const delta = total(cur) - total(prev);

  if (heavier) {
    return delta >= 0
      ? {
          status: 'up',
          reason: exercise.type === 'assisted' ? `Mindre assistanse med minst like mange ${unit}` : `Høyere vekt med minst like mange ${unit}`,
        }
      : { status: 'same', reason: `Høyere ${weightWord}, men færre ${unit}. Kan ikke rangeres ennå` };
  }
  if (!sameWeight) {
    return { status: 'same', reason: `Ulik ${weightWord} fra forrige gang. Kan ikke rangeres ennå` };
  }

  // Uten vekt eller assistanse i noen av øktene nevnes ikke vekten i forklaringen.
  const weighted = [...cur, ...prev].some((s) => weight(s) !== 0);
  const onSame = weighted ? ` på samme ${weightWord}` : '';
  const andWeight = weighted ? ` og ${weightWord}` : '';
  const count = (n: number) => `${n} ${n === 1 ? (seconds ? 'sekund' : 'rep') : unit}`;
  if (delta >= 1) return { status: 'up', reason: `${count(delta)} mer totalt${onSame}` };
  if (delta <= -1) return { status: 'down', reason: `${count(-delta)} færre totalt${onSame}` };

  // RPE brukes bare når det er logget i begge øktene.
  const avgRpe = (sets: SetEntry[]) => {
    const logged = sets.filter((s) => s.rpe != null).map((s) => s.rpe as number);
    return logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : undefined;
  };
  const rc = avgRpe(cur);
  const rp = avgRpe(prev);
  if (rc !== undefined && rp !== undefined) {
    const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
    if (rp - rc >= t.rpeDiff) return { status: 'up', reason: `Samme ${unit}${andWeight}, snitt-RPE ned fra ${fmt(rp)} til ${fmt(rc)}` };
    if (rc - rp >= t.rpeDiff) return { status: 'down', reason: `Samme ${unit}${andWeight}, snitt-RPE opp fra ${fmt(rp)} til ${fmt(rc)}` };
  }
  return { status: 'same', reason: `Samme ${unit}${andWeight} som forrige gang` };
}

/** Sammenligner to like forekomster. Unilaterale øvelser vurderes per side og slås sammen. */
export function compareSessions(
  exercise: Exercise,
  current: ExerciseSession,
  previous: ExerciseSession,
  t: Pick<ProgressionThresholds, 'rpeDiff'>,
): Comparison {
  const cur = bySide(working(current));
  const prev = bySide(working(previous));
  const results: { side: Side | 'both'; c: Comparison }[] = [];
  for (const [side, sets] of cur) {
    results.push({ side, c: compareSets(exercise, sets, prev.get(side) ?? [], t) });
  }
  if (results.length === 1) return results[0]!.c;

  const up = results.some((r) => r.c.status === 'up');
  const down = results.some((r) => r.c.status === 'down');
  const status: ProgressStatus = up && !down ? 'up' : down && !up ? 'down' : 'same';
  const name = (s: Side | 'both') => (s === 'left' ? 'Venstre' : s === 'right' ? 'Høyre' : 'Begge');
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  return { status, reason: results.map((r) => `${name(r.side)}: ${lower(r.c.reason)}`).join('. ') };
}

/**
 * Pil for en øvelse i en ferdig økt: sammenligner med den nyeste tidligere
 * økta som er lik. Uten en tidligere lik økt gis ingen pil.
 */
export function progressFor(
  exercise: Exercise,
  current: ExerciseSession,
  history: ExerciseSession[],
  t: ProgressionThresholds,
): ProgressResult | undefined {
  if (working(current).length === 0) return undefined;
  const earlier = history
    .filter((s) => s.workoutId !== current.workoutId && s.startedAt < current.startedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const match = earlier.find((s) => areAlike(current, s, t));
  if (!match) return undefined;
  return {
    ...compareSessions(exercise, current, match, t),
    comparedTo: { workoutId: match.workoutId, startedAt: match.startedAt },
  };
}
