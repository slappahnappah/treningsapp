import type { Level, ProgressionThresholds, Settings } from './model';

export const defaultThresholds: ProgressionThresholds = {
  restDiffSec: 15,
  restDiffPct: 15,
  rpeDiff: 1,
  trendSessions: 6,
  trendProgressPctPerWeek: 0.5,
  trendPlateauPctPerWeek: 0.5,
  trendPlateauWeeks: 3,
  trendDeclinePctPerWeek: 1,
  declineSessionsInRow: 2,
  deloadDeclineSharePct: 40,
  deloadWindowDays: 10,
  deloadMainLiftSessions: 3,
  deloadRpeSessions: 3,
  deloadWeeksSinceLast: 6,
  deloadSignalsNeeded: 2,
};

export const defaultSettings: Settings = {
  barKg: 20,
  platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  warmupScheme: [
    { percent: 40, reps: 5 },
    { percent: 60, reps: 3 },
    { percent: 80, reps: 2 },
  ],
  thresholds: defaultThresholds,
  holdClock: { volume: 0.8, beepEverySec: 10 },
};

/** Standard nivåstige for nye level-øvelser: P1–P5, med valgfrie beskrivelser. */
export function defaultLevels(exerciseId: string, descriptions: string[] = []): Level[] {
  const count = Math.max(5, descriptions.length);
  return Array.from({ length: count }, (_, i) => {
    const level: Level = { id: `${exerciseId}-p${i + 1}`, order: i + 1 };
    const d = descriptions[i];
    if (d) level.description = d;
    return level;
  });
}

export function levelLabel(level: Pick<Level, 'order'>): string {
  return `P${level.order}`;
}
