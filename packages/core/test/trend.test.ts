import { describe, expect, it } from 'vitest';
import {
  defaultThresholds as t,
  deloadAdvice,
  exerciseTrend,
  seedExercises,
  type Exercise,
  type ExerciseSession,
  type SetEntry,
  type Workout,
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
const weekly = (start: string, list: SetEntry[][]) =>
  list.map((sets, i) => {
    const d = new Date(`${start}T10:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return session(d.toISOString().slice(0, 10), sets);
  });

describe('trend', () => {
  it('trenger minst 3 like økter', () => {
    const r = exerciseTrend(squat, weekly('2026-10-01', [sq([5, 5, 5]), sq([5, 5, 6])]), t);
    expect(r?.status).toBe('unclear');
    expect(r?.sessions).toBe(2);
  });
  it('over +0,5 % per uke er progresjon', () => {
    const r = exerciseTrend(squat, weekly('2026-10-01', [sq([5, 5, 5], 100), sq([5, 5, 5], 102.5), sq([5, 5, 5], 105), sq([5, 5, 5], 107.5)]), t);
    expect(r?.status).toBe('progress');
    expect(r?.pctPerWeek).toBeGreaterThan(2);
    expect(r?.reason).toContain('Estimert 1RM +2,');
  });
  it('flatt i minst 3 uker er platå, kortere tid er uavklart', () => {
    const flat = [sq([5, 5, 5]), sq([5, 5, 5]), sq([5, 5, 5]), sq([5, 5, 5])];
    expect(exerciseTrend(squat, weekly('2026-10-01', flat), t)?.status).toBe('plateau');
    expect(exerciseTrend(squat, weekly('2026-10-01', flat.slice(0, 3)), t)?.status).toBe('unclear');
  });
  it('under −1 % per uke er nedgang', () => {
    const r = exerciseTrend(squat, weekly('2026-10-01', [sq([8, 8, 8]), sq([7, 7, 7]), sq([6, 6, 6]), sq([5, 5, 5])]), t);
    expect(r?.status).toBe('decline');
  });
  it('tilbakegang 2 økter på rad er nedgang selv om trendlinja er slak', () => {
    // Beste sett er likt hver gang, men totalen faller to ganger på rad.
    const r = exerciseTrend(squat, weekly('2026-10-01', [sq([5, 5, 5]), sq([5, 5, 5]), sq([5, 5, 4]), sq([5, 4, 4])]), t);
    expect(r?.status).toBe('decline');
    expect(r?.reason).toContain('Tilbakegang 2 økter på rad');
  });
  it('lettuker og ulike økter holdes utenfor', () => {
    const list = weekly('2026-10-01', [sq([5, 5, 5], 100), sq([5, 5, 5], 102.5), sq([5, 5, 5], 105), sq([5, 5, 5], 107.5)]);
    const deload = session('2026-10-25', sq([5, 5, 5], 60), { isDeload: true });
    const other = session('2026-10-20', sq([12, 12], 60));
    const r = exerciseTrend(squat, [...list, deload, other], t);
    expect(r?.status).toBe('progress');
    expect(r?.sessions).toBe(4);
  });
  it('bruker bare de 6 siste like øktene', () => {
    const list = weekly('2026-09-01', Array.from({ length: 9 }, () => sq([5, 5, 5])));
    expect(exerciseTrend(squat, list, t)?.sessions).toBe(6);
  });
  it('hold måles i sekunder, og nivåøvelser har ingen trend', () => {
    const plank: Exercise = { ...squat, id: 'x-plank', type: 'time' };
    const r = exerciseTrend(plank, weekly('2026-10-01', [[set({ durationSec: 40 })], [set({ durationSec: 45 })], [set({ durationSec: 50 })]]), t);
    expect(r?.status).toBe('progress');
    expect(r?.reason).toContain('Lengste hold');
    expect(exerciseTrend(lib.get('ex-front-lever')!, [], t)).toBeUndefined();
  });
  it('nivåøvelser følges på det høyeste nivået i den nyeste økta', () => {
    const fl = lib.get('ex-front-lever')!;
    const [p1, p2] = [fl.levels![0]!.id, fl.levels![1]!.id];
    const hold = (levelId: string, sec: number) => [set({ levelId, durationSec: sec })];
    const list = weekly('2026-10-01', [hold(p1, 30), hold(p2, 8), hold(p2, 10), hold(p2, 12)]);
    const r = exerciseTrend(fl, list, t);
    expect(r?.status).toBe('progress');
    expect(r?.sessions).toBe(3); // økta på P1 er ikke med
    expect(r?.reason).toContain('Lengste hold på P2');
  });
  it('kroppsvekt med ekstravekt følger estimert 1RM, uten ekstravekt beste sett', () => {
    const pull = lib.get('ex-pull-up')!;
    const plain = weekly('2026-10-01', [[set({ reps: 8 })], [set({ reps: 9 })], [set({ reps: 10 })]]);
    expect(exerciseTrend(pull, plain, t)?.reason).toContain('Beste sett +');
    const loaded = weekly('2026-10-01', [[set({ weightKg: 10, reps: 5 })], [set({ weightKg: 12.5, reps: 5 })], [set({ weightKg: 15, reps: 5 })]]);
    const r = exerciseTrend(pull, loaded, t);
    expect(r?.status).toBe('progress');
    expect(r?.reason).toContain('ekstravekt');
  });
});

describe('varsel om lettuke', () => {
  const bench: Exercise = { ...squat, id: 'x-bench', name: 'Benkpress', isMainLift: true };
  const row: Exercise = { ...squat, id: 'x-row', name: 'Roing', isMainLift: false };
  const workout = (date: string, parts: [Exercise, SetEntry[]][], isDeload = false): Workout => ({
    id: `w${++n}`,
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: `${date}T11:00:00.000Z`,
    isDeload,
    exercises: parts.map(([ex, sets], i) => ({ id: `we${++n}`, exerciseId: ex.id, order: i, sets })),
  });
  const now = new Date('2026-11-14T12:00:00.000Z');
  const signal = (a: ReturnType<typeof deloadAdvice>, id: string) => a.signals.find((s) => s.id === id)!;

  it('foreslår ingenting uten økter', () => {
    const a = deloadAdvice([bench], [], t, now);
    expect(a.suggest).toBe(false);
    expect(a.signals).toHaveLength(4);
  });
  it('hovedøvelse med tilbakegang 3 økter på rad og nedgang i øvelsene gir forslag', () => {
    const ws = [
      workout('2026-10-17', [[bench, sq([8, 8, 8], 80)], [row, sq([10, 10, 10], 60)]]),
      workout('2026-10-24', [[bench, sq([8, 8, 7], 80)], [row, sq([10, 10, 10], 60)]]),
      workout('2026-10-31', [[bench, sq([8, 7, 7], 80)], [row, sq([10, 10, 10], 60)]]),
      workout('2026-11-07', [[bench, sq([7, 7, 7], 80)], [row, sq([10, 10, 10], 60)]]),
    ];
    const a = deloadAdvice([bench, row], ws, t, now);
    expect(signal(a, 'main_lift').fired).toBe(true);
    expect(signal(a, 'main_lift').reason).toBe('Benkpress har gått tilbake 3 økter på rad');
    expect(signal(a, 'decline_share').fired).toBe(true); // 1 av 2 = 50 %
    expect(signal(a, 'weeks_since').fired).toBe(false); // 4 uker siden første økt
    expect(a.suggest).toBe(true);
  });
  it('RPE-signalet krever minst to øvelser', () => {
    const rpe = (v: number) => ({ rpe: v });
    const days = ['2026-10-24', '2026-10-31', '2026-11-07'];
    const both = days.map((d, i) => workout(d, [[bench, sq([5, 5, 5], 80, rpe(8 + i * 0.5))], [row, sq([8, 8, 8], 60, rpe(7 + i * 0.5))]]));
    expect(signal(deloadAdvice([bench, row], both, t, now), 'rpe_rise').fired).toBe(true);
    const one = days.map((d, i) => workout(d, [[bench, sq([5, 5, 5], 80, rpe(8 + i * 0.5))], [row, sq([8, 8, 8], 60, rpe(7))]]));
    expect(signal(deloadAdvice([bench, row], one, t, now), 'rpe_rise').fired).toBe(false);
  });
  it('teller uker fra forrige lettuke, eller fra første økt', () => {
    const first = workout('2026-09-01', [[row, sq([8], 60)]]);
    const a = deloadAdvice([row], [first], t, now);
    expect(signal(a, 'weeks_since').fired).toBe(true);
    expect(signal(a, 'weeks_since').reason).toContain('10 uker siden første økt');
    const deload = workout('2026-10-20', [[row, sq([8], 60)]], true);
    const b = deloadAdvice([row], [first, deload], t, now);
    expect(signal(b, 'weeks_since').fired).toBe(false);
    expect(signal(b, 'weeks_since').reason).toBe('Det er 3 uker siden forrige lettuke');
    expect(b.suggest).toBe(false);
  });
});
