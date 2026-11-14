import Dexie, { type EntityTable, type Table } from 'dexie';
import {
  defaultSettings,
  seedExercises,
  seedRoutines,
  type DiaryNote,
  type Exercise,
  type Routine,
  type Settings,
  type Workout,
} from '@stige/core';

export interface RestTimer {
  startedAt: number; // ms
  endsAt: number; // ms
  label: string;
}

interface KV {
  key: string;
  value: unknown;
}

class StigeDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  diary!: EntityTable<DiaryNote, 'date'>;
  kv!: Table<KV, string>;

  constructor() {
    super('stige');
    this.version(1).stores({
      exercises: 'id',
      workouts: 'id, startedAt',
      routines: 'id',
      diary: 'date',
      kv: 'key',
    });
    // Første oppstart: legg inn startbiblioteket og rutinene A, B og C.
    this.on('populate', (tx) => {
      const exercises = seedExercises();
      tx.table('exercises').bulkAdd(exercises);
      tx.table('routines').bulkAdd(seedRoutines(exercises));
      tx.table('kv').add({ key: 'settings', value: defaultSettings });
    });
  }
}

export const db = new StigeDB();

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...defaultSettings, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.kv.put({ key: 'settings', value: { ...current, ...patch } });
}

export async function getRestTimer(): Promise<RestTimer | undefined> {
  return (await db.kv.get('rest'))?.value as RestTimer | undefined;
}

export async function setRestTimer(timer: RestTimer | undefined): Promise<void> {
  if (timer) await db.kv.put({ key: 'rest', value: timer });
  else await db.kv.delete('rest');
}
