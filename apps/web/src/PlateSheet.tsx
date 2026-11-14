import { useState } from 'react';
import { formatNumber, platesPerSide, warmupSuggestions, type Exercise, type Workout, type WorkoutExercise } from '@stige/core';
import { addWarmupSets } from './actions';
import { useData } from './data';
import { NumberField, Sheet } from './ui';

interface Props {
  workout: Workout;
  we: WorkoutExercise;
  exercise: Exercise;
  initialKg: number | undefined;
  onClose: () => void;
}

/** Platekalkulator og oppvarmingsforslag for stangøvelser. */
export function PlateSheet({ workout, we, exercise, initialKg, onClose }: Props) {
  const { settings } = useData();
  const [target, setTarget] = useState<number | undefined>(initialKg);
  const load = target != null ? platesPerSide(target, settings.barKg, settings.platesKg) : undefined;
  const warmups = target != null && target > settings.barKg ? warmupSuggestions(target, settings) : [];

  return (
    <Sheet title={`Platekalkulator · ${exercise.name}`} onClose={onClose}>
      <div className="field">
        <span>Vekt på stanga (kg)</span>
        <div className="plate-input">
          <NumberField label="Målvekt i kg" decimal value={target} onChange={setTarget} />
        </div>
      </div>
      {load && target != null && (
        <>
          {target < settings.barKg ? (
            <p className="muted">Vekten er lavere enn stanga ({formatNumber(settings.barKg)} kg).</p>
          ) : (
            <>
              <p className="muted small">Per side, med stang på {formatNumber(settings.barKg)} kg:</p>
              <div className="plates">
                {load.perSide.length === 0 && <span className="muted">Bare stanga</span>}
                {load.perSide.map((p, i) => (
                  <span className="plate" key={i}>
                    {formatNumber(p)}
                  </span>
                ))}
              </div>
              {load.remainderKg > 0 && (
                <p className="muted small">
                  {formatNumber(target)} kg kan ikke lastes med platene dine. Nærmeste under er {formatNumber(load.totalKg)}{' '}
                  kg.
                </p>
              )}
            </>
          )}
        </>
      )}
      {warmups.length > 0 && (
        <>
          <h3>Oppvarmingsforslag</h3>
          <ul className="plain-list">
            {warmups.map((w, i) => (
              <li key={i}>
                {formatNumber(w.weightKg)} kg × {w.reps}
                <span className="muted small">
                  {' '}
                  · {platesPerSide(w.weightKg, settings.barKg, settings.platesKg).perSide.map(formatNumber).join(' + ') ||
                    'bare stanga'}
                </span>
              </li>
            ))}
          </ul>
          <button
            className="btn btn-wide"
            onClick={() => {
              void addWarmupSets(workout.id, we.id, warmups);
              onClose();
            }}
          >
            Legg til som oppvarmingssett
          </button>
        </>
      )}
      <button className="btn btn-wide" onClick={onClose}>
        Lukk
      </button>
    </Sheet>
  );
}
