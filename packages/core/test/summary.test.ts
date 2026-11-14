import { describe, expect, it } from 'vitest';
import { buildSummary, externalName, seedExercises, type Exercise, type SetEntry, type Workout, type WorkoutExercise } from '../src';

let n = 0;
const set = (p: Partial<SetEntry> = {}): SetEntry => ({ id: `s${++n}`, kind: 'working', done: true, ...p });
const we = (exerciseId: string, sets: SetEntry[]): WorkoutExercise => ({ id: `we${++n}`, exerciseId, order: n, sets });
const lib = new Map<string, Exercise>(seedExercises().map((e) => [e.id, e]));
lib.set('ex-db-bench', {
  ...(lib.get('ex-bench-press') as Exercise),
  id: 'ex-db-bench',
  nameEn: 'Dumbbell Bench Press',
  equipment: 'dumbbell',
  perHand: true,
});
const get = (id: string) => lib.get(id);
const opts = { timeZone: 'Europe/Oslo' };
const base = { id: 'w', startedAt: '2026-11-14T13:52:00.000Z', endedAt: '2026-11-14T14:17:00.000Z', isDeload: false };

describe('øktsammendrag', () => {
  it('gir eksempelet i kapittel 6', () => {
    const w: Workout = {
      ...base,
      exercises: [
        we('ex-back-squat', [
          set({ kind: 'warmup', weightKg: 60, reps: 5 }),
          set({ weightKg: 100, reps: 5 }),
          set({ weightKg: 100, reps: 5 }),
          set({ weightKg: 100, reps: 5 }),
        ]),
        we('ex-romanian-deadlift', [set({ weightKg: 80, reps: 8 }), set({ weightKg: 80, reps: 8 }), set({ weightKg: 80, reps: 8 })]),
        we('ex-db-bench', [set({ weightKg: 30, reps: 10 }), set({ weightKg: 30, reps: 10 }), set({ weightKg: 30, reps: 9 })]),
        we('ex-pull-up', [set({ reps: 8 }), set({ reps: 7 }), set({ reps: 6 })]),
      ],
    };
    expect(buildSummary(w, get, opts)).toBe(
      [
        'Strength workout – 14 Nov 2026, 14:52–15:17 (25 min)',
        '',
        'Back Squat: warm-up 60×5; 100×5, 100×5, 100×5',
        'Romanian Deadlift: 80×8, 80×8, 80×8',
        'Dumbbell Bench Press (per hand): 30×10, 30×10, 30×9',
        'Pull-up: BW×8, BW×7, BW×6',
        '',
        'Working sets: 12 · Volume: 5 160 kg (weighted sets only)',
      ].join('\n'),
    );
  });

  it('hold, nivå, unilateralt, ekstravekt og assistert', () => {
    const fl = lib.get('ex-front-lever')!;
    const pistol = lib.get('ex-pistol-squat')!;
    const hspu = lib.get('ex-handstand-push-up')!;
    const assisted: Exercise = { ...lib.get('ex-pull-up')!, id: 'ex-assisted', type: 'assisted' };
    lib.set(assisted.id, assisted);
    const p = pistol.levels!;
    const w: Workout = {
      ...base,
      isDeload: true,
      exercises: [
        we(hspu.id, [set({ kind: 'warmup', levelId: hspu.levels![0]!.id, reps: 5 })]),
        we(fl.id, [12, 10, 9].map((d) => set({ levelId: fl.levels![0]!.id, durationSec: d }))),
        we(pistol.id, [
          set({ levelId: p[1]!.id, side: 'left', reps: 5 }),
          set({ levelId: p[1]!.id, side: 'right', reps: 5 }),
          set({ levelId: p[1]!.id, side: 'left', reps: 5 }),
          set({ levelId: p[1]!.id, side: 'right', reps: 4 }),
        ]),
        we(hspu.id, [set({ levelId: hspu.levels![2]!.id, reps: 4 }), set({ levelId: hspu.levels![2]!.id, reps: 3, kind: 'failure' })]),
        we('ex-pull-up', [set({ weightKg: 10, reps: 5 })]),
        we(assisted.id, [set({ assistanceKg: 20, reps: 6 })]),
        we('ex-dips', [set({ reps: 5, done: false })]),
      ],
    };
    const lines = buildSummary(w, get, opts).split('\n');
    expect(lines[0]).toBe('Strength workout (deload) – 14 Nov 2026, 14:52–15:17 (25 min)');
    expect(lines.slice(2, 7)).toEqual([
      'Handstand Push-up: warm-up P1 5; P3 4, P3 3 (failure)',
      'Front Lever (P1): 12s, 10s, 9s',
      'Pistol Squat (P2) (L/R): 5/5, 5/4',
      'Pull-up: BW+10×5',
      'Pull-up (assisted): BW−20×6',
    ]);
    expect(lines.at(-1)).toBe('Working sets: 9');
  });

  it('bruker navnet for valgt app, ellers det engelske', () => {
    const squat: Exercise = { ...lib.get('ex-back-squat')!, externalNames: { whoop: 'Squat - Barbell' } };
    expect(externalName(squat, 'whoop')).toBe('Squat - Barbell');
    expect(externalName(squat, 'bevel')).toBe('Back Squat');
    expect(externalName(squat)).toBe('Back Squat');
  });
});
