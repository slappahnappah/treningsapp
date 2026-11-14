import { levelLabel } from './defaults';
import type { DiaryNote, Exercise, Routine, Settings, Workout } from './model';

export interface Backup {
  app: 'stige';
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  workouts: Workout[];
  routines: Routine[];
  diary: DiaryNote[];
  settings: Settings;
  deloadWeeks: string[];
}

export function makeBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>, now = new Date()): Backup {
  return { app: 'stige', version: 1, exportedAt: now.toISOString(), ...data };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasId = (key: string) => (v: unknown) => isObj(v) && typeof v[key] === 'string' && v[key] !== '';

/** Leser og kontrollerer en backupfil. Kaster en feil med norsk forklaring når fila ikke kan brukes. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Fila er ikke gyldig JSON.');
  }
  if (!isObj(raw) || raw.app !== 'stige') throw new Error('Fila er ikke en backup fra denne appen.');
  if (raw.version !== 1) throw new Error('Backupen er laget av en nyere versjon av appen.');

  const list = (key: string, check: (v: unknown) => boolean): unknown[] => {
    const v = raw[key];
    if (!Array.isArray(v) || !v.every(check)) throw new Error(`Backupen har ugyldig innhold i «${key}».`);
    return v;
  };
  const exercises = list('exercises', (v) => hasId('id')(v) && isObj(v) && typeof v.name === 'string') as Exercise[];
  const workouts = list(
    'workouts',
    (v) => hasId('id')(v) && isObj(v) && typeof v.startedAt === 'string' && Array.isArray(v.exercises),
  ) as Workout[];
  const routines = list('routines', (v) => hasId('id')(v) && isObj(v) && Array.isArray(v.exercises)) as Routine[];
  const diary = list('diary', hasId('date')) as DiaryNote[];
  if (!isObj(raw.settings)) throw new Error('Backupen mangler innstillinger.');
  const deloadWeeks = Array.isArray(raw.deloadWeeks) ? raw.deloadWeeks.filter((w): w is string => typeof w === 'string') : [];

  return {
    app: 'stige',
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    exercises,
    workouts,
    routines,
    diary,
    settings: raw.settings as unknown as Settings,
    deloadWeeks,
  };
}

const CSV_HEAD = [
  'dato',
  'start',
  'slutt',
  'økt',
  'lettuke',
  'øvelse',
  'øvelse_engelsk',
  'sett_nr',
  'settype',
  'side',
  'nivå',
  'kg',
  'assistanse_kg',
  'reps',
  'sekunder',
  'rpe',
  'pause_sek',
];

function csvCell(v: string | number | undefined): string {
  if (v === undefined) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Alle fullførte sett som CSV, én rad per sett. Semikolon som skilletegn og
 * desimalkomma, slik at fila åpnes riktig i norsk Excel og Numbers.
 */
export function workoutsToCsv(workouts: Workout[], getExercise: (id: string) => Exercise | undefined): string {
  const rows: string[] = [CSV_HEAD.join(';')];
  const sorted = [...workouts].filter((w) => w.endedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const w of sorted) {
    for (const we of [...w.exercises].sort((a, b) => a.order - b.order)) {
      const ex = getExercise(we.exerciseId);
      we.sets
        .filter((s) => s.done)
        .forEach((s, i) => {
          const level = ex?.levels?.find((l) => l.id === s.levelId);
          rows.push(
            [
              w.startedAt.slice(0, 10),
              w.startedAt,
              w.endedAt,
              w.title,
              w.isDeload ? 'ja' : 'nei',
              ex?.name ?? we.exerciseId,
              ex?.nameEn,
              i + 1,
              s.kind,
              s.side,
              level ? levelLabel(level) : undefined,
              s.weightKg,
              s.assistanceKg,
              s.reps,
              s.durationSec,
              s.rpe,
              s.restBeforeSec,
            ]
              .map(csvCell)
              .join(';'),
          );
        });
    }
  }
  return rows.join('\r\n') + '\r\n';
}
