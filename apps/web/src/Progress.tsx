import { useMemo } from 'react';
import { exerciseHistory, progressFor, type ProgressResult, type ProgressStatus, type Workout } from '@stige/core';
import { useData } from './data';

const ARROW: Record<ProgressStatus, string> = { up: '↑', same: '→', down: '↓' };
const WORD: Record<ProgressStatus, string> = { up: 'Fremgang', same: 'Lik', down: 'Tilbakegang' };
const dateFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long' });

/** Pil per øvelse i en ferdig økt, sammenlignet med forrige like økt. */
export function useProgress(workout: Workout): Map<string, ProgressResult> {
  const { workouts, exMap, settings } = useData();
  return useMemo(() => {
    const out = new Map<string, ProgressResult>();
    if (!workout.endedAt) return out;
    for (const id of new Set(workout.exercises.map((we) => we.exerciseId))) {
      const ex = exMap.get(id);
      if (!ex) continue;
      const history = exerciseHistory(workouts, id);
      const current = history.find((s) => s.workoutId === workout.id);
      if (!current) continue;
      const result = progressFor(ex, current, history, settings.thresholds);
      if (result) out.set(id, result);
    }
    return out;
  }, [workout, workouts, exMap, settings.thresholds]);
}

export function ProgressArrow({ result }: { result: ProgressResult | undefined }) {
  if (!result) return null;
  return (
    <span className={`arrow arrow-${result.status}`} role="img" aria-label={WORD[result.status]}>
      {ARROW[result.status]}
    </span>
  );
}

/** Forklaringen bak hver pil: hva som er endret, og hvilken økt det er sammenlignet med. */
export function ProgressList({ workout }: { workout: Workout }) {
  const { exMap } = useData();
  const progress = useProgress(workout);
  if (progress.size === 0) {
    return <p className="muted small">Ingen tidligere like økter å sammenligne med ennå.</p>;
  }
  return (
    <ul className="plain-list">
      {[...progress].map(([id, r]) => (
        <li key={id}>
          <ProgressArrow result={r} /> <strong>{exMap.get(id)?.name}</strong>
          <span className="muted small">
            {' '}
            · {WORD[r.status]}. {r.reason}. Sammenlignet med {dateFormat.format(new Date(r.comparedTo.startedAt))}.
          </span>
        </li>
      ))}
    </ul>
  );
}
