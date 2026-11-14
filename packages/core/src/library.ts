import { defaultLevels } from './defaults';
import type { Equipment, Exercise, ExerciseType, PlannedSet, Routine, RoutineExercise } from './model';

// Startbiblioteket og startrutinene fra byggebriefen, kapittel 7.
// Frøene har faste ID-er, slik at rutinene kan peke på dem.

interface Seed {
  id: string;
  name: string;
  nameEn: string;
  type: ExerciseType;
  metric?: 'seconds' | 'reps';
  equipment?: Equipment;
  unilateral?: boolean;
  perHand?: boolean;
  main?: boolean;
  rest?: number;
  levels?: string[];
}

const lv = (id: string, name: string, nameEn: string, extra: Partial<Seed> = {}): Seed => ({
  id,
  name,
  nameEn,
  type: 'level',
  metric: 'reps',
  equipment: 'bodyweight',
  ...extra,
});
const bw = (id: string, name: string, nameEn: string, extra: Partial<Seed> = {}): Seed => ({
  id,
  name,
  nameEn,
  type: 'bodyweight',
  equipment: 'bodyweight',
  ...extra,
});
const wr = (
  id: string,
  name: string,
  nameEn: string,
  equipment: Equipment,
  extra: Partial<Seed> = {},
): Seed => ({ id, name, nameEn, type: 'weight_reps', equipment, ...extra });

const seeds: Seed[] = [
  // Øvelser i programmet
  bw('pull-up', 'Pull-up', 'Pull-up', { main: true, rest: 180 }),
  bw('chest-to-bar-pull-up', 'Chest-to-bar pull-up', 'Chest-to-Bar Pull-up'),
  lv('one-arm-pull-up', 'One arm pull-up', 'One Arm Pull-up', {
    unilateral: true,
    rest: 180,
    levels: ['assistert med strikk', 'assistert med hånd', 'negativ', 'full'],
  }),
  bw('dips', 'Dips', 'Dip', { main: true, rest: 180 }),
  lv('handstand-push-up', 'Handstand push-up', 'Handstand Push-up', { main: true, rest: 180 }),
  lv('handstand-push-up-back-to-wall', 'Handstand push-up, back to wall', 'Handstand Push-up (Back to Wall)', {
    main: true,
    rest: 180,
  }),
  lv('handstand-push-up-chest-to-wall', 'Handstand push-up, chest to wall', 'Handstand Push-up (Chest to Wall)', {
    main: true,
    rest: 180,
  }),
  lv('handstand-hold', 'Handstand hold', 'Handstand Hold', { metric: 'seconds', rest: 90 }),
  lv('headstand-pike', 'Headstand pike', 'Headstand Pike'),
  lv('pseudo-planche-push-up', 'Pseudo planche push-up', 'Pseudo Planche Push-up'),
  lv('one-arm-push-up', 'One arm push-up', 'One Arm Push-up', { unilateral: true }),
  lv('hanging-leg-raise', 'Hanging leg raise', 'Hanging Leg Raise', { rest: 90 }),
  lv('dragon-flag', 'Dragon flag', 'Dragon Flag'),
  lv('front-lever', 'Front lever (hold)', 'Front Lever', {
    metric: 'seconds',
    levels: ['tuck', 'advanced tuck', 'one leg', 'straddle', 'full'],
  }),
  lv('pistol-squat', 'Pistol squat', 'Pistol Squat', { unilateral: true }),
  lv('sissy-squat', 'Sissy squat', 'Sissy Squat'),
  lv('single-leg-hamstring-curl', 'Enbeins hamstring curl, liggende', 'Single Leg Hamstring Curl (Lying)', {
    unilateral: true,
    rest: 90,
  }),
  lv('nordic-hamstring-curl', 'Nordic hamstring curl', 'Nordic Hamstring Curl', {
    levels: ['bare ned (negativ)', 'ned og opp'],
  }),
  wr('back-squat', 'Knebøy (stang)', 'Back Squat', 'barbell', { main: true, rest: 180 }),
  wr('deadlift', 'Markløft', 'Deadlift', 'barbell', { main: true, rest: 180 }),

  // Resten av startbiblioteket – styrke
  wr('front-squat', 'Frontknebøy', 'Front Squat', 'barbell', { rest: 180 }),
  wr('romanian-deadlift', 'Rumensk markløft', 'Romanian Deadlift', 'barbell', { rest: 150 }),
  wr('bench-press', 'Benkpress', 'Bench Press', 'barbell', { rest: 180 }),
  wr('incline-bench-press', 'Skråbenk', 'Incline Bench Press', 'barbell', { rest: 150 }),
  wr('overhead-press', 'Skulderpress', 'Overhead Press', 'barbell', { rest: 150 }),
  wr('barbell-row', 'Roing', 'Barbell Row', 'barbell'),
  wr('lat-pulldown', 'Nedtrekk', 'Lat Pulldown', 'cable'),
  wr('hip-thrust', 'Hip thrust', 'Hip Thrust', 'barbell'),
  wr('lunge', 'Utfall', 'Lunge', 'dumbbell', { perHand: true }),
  wr('bulgarian-split-squat', 'Bulgarsk splittknebøy', 'Bulgarian Split Squat', 'dumbbell', { perHand: true }),
  wr('leg-curl', 'Leg curl', 'Leg Curl', 'machine', { rest: 90 }),
  wr('leg-extension', 'Leg extension', 'Leg Extension', 'machine', { rest: 90 }),
  wr('biceps-curl', 'Biceps curl', 'Biceps Curl', 'dumbbell', { perHand: true, rest: 90 }),
  wr('triceps-pushdown', 'Triceps pushdown', 'Triceps Pushdown', 'cable', { rest: 90 }),
  wr('lateral-raise', 'Sidehev', 'Lateral Raise', 'dumbbell', { perHand: true, rest: 90 }),
  wr('face-pull', 'Face pull', 'Face Pull', 'cable', { rest: 90 }),
  wr('calf-raise', 'Tåhev', 'Calf Raise', 'machine', { rest: 90 }),

  // Resten av startbiblioteket – calisthenics
  bw('chin-up', 'Chin-up', 'Chin-up'),
  lv('explosive-pull-up', 'Eksplosiv pull-up', 'Explosive Pull-up'),
  lv('muscle-up', 'Muscle-up', 'Muscle-up', { rest: 180 }),
  bw('ring-dips', 'Ringdips', 'Ring Dip', { equipment: 'rings' }),
  lv('push-up', 'Push-up', 'Push-up', { rest: 90 }),
  lv('front-lever-raise', 'Front lever raise', 'Front Lever Raise'),
  lv('planche-hold', 'Planche hold', 'Planche', { metric: 'seconds' }),
  lv('planche-push-up', 'Planche push-up', 'Planche Push-up'),
  lv('l-sit', 'L-sit', 'L-sit', { metric: 'seconds', rest: 90 }),
];

function fromSeed(s: Seed): Exercise {
  const id = `ex-${s.id}`;
  const ex: Exercise = {
    id,
    name: s.name,
    nameEn: s.nameEn,
    type: s.type,
    equipment: s.equipment ?? 'other',
    perHand: s.perHand ?? false,
    unilateral: s.unilateral ?? false,
    defaultRestSec: s.rest ?? 120,
    isMainLift: s.main ?? false,
    externalNames: {},
    isCustom: false,
    archived: false,
  };
  if (s.type === 'level') {
    ex.levelMetric = s.metric ?? 'reps';
    ex.levels = defaultLevels(id, s.levels);
  }
  return ex;
}

export function seedExercises(): Exercise[] {
  return seeds.map(fromSeed);
}

// --- Startrutiner ---

const WARMUP = ['pull-up', 'dips', 'handstand-push-up', 'handstand-hold', 'hanging-leg-raise'];

const PROGRAM: { id: string; name: string; exercises: string[] }[] = [
  {
    id: 'routine-a',
    name: 'Økt A',
    exercises: [
      'handstand-hold',
      'pistol-squat',
      'sissy-squat',
      'one-arm-pull-up',
      'single-leg-hamstring-curl',
      'handstand-push-up-chest-to-wall',
      'headstand-pike',
      'pseudo-planche-push-up',
      'hanging-leg-raise',
    ],
  },
  {
    id: 'routine-b',
    name: 'Økt B',
    exercises: [
      'back-squat',
      'chest-to-bar-pull-up',
      'handstand-push-up-back-to-wall',
      'dragon-flag',
      'nordic-hamstring-curl',
      'one-arm-push-up',
    ],
  },
  {
    id: 'routine-c',
    name: 'Økt C',
    exercises: [
      'pull-up',
      'handstand-push-up',
      'pistol-squat',
      'sissy-squat',
      'front-lever',
      'deadlift',
      'dips',
    ],
  },
];

/** Planlagte sett for en øvelse. Unilaterale øvelser får én rad per side. */
export function plannedSetsFor(exercise: Exercise, kind: PlannedSet['kind'], count: number): PlannedSet[] {
  const out: PlannedSet[] = [];
  const levelId = exercise.type === 'level' ? exercise.levels?.[0]?.id : undefined;
  for (let i = 0; i < count; i++) {
    const base: PlannedSet = { kind };
    if (levelId) base.levelId = levelId;
    if (exercise.unilateral) {
      out.push({ ...base, side: 'left' }, { ...base, side: 'right' });
    } else {
      out.push(base);
    }
  }
  return out;
}

/** Rutinene A, B og C. Hver starter med felles oppvarming (ett oppvarmingssett per øvelse). */
export function seedRoutines(exercises: Exercise[] = seedExercises()): Routine[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const get = (slug: string): Exercise => {
    const ex = byId.get(`ex-${slug}`);
    if (!ex) throw new Error(`Mangler øvelse i startbiblioteket: ${slug}`);
    return ex;
  };
  return PROGRAM.map((p) => {
    const list: RoutineExercise[] = [];
    for (const slug of WARMUP) {
      const ex = get(slug);
      list.push({ exerciseId: ex.id, order: list.length, plannedSets: plannedSetsFor(ex, 'warmup', 1) });
    }
    for (const slug of p.exercises) {
      const ex = get(slug);
      list.push({ exerciseId: ex.id, order: list.length, plannedSets: plannedSetsFor(ex, 'working', 3) });
    }
    return { id: p.id, name: p.name, exercises: list };
  });
}
