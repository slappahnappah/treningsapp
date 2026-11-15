import { useMemo, useState } from 'react';
import {
  RPE_VALUES,
  findPreviousSets,
  formatClock,
  formatNumber,
  formatSet,
  indexWithinKind,
  levelLabel,
  type Exercise,
  type PreviousSets,
  type SetEntry,
  type SetKind,
  type Workout,
  type WorkoutExercise,
} from '@stige/core';
import {
  addExercise,
  addSet,
  deleteWorkout,
  finishWorkout,
  patchSet,
  removeExercise,
  removeSet,
  setDefaultRest,
  setExerciseNotes,
  setDeload,
  setKind,
  toggleSet,
  toggleSuperset,
  type SetPatch,
} from './actions';
import { useData } from './data';
import { ExerciseDetail } from './ExerciseDetail';
import { ExercisePicker } from './ExercisePicker';
import { HoldClock } from './HoldClock';
import { PlateSheet } from './PlateSheet';
import { useNow } from './hooks';
import { NumberField, Sheet } from './ui';

const KIND_LABEL: Record<SetKind, string> = {
  warmup: 'Oppvarming',
  working: 'Arbeidssett',
  drop: 'Drop set',
  failure: 'Failure',
};
const KIND_SHORT: Record<SetKind, string> = { warmup: 'O', working: '', drop: 'D', failure: 'F' };

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const rest = formatClock(s % 3600);
  return h > 0 ? `${h}:${rest.padStart(5, '0')}` : rest;
}

interface ViewProps {
  workout: Workout;
  /** Retting av en ferdig økt: ingen hviletimer, og ingenting fjernes ved lukking. */
  editing?: boolean;
  onClose?: () => void;
  onFinished?: (workoutId: string) => void;
}

const editDate = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });

export function WorkoutView({ workout, editing, onClose, onFinished }: ViewProps) {
  const { exMap, workouts: allWorkouts } = useData();
  // «Forrige gang» skal bare se på økter før denne.
  const workouts = useMemo(
    () => allWorkouts.filter((w) => w.startedAt < workout.startedAt),
    [allWorkouts, workout.startedAt],
  );
  const now = useNow(1000, !editing);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);
  const [freeClock, setFreeClock] = useState(false);

  const all = workout.exercises.flatMap((we) => we.sets);
  const doneCount = all.filter((s) => s.done).length;
  const openCount = all.length - doneCount;

  return (
    <div className="workout">
      <header className="workout-head">
        <div>
          <h1>{workout.title ?? 'Økt'}</h1>
          <div className="muted tabular">
            {editing ? `Retter økta fra ${editDate.format(new Date(workout.startedAt))}` : formatElapsed(now - Date.parse(workout.startedAt))}
          </div>
        </div>
        <div className="row-gap">
          {!editing && (
            <button className="chip" onClick={() => setFreeClock(true)} aria-label="Åpne holdeklokka">
              ⏱ Klokke
            </button>
          )}
          <button
            className={`chip${workout.isDeload ? ' chip-on' : ''}`}
            aria-pressed={workout.isDeload}
            onClick={() => void setDeload(workout.id, !workout.isDeload)}
          >
            Lettuke
          </button>
          <button className="btn btn-primary" onClick={() => (editing ? onClose?.() : setConfirm('finish'))}>
            {editing ? 'Ferdig' : 'Fullfør'}
          </button>
        </div>
      </header>

      {workout.exercises.map((we) => {
        const exercise = exMap.get(we.exerciseId);
        if (!exercise) return null;
        return <ExerciseCard key={we.id} workout={workout} we={we} exercise={exercise} workouts={workouts} live={!editing} />;
      })}

      {workout.exercises.length === 0 && (
        <p className="muted pad">Økta er tom. Legg til den første øvelsen for å begynne å logge.</p>
      )}

      <button className="btn btn-wide" onClick={() => setPicking(true)}>
        + Legg til øvelse
      </button>
      {!editing && (
        <button className="btn btn-wide btn-danger-text" onClick={() => setConfirm('discard')}>
          Forkast økta
        </button>
      )}

      {freeClock && <HoldClock title="Holdeklokke" subtitle="Fri bruk" onClose={() => setFreeClock(false)} />}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(e) => {
            void addExercise(workout.id, e);
            setPicking(false);
          }}
        />
      )}

      {confirm === 'finish' && (
        <Sheet title="Fullføre økta?" onClose={() => setConfirm(null)}>
          <p className="muted">
            {doneCount === 0
              ? 'Ingen sett er haket av ennå. Økta lagres tom.'
              : openCount > 0
                ? `${doneCount} sett er haket av. ${openCount} sett uten hake blir ikke lagret.`
                : `Alle ${doneCount} sett er haket av.`}
          </p>
          <button
            className="btn btn-primary btn-wide"
            onClick={() => {
              setConfirm(null);
              if (doneCount === 0) void deleteWorkout(workout.id);
              else void finishWorkout(workout.id).then(() => onFinished?.(workout.id));
            }}
          >
            {doneCount === 0 ? 'Avslutt uten å lagre' : 'Fullfør økta'}
          </button>
          <button className="btn btn-wide" onClick={() => setConfirm(null)}>
            Fortsett økta
          </button>
        </Sheet>
      )}

      {confirm === 'discard' && (
        <Sheet title="Forkaste økta?" onClose={() => setConfirm(null)}>
          <p className="muted">Alt som er logget i denne økta slettes. Dette kan ikke angres.</p>
          <button
            className="btn btn-danger btn-wide"
            onClick={() => {
              setConfirm(null);
              void deleteWorkout(workout.id);
            }}
          >
            Forkast økta
          </button>
          <button className="btn btn-wide" onClick={() => setConfirm(null)}>
            Fortsett økta
          </button>
        </Sheet>
      )}
    </div>
  );
}

interface CardProps {
  workout: Workout;
  we: WorkoutExercise;
  exercise: Exercise;
  workouts: Workout[];
  live: boolean;
}

function ExerciseCard({ workout, we, exercise, workouts, live }: CardProps) {
  const [menu, setMenu] = useState(false);
  const [plates, setPlates] = useState(false);
  const [detail, setDetail] = useState(false);
  const prev = useMemo(
    () => findPreviousSets(workouts, exercise.id, workout.id),
    [workouts, exercise.id, workout.id],
  );

  // Nummerering: arbeidssett telles, og venstre og høyre side deler nummer.
  let counter = 0;
  const labels = we.sets.map((s) => {
    const side = s.side === 'left' ? 'V' : s.side === 'right' ? 'H' : '';
    if (s.kind !== 'working') return `${KIND_SHORT[s.kind]}${side}`;
    if (s.side !== 'right') counter++;
    return `${Math.max(1, counter)}${side}`;
  });

  const seconds = exercise.type === 'time' || (exercise.type === 'level' && exercise.levelMetric === 'seconds');
  const cols = columnsFor(exercise);

  return (
    <section className="card">
      <header className="card-head">
        <button className="card-title" onClick={() => setMenu(true)}>
          {exercise.name}
          <span className="muted small"> · hvile {formatClock(exercise.defaultRestSec)}</span>
          {we.supersetGroup && <span className="chip chip-on chip-small">Supersett</span>}
        </button>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label={`Valg for ${exercise.name}`}>
          ⋯
        </button>
      </header>

      {exercise.notes && (
        <button className="ex-note" onClick={() => setMenu(true)} aria-label={`Notat for ${exercise.name}`}>
          {exercise.notes}
        </button>
      )}

      <div className={`sets sets-${cols}`}>
        <div className="set-row set-head">
          <span>Sett</span>
          <span>Forrige</span>
          {exercise.type === 'level' && <span>Nivå</span>}
          {cols !== 'time' && cols !== 'level-sec' && (
            <span>{exercise.type === 'assisted' ? '− kg' : exercise.type === 'weight_reps' ? 'kg' : '+ kg'}</span>
          )}
          <span>{seconds ? 'Sek' : 'Reps'}</span>
          {seconds && <span />}
          <span>RPE</span>
          <span />
        </div>
        {we.sets.map((s, i) => (
          <SetRow
            key={s.id}
            workout={workout}
            we={we}
            exercise={exercise}
            set={s}
            label={labels[i] ?? ''}
            prev={prev}
            live={live}
          />
        ))}
      </div>

      <button className="btn btn-wide btn-quiet" onClick={() => void addSet(workout.id, we.id, exercise)}>
        + Sett
      </button>

      {menu && (
        <Sheet title={exercise.name} onClose={() => setMenu(false)}>
          <div className="field">
            <span>Hviletid etter sett</span>
            <div className="stepper">
              <button className="btn" onClick={() => void setDefaultRest(exercise.id, exercise.defaultRestSec - 15)}>
                −15
              </button>
              <strong className="tabular">{formatClock(exercise.defaultRestSec)}</strong>
              <button className="btn" onClick={() => void setDefaultRest(exercise.id, exercise.defaultRestSec + 15)}>
                +15
              </button>
            </div>
          </div>
          <label className="form-row">
            <span>Notat for øvelsen</span>
            <textarea
              className="text note"
              rows={2}
              defaultValue={exercise.notes ?? ''}
              placeholder="For eksempel setehøyde eller grep"
              onChange={(e) => void setExerciseNotes(exercise.id, e.target.value)}
            />
          </label>
          <button
            className="btn btn-wide"
            onClick={() => {
              setMenu(false);
              setDetail(true);
            }}
          >
            Historikk, grafer og rekorder
          </button>
          {exercise.type === 'weight_reps' && exercise.equipment === 'barbell' && (
            <button
              className="btn btn-wide"
              onClick={() => {
                setMenu(false);
                setPlates(true);
              }}
            >
              Platekalkulator og oppvarming
            </button>
          )}
          {(we.supersetGroup || workout.exercises.some((x) => x.order > we.order)) && (
            <button
              className="btn btn-wide"
              onClick={() => {
                setMenu(false);
                void toggleSuperset(workout.id, we.id);
              }}
            >
              {we.supersetGroup ? 'Ta øvelsen ut av supersettet' : 'Supersett med neste øvelse'}
            </button>
          )}
          <button
            className="btn btn-danger btn-wide"
            onClick={() => {
              setMenu(false);
              void removeExercise(workout.id, we.id);
            }}
          >
            Fjern øvelsen fra økta
          </button>
          <button className="btn btn-wide" onClick={() => setMenu(false)}>
            Lukk
          </button>
        </Sheet>
      )}
      {detail && <ExerciseDetail exerciseId={exercise.id} onClose={() => setDetail(false)} />}
      {plates && (
        <PlateSheet
          workout={workout}
          we={we}
          exercise={exercise}
          initialKg={
            we.sets.find((s) => !s.done && s.kind !== 'warmup')?.weightKg ??
            [...we.sets].reverse().find((s) => s.kind !== 'warmup' && s.weightKg != null)?.weightKg ??
            prev?.get('working', undefined, 0)?.weightKg
          }
          onClose={() => setPlates(false)}
        />
      )}
    </section>
  );
}

type Columns = 'weight' | 'time' | 'level-reps' | 'level-sec';
function columnsFor(e: Exercise): Columns {
  if (e.type === 'time') return 'time';
  if (e.type === 'level') return e.levelMetric === 'seconds' ? 'level-sec' : 'level-reps';
  return 'weight';
}

interface RowProps {
  workout: Workout;
  we: WorkoutExercise;
  exercise: Exercise;
  set: SetEntry;
  label: string;
  prev: PreviousSets | undefined;
  live: boolean;
}

function SetRow({ workout, we, exercise, set, label, prev, live }: RowProps) {
  const [sheet, setSheet] = useState<'kind' | 'rpe' | null>(null);
  const [clock, setClock] = useState(false);
  const [shake, setShake] = useState(false);

  const prevSet = prev?.get(set.kind, set.side, indexWithinKind(we.sets, set.id));
  // Uten forrige økt brukes settet over (samme side) som forslag.
  const above = [...we.sets.slice(0, we.sets.indexOf(set))]
    .reverse()
    .find((s) => s.done && s.side === set.side && (s.kind === 'warmup') === (set.kind === 'warmup'));
  const source = prevSet ?? above;
  const fallback: SetPatch = source
    ? {
        weightKg: source.weightKg,
        assistanceKg: source.assistanceKg,
        reps: source.reps,
        durationSec: source.durationSec,
      }
    : {};
  const ph = (n: number | undefined) => (n != null ? formatNumber(n) : '');
  const patch = (p: SetPatch) => void patchSet(workout.id, we.id, set.id, p);
  const cols = columnsFor(exercise);
  const seconds = cols === 'time' || cols === 'level-sec';
  const level = exercise.levels?.find((l) => l.id === set.levelId);

  const check = async (extra: SetPatch = {}) => {
    const ok = await toggleSet(workout.id, we.id, set.id, exercise, { ...fallback, ...extra }, live);
    if (!ok) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    }
  };

  return (
    <div className={`set-row${set.done ? ' set-done' : ''}${shake ? ' set-shake' : ''} kind-${set.kind}`}>
      <button className="set-label" onClick={() => setSheet('kind')} aria-label={`Sett ${label}, ${KIND_LABEL[set.kind]}`}>
        {label}
      </button>
      <span className="set-prev">{prevSet ? formatSet(exercise, prevSet) : '–'}</span>

      {exercise.type === 'level' && (
        <select
          className="num level-select"
          aria-label="Nivå"
          value={set.levelId ?? ''}
          onChange={(e) => patch({ levelId: e.target.value })}
        >
          {[...(exercise.levels ?? [])]
            .sort((a, b) => a.order - b.order)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {levelLabel(l)}
                {l.description ? ` ${l.description}` : ''}
              </option>
            ))}
        </select>
      )}

      {cols !== 'time' && cols !== 'level-sec' && (
        <NumberField
          label={exercise.type === 'assisted' ? 'Assistanse i kg' : 'Kg'}
          decimal
          value={exercise.type === 'assisted' ? set.assistanceKg : set.weightKg}
          placeholder={ph(exercise.type === 'assisted' ? fallback.assistanceKg : fallback.weightKg)}
          onChange={(v) => patch(exercise.type === 'assisted' ? { assistanceKg: v } : { weightKg: v })}
        />
      )}

      {seconds ? (
        <>
          <NumberField
            label="Sekunder"
            value={set.durationSec}
            placeholder={ph(fallback.durationSec)}
            onChange={(v) => patch({ durationSec: v })}
          />
          <button className="icon-btn clock-btn" onClick={() => setClock(true)} aria-label="Åpne holdeklokka">
            ⏱
          </button>
        </>
      ) : (
        <NumberField label="Reps" value={set.reps} placeholder={ph(fallback.reps)} onChange={(v) => patch({ reps: v })} />
      )}

      <button className={`rpe-btn${set.rpe != null ? ' rpe-set' : ''}`} onClick={() => setSheet('rpe')} aria-label="RPE">
        {set.rpe != null ? formatNumber(set.rpe) : '–'}
      </button>

      <button
        className="check"
        aria-pressed={set.done}
        aria-label={set.done ? 'Fjern haken' : 'Hak av settet'}
        onClick={() => void check()}
      >
        ✓
      </button>

      {sheet === 'rpe' && (
        <Sheet title="RPE" onClose={() => setSheet(null)}>
          <p className="muted small">10 betyr ingen reps igjen. 8 betyr to reps igjen.</p>
          <div className="rpe-grid">
            {RPE_VALUES.map((v) => (
              <button
                key={v}
                className={`btn rpe-choice${set.rpe === v ? ' btn-primary' : ''}`}
                onClick={() => {
                  patch({ rpe: v });
                  setSheet(null);
                }}
              >
                {formatNumber(v)}
              </button>
            ))}
          </div>
          <button
            className="btn btn-wide"
            onClick={() => {
              patch({ rpe: undefined });
              setSheet(null);
            }}
          >
            Ingen RPE
          </button>
        </Sheet>
      )}

      {sheet === 'kind' && (
        <Sheet title={`Sett ${label}`} onClose={() => setSheet(null)}>
          <div className="kind-grid">
            {(Object.keys(KIND_LABEL) as SetKind[]).map((k) => (
              <button
                key={k}
                className={`btn${set.kind === k ? ' btn-primary' : ''}`}
                onClick={() => {
                  void setKind(workout.id, we.id, set.id, k);
                  setSheet(null);
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <button
            className="btn btn-danger btn-wide"
            onClick={() => {
              setSheet(null);
              void removeSet(workout.id, we.id, set.id);
            }}
          >
            {set.side ? 'Slett settet (begge sider)' : 'Slett settet'}
          </button>
        </Sheet>
      )}

      {clock && (
        <HoldClock
          title={exercise.name}
          subtitle={[level ? levelLabel(level) : '', set.side === 'left' ? 'venstre' : set.side === 'right' ? 'høyre' : '']
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setClock(false)}
          onSave={(sec) => {
            setClock(false);
            void (async () => {
              await patchSet(workout.id, we.id, set.id, { durationSec: sec });
              if (!set.done) await check({ durationSec: sec });
            })();
          }}
        />
      )}
    </div>
  );
}
