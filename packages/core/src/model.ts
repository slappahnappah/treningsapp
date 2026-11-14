// Datamodellen fra byggebriefen, kapittel 4.
// Alle ID-er er strenger. Alle tider lagres som ISO 8601.

export type ExerciseType =
  | 'weight_reps' // vekt × reps (stang, manualer, maskin, kabel)
  | 'bodyweight' // reps, valgfri ekstravekt i kg
  | 'assisted' // reps, assistanse i kg (strikk/maskin)
  | 'time' // sekunder (hold)
  | 'level'; // progresjonsnivå + sekunder eller reps

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'rings'
  | 'other';

// Brukes først senere (volum per muskelgruppe).
export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'lats'
  | 'upper_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export interface Level {
  id: string;
  order: number; // 1, 2, 3 … – vises som P1, P2, P3 …
  description?: string;
}

export interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  type: ExerciseType;
  levelMetric?: 'seconds' | 'reps';
  equipment: Equipment;
  perHand: boolean;
  unilateral: boolean;
  levels?: Level[];
  defaultRestSec: number;
  isMainLift: boolean;
  externalNames: { whoop?: string; bevel?: string };
  muscles?: { direct: Muscle[]; indirect: Muscle[] };
  isCustom: boolean;
  archived: boolean;
}

export type SetKind = 'warmup' | 'working' | 'drop' | 'failure';
export type Side = 'left' | 'right';

export interface SetEntry {
  id: string;
  kind: SetKind;
  weightKg?: number;
  assistanceKg?: number;
  reps?: number;
  durationSec?: number;
  levelId?: string;
  side?: Side;
  rpe?: number; // 6, 6.5 … 10
  done: boolean;
  completedAt?: string;
  restBeforeSec?: number; // faktisk pause før settet
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  supersetGroup?: string;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  startedAt: string;
  endedAt?: string;
  routineId?: string;
  title?: string;
  isDeload: boolean;
  exercises: WorkoutExercise[];
}

export type PlannedSet = Omit<SetEntry, 'id' | 'done' | 'completedAt' | 'restBeforeSec'>;

export interface RoutineExercise {
  exerciseId: string;
  order: number;
  supersetGroup?: string;
  plannedSets: PlannedSet[];
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export interface DiaryNote {
  date: string; // YYYY-MM-DD
  text: string;
}

export interface ProgressionThresholds {
  restDiffSec: number;
  restDiffPct: number;
  rpeDiff: number;
  trendSessions: number;
  trendProgressPctPerWeek: number;
  trendPlateauPctPerWeek: number;
  trendPlateauWeeks: number;
  trendDeclinePctPerWeek: number;
  declineSessionsInRow: number;
  deloadDeclineSharePct: number;
  deloadWindowDays: number;
  deloadMainLiftSessions: number;
  deloadRpeSessions: number;
  deloadWeeksSinceLast: number;
  deloadSignalsNeeded: number;
}

export interface Settings {
  barKg: number;
  platesKg: number[];
  warmupScheme: { percent: number; reps: number }[];
  thresholds: ProgressionThresholds;
  holdClock: { volume: number; beepEverySec: number; countdownSec?: number };
}

export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;
