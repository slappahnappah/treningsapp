import { useMemo, useState } from 'react';
import type { Exercise } from '@stige/core';
import { useData } from './data';
import { Overlay } from './ui';

export const TYPE_LABEL: Record<Exercise['type'], string> = {
  weight_reps: 'Vekt × reps',
  bodyweight: 'Kroppsvekt',
  assisted: 'Assistert',
  time: 'Tid',
  level: 'Nivå',
};

export function typeLabel(e: Exercise): string {
  if (e.type === 'level') return `Nivå · ${e.levelMetric === 'seconds' ? 'sekunder' : 'reps'}`;
  return TYPE_LABEL[e.type];
}

export function useExerciseSearch(query: string): Exercise[] {
  const { exercises } = useData();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) => !e.archived && (q === '' || e.name.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q)),
    );
  }, [exercises, query]);
}

export function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const list = useExerciseSearch(query);
  return (
    <Overlay label="Velg øvelse">
      <header className="overlay-head">
        <h2>Legg til øvelse</h2>
        <button className="btn" onClick={onClose}>
          Lukk
        </button>
      </header>
      <input
        className="search"
        type="search"
        placeholder="Søk i øvelser"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="list overlay-scroll">
        {list.map((e) => (
          <li key={e.id}>
            <button className="list-item" onClick={() => onPick(e)}>
              <span>{e.name}</span>
              <span className="muted small">{typeLabel(e)}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="muted pad">Ingen øvelser passer med søket.</li>}
      </ul>
    </Overlay>
  );
}
