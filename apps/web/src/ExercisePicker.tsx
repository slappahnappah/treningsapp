import { useMemo, useState } from 'react';
import type { Exercise } from '@stige/core';
import { useData } from './data';
import { ExerciseEditor, newExercise } from './ExerciseEditor';
import { Overlay } from './ui';

import { typeLabel } from './labels';

export { TYPE_LABEL, typeLabel } from './labels';

export function useExerciseSearch(query: string): Exercise[] {
  const { exercises } = useData();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) => !e.archived && (q === '' || e.name.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q)),
    );
  }, [exercises, query]);
}

interface PickerProps {
  onPick: (e: Exercise) => void;
  onClose: () => void;
  title?: string;
}

export function ExercisePicker({ onPick, onClose, title = 'Legg til øvelse' }: PickerProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<Exercise | null>(null);
  const list = useExerciseSearch(query);
  const typed = query.trim();
  return (
    <Overlay label="Velg øvelse">
      <header className="overlay-head">
        <h2>{title}</h2>
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
      <button className="btn btn-wide" onClick={() => setCreating({ ...newExercise(), name: typed })}>
        {typed ? `+ Lag ny øvelse «${typed}»` : '+ Lag ny øvelse'}
      </button>
      {creating && (
        <ExerciseEditor exercise={creating} isNew onClose={() => setCreating(null)} onSaved={(e) => onPick(e)} />
      )}
    </Overlay>
  );
}
