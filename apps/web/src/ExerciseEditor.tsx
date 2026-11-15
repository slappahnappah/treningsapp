import { useMemo, useState } from 'react';
import {
  MUSCLES,
  MUSCLE_LABEL,
  defaultLevels,
  formatClock,
  levelLabel,
  musclesFor,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type Level,
  type Muscle,
} from '@stige/core';
import { deleteExercise } from './actions';
import { useData } from './data';
import { db } from './db';
import { TYPE_LABEL } from './ExercisePicker';
import { Overlay } from './ui';

const EQUIPMENT: Record<Equipment, string> = {
  barbell: 'Stang',
  dumbbell: 'Manualer',
  kettlebell: 'Kettlebell',
  machine: 'Maskin',
  cable: 'Kabel',
  bodyweight: 'Kroppsvekt',
  rings: 'Ringer',
  other: 'Annet',
};

export function newExercise(): Exercise {
  return {
    id: crypto.randomUUID(),
    name: '',
    nameEn: '',
    type: 'weight_reps',
    equipment: 'barbell',
    perHand: false,
    unilateral: false,
    defaultRestSec: 120,
    isMainLift: false,
    externalNames: {},
    isCustom: true,
    archived: false,
  };
}

type MuscleRole = 'none' | 'direct' | 'indirect';

interface Props {
  exercise: Exercise;
  isNew?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export function ExerciseEditor({ exercise, isNew, onClose, onDeleted }: Props) {
  const { workouts } = useData();
  const [draft, setDraft] = useState<Exercise>(exercise);
  const set = (patch: Partial<Exercise>) => setDraft((d) => ({ ...d, ...patch }));

  // Type, sider og nivåer i bruk kan ikke endres uten å ødelegge historikken.
  const usedLevels = useMemo(() => {
    const ids = new Set<string>();
    let used = false;
    for (const w of workouts)
      for (const we of w.exercises)
        if (we.exerciseId === exercise.id) {
          used = true;
          for (const s of we.sets) if (s.levelId) ids.add(s.levelId);
        }
    return { used, ids };
  }, [workouts, exercise.id]);
  const locked = usedLevels.used;

  const setType = (type: ExerciseType) => {
    const patch: Partial<Exercise> = { type };
    if (type === 'level') {
      patch.levelMetric = draft.levelMetric ?? 'reps';
      patch.levels = draft.levels ?? defaultLevels(draft.id);
    }
    set(patch);
  };

  const muscles = musclesFor(draft);
  const setMuscle = (mu: Muscle, role: MuscleRole) => {
    const direct = muscles.direct.filter((x) => x !== mu);
    const indirect = muscles.indirect.filter((x) => x !== mu);
    if (role === 'direct') direct.push(mu);
    if (role === 'indirect') indirect.push(mu);
    set({ muscles: { direct, indirect } });
  };

  const levels = [...(draft.levels ?? [])].sort((a, b) => a.order - b.order);
  const setLevels = (next: Level[]) => set({ levels: next.map((l, i) => ({ ...l, order: i + 1 })) });

  const valid = draft.name.trim() !== '';
  const save = async () => {
    const name = draft.name.trim();
    const clean: Exercise = {
      ...draft,
      name,
      nameEn: draft.nameEn.trim() || name,
      externalNames: {
        ...(draft.externalNames.whoop?.trim() ? { whoop: draft.externalNames.whoop.trim() } : {}),
        ...(draft.externalNames.bevel?.trim() ? { bevel: draft.externalNames.bevel.trim() } : {}),
      },
    };
    if (clean.notes?.trim()) clean.notes = clean.notes.trim();
    else delete clean.notes;
    if (clean.type !== 'level') {
      delete clean.levels;
      delete clean.levelMetric;
    } else {
      clean.levels = (clean.levels ?? []).map((l) => {
        const out: Level = { id: l.id, order: l.order };
        if (l.description?.trim()) out.description = l.description.trim();
        return out;
      });
    }
    await db.exercises.put(clean);
    onClose();
  };

  return (
    <Overlay label={isNew ? 'Ny øvelse' : 'Rediger øvelse'}>
      <header className="overlay-head">
        <h2>{isNew ? 'Ny øvelse' : 'Rediger øvelse'}</h2>
        <div className="row-gap">
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => void save()}>
            Lagre
          </button>
        </div>
      </header>

      <div className="overlay-scroll form">
        <label className="form-row">
          <span>Navn</span>
          <input className="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="form-row">
          <span>Engelsk navn (brukes i sammendraget)</span>
          <input
            className="text"
            value={draft.nameEn}
            placeholder={draft.name}
            onChange={(e) => set({ nameEn: e.target.value })}
          />
        </label>

        <label className="form-row">
          <span>Type</span>
          <select className="text" value={draft.type} disabled={locked} onChange={(e) => setType(e.target.value as ExerciseType)}>
            {(Object.keys(TYPE_LABEL) as ExerciseType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        {draft.type === 'level' && (
          <label className="form-row">
            <span>Måles i</span>
            <select
              className="text"
              value={draft.levelMetric ?? 'reps'}
              disabled={locked}
              onChange={(e) => set({ levelMetric: e.target.value as 'reps' | 'seconds' })}
            >
              <option value="reps">Reps</option>
              <option value="seconds">Sekunder</option>
            </select>
          </label>
        )}
        {locked && <p className="muted small">Typen kan ikke endres fordi øvelsen har historikk.</p>}

        <label className="form-row">
          <span>Utstyr</span>
          <select className="text" value={draft.equipment} onChange={(e) => set({ equipment: e.target.value as Equipment })}>
            {(Object.keys(EQUIPMENT) as Equipment[]).map((q) => (
              <option key={q} value={q}>
                {EQUIPMENT[q]}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-check">
          <span>Én side om gangen (logges per side)</span>
          <input
            type="checkbox"
            checked={draft.unilateral}
            disabled={locked}
            onChange={(e) => set({ unilateral: e.target.checked })}
          />
        </label>
        {draft.type === 'weight_reps' && (
          <label className="field field-check">
            <span>Vekten oppgis per hånd</span>
            <input type="checkbox" checked={draft.perHand} onChange={(e) => set({ perHand: e.target.checked })} />
          </label>
        )}
        <label className="field field-check">
          <span>Hovedøvelse (brukes av lettuke-varselet)</span>
          <input type="checkbox" checked={draft.isMainLift} onChange={(e) => set({ isMainLift: e.target.checked })} />
        </label>

        <label className="form-row">
          <span>Notat (vises når du logger øvelsen)</span>
          <textarea
            className="text note"
            rows={2}
            value={draft.notes ?? ''}
            placeholder="For eksempel setehøyde eller grep"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>

        <div className="form-row">
          <span>Muskler (brukes i volum per muskelgruppe)</span>
          <div className="muscle-pick">
            {MUSCLES.map((mu) => {
              const role = muscles.direct.includes(mu) ? 'direct' : muscles.indirect.includes(mu) ? 'indirect' : 'none';
              return (
                <label key={mu} style={{ display: 'contents' }}>
                  <span className="small">{MUSCLE_LABEL[mu]}</span>
                  <select className="text" value={role} onChange={(e) => setMuscle(mu, e.target.value as MuscleRole)}>
                    <option value="none">Ikke med</option>
                    <option value="direct">Hovedmuskel</option>
                    <option value="indirect">Hjelper til</option>
                  </select>
                </label>
              );
            })}
          </div>
        </div>

        <div className="field">
          <span>Hviletid etter sett</span>
          <div className="stepper">
            <button className="btn" onClick={() => set({ defaultRestSec: Math.max(0, draft.defaultRestSec - 15) })}>
              −15
            </button>
            <strong className="tabular">{formatClock(draft.defaultRestSec)}</strong>
            <button className="btn" onClick={() => set({ defaultRestSec: draft.defaultRestSec + 15 })}>
              +15
            </button>
          </div>
        </div>

        {draft.type === 'level' && (
          <>
            <h3>Nivåer</h3>
            <p className="muted small">Høyere nummer er tyngre variant. Beskrivelsen er valgfri.</p>
            {levels.map((l) => (
              <div className="level-row" key={l.id}>
                <strong>{levelLabel(l)}</strong>
                <input
                  className="text"
                  aria-label={`Beskrivelse av ${levelLabel(l)}`}
                  placeholder="Beskrivelse"
                  value={l.description ?? ''}
                  onChange={(e) =>
                    setLevels(levels.map((x) => (x.id === l.id ? { ...x, description: e.target.value } : x)))
                  }
                />
                <button
                  className="icon-btn"
                  aria-label={`Fjern ${levelLabel(l)}`}
                  disabled={usedLevels.ids.has(l.id) || levels.length <= 1}
                  onClick={() => setLevels(levels.filter((x) => x.id !== l.id))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn btn-wide btn-quiet"
              onClick={() => setLevels([...levels, { id: crypto.randomUUID(), order: levels.length + 1 }])}
            >
              + Nivå
            </button>
            <p className="muted small">Nivåer som er brukt i en økt kan ikke fjernes.</p>
          </>
        )}

        <h3>Navn i andre apper</h3>
        <label className="form-row">
          <span>Whoop</span>
          <input
            className="text"
            value={draft.externalNames.whoop ?? ''}
            placeholder={draft.nameEn || draft.name}
            onChange={(e) => set({ externalNames: { ...draft.externalNames, whoop: e.target.value } })}
          />
        </label>
        <label className="form-row">
          <span>Bevel</span>
          <input
            className="text"
            value={draft.externalNames.bevel ?? ''}
            placeholder={draft.nameEn || draft.name}
            onChange={(e) => set({ externalNames: { ...draft.externalNames, bevel: e.target.value } })}
          />
        </label>

        {!isNew && (
          <>
            <button
              className="btn btn-wide"
              onClick={() => {
                void db.exercises.update(exercise.id, { archived: !exercise.archived });
                onClose();
              }}
            >
              {exercise.archived ? 'Hent øvelsen tilbake fra arkivet' : 'Arkiver øvelsen'}
            </button>
            {!locked && (
              <button
                className="btn btn-danger btn-wide"
                onClick={() => {
                  void deleteExercise(exercise.id);
                  (onDeleted ?? onClose)();
                }}
              >
                Slett øvelsen
              </button>
            )}
            <p className="muted small">
              Arkiverte øvelser skjules når du legger til øvelser, men historikken beholdes.
              {locked ? ' Øvelser med historikk kan ikke slettes.' : ''}
            </p>
          </>
        )}
      </div>
    </Overlay>
  );
}
