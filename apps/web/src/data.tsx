import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  defaultSettings,
  type DiaryNote,
  type Exercise,
  type Routine,
  type Settings,
  type Workout,
} from '@stige/core';
import { db, getDeloadWeeks, getRestTimer, getSettings, type RestTimer } from './db';

export interface Data {
  exercises: Exercise[];
  exMap: Map<string, Exercise>;
  workouts: Workout[]; // nyeste først
  finished: Workout[];
  active: Workout | undefined;
  routines: Routine[];
  settings: Settings;
  rest: RestTimer | undefined;
  notes: Map<string, string>; // dagboknotater per dato
  deloadWeeks: Set<string>; // mandager i uker markert som lettuke
}

const Ctx = createContext<Data | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), []);
  const routines = useLiveQuery(() => db.routines.toArray(), []);
  const settings = useLiveQuery(() => getSettings(), []);
  const rest = useLiveQuery(async () => (await getRestTimer()) ?? null, []);
  const diary = useLiveQuery(() => db.diary.toArray(), []);
  const deloadWeeks = useLiveQuery(() => getDeloadWeeks(), []);

  const data = useMemo<Data | null>(() => {
    if (!exercises || !workouts || !routines || !settings || rest === undefined || !diary || !deloadWeeks) return null;
    return {
      exercises: [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
      exMap: new Map(exercises.map((e) => [e.id, e])),
      workouts,
      finished: workouts.filter((w) => w.endedAt),
      active: workouts.find((w) => !w.endedAt),
      routines: [...routines].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
      settings: settings ?? defaultSettings,
      rest: rest ?? undefined,
      notes: new Map(diary.map((d: DiaryNote) => [d.date, d.text])),
      deloadWeeks: new Set(deloadWeeks),
    };
  }, [exercises, workouts, routines, settings, rest, diary, deloadWeeks]);

  if (!data) return <div className="loading">Laster …</div>;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData må brukes inne i DataProvider');
  return d;
}
