import { formatNumber } from './format';
import { isWorkingSet, setE1RM } from './formulas';
import type { Exercise, ProgressionThresholds, SetEntry, Workout } from './model';
import { areAlike, compareSessions, progressFor } from './progression';
import { exerciseHistory, type ExerciseSession } from './records';

// Progresjon steg 2 og 3: trend over tid og varsel om lettuke (byggebriefen, kapittel 5).

export type TrendStatus = 'progress' | 'plateau' | 'decline' | 'unclear';

export interface Trend {
  status: TrendStatus;
  reason: string;
  /** Stigning i prosent per uke av snittet. Mangler når det er for lite data. */
  pctPerWeek?: number;
  sessions: number;
  weeks: number;
}

const DAY = 86_400_000;
const working = (s: ExerciseSession) => s.sets.filter((x) => x.done && isWorkingSet(x));
const pct = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatNumber(Math.abs(r))} %`;
};

/**
 * Hva trenden måles i, ut fra den nyeste økta. Nivåøvelser følges på det
 * høyeste nivået i den nyeste økta. Assistanseøvelser har ingen trend ennå.
 */
function metric(
  exercise: Exercise,
  latest: ExerciseSession,
): { value: (s: ExerciseSession) => number; name: string } | undefined {
  const best = (sets: SetEntry[], f: (x: SetEntry) => number) => Math.max(0, ...sets.map(f));
  const reps = (x: SetEntry) => x.reps ?? 0;
  const seconds = (x: SetEntry) => x.durationSec ?? 0;
  switch (exercise.type) {
    case 'weight_reps':
      return { value: (s) => best(working(s), setE1RM), name: 'Estimert 1RM' };
    case 'bodyweight': {
      // Med ekstravekt følges estimert 1RM for ekstravekten, ellers beste sett.
      const weighted = (x: SetEntry) => (x.weightKg ?? 0) > 0;
      if (working(latest).some(weighted)) {
        return { value: (s) => best(working(s).filter(weighted), setE1RM), name: 'Estimert 1RM med ekstravekt' };
      }
      return { value: (s) => best(working(s).filter((x) => !weighted(x)), reps), name: 'Beste sett' };
    }
    case 'time':
      return { value: (s) => best(working(s), seconds), name: 'Lengste hold' };
    case 'level': {
      const order = (x: SetEntry) => exercise.levels?.find((l) => l.id === x.levelId)?.order ?? 0;
      const top = [...working(latest)].sort((p, q) => order(q) - order(p))[0];
      const level = exercise.levels?.find((l) => l.id === top?.levelId);
      if (!level) return undefined;
      const hold = exercise.levelMetric === 'seconds';
      return {
        value: (s) => best(working(s).filter((x) => x.levelId === level.id), hold ? seconds : reps),
        name: `${hold ? 'Lengste hold' : 'Beste sett'} på P${level.order}`,
      };
    }
    default:
      return undefined;
  }
}

/**
 * Trend for en øvelse: lineær trendlinje gjennom de siste like øktene
 * (lettuker holdes utenfor). `history` er alle forekomster av øvelsen.
 */
export function exerciseTrend(
  exercise: Exercise,
  history: ExerciseSession[],
  t: ProgressionThresholds,
): Trend | undefined {
  const normal = history
    .filter((s) => !s.isDeload && working(s).length > 0)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = normal[0];
  if (!latest) return undefined;
  const m = metric(exercise, latest);
  if (!m) return undefined;
  // Nyeste først. Den nyeste økta er alltid med. Økter uten verdi (f.eks. et annet nivå) holdes utenfor.
  const alike = normal
    .filter((s) => (s === latest || areAlike(latest, s, t)) && m.value(s) > 0)
    .slice(0, t.trendSessions);
  const points = alike.map((s) => ({ x: Date.parse(s.startedAt) / (7 * DAY), y: m.value(s) })).reverse();
  const n = points.length;
  const weeks = n > 1 ? points[n - 1]!.x - points[0]!.x : 0;

  // Tilbakegang flere økter på rad teller som nedgang uansett trendlinje.
  let downRun = 0;
  for (let i = 0; i + 1 < alike.length; i++) {
    if (compareSessions(exercise, alike[i]!, alike[i + 1]!, t).status !== 'down') break;
    downRun++;
  }
  const run = downRun >= t.declineSessionsInRow;

  if (n < 3 || weeks <= 0) {
    if (run) return { status: 'decline', reason: `Tilbakegang ${downRun} økter på rad`, sessions: n, weeks };
    return {
      status: 'unclear',
      reason: `Trenger minst 3 like økter for å se en trend. Har ${n} så langt`,
      sessions: n,
      weeks,
    };
  }

  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const pctPerWeek = sxx > 0 && my > 0 ? (sxy / sxx / my) * 100 : 0;
  const base = { pctPerWeek, sessions: n, weeks };
  const over = `${m.name} ${pct(pctPerWeek)} per uke over de ${n} siste like øktene`;

  if (run) return { ...base, status: 'decline', reason: `Tilbakegang ${downRun} økter på rad. ${over}` };
  if (pctPerWeek < -t.trendDeclinePctPerWeek) return { ...base, status: 'decline', reason: over };
  if (pctPerWeek > t.trendProgressPctPerWeek) return { ...base, status: 'progress', reason: over };
  if (Math.abs(pctPerWeek) <= t.trendPlateauPctPerWeek) {
    if (weeks >= t.trendPlateauWeeks) {
      return { ...base, status: 'plateau', reason: `${over}, i ${formatNumber(Math.round(weeks))} uker` };
    }
    return { ...base, status: 'unclear', reason: `${over}. Flatt, men for kort tid til å kalle det et platå` };
  }
  return { ...base, status: 'unclear', reason: `${over}. Svak nedgang, men ikke nok til å kalle det nedgang` };
}

export interface DeloadSignal {
  id: 'decline_share' | 'main_lift' | 'rpe_rise' | 'weeks_since';
  fired: boolean;
  reason: string;
}

export interface DeloadAdvice {
  suggest: boolean;
  signals: DeloadSignal[];
}

const join = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} og ${names.length - 3} til` : names.join(', '));

/** Samme vekt og reps (eller sekunder) i alle arbeidssett, i samme rekkefølge. */
function signature(s: ExerciseSession): string {
  return working(s)
    .map((x) => [x.side ?? '', x.levelId ?? '', x.weightKg ?? 0, x.assistanceKg ?? 0, x.reps ?? 0, x.durationSec ?? 0].join('/'))
    .join('|');
}

function avgRpe(s: ExerciseSession): number | undefined {
  const logged = working(s).filter((x) => x.rpe != null).map((x) => x.rpe as number);
  return logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : undefined;
}

/**
 * Varsel om lettuke: foreslås når minst `deloadSignalsNeeded` av fire signaler
 * slår ut. Hvert signal har en forklaring, også når det ikke slår ut.
 */
export function deloadAdvice(
  exercises: Exercise[],
  workouts: Workout[],
  t: ProgressionThresholds,
  now: Date = new Date(),
): DeloadAdvice {
  const finished = workouts.filter((w) => w.endedAt && Date.parse(w.startedAt) <= now.getTime());
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const histories = new Map<string, ExerciseSession[]>();
  const historyOf = (id: string) => {
    let h = histories.get(id);
    if (!h) {
      h = exerciseHistory(finished, id);
      histories.set(id, h);
    }
    return h;
  };
  const recent = (id: string, count: number) => historyOf(id).filter((s) => !s.isDeload && working(s).length > 0).slice(0, count);
  const signals: DeloadSignal[] = [];

  // 1. Andel øvelser med nedgang de siste dagene.
  const from = now.getTime() - t.deloadWindowDays * DAY;
  const ids = new Set(
    finished
      .filter((w) => !w.isDeload && Date.parse(w.startedAt) >= from)
      .flatMap((w) => w.exercises.filter((we) => we.sets.some((s) => s.done && isWorkingSet(s))).map((we) => we.exerciseId)),
  );
  const declining: string[] = [];
  for (const id of ids) {
    const ex = exMap.get(id);
    if (ex && exerciseTrend(ex, historyOf(id), t)?.status === 'decline') declining.push(ex.name);
  }
  const share = ids.size > 0 ? (declining.length / ids.size) * 100 : 0;
  signals.push({
    id: 'decline_share',
    fired: ids.size > 0 && share >= t.deloadDeclineSharePct,
    reason:
      declining.length > 0
        ? `${declining.length} av ${ids.size} øvelser de siste ${t.deloadWindowDays} dagene har nedgang (${join(declining)})`
        : `Ingen øvelser de siste ${t.deloadWindowDays} dagene har nedgang`,
  });

  // 2. En hovedøvelse med tilbakegang flere økter på rad.
  const mainDown: string[] = [];
  for (const ex of exercises) {
    if (!ex.isMainLift) continue;
    const last = recent(ex.id, t.deloadMainLiftSessions);
    if (last.length < t.deloadMainLiftSessions) continue;
    if (last.every((s) => progressFor(ex, s, historyOf(ex.id), t)?.status === 'down')) mainDown.push(ex.name);
  }
  signals.push({
    id: 'main_lift',
    fired: mainDown.length > 0,
    reason:
      mainDown.length > 0
        ? `${join(mainDown)} har gått tilbake ${t.deloadMainLiftSessions} økter på rad`
        : `Ingen hovedøvelser har gått tilbake ${t.deloadMainLiftSessions} økter på rad`,
  });

  // 3. Snitt-RPE har steget på samme vekt og reps, for minst to øvelser.
  const heavier: string[] = [];
  for (const ex of exercises) {
    const last = recent(ex.id, t.deloadRpeSessions);
    if (last.length < t.deloadRpeSessions || t.deloadRpeSessions < 2) continue;
    const sig = signature(last[0]!);
    if (!last.every((s) => signature(s) === sig)) continue;
    const newest = avgRpe(last[0]!);
    const oldest = avgRpe(last[last.length - 1]!);
    if (newest !== undefined && oldest !== undefined && newest - oldest >= t.rpeDiff) heavier.push(ex.name);
  }
  signals.push({
    id: 'rpe_rise',
    fired: heavier.length >= 2,
    reason:
      heavier.length > 0
        ? `Samme vekt og reps kjennes tyngre (høyere RPE) over de ${t.deloadRpeSessions} siste øktene på ${join(heavier)}`
        : `RPE har ikke steget på samme vekt og reps over de ${t.deloadRpeSessions} siste øktene`,
  });

  // 4. Tid siden forrige lettuke, eller siden første økt.
  const sorted = [...finished].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const lastDeload = [...sorted].reverse().find((w) => w.isDeload);
  const since = lastDeload ?? sorted[0];
  const weeks = since ? (now.getTime() - Date.parse(since.startedAt)) / (7 * DAY) : 0;
  const whole = Math.floor(weeks);
  signals.push({
    id: 'weeks_since',
    fired: weeks > t.deloadWeeksSinceLast,
    reason: !since
      ? 'Ingen økter er logget ennå'
      : lastDeload
        ? `Det er ${whole} uker siden forrige lettuke`
        : `Det er ${whole} uker siden første økt, og ingen lettuke er markert`,
  });

  const fired = signals.filter((s) => s.fired).length;
  return { suggest: fired >= t.deloadSignalsNeeded, signals };
}
