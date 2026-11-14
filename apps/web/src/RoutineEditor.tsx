import { useState } from 'react';
import { plannedSetsFor, type Routine } from '@stige/core';
import { useData } from './data';
import { db } from './db';
import { ExercisePicker } from './ExercisePicker';

interface Row {
  key: string;
  exerciseId: string;
  warmups: number;
  work: number;
  levelId?: string;
  linkNext: boolean; // supersett med neste øvelse
}

function toRows(routine: Routine): Row[] {
  const list = [...routine.exercises].sort((a, b) => a.order - b.order);
  return list.map((re, i) => {
    const single = re.plannedSets.filter((s) => s.side !== 'right');
    const row: Row = {
      key: crypto.randomUUID(),
      exerciseId: re.exerciseId,
      warmups: single.filter((s) => s.kind === 'warmup').length,
      work: single.filter((s) => s.kind !== 'warmup').length,
      linkNext: !!re.supersetGroup && list[i + 1]?.supersetGroup === re.supersetGroup,
    };
    const levelId = re.plannedSets[0]?.levelId;
    if (levelId) row.levelId = levelId;
    return row;
  });
}

export function newRoutine(): Routine {
  return { id: crypto.randomUUID(), name: '', exercises: [] };
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mini-stepper">
      <span className="muted small">{label}</span>
      <button className="btn" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Færre ${label.toLowerCase()}`}>
        −
      </button>
      <strong className="tabular">{value}</strong>
      <button className="btn" onClick={() => onChange(value + 1)} aria-label={`Flere ${label.toLowerCase()}`}>
        +
      </button>
    </div>
  );
}

export function RoutineEditor({ routine, isNew, onClose }: { routine: Routine; isNew?: boolean; onClose: () => void }) {
  const { exMap } = useData();
  const [name, setName] = useState(routine.name);
  const [rows, setRows] = useState<Row[]>(() => toRows(routine));
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = async () => {
    let group: string | undefined;
    const exercises: Routine['exercises'] = [];
    rows.forEach((r, i) => {
      const ex = exMap.get(r.exerciseId);
      if (!ex || r.warmups + r.work === 0) return;
      const planned = [...plannedSetsFor(ex, 'warmup', r.warmups), ...plannedSetsFor(ex, 'working', r.work)].map((p) =>
        r.levelId && ex.levels?.some((l) => l.id === r.levelId) ? { ...p, levelId: r.levelId } : p,
      );
      const linkedFromPrev = i > 0 && rows[i - 1]!.linkNext;
      if (!linkedFromPrev) group = r.linkNext ? crypto.randomUUID() : undefined;
      const re: Routine['exercises'][number] = { exerciseId: r.exerciseId, order: exercises.length, plannedSets: planned };
      if (group && (r.linkNext || linkedFromPrev)) re.supersetGroup = group;
      exercises.push(re);
    });
    await db.routines.put({ id: routine.id, name: name.trim(), exercises });
    onClose();
  };

  return (
    <div className="overlay" role="dialog" aria-label={isNew ? 'Ny rutine' : 'Rediger rutine'}>
      <header className="overlay-head">
        <h2>{isNew ? 'Ny rutine' : 'Rediger rutine'}</h2>
        <div className="row-gap">
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn btn-primary" disabled={name.trim() === ''} onClick={() => void save()}>
            Lagre
          </button>
        </div>
      </header>
      <div className="overlay-scroll form">
        <label className="form-row">
          <span>Navn</span>
          <input className="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {rows.map((r, i) => {
          const ex = exMap.get(r.exerciseId);
          return (
            <section className="card" key={r.key}>
              <header className="card-head">
                <strong className="pad-x">{ex?.name ?? 'Ukjent øvelse'}</strong>
                <div className="row-gap">
                  <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Flytt opp">
                    ↑
                  </button>
                  <button className="icon-btn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Flytt ned">
                    ↓
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    aria-label={`Fjern ${ex?.name ?? 'øvelsen'}`}
                  >
                    ✕
                  </button>
                </div>
              </header>
              <div className="stepper-row">
                <Stepper label="Oppvarming" value={r.warmups} onChange={(v) => patch(r.key, { warmups: v })} />
                <Stepper label="Arbeidssett" value={r.work} onChange={(v) => patch(r.key, { work: v })} />
              </div>
              {i < rows.length - 1 && (
                <label className="field field-check">
                  <span className="small">Supersett med neste øvelse</span>
                  <input type="checkbox" checked={r.linkNext} onChange={(e) => patch(r.key, { linkNext: e.target.checked })} />
                </label>
              )}
            </section>
          );
        })}
        {rows.length === 0 && <p className="muted">Rutinen har ingen øvelser ennå.</p>}

        <button className="btn btn-wide" onClick={() => setPicking(true)}>
          + Legg til øvelse
        </button>

        {!isNew &&
          (confirmDelete ? (
            <button
              className="btn btn-danger btn-wide"
              onClick={() => {
                void db.routines.delete(routine.id);
                onClose();
              }}
            >
              Bekreft: slett rutinen
            </button>
          ) : (
            <button className="btn btn-danger-text btn-wide" onClick={() => setConfirmDelete(true)}>
              Slett rutinen
            </button>
          ))}
        <p className="muted small">Kg og reps fylles inn under økta og hentes fra forrige gang.</p>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(e) => {
            setRows((rs) => [...rs, { key: crypto.randomUUID(), exerciseId: e.id, warmups: 0, work: 3, linkNext: false }]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
