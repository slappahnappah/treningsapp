import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKey,
  defaultSettings,
  isoWeek,
  makeBackup,
  monthGrid,
  parseBackup,
  seedExercises,
  seedRoutines,
  weekStartKey,
  workoutsToCsv,
  type Workout,
} from '../src';

const exercises = seedExercises();
const workout: Workout = {
  id: 'w1',
  startedAt: '2026-11-14T13:52:00.000Z',
  endedAt: '2026-11-14T14:17:00.000Z',
  title: 'Økt; "B"',
  isDeload: false,
  exercises: [
    {
      id: 'we1',
      exerciseId: 'ex-back-squat',
      order: 0,
      sets: [
        { id: 's1', kind: 'warmup', weightKg: 62.5, reps: 5, done: true },
        { id: 's2', kind: 'working', weightKg: 100, reps: 5, rpe: 8.5, restBeforeSec: 180, done: true },
        { id: 's3', kind: 'working', weightKg: 100, reps: 5, done: false },
      ],
    },
  ],
};

describe('backup', () => {
  const backup = makeBackup({
    exercises,
    workouts: [workout],
    routines: seedRoutines(exercises),
    diary: [{ date: '2026-11-14', text: 'Bra økt' }],
    settings: defaultSettings,
    deloadWeeks: ['2026-11-09'],
  });
  it('kan leses inn igjen uten tap', () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });
  it('avviser filer som ikke er en backup', () => {
    expect(() => parseBackup('ikke json')).toThrow('ikke gyldig JSON');
    expect(() => parseBackup('{"app":"annen"}')).toThrow('ikke en backup');
    expect(() => parseBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow('nyere versjon');
    expect(() => parseBackup(JSON.stringify({ ...backup, workouts: [{ id: 1 }] }))).toThrow('workouts');
  });
});

describe('CSV', () => {
  it('én rad per fullført sett, med semikolon og desimalkomma', () => {
    const csv = workoutsToCsv([workout], (id) => exercises.find((e) => e.id === id));
    const rows = csv.trim().split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.split(';')).toHaveLength(17);
    expect(rows[1]).toBe(
      '2026-11-14;2026-11-14T13:52:00.000Z;2026-11-14T14:17:00.000Z;"Økt; ""B""";nei;Knebøy (stang);Back Squat;1;warmup;;;62,5;;5;;;',
    );
    expect(rows[2]?.endsWith(';2;working;;;100;;5;;8,5;180')).toBe(true);
  });
});

describe('datoer', () => {
  it('uka starter på mandag', () => {
    expect(weekStartKey('2026-11-14')).toBe('2026-11-09'); // lørdag
    expect(weekStartKey('2026-11-09')).toBe('2026-11-09');
    expect(weekStartKey('2026-11-15')).toBe('2026-11-09'); // søndag
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
  it('ISO-ukenummer', () => {
    expect(isoWeek('2026-11-14')).toBe(46);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-03')).toBe(53);
    expect(isoWeek('2024-12-30')).toBe(1);
  });
  it('månedsrutenett dekker hele måneden med hele uker', () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0]?.[0]).toBe('2026-10-26');
    expect(grid.at(-1)?.[6]).toBe('2026-12-06');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});
