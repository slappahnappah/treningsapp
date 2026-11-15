import { describe, expect, it } from 'vitest';
import { MUSCLES, musclesFor, seedExercises, weeklyMuscleVolume, type SetEntry, type Workout } from '../src';

const lib = seedExercises();
let n = 0;
const set = (p: Partial<SetEntry> = {}): SetEntry => ({ id: `s${++n}`, kind: 'working', done: true, reps: 5, ...p });
const workout = (date: string, parts: [string, SetEntry[]][], ended = true): Workout => ({
  id: `w${++n}`,
  startedAt: `${date}T10:00:00`,
  ...(ended ? { endedAt: `${date}T11:00:00` } : {}),
  isDeload: false,
  exercises: parts.map(([id, sets], i) => ({ id: `we${++n}`, exerciseId: id, order: i, sets })),
});

describe('muskler', () => {
  it('alle øvelser i startbiblioteket har minst én hovedmuskel', () => {
    for (const ex of lib) expect(musclesFor(ex).direct.length, ex.name).toBeGreaterThan(0);
  });
  it('egne valg overstyrer standarden, og ukjente øvelser har ingen muskler', () => {
    expect(musclesFor({ id: 'ex-pull-up', muscles: { direct: ['calves'], indirect: [] } }).direct).toEqual(['calves']);
    expect(musclesFor({ id: 'egen' })).toEqual({ direct: [], indirect: [] });
  });
});

describe('volum per muskelgruppe', () => {
  const get = (list: ReturnType<typeof weeklyMuscleVolume>, id: string) => list.find((v) => v.muscle === id)!;

  it('teller arbeidssett i uka, direkte fullt og indirekte halvt', () => {
    const ws = [
      workout('2026-11-09', [['ex-bench-press', [set({ kind: 'warmup' }), set(), set(), set()]]]), // mandag
      workout('2026-11-15', [['ex-dips', [set(), set({ done: false })]]]), // søndag
      workout('2026-11-16', [['ex-bench-press', [set()]]]), // neste uke
      workout('2026-11-10', [['ex-bench-press', [set()]]], false), // ikke fullført
    ];
    const v = weeklyMuscleVolume(lib, ws, '2026-11-09');
    expect(v).toHaveLength(MUSCLES.length);
    expect(get(v, 'chest')).toMatchObject({ direct: 4, indirect: 0, total: 4 });
    expect(get(v, 'triceps')).toMatchObject({ direct: 1, indirect: 3, total: 2.5 });
    expect(get(v, 'front_delts')).toMatchObject({ direct: 0, indirect: 4, total: 2 });
    expect(get(v, 'quads').total).toBe(0);
  });
  it('venstre og høyre side teller som ett sett', () => {
    const sets = [set({ side: 'left' }), set({ side: 'right' }), set({ side: 'left' }), set({ side: 'right' })];
    const v = weeklyMuscleVolume(lib, [workout('2026-11-10', [['ex-pistol-squat', sets]])], '2026-11-09');
    expect(get(v, 'quads').direct).toBe(2);
  });
});
