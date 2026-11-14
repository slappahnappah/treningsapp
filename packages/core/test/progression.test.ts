import { describe, expect, it } from 'vitest';
import {
  areAlike,
  compareSessions,
  defaultThresholds as t,
  progressFor,
  seedExercises,
  type Exercise,
  type ExerciseSession,
  type SetEntry,
} from '../src';

let n = 0;
const set = (p: Partial<SetEntry> = {}): SetEntry => ({ id: `s${++n}`, kind: 'working', done: true, ...p });
const session = (date: string, sets: SetEntry[], extra: Partial<ExerciseSession> = {}): ExerciseSession => ({
  workoutId: `w${++n}`,
  startedAt: `${date}T10:00:00.000Z`,
  isDeload: false,
  sets,
  ...extra,
});
const lib = new Map<string, Exercise>(seedExercises().map((e) => [e.id, e]));
const squat = lib.get('ex-back-squat')!;
const sq = (reps: number[], kg = 100, extra: Partial<SetEntry> = {}) =>
  reps.map((r, i) => set({ weightKg: kg, reps: r, ...(i > 0 ? { restBeforeSec: 180 } : {}), ...extra }));

describe('like økter', () => {
  it('krever samme antall arbeidssett', () => {
    expect(areAlike(session('2026-11-08', sq([5, 5, 5])), session('2026-11-01', sq([5, 5])), t)).toBe(false);
    const withWarmup = [set({ kind: 'warmup', weightKg: 60, reps: 5 }), ...sq([5, 5, 5])];
    expect(areAlike(session('2026-11-08', withWarmup), session('2026-11-01', sq([5, 5, 5])), t)).toBe(true);
  });
  it('tåler 15 sekunder eller 15 prosent avvik i snittpause', () => {
    const rest = (sec: number) => session('2026-11-01', [set({ weightKg: 100, reps: 5 }), set({ weightKg: 100, reps: 5, restBeforeSec: sec })]);
    expect(areAlike(rest(180), rest(195), t)).toBe(true); // 15 s
    expect(areAlike(rest(204), rest(180), t)).toBe(true); // 13 %
    expect(areAlike(rest(240), rest(180), t)).toBe(false);
    expect(areAlike(rest(60), rest(80), t)).toBe(false); // 20 s og 25 %
  });
  it('lettuke sammenlignes ikke med vanlige økter', () => {
    expect(areAlike(session('2026-11-08', sq([5]), { isDeload: true }), session('2026-11-01', sq([5])), t)).toBe(false);
  });
});

describe('fremgang, lik og tilbakegang', () => {
  const prev = session('2026-11-01', sq([5, 5, 5]));
  const cmp = (cur: SetEntry[], p = prev) => compareSessions(squat, session('2026-11-08', cur), p, t).status;

  it('minst 1 rep mer totalt på samme vekt er fremgang', () => {
    expect(cmp(sq([5, 5, 6]))).toBe('up');
  });
  it('høyere vekt med minst like mange reps er fremgang', () => {
    expect(cmp(sq([5, 5, 5], 102.5))).toBe('up');
  });
  it('samme reps og vekt er lik', () => {
    expect(cmp(sq([5, 5, 5]))).toBe('same');
    expect(cmp(sq([6, 5, 4]))).toBe('same');
  });
  it('minst 1 rep færre totalt på samme vekt er tilbakegang', () => {
    expect(cmp(sq([5, 5, 4]))).toBe('down');
  });
  it('høyere vekt og færre reps vises som lik', () => {
    expect(cmp(sq([5, 4, 4], 105))).toBe('same');
  });
  it('ulik vekt i noen sett vises som lik', () => {
    expect(cmp([...sq([5, 5], 100), ...sq([5], 95)])).toBe('same');
  });
  it('RPE avgjør når reps og vekt er like, og bare når den er logget i begge', () => {
    const prevRpe = session('2026-11-01', sq([5, 5, 5], 100, { rpe: 9 }));
    expect(cmp(sq([5, 5, 5], 100, { rpe: 8 }), prevRpe)).toBe('up');
    expect(cmp(sq([5, 5, 5], 100, { rpe: 10 }), prevRpe)).toBe('down');
    expect(cmp(sq([5, 5, 5], 100, { rpe: 8.5 }), prevRpe)).toBe('same');
    expect(cmp(sq([5, 5, 5], 100, { rpe: 7 }))).toBe('same');
  });
  it('oppvarmingssett er aldri med', () => {
    const cur = [set({ kind: 'warmup', weightKg: 60, reps: 20 }), ...sq([5, 5, 5])];
    expect(cmp(cur)).toBe('same');
  });
});

describe('andre øvelsestyper', () => {
  it('hold bruker sekunder', () => {
    const fl = lib.get('ex-front-lever')!;
    const p1 = fl.levels![0]!.id;
    const a = session('2026-11-01', [set({ levelId: p1, durationSec: 10 })]);
    const b = session('2026-11-08', [set({ levelId: p1, durationSec: 12 })]);
    const r = compareSessions(fl, b, a, t);
    expect(r.status).toBe('up');
    expect(r.reason).toBe('2 sekunder mer totalt');
  });
  it('høyere nivå er alltid fremgang', () => {
    const fl = lib.get('ex-front-lever')!;
    const a = session('2026-11-01', [set({ levelId: fl.levels![0]!.id, durationSec: 20 })]);
    const b = session('2026-11-08', [set({ levelId: fl.levels![1]!.id, durationSec: 5 })]);
    expect(compareSessions(fl, b, a, t).status).toBe('up');
    expect(compareSessions(fl, a, b, t).status).toBe('same');
  });
  it('assistert: mindre assistanse med minst like mange reps er fremgang', () => {
    const assisted: Exercise = { ...lib.get('ex-pull-up')!, type: 'assisted' };
    const a = session('2026-11-01', [set({ assistanceKg: 20, reps: 6 })]);
    const b = session('2026-11-08', [set({ assistanceKg: 15, reps: 6 })]);
    expect(compareSessions(assisted, b, a, t).status).toBe('up');
  });
  it('ekstravekt på kroppsvektøvelser behandles som vekt', () => {
    const pull = lib.get('ex-pull-up')!;
    const a = session('2026-11-01', [set({ weightKg: 10, reps: 5 })]);
    const b = session('2026-11-08', [set({ weightKg: 12.5, reps: 5 })]);
    expect(compareSessions(pull, b, a, t).status).toBe('up');
  });
  it('unilateralt vurderes per side', () => {
    const pistol = lib.get('ex-pistol-squat')!;
    const p1 = pistol.levels![0]!.id;
    const s = (l: number, r: number, date: string) =>
      session(date, [set({ levelId: p1, side: 'left', reps: l }), set({ levelId: p1, side: 'right', reps: r })]);
    expect(compareSessions(pistol, s(6, 5, '2026-11-08'), s(5, 5, '2026-11-01'), t).status).toBe('up');
    expect(compareSessions(pistol, s(6, 4, '2026-11-08'), s(5, 5, '2026-11-01'), t).status).toBe('same');
    expect(compareSessions(pistol, s(5, 4, '2026-11-08'), s(5, 5, '2026-11-01'), t).status).toBe('down');
  });
});

describe('pil for en økt', () => {
  it('sammenligner med nyeste tidligere like økt og hopper over ulike', () => {
    const old = session('2026-10-25', sq([5, 5, 4]));
    const different = session('2026-11-01', sq([8, 8]));
    const deload = session('2026-11-05', sq([5, 5, 5]), { isDeload: true });
    const cur = session('2026-11-08', sq([5, 5, 5]));
    const later = session('2026-11-12', sq([5, 5, 9]));
    const r = progressFor(squat, cur, [later, cur, deload, different, old], t);
    expect(r?.status).toBe('up');
    expect(r?.comparedTo.workoutId).toBe(old.workoutId);
  });
  it('gir ingen pil uten en tidligere lik økt', () => {
    const cur = session('2026-11-08', sq([5, 5, 5]));
    expect(progressFor(squat, cur, [cur], t)).toBeUndefined();
    expect(progressFor(squat, cur, [cur, session('2026-11-01', sq([5]))], t)).toBeUndefined();
  });
});
