import { describe, expect, it } from 'vitest';
import { seedExercises, weeklyStats, type Workout } from '../src';

const lib = new Map(seedExercises().map((e) => [e.id, e]));
const get = (id: string) => lib.get(id);
const workout = (date: string, kg: number, extra: Partial<Workout> = {}): Workout => ({
  id: `${date}-${kg}`,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T11:00:00.000Z`,
  isDeload: false,
  exercises: [
    {
      id: 'we',
      exerciseId: 'ex-back-squat',
      order: 0,
      sets: [
        { id: 'a', kind: 'warmup', done: true, weightKg: 40, reps: 10 },
        { id: 'b', kind: 'working', done: true, weightKg: kg, reps: 5 },
        { id: 'c', kind: 'working', done: true, weightKg: kg, reps: 5 },
      ],
    },
  ],
  ...extra,
});

describe('ukeoversikt', () => {
  const now = new Date('2026-11-15T12:00:00Z'); // søndag i uka som starter 9. november
  it('gir de siste ukene, eldste først, også tomme uker', () => {
    const stats = weeklyStats([workout('2026-11-10', 100), workout('2026-11-12', 100), workout('2026-10-27', 90)], get, { count: 4, now });
    expect(stats.map((s) => s.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(stats.map((s) => s.workouts)).toEqual([0, 1, 0, 2]);
    expect(stats[3]).toMatchObject({ workingSets: 4, volumeKg: 2000, minutes: 120, isDeload: false });
    expect(stats[1]).toMatchObject({ workingSets: 2, volumeKg: 900 });
  });
  it('økter som ikke er fullført og økter utenfor perioden telles ikke', () => {
    const open = workout('2026-11-11', 100);
    delete open.endedAt;
    const stats = weeklyStats([open, workout('2026-01-05', 100)], get, { count: 4, now });
    expect(stats.every((s) => s.workouts === 0)).toBe(true);
  });
  it('markerer lettuker', () => {
    const stats = weeklyStats([workout('2026-11-10', 60, { isDeload: true })], get, { count: 2, now, deloadWeeks: ['2026-11-02'] });
    expect(stats.map((s) => s.isDeload)).toEqual([true, true]);
  });
});
