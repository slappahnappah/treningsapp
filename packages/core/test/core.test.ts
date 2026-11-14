import { describe, expect, it } from 'vitest';
import {
  averageRestSec,
  computeRestBeforeSec,
  countWorkingSets,
  defaultSettings,
  epley1RM,
  epley1RMWithRpe,
  findPreviousSets,
  formatClock,
  formatSet,
  indexWithinKind,
  parseNumber,
  platesPerSide,
  restDurationSec,
  roundToLoadable,
  seedExercises,
  seedRoutines,
  setE1RM,
  shouldStartRest,
  warmupSuggestions,
  workoutVolume,
  workoutWorkingSets,
  type Exercise,
  type SetEntry,
  type Workout,
  type WorkoutExercise,
} from '../src';

let n = 0;
const set = (p: Partial<SetEntry> = {}): SetEntry => ({ id: `s${++n}`, kind: 'working', done: true, ...p });
const we = (exerciseId: string, sets: SetEntry[], extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: `we${++n}`,
  exerciseId,
  order: n,
  sets,
  ...extra,
});
const workout = (exercises: WorkoutExercise[], extra: Partial<Workout> = {}): Workout => ({
  id: `w${++n}`,
  startedAt: '2026-11-14T14:52:00.000Z',
  endedAt: '2026-11-14T15:17:00.000Z',
  isDeload: false,
  exercises,
  ...extra,
});

const lib = new Map<string, Exercise>(seedExercises().map((e) => [e.id, e]));
const dumbbellBench: Exercise = {
  ...(lib.get('ex-bench-press') as Exercise),
  id: 'ex-db-bench',
  equipment: 'dumbbell',
  perHand: true,
};
lib.set(dumbbellBench.id, dumbbellBench);
const getEx = (id: string) => lib.get(id);

describe('estimert 1RM', () => {
  it('Epley', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.67, 2);
    expect(epley1RM(100, 0)).toBe(0);
  });
  it('med RPE legger til reps i reserve', () => {
    expect(epley1RMWithRpe(100, 5, 8)).toBeCloseTo(100 * (1 + 7 / 30), 6);
    expect(epley1RMWithRpe(100, 5, 10)).toBeCloseTo(epley1RM(100, 5), 6);
  });
  it('setE1RM bruker RPE når den er logget', () => {
    expect(setE1RM(set({ weightKg: 100, reps: 5 }))).toBeCloseTo(116.67, 2);
    expect(setE1RM(set({ weightKg: 100, reps: 5, rpe: 9 }))).toBeCloseTo(120, 6);
    expect(setE1RM(set({ reps: 5 }))).toBe(0);
  });
});

describe('volum og arbeidssett – eksempelet i kapittel 6', () => {
  const w = workout([
    we('ex-back-squat', [
      set({ kind: 'warmup', weightKg: 60, reps: 5 }),
      set({ weightKg: 100, reps: 5 }),
      set({ weightKg: 100, reps: 5 }),
      set({ weightKg: 100, reps: 5 }),
    ]),
    we('ex-romanian-deadlift', [
      set({ weightKg: 80, reps: 8 }),
      set({ weightKg: 80, reps: 8 }),
      set({ weightKg: 80, reps: 8 }),
    ]),
    we('ex-db-bench', [
      set({ weightKg: 30, reps: 10 }),
      set({ weightKg: 30, reps: 10 }),
      set({ weightKg: 30, reps: 9 }),
    ]),
    we('ex-pull-up', [set({ reps: 8 }), set({ reps: 7 }), set({ reps: 6 })]),
  ]);

  it('volum er 5 160 kg', () => {
    expect(workoutVolume(w, getEx)).toBe(5160);
  });
  it('antall arbeidssett er 12', () => {
    expect(workoutWorkingSets(w)).toBe(12);
  });
  it('sett som ikke er haket av teller ikke', () => {
    const w2 = workout([we('ex-back-squat', [set({ weightKg: 100, reps: 5, done: false })])]);
    expect(workoutVolume(w2, getEx)).toBe(0);
    expect(workoutWorkingSets(w2)).toBe(0);
  });
  it('ekstravekt på kroppsvektøvelser er ikke med i volumet', () => {
    const w2 = workout([we('ex-pull-up', [set({ weightKg: 10, reps: 5 })])]);
    expect(workoutVolume(w2, getEx)).toBe(0);
  });
  it('venstre og høyre side teller som ett sett', () => {
    expect(
      countWorkingSets([
        set({ side: 'left', reps: 5 }),
        set({ side: 'right', reps: 5 }),
        set({ side: 'left', reps: 5 }),
        set({ side: 'right', reps: 4 }),
        set({ kind: 'warmup', side: 'left' }),
      ]),
    ).toBe(2);
  });
});

describe('pause', () => {
  const t = (sec: number) => new Date(Date.UTC(2026, 10, 14, 15, 0, sec)).toISOString();

  it('måles fra forrige sett i samme øvelse', () => {
    const a = set({ completedAt: t(0) });
    const b = set({ done: false });
    const w = workout([we('ex-back-squat', [a, b])]);
    const weId = w.exercises[0]!.id;
    expect(computeRestBeforeSec(w, weId, b.id, t(150))).toBe(150);
    expect(computeRestBeforeSec(w, weId, a.id, t(0))).toBeUndefined();
  });

  it('trekker fra settets egen varighet', () => {
    const a = set({ completedAt: t(0) });
    const b = set({ done: false, durationSec: 30 });
    const w = workout([we('ex-front-lever', [a, b])]);
    expect(computeRestBeforeSec(w, w.exercises[0]!.id, b.id, t(120))).toBe(90);
  });

  it('høyre side rett etter venstre får ingen pause', () => {
    const l1 = set({ side: 'left', completedAt: t(0) });
    const r1 = set({ side: 'right', done: false });
    const l2 = set({ side: 'left', done: false });
    const w = workout([we('ex-pistol-squat', [l1, r1, l2])]);
    const weId = w.exercises[0]!.id;
    expect(computeRestBeforeSec(w, weId, r1.id, t(40))).toBeUndefined();
    r1.done = true;
    r1.completedAt = t(40);
    expect(computeRestBeforeSec(w, weId, l2.id, t(160))).toBe(120);
  });

  it('supersett: pausen regnes fra forrige øvelse i supersettet', () => {
    const a = set({ completedAt: t(0) });
    const b = set({ done: false });
    const w = workout([
      we('ex-back-squat', [a], { supersetGroup: 'g' }),
      we('ex-pull-up', [b], { supersetGroup: 'g' }),
    ]);
    expect(computeRestBeforeSec(w, w.exercises[1]!.id, b.id, t(20))).toBe(20);
  });

  it('snittpause ser bare på sett med målt pause', () => {
    expect(averageRestSec([set(), set({ restBeforeSec: 100 }), set({ restBeforeSec: 140 })])).toBe(120);
    expect(averageRestSec([set()])).toBeUndefined();
  });

  it('hviletimeren starter først når begge sider er gjort', () => {
    const l = set({ side: 'left' });
    const r = set({ side: 'right', done: false });
    const w = workout([we('ex-pistol-squat', [l, r])]);
    const weId = w.exercises[0]!.id;
    expect(shouldStartRest(w, weId, l.id)).toBe(false);
    r.done = true;
    expect(shouldStartRest(w, weId, r.id)).toBe(true);
  });

  it('supersett: timeren starter etter siste øvelse i runden, med lengste hviletid', () => {
    const a = set();
    const b = set({ done: false });
    const w = workout([
      we('ex-back-squat', [a, set({ done: false })], { supersetGroup: 'g' }),
      we('ex-hanging-leg-raise', [b, set({ done: false })], { supersetGroup: 'g' }),
    ]);
    const [first, second] = w.exercises as [WorkoutExercise, WorkoutExercise];
    expect(shouldStartRest(w, first.id, a.id)).toBe(false);
    b.done = true;
    expect(shouldStartRest(w, second.id, b.id)).toBe(true);
    expect(restDurationSec(w, second, (id) => getEx(id)?.defaultRestSec)).toBe(180);
  });

  it('vanlig sett starter timeren', () => {
    const a = set();
    const w = workout([we('ex-back-squat', [a])]);
    expect(shouldStartRest(w, w.exercises[0]!.id, a.id)).toBe(true);
  });
});

describe('platekalkulator', () => {
  const { barKg, platesKg } = defaultSettings;
  it('viser plater per side', () => {
    expect(platesPerSide(100, barKg, platesKg).perSide).toEqual([25, 15]);
    expect(platesPerSide(62.5, barKg, platesKg).perSide).toEqual([20, 1.25]);
    expect(platesPerSide(20, barKg, platesKg).perSide).toEqual([]);
  });
  it('melder fra om rest som ikke kan lastes', () => {
    const load = platesPerSide(101, barKg, platesKg);
    expect(load.totalKg).toBe(100);
    expect(load.remainderKg).toBe(1);
  });
  it('runder til nærmeste plateoppsett', () => {
    expect(roundToLoadable(41, barKg, platesKg)).toBe(40);
    expect(roundToLoadable(61.5, barKg, platesKg)).toBe(62.5);
    expect(roundToLoadable(10, barKg, platesKg)).toBe(20);
  });
  it('oppvarmingsforslag: stang × 10, 40 % × 5, 60 % × 3, 80 % × 2', () => {
    expect(warmupSuggestions(100, defaultSettings)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 40, reps: 5 },
      { weightKg: 60, reps: 3 },
      { weightKg: 80, reps: 2 },
    ]);
  });
  it('hopper over trinn som ikke er tyngre enn det forrige', () => {
    expect(warmupSuggestions(40, defaultSettings)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 25, reps: 3 },
      { weightKg: 32.5, reps: 2 },
    ]);
  });
});

describe('forrige gang', () => {
  it('skiller oppvarming fra arbeidssett og velger siste ferdige økt', () => {
    const old = workout([we('ex-handstand-hold', [set({ durationSec: 20 })])], {
      startedAt: '2026-11-01T10:00:00.000Z',
    });
    const warm = set({ kind: 'warmup', durationSec: 15 });
    const w1 = set({ durationSec: 40 });
    const w2 = set({ durationSec: 35 });
    const latest = workout(
      [we('ex-handstand-hold', [warm]), we('ex-handstand-hold', [w1, w2, set({ done: false })])],
      { startedAt: '2026-11-10T10:00:00.000Z' },
    );
    const active = workout([we('ex-handstand-hold', [set({ durationSec: 99 })])], {
      startedAt: '2026-11-14T10:00:00.000Z',
      endedAt: undefined,
    });
    const prev = findPreviousSets([old, latest, active], 'ex-handstand-hold', active.id);
    expect(prev?.workoutId).toBe(latest.id);
    expect(prev?.get('warmup', undefined, 0)?.durationSec).toBe(15);
    expect(prev?.get('working', undefined, 0)?.durationSec).toBe(40);
    expect(prev?.get('working', undefined, 1)?.durationSec).toBe(35);
    expect(prev?.get('working', undefined, 2)).toBeUndefined();
  });

  it('holder sidene fra hverandre', () => {
    const w = workout([
      we('ex-pistol-squat', [
        set({ side: 'left', reps: 5 }),
        set({ side: 'right', reps: 4 }),
        set({ side: 'left', reps: 3 }),
        set({ side: 'right', reps: 2 }),
      ]),
    ]);
    const prev = findPreviousSets([w], 'ex-pistol-squat');
    expect(prev?.get('working', 'right', 1)?.reps).toBe(2);
    expect(indexWithinKind(w.exercises[0]!.sets, w.exercises[0]!.sets[3]!.id)).toBe(1);
  });

  it('gir undefined uten tidligere økt', () => {
    expect(findPreviousSets([], 'ex-pull-up')).toBeUndefined();
  });
});

describe('startbibliotek', () => {
  const exercises = seedExercises();
  it('har unike ID-er og P1–P5 på level-øvelser', () => {
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
    for (const e of exercises.filter((x) => x.type === 'level')) {
      expect(e.levels?.length).toBeGreaterThanOrEqual(5);
      expect(e.levelMetric).toBeDefined();
    }
    const fl = exercises.find((e) => e.id === 'ex-front-lever');
    expect(fl?.levels?.map((l) => l.description)).toEqual(['tuck', 'advanced tuck', 'one leg', 'straddle', 'full']);
  });
  it('rutinene A, B og C starter med felles oppvarming', () => {
    const routines = seedRoutines(exercises);
    expect(routines.map((r) => r.name)).toEqual(['Økt A', 'Økt B', 'Økt C']);
    expect(routines.map((r) => r.exercises.length)).toEqual([14, 11, 12]);
    for (const r of routines) {
      const warm = r.exercises.slice(0, 5);
      expect(warm.every((x) => x.plannedSets.every((s) => s.kind === 'warmup'))).toBe(true);
    }
    const pistol = routines[0]!.exercises.find((x) => x.exerciseId === 'ex-pistol-squat');
    expect(pistol?.plannedSets.map((s) => s.side)).toEqual(['left', 'right', 'left', 'right', 'left', 'right']);
  });
});

describe('formatering', () => {
  it('sett', () => {
    const pull = lib.get('ex-pull-up')!;
    const fl = lib.get('ex-front-lever')!;
    expect(formatSet(lib.get('ex-back-squat')!, set({ weightKg: 62.5, reps: 5 }))).toBe('62,5×5');
    expect(formatSet(pull, set({ reps: 8 }))).toBe('BW×8');
    expect(formatSet(pull, set({ weightKg: 10, reps: 5 }))).toBe('BW+10×5');
    expect(formatSet({ ...pull, type: 'assisted' }, set({ assistanceKg: 20, reps: 6 }))).toBe('BW−20×6');
    expect(formatSet(fl, set({ levelId: fl.levels![0]!.id, durationSec: 12 }))).toBe('P1 12s');
  });
  it('tall og klokke', () => {
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
    expect(formatClock(125)).toBe('2:05');
  });
});
