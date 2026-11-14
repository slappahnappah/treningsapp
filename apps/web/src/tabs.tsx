import { useState } from 'react';
import {
  formatClock,
  formatNumber,
  formatSet,
  workoutVolume,
  workoutWorkingSets,
  type Routine,
  type Workout,
} from '@stige/core';
import { deleteWorkout, startWorkout } from './actions';
import { restDoneSignal, unlockAudio } from './audio';
import { useData } from './data';
import { saveSettings, setRestTimer } from './db';
import { typeLabel, useExerciseSearch } from './ExercisePicker';
import { HoldClock } from './HoldClock';
import { Sheet } from './ui';
import { WorkoutView } from './WorkoutView';

const dayFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function StartTab() {
  const { active, routines, finished } = useData();
  if (active) return <WorkoutView workout={active} />;
  const last = finished[0];
  return (
    <div className="page">
      <h1>Start økt</h1>
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
          <WorkoutCard workout={last} />
        </>
      )}
    </div>
  );
}

export function RoutinesTab({ onStarted }: { onStarted: () => void }) {
  const { routines, exMap, active } = useData();
  const start = async (r: Routine) => {
    await startWorkout(r);
    onStarted();
  };
  return (
    <div className="page">
      <h1>Rutiner</h1>
      {active && <p className="muted">En økt er i gang. Fullfør den før du starter en ny.</p>}
      {routines.map((r) => (
        <section className="card" key={r.id}>
          <header className="card-head">
            <h2 className="card-title-static">{r.name}</h2>
            <button className="btn btn-primary" disabled={!!active} onClick={() => void start(r)}>
              Start
            </button>
          </header>
          <ol className="plain-list">
            {[...r.exercises]
              .sort((a, b) => a.order - b.order)
              .map((re, i) => {
                const ex = exMap.get(re.exerciseId);
                const warm = re.plannedSets.every((s) => s.kind === 'warmup');
                const count = re.plannedSets.filter((s) => s.side !== 'right').length;
                return (
                  <li key={i} className={warm ? 'muted' : ''}>
                    {ex?.name ?? 'Ukjent øvelse'}
                    <span className="muted small"> · {warm ? 'oppvarming' : `${count} sett`}</span>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
      <p className="muted small">Redigering av rutiner og egne maler kommer i et senere trinn.</p>
    </div>
  );
}

function WorkoutCard({ workout, onDelete }: { workout: Workout; onDelete?: () => void }) {
  const { exMap } = useData();
  const start = new Date(workout.startedAt);
  const end = workout.endedAt ? new Date(workout.endedAt) : undefined;
  const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const volume = workoutVolume(workout, (id) => exMap.get(id));
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2 className="card-title-static">
            {workout.title ?? 'Økt'}
            {workout.isDeload && <span className="chip chip-on chip-small">Lettuke</span>}
          </h2>
          <div className="muted small">
            {capitalize(dayFormat.format(start))} · {timeFormat.format(start)}
            {end ? `–${timeFormat.format(end)} (${minutes} min)` : ''}
          </div>
        </div>
        {onDelete && (
          <button className="icon-btn" onClick={onDelete} aria-label="Slett økta">
            🗑
          </button>
        )}
      </header>
      <ul className="plain-list">
        {workout.exercises.map((we) => {
          const ex = exMap.get(we.exerciseId);
          if (!ex) return null;
          const sets = we.sets
            .filter((s) => s.done)
            .map((s) => {
              const side = s.side === 'left' ? 'V ' : s.side === 'right' ? 'H ' : '';
              return `${s.kind === 'warmup' ? 'oppv. ' : ''}${side}${formatSet(ex, s)}`;
            });
          return (
            <li key={we.id}>
              <strong>{ex.name}</strong>
              <span className="muted"> {sets.join(', ')}</span>
            </li>
          );
        })}
      </ul>
      <div className="muted small">
        {workoutWorkingSets(workout)} arbeidssett
        {volume > 0 ? ` · volum ${formatNumber(volume)} kg` : ''}
      </div>
    </section>
  );
}

export function DiaryTab() {
  const { finished } = useData();
  const [toDelete, setToDelete] = useState<Workout | null>(null);
  return (
    <div className="page">
      <h1>Dagbok</h1>
      {finished.length === 0 && <p className="muted">Ingen økter ennå. Ferdige økter vises her.</p>}
      {finished.map((w) => (
        <WorkoutCard key={w.id} workout={w} onDelete={() => setToDelete(w)} />
      ))}
      {finished.length > 0 && (
        <p className="muted small">Kalender, notater og redigering av ferdige økter kommer i et senere trinn.</p>
      )}
      {toDelete && (
        <Sheet title="Slette økta?" onClose={() => setToDelete(null)}>
          <p className="muted">Økta fjernes fra dagboka og historikken. Dette kan ikke angres.</p>
          <button
            className="btn btn-danger btn-wide"
            onClick={() => {
              void deleteWorkout(toDelete.id);
              setToDelete(null);
            }}
          >
            Slett økta
          </button>
          <button className="btn btn-wide" onClick={() => setToDelete(null)}>
            Avbryt
          </button>
        </Sheet>
      )}
    </div>
  );
}

export function ExercisesTab() {
  const [query, setQuery] = useState('');
  const list = useExerciseSearch(query);
  return (
    <div className="page">
      <h1>Øvelser</h1>
      <input
        className="search"
        type="search"
        placeholder="Søk i øvelser"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="list">
        {list.map((e) => (
          <li key={e.id} className="list-item list-static">
            <span>
              {e.name}
              {e.unilateral && <span className="muted small"> · per side</span>}
            </span>
            <span className="muted small">
              {typeLabel(e)} · {formatClock(e.defaultRestSec)}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">Øvelsesside med historikk, grafer og rekorder kommer i et senere trinn.</p>
    </div>
  );
}

export function SettingsTab() {
  const { settings, active } = useData();
  const [clock, setClock] = useState(false);
  const hold = settings.holdClock;
  const testRest = () => {
    unlockAudio();
    const now = Date.now();
    void setRestTimer({ startedAt: now, endsAt: now + 10_000, label: 'test' });
  };
  return (
    <div className="page">
      <h1>Innstillinger</h1>

      <section className="card">
        <h2 className="card-title-static">Lyd</h2>
        <label className="field">
          <span>Volum for timer og holdeklokke</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={hold.volume}
            onChange={(e) => void saveSettings({ holdClock: { ...hold, volume: Number(e.target.value) } })}
          />
        </label>
        <button
          className="btn btn-wide"
          onClick={() => {
            unlockAudio();
            restDoneSignal(hold.volume);
          }}
        >
          Spill av testlyd
        </button>
      </section>

      <section className="card">
        <h2 className="card-title-static">Test på telefonen</h2>
        <p className="muted small">
          Prøv begge med appen lagt til på hjemskjermen. Sjekk om lyden kommer med lydbryteren på og av, og hva som
          skjer når du bytter app eller låser skjermen underveis.
        </p>
        <button className="btn btn-wide" onClick={testRest}>
          Test hviletimer (10 sekunder)
        </button>
        <button className="btn btn-wide" onClick={() => setClock(true)}>
          Test holdeklokka
        </button>
      </section>

      <section className="card">
        <h2 className="card-title-static">Om</h2>
        <p className="muted small">
          Stige {__APP_VERSION__}. Alle data ligger bare på denne enheten.
          {active ? ' En økt er i gang.' : ''}
        </p>
      </section>

      {clock && <HoldClock title="Holdeklokke" subtitle="Test" onClose={() => setClock(false)} />}
    </div>
  );
}
