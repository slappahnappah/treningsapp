import { addDays, dateKey } from './dates';
import { countWorkingSets } from './formulas';
import type { Exercise, Muscle, Workout } from './model';

// Volum per muskelgruppe per uke (byggebriefen, kapittel 10).

export const MUSCLES: Muscle[] = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Bryst',
  front_delts: 'Fremre skulder',
  side_delts: 'Ytre skulder',
  rear_delts: 'Bakre skulder',
  lats: 'Lats',
  upper_back: 'Øvre rygg',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Underarmer',
  core: 'Mage og kjerne',
  glutes: 'Sete',
  quads: 'Forside lår',
  hamstrings: 'Bakside lår',
  calves: 'Legger',
};

type Pair = { direct: Muscle[]; indirect: Muscle[] };
const m = (direct: Muscle[], indirect: Muscle[] = []): Pair => ({ direct, indirect });

/** Muskler for øvelsene i startbiblioteket. Kan overstyres per øvelse. */
const SEED_MUSCLES: Record<string, Pair> = {
  'pull-up': m(['lats', 'biceps'], ['upper_back', 'forearms']),
  'chest-to-bar-pull-up': m(['lats', 'upper_back'], ['biceps', 'forearms']),
  'one-arm-pull-up': m(['lats', 'biceps'], ['forearms', 'core']),
  dips: m(['chest', 'triceps'], ['front_delts']),
  'handstand-push-up': m(['front_delts', 'triceps'], ['side_delts', 'upper_back']),
  'handstand-push-up-back-to-wall': m(['front_delts', 'triceps'], ['side_delts', 'upper_back']),
  'handstand-push-up-chest-to-wall': m(['front_delts', 'triceps'], ['side_delts', 'upper_back']),
  'handstand-hold': m(['front_delts'], ['core', 'forearms']),
  'headstand-pike': m(['core'], ['front_delts']),
  'pseudo-planche-push-up': m(['chest', 'front_delts'], ['triceps', 'core']),
  'one-arm-push-up': m(['chest', 'triceps'], ['front_delts', 'core']),
  'hanging-leg-raise': m(['core'], ['forearms']),
  'dragon-flag': m(['core'], ['lats']),
  'front-lever': m(['lats', 'core'], ['upper_back', 'rear_delts']),
  'pistol-squat': m(['quads', 'glutes'], ['hamstrings', 'core']),
  'sissy-squat': m(['quads']),
  'single-leg-hamstring-curl': m(['hamstrings'], ['calves']),
  'nordic-hamstring-curl': m(['hamstrings'], ['glutes']),
  'back-squat': m(['quads', 'glutes'], ['hamstrings', 'core']),
  deadlift: m(['hamstrings', 'glutes'], ['upper_back', 'lats', 'forearms', 'quads']),
  'front-squat': m(['quads'], ['glutes', 'core', 'upper_back']),
  'romanian-deadlift': m(['hamstrings', 'glutes'], ['forearms', 'upper_back']),
  'bench-press': m(['chest'], ['triceps', 'front_delts']),
  'incline-bench-press': m(['chest', 'front_delts'], ['triceps']),
  'overhead-press': m(['front_delts'], ['triceps', 'side_delts']),
  'barbell-row': m(['lats', 'upper_back'], ['biceps', 'rear_delts', 'forearms']),
  'lat-pulldown': m(['lats'], ['biceps', 'upper_back']),
  'hip-thrust': m(['glutes'], ['hamstrings']),
  lunge: m(['quads', 'glutes'], ['hamstrings']),
  'bulgarian-split-squat': m(['quads', 'glutes'], ['hamstrings']),
  'leg-curl': m(['hamstrings']),
  'leg-extension': m(['quads']),
  'biceps-curl': m(['biceps'], ['forearms']),
  'triceps-pushdown': m(['triceps']),
  'lateral-raise': m(['side_delts']),
  'face-pull': m(['rear_delts', 'upper_back']),
  'calf-raise': m(['calves']),
  'chin-up': m(['lats', 'biceps'], ['forearms']),
  'explosive-pull-up': m(['lats', 'biceps'], ['upper_back']),
  'muscle-up': m(['lats', 'chest', 'triceps'], ['biceps']),
  'ring-dips': m(['chest', 'triceps'], ['front_delts']),
  'push-up': m(['chest', 'triceps'], ['front_delts', 'core']),
  'front-lever-raise': m(['lats', 'core'], ['upper_back']),
  'planche-hold': m(['front_delts', 'chest'], ['core', 'biceps']),
  'planche-push-up': m(['chest', 'front_delts'], ['triceps', 'core']),
  'l-sit': m(['core'], ['quads', 'triceps']),
};

/** Musklene en øvelse trener: egne valg først, ellers standard fra startbiblioteket. */
export function musclesFor(exercise: Pick<Exercise, 'id' | 'muscles'>): Pair {
  if (exercise.muscles) return exercise.muscles;
  return SEED_MUSCLES[exercise.id.replace(/^ex-/, '')] ?? { direct: [], indirect: [] };
}

export interface MuscleVolume {
  muscle: Muscle;
  direct: number; // arbeidssett der muskelen er hovedmuskel
  indirect: number; // arbeidssett der muskelen hjelper til
  /** Direkte sett teller fullt, indirekte sett teller halvt. */
  total: number;
}

/**
 * Arbeidssett per muskelgruppe i uka som starter `weekStart` (mandag, YYYY-MM-DD).
 * Oppvarming teller ikke, og venstre og høyre side teller som ett sett.
 */
export function weeklyMuscleVolume(exercises: Exercise[], workouts: Workout[], weekStart: string): MuscleVolume[] {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const end = addDays(weekStart, 7);
  const out = new Map<Muscle, MuscleVolume>(MUSCLES.map((x) => [x, { muscle: x, direct: 0, indirect: 0, total: 0 }]));
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const day = dateKey(w.startedAt);
    if (day < weekStart || day >= end) continue;
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const sets = countWorkingSets(we.sets);
      if (sets === 0) continue;
      const { direct, indirect } = musclesFor(ex);
      for (const x of direct) out.get(x)!.direct += sets;
      for (const x of indirect) if (!direct.includes(x)) out.get(x)!.indirect += sets;
    }
  }
  return MUSCLES.map((x) => {
    const v = out.get(x)!;
    return { ...v, total: v.direct + v.indirect / 2 };
  });
}
