import { useMemo, useState } from 'react';
import {
  bestSeries,
  e1rmSeries,
  exerciseHistory,
  exerciseRecords,
  formatClock,
  formatSet,
  levelLabel,
  volumeSeries,
  type Exercise,
} from '@stige/core';
import { LineChart } from './Chart';
import { useData } from './data';
import { ExerciseEditor } from './ExerciseEditor';
import { typeLabel } from './ExercisePicker';
import { Overlay } from './ui';

type Pane = 'history' | 'charts' | 'records';
const dayFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });

export function ExerciseDetail({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const { exMap, workouts } = useData();
  const exercise = exMap.get(exerciseId);
  const [pane, setPane] = useState<Pane>('history');
  const [editing, setEditing] = useState(false);
  const sessions = useMemo(() => exerciseHistory(workouts, exerciseId), [workouts, exerciseId]);

  if (!exercise) return null;
  if (editing) return <ExerciseEditor exercise={exercise} onClose={() => setEditing(false)} onDeleted={onClose} />;

  return (
    <Overlay label={exercise.name}>
      <header className="overlay-head">
        <div>
          <h2>{exercise.name}</h2>
          <div className="muted small">
            {typeLabel(exercise)}
            {exercise.unilateral ? ' · per side' : ''} · hvile {formatClock(exercise.defaultRestSec)}
            {exercise.archived ? ' · arkivert' : ''}
          </div>
        </div>
        <div className="row-gap">
          <button className="btn" onClick={() => setEditing(true)}>
            Rediger
          </button>
          <button className="btn" onClick={onClose}>
            Lukk
          </button>
        </div>
      </header>

      <div className="seg seg-full" role="tablist">
        {(
          [
            ['history', 'Historikk'],
            ['charts', 'Grafer'],
            ['records', 'Rekorder'],
          ] as [Pane, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pane === id}
            className={`seg-item${pane === id ? ' seg-on' : ''}`}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overlay-scroll">
        {sessions.length === 0 && <p className="muted pad">Øvelsen er ikke logget ennå.</p>}
        {sessions.length > 0 && pane === 'history' && <History exercise={exercise} />}
        {sessions.length > 0 && pane === 'charts' && <Charts exercise={exercise} />}
        {sessions.length > 0 && pane === 'records' && <Records exercise={exercise} />}
      </div>
    </Overlay>
  );
}

function useSessions(exercise: Exercise) {
  const { workouts } = useData();
  return useMemo(() => exerciseHistory(workouts, exercise.id), [workouts, exercise.id]);
}

function History({ exercise }: { exercise: Exercise }) {
  const sessions = useSessions(exercise);
  return (
    <>
      {sessions.map((s) => (
        <section className="card" key={s.workoutId}>
          <h3 className="card-title-static">
            {dayFormat.format(new Date(s.startedAt))}
            {s.isDeload && <span className="chip chip-on chip-small">Lettuke</span>}
          </h3>
          {s.title && <div className="muted small pad-x">{s.title}</div>}
          <ul className="plain-list">
            {s.sets.map((set) => {
              const side = set.side === 'left' ? 'V ' : set.side === 'right' ? 'H ' : '';
              return (
                <li key={set.id} className={set.kind === 'warmup' ? 'muted' : ''}>
                  {set.kind === 'warmup' ? 'Oppvarming: ' : set.kind === 'drop' ? 'Drop set: ' : set.kind === 'failure' ? 'Failure: ' : ''}
                  {side}
                  {formatSet(exercise, set)}
                  {set.rpe != null && <span className="muted small"> · RPE {String(set.rpe).replace('.', ',')}</span>}
                  {set.restBeforeSec != null && (
                    <span className="muted small"> · pause {formatClock(set.restBeforeSec)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function Charts({ exercise }: { exercise: Exercise }) {
  const sessions = useSessions(exercise);
  const levels = useMemo(() => {
    const used = new Set(sessions.flatMap((s) => s.sets.map((x) => x.levelId)));
    return (exercise.levels ?? []).filter((l) => used.has(l.id)).sort((a, b) => b.order - a.order);
  }, [exercise.levels, sessions]);
  const [levelId, setLevelId] = useState<string | undefined>(undefined);
  const chosen = levelId ?? levels[0]?.id;

  if (exercise.type === 'weight_reps') {
    return (
      <>
        <LineChart title="Estimert 1RM" unit="kg" points={e1rmSeries(sessions)} />
        <LineChart title="Volum per økt" unit="kg" points={volumeSeries(exercise, sessions)} />
      </>
    );
  }
  const seconds = exercise.type === 'time' || (exercise.type === 'level' && exercise.levelMetric === 'seconds');
  return (
    <>
      {exercise.type === 'level' && levels.length > 1 && (
        <div className="seg seg-wrap">
          {levels.map((l) => (
            <button
              key={l.id}
              className={`seg-item${chosen === l.id ? ' seg-on' : ''}`}
              onClick={() => setLevelId(l.id)}
            >
              {levelLabel(l)}
            </button>
          ))}
        </div>
      )}
      <LineChart
        title={seconds ? 'Lengste hold per økt' : 'Flest reps i ett sett per økt'}
        unit={seconds ? 's' : 'reps'}
        points={bestSeries(sessions, seconds ? 'seconds' : 'reps', exercise.type === 'level' ? chosen : undefined)}
      />
      {exercise.unilateral && <p className="muted small">Grafen viser den beste siden i hver økt.</p>}
    </>
  );
}

function Records({ exercise }: { exercise: Exercise }) {
  const sessions = useSessions(exercise);
  const groups = useMemo(() => exerciseRecords(exercise, sessions), [exercise, sessions]);
  if (groups.length === 0) return <p className="muted pad">Ingen arbeidssett er logget ennå.</p>;
  return (
    <>
      {groups.map((g) => (
        <section className="card" key={`${g.levelId ?? ''}${g.side ?? ''}`}>
          {g.label && <h3 className="card-title-static">{g.label}</h3>}
          <dl className="records">
            {g.records.map((r) => (
              <div key={r.kind}>
                <dt>{r.label}</dt>
                <dd>
                  <strong>{r.display}</strong>
                  <span className="muted small">{shortDate.format(new Date(r.date))}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}
