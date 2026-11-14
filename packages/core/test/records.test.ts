import { describe, expect, it } from 'vitest';
import {
  bestSeries,
  e1rmSeries,
  exerciseHistory,
  exerciseRecords,
  seedExercises,
  volumeSeries,
  type Exercise,
  type SetEntry,
  type Workout,
} from '../src';

let n = 0;
const set = (p: Partial<SetEntry> = {}): SetEntry => ({ id: `s${++n}`, kind: 'working', done: true, ...p });
const workout = (date: string, exerciseId: string, sets: SetEntry[], extra: Partial<Workout> = {}): Workout => ({
  id: `w${++n}`,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  isDeload: false,
  exercises: [{ id: `we${++n}`, exerciseId, order: 0, sets }],
  ...extra,
});
const lib = new Map<string, Exercise>(seedExercises().map((e) => [e.id, e]));
const ex = (id: string) => lib.get(id) as Exercise;

describe('historikk', () => {
  it('tar med ferdige økter med fullførte sett, nyeste først', () => {
    const w1 = workout('2026-11-01', 'ex-back-squat', [set({ weightKg: 100, reps: 5 })]);
    const w2 = workout('2026-11-08', 'ex-back-squat', [set({ weightKg: 105, reps: 5 }), set({ done: false })]);
    const active = workout('2026-11-14', 'ex-back-squat', [set({ weightKg: 110, reps: 5 })], { endedAt: undefined });
    const other = workout('2026-11-09', 'ex-deadlift', [set({ weightKg: 140, reps: 3 })]);
    const h = exerciseHistory([w1, w2, active, other], 'ex-back-squat');
    expect(h.map((s) => s.workoutId)).toEqual([w2.id, w1.id]);
    expect(h[0]?.sets).toHaveLength(1);
  });
});

describe('rekorder', () => {
  it('vekt × reps: estimert 1RM, tyngste sett og flest reps, uten oppvarming', () => {
    const sessions = exerciseHistory(
      [
        workout('2026-11-01', 'ex-back-squat', [
          set({ kind: 'warmup', weightKg: 60, reps: 20 }),
          set({ weightKg: 100, reps: 5 }),
          set({ weightKg: 80, reps: 12 }),
        ]),
        workout('2026-11-08', 'ex-back-squat', [set({ weightKg: 110, reps: 2 }), set({ weightKg: 100, reps: 5 })]),
      ],
      'ex-back-squat',
    );
    const [group] = exerciseRecords(ex('ex-back-squat'), sessions);
    const byKind = Object.fromEntries(group!.records.map((r) => [r.kind, r]));
    expect(byKind.e1rm?.display).toBe('117,3 kg (110×2)');
    expect(byKind.heaviest?.display).toBe('110 kg × 2');
    expect(byKind.most_reps?.display).toBe('12 reps (80 kg)');
    // Lik verdi: den eldste økta beholder rekorden.
    expect(byKind.most_reps?.date.startsWith('2026-11-01')).toBe(true);
  });

  it('kroppsvekt: flest reps og mest ekstravekt', () => {
    const sessions = exerciseHistory(
      [workout('2026-11-01', 'ex-pull-up', [set({ reps: 10 }), set({ weightKg: 15, reps: 4 })])],
      'ex-pull-up',
    );
    const [group] = exerciseRecords(ex('ex-pull-up'), sessions);
    expect(group!.records.map((r) => r.display)).toEqual(['10 reps', '+15 kg × 4']);
  });

  it('assistert: minst assistanse', () => {
    const assisted: Exercise = { ...ex('ex-pull-up'), id: 'ex-assisted', type: 'assisted' };
    const sessions = exerciseHistory(
      [workout('2026-11-01', 'ex-assisted', [set({ assistanceKg: 30, reps: 8 }), set({ assistanceKg: 20, reps: 5 })])],
      'ex-assisted',
    );
    const [group] = exerciseRecords(assisted, sessions);
    expect(group!.records.find((r) => r.kind === 'least_assistance')?.display).toBe('−20 kg × 5');
  });

  it('nivå med sekunder: lengste hold per nivå, høyeste nivå først', () => {
    const fl = ex('ex-front-lever');
    const [p1, p2] = fl.levels!;
    const sessions = exerciseHistory(
      [
        workout('2026-11-01', fl.id, [set({ levelId: p1!.id, durationSec: 20 }), set({ levelId: p2!.id, durationSec: 8 })]),
        workout('2026-11-08', fl.id, [set({ levelId: p1!.id, durationSec: 25 })]),
      ],
      fl.id,
    );
    const groups = exerciseRecords(fl, sessions);
    expect(groups.map((g) => g.label)).toEqual(['P2 advanced tuck', 'P1 tuck']);
    expect(groups.map((g) => g.records[0]?.display)).toEqual(['8 s', '25 s']);
  });

  it('unilateralt: egne rekorder per side', () => {
    const pistol = ex('ex-pistol-squat');
    const p1 = pistol.levels![0]!.id;
    const sessions = exerciseHistory(
      [
        workout('2026-11-01', pistol.id, [
          set({ levelId: p1, side: 'left', reps: 5 }),
          set({ levelId: p1, side: 'right', reps: 3 }),
        ]),
      ],
      pistol.id,
    );
    const groups = exerciseRecords(pistol, sessions);
    expect(groups.map((g) => [g.label, g.records[0]?.display])).toEqual([
      ['P1 · venstre', '5 reps'],
      ['P1 · høyre', '3 reps'],
    ]);
  });

  it('gir tom liste uten historikk', () => {
    expect(exerciseRecords(ex('ex-back-squat'), [])).toEqual([]);
  });
});

describe('grafserier', () => {
  const sessions = exerciseHistory(
    [
      workout('2026-11-08', 'ex-back-squat', [set({ weightKg: 105, reps: 5, rpe: 9 })]),
      workout('2026-11-01', 'ex-back-squat', [
        set({ kind: 'warmup', weightKg: 60, reps: 5 }),
        set({ weightKg: 100, reps: 5 }),
        set({ weightKg: 100, reps: 5 }),
      ]),
    ],
    'ex-back-squat',
  );
  it('estimert 1RM per økt, eldste først, med RPE når den er logget', () => {
    const s = e1rmSeries(sessions);
    expect(s.map((p) => p.date.slice(0, 10))).toEqual(['2026-11-01', '2026-11-08']);
    expect(s[0]?.value).toBeCloseTo(116.67, 2);
    expect(s[1]?.value).toBeCloseTo(105 * (1 + 6 / 30), 6);
  });
  it('volum per økt', () => {
    expect(volumeSeries(ex('ex-back-squat'), sessions).map((p) => p.value)).toEqual([1000, 525]);
  });
  it('beste hold per økt for ett nivå', () => {
    const fl = ex('ex-front-lever');
    const [p1, p2] = fl.levels!;
    const h = exerciseHistory(
      [
        workout('2026-11-01', fl.id, [set({ levelId: p1!.id, durationSec: 20 }), set({ levelId: p1!.id, durationSec: 15 })]),
        workout('2026-11-08', fl.id, [set({ levelId: p2!.id, durationSec: 8 })]),
      ],
      fl.id,
    );
    expect(bestSeries(h, 'seconds', p1!.id).map((p) => p.value)).toEqual([20]);
    expect(bestSeries(h, 'seconds').map((p) => p.value)).toEqual([20, 8]);
  });
});
