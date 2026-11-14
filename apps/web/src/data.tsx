import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultSettings, type Exercise, type Routine, type Settings, type Workout } from '@stige/core';
import { db, getRestTimer, getSettings, type RestTimer } from './db';

export interface Data {
  exercises: Exercise[];
  exMap: Map<string, Exercise>;
  workouts: Workout[]; // nyeste først
  finished: Workout[];
  active: Workout | undefined;
  routines: Routine[];
  settings: Settings;
  rest: RestTimer | undefined;
}

const Ctx = createContext<Data | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), []);
  const routines = useLiveQuery(() => db.routines.toArray(), []);
  const settings = useLiveQuery(() => getSettings(), []);
  const rest = useLiveQuery(async () => (await getRestTimer()) ?? null, []);

  const data = useMemo<Data | null>(() => {
    if (!exercises || !workouts || !routines || !settings || rest === undefined) return null;
    return {
      exercises: [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
      exMap: new Map(exercises.map((e) => [e.id, e])),
      workouts,
      finished: workouts.filter((w) => w.endedAt),
      active: workouts.find((w) => !w.endedAt),
      routines: [...routines].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
      settings: settings ?? defaultSettings,
      rest: rest ?? undefined,
    };
  }, [exercises, workouts, routines, settings, rest]);

  if (!data) return <div className="loading">Laster …</div>;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData må brukes inne i DataProvider');
  return d;
}
