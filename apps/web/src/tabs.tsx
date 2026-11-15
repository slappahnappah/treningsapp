import { useState } from 'react';
import { formatClock, type Exercise, type Routine, type Workout } from '@stige/core';
import { startWorkout } from './actions';
import { useData } from './data';
import { WorkoutCard } from './Diary';
import { ExerciseDetail } from './ExerciseDetail';
import { DeloadBanner } from './Insights';
import { ExerciseEditor, newExercise } from './ExerciseEditor';
import { typeLabel, useExerciseSearch } from './ExercisePicker';
import { RoutineEditor, newRoutine } from './RoutineEditor';
import { SummaryOverlay } from './Summary';
import { WorkoutView } from './WorkoutView';

export function StartTab() {
  const { active, routines, finished } = useData();
  const [justFinished, setJustFinished] = useState<string | null>(null);
  const summary: Workout | undefined = justFinished ? finished.find((w) => w.id === justFinished) : undefined;

  if (active) return <WorkoutView workout={active} onFinished={setJustFinished} />;
  const last = finished[0];
  return (
    <div className="page">
      <h1>Start økt</h1>
      <DeloadBanner />
      <button className="btn btn-primary btn-big" onClick={() => void startWorkout()}>
        Start tom økt
      </button>
      <h2>Fra rutine</h2>
      <div className="grid-3">
        {routines.map((r) => (
          <button key={r.id} className="btn btn-tile" onClick={() => void startWorkout(r)}>
            <strong>{r.name}</strong>
            <span className="muted small">{r.exercises.length} øvelser</span>
          </button>
        ))}
      </div>
      {last && (
        <>
          <h2>Forrige økt</h2>
          <WorkoutCard workout={last} actions />
        </>
      )}
      {summary && <SummaryOverlay workout={summary} finished onClose={() => setJustFinished(null)} />}
    </div>
  );
}

export function RoutinesTab({ onStarted }: { onStarted: () => void }) {
  const { routines, exMap, active } = useData();
  const [editing, setEditing] = useState<{ routine: Routine; isNew: boolean } | null>(null);
  const start = async (r: Routine) => {
    await startWorkout(r);
    onStarted();
  };
  return (
    <div className="page">
      <header className="workout-head">
        <h1>Rutiner</h1>
        <button className="btn btn-primary" onClick={() => setEditing({ routine: newRoutine(), isNew: true })}>
          + Ny rutine
        </button>
      </header>
      {active && <p className="muted">En økt er i gang. Fullfør den før du starter en ny.</p>}
      {routines.map((r) => {
        const list = [...r.exercises].sort((a, b) => a.order - b.order);
        return (
          <section className="card" key={r.id}>
            <header className="card-head">
              <h2 className="card-title-static">{r.name}</h2>
              <div className="row-gap">
                <button className="btn" onClick={() => setEditing({ routine: r, isNew: false })}>
                  Rediger
                </button>
                <button className="btn btn-primary" disabled={!!active} onClick={() => void start(r)}>
                  Start
                </button>
              </div>
            </header>
            <ol className="plain-list">
              {list.map((re, i) => {
                const ex = exMap.get(re.exerciseId);
                const warm = re.plannedSets.every((s) => s.kind === 'warmup');
                const count = re.plannedSets.filter((s) => s.side !== 'right').length;
                const linked = !!re.supersetGroup && list[i + 1]?.supersetGroup === re.supersetGroup;
                return (
                  <li key={i} className={warm ? 'muted' : ''}>
                    {ex?.name ?? 'Ukjent øvelse'}
                    <span className="muted small">
                      {' '}
                      · {warm ? 'oppvarming' : `${count} sett`}
                      {linked ? ' · supersett med neste' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {routines.length === 0 && <p className="muted">Ingen rutiner ennå.</p>}
      {editing && <RoutineEditor routine={editing.routine} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function ExercisesTab() {
  const { exercises } = useData();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Exercise | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = useExerciseSearch(query);
  const archived = exercises.filter((e) => e.archived);
  return (
    <div className="page">
      <header className="workout-head">
        <h1>Øvelser</h1>
        <button className="btn btn-primary" onClick={() => setCreating(newExercise())}>
          + Ny øvelse
        </button>
      </header>
      <input
        className="search"
        type="search"
        placeholder="Søk i øvelser"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="list">
        {(showArchived ? archived : list).map((e) => (
          <li key={e.id}>
            <button className="list-item" onClick={() => setOpenId(e.id)}>
              <span>
                {e.name}
                {e.unilateral && <span className="muted small"> · per side</span>}
              </span>
              <span className="muted small">
                {typeLabel(e)} · {formatClock(e.defaultRestSec)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <button className="btn btn-wide btn-quiet" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Vis aktive øvelser' : `Vis arkiverte øvelser (${archived.length})`}
        </button>
      )}
      {openId && <ExerciseDetail exerciseId={openId} onClose={() => setOpenId(null)} />}
      {creating && <ExerciseEditor exercise={creating} isNew onClose={() => setCreating(null)} />}
    </div>
  );
}

