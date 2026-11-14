import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  dateKey,
  formatNumber,
  formatSet,
  fromDateKey,
  isoWeek,
  monthGrid,
  weekStartKey,
  workoutVolume,
  workoutWorkingSets,
  type Workout,
} from '@stige/core';
import { deleteWorkout, saveAsRoutine, saveNote, setDeload, setWeekDeload } from './actions';
import { useData } from './data';
import { ProgressArrow, ProgressList, useProgress } from './Progress';
import { SummaryOverlay } from './Summary';
import { Overlay, Sheet } from './ui';
import { WorkoutView } from './WorkoutView';

const dayFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });
const monthFormat = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];

export function WorkoutCard({ workout, actions }: { workout: Workout; actions?: boolean }) {
  const { exMap, notes } = useData();
  const progress = useProgress(workout);
  const [sheet, setSheet] = useState<'menu' | 'delete' | 'routine' | null>(null);
  const [overlay, setOverlay] = useState<'summary' | 'edit' | null>(null);
  const [reasons, setReasons] = useState(false);
  const [routineName, setRoutineName] = useState(workout.title ?? 'Ny rutine');

  const start = new Date(workout.startedAt);
  const end = workout.endedAt ? new Date(workout.endedAt) : undefined;
  const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const volume = workoutVolume(workout, (id) => exMap.get(id));
  const note = notes.get(dateKey(start));
  const shown = new Set<string>();

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2 className="card-title-static">
            {workout.title ?? 'Økt'}
            {workout.isDeload && <span className="chip chip-on chip-small">Lettuke</span>}
          </h2>
          <div className="muted small pad-x">
            {capitalize(dayFormat.format(start))} · {timeFormat.format(start)}
            {end ? `–${timeFormat.format(end)} (${minutes} min)` : ''}
          </div>
        </div>
        {actions && (
          <button className="icon-btn" onClick={() => setSheet('menu')} aria-label="Valg for økta">
            ⋯
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
          // Pila vises én gang per øvelse, ved arbeidssettene.
          const working = we.sets.some((s) => s.done && s.kind !== 'warmup');
          const arrow = working && !shown.has(ex.id) ? progress.get(ex.id) : undefined;
          if (arrow) shown.add(ex.id);
          return (
            <li key={we.id}>
              {arrow && (
                <button className="arrow-btn" onClick={() => setReasons(!reasons)} aria-label="Vis forklaring på pilene">
                  <ProgressArrow result={arrow} />
                </button>
              )}
              <strong>{ex.name}</strong>
              <span className="muted"> {sets.join(', ')}</span>
            </li>
          );
        })}
      </ul>
      {reasons && <ProgressList workout={workout} />}
      <div className="muted small pad-x">
        {workoutWorkingSets(workout)} arbeidssett
        {volume > 0 ? ` · volum ${formatNumber(volume)} kg` : ''}
      </div>
      {note && <p className="note-quote">{note}</p>}

      {sheet === 'menu' && (
        <Sheet title={workout.title ?? 'Økt'} onClose={() => setSheet(null)}>
          <button className="btn btn-wide" onClick={() => (setSheet(null), setOverlay('summary'))}>
            Sammendrag for Whoop og Bevel
          </button>
          <button className="btn btn-wide" onClick={() => (setSheet(null), setOverlay('edit'))}>
            Rediger økta
          </button>
          <button className="btn btn-wide" onClick={() => void setDeload(workout.id, !workout.isDeload).then(() => setSheet(null))}>
            {workout.isDeload ? 'Fjern markeringen som lettuke' : 'Marker som lettuke'}
          </button>
          <button className="btn btn-wide" onClick={() => setSheet('routine')}>
            Lagre som rutine
          </button>
          <button className="btn btn-danger btn-wide" onClick={() => setSheet('delete')}>
            Slett økta
          </button>
        </Sheet>
      )}
      {sheet === 'routine' && (
        <Sheet title="Lagre som rutine" onClose={() => setSheet(null)}>
          <label className="form-row">
            <span>Navn på rutinen</span>
            <input className="text" value={routineName} onChange={(e) => setRoutineName(e.target.value)} />
          </label>
          <button
            className="btn btn-primary btn-wide"
            disabled={routineName.trim() === ''}
            onClick={() => void saveAsRoutine(workout, routineName.trim()).then(() => setSheet(null))}
          >
            Lagre rutinen
          </button>
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Sheet title="Slette økta?" onClose={() => setSheet(null)}>
          <p className="muted">Økta fjernes fra dagboka og historikken. Dette kan ikke angres.</p>
          <button className="btn btn-danger btn-wide" onClick={() => void deleteWorkout(workout.id)}>
            Slett økta
          </button>
          <button className="btn btn-wide" onClick={() => setSheet(null)}>
            Avbryt
          </button>
        </Sheet>
      )}
      {overlay === 'summary' && <SummaryOverlay workout={workout} onClose={() => setOverlay(null)} />}
      {overlay === 'edit' && (
        <Overlay label="Rediger økta">
          <div className="overlay-scroll">
            <WorkoutView workout={workout} editing onClose={() => setOverlay(null)} />
          </div>
        </Overlay>
      )}
    </section>
  );
}

function NoteField({ date }: { date: string }) {
  const { notes } = useData();
  const saved = notes.get(date) ?? '';
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [date]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="form-row">
      <span>Dagboknotat</span>
      <textarea
        className="text note"
        rows={3}
        value={text}
        placeholder="Hvordan gikk det i dag?"
        onChange={(e) => {
          setText(e.target.value);
          void saveNote(date, e.target.value);
        }}
      />
    </label>
  );
}

export function DiaryTab() {
  const { finished, notes, deloadWeeks } = useData();
  const today = dateKey(new Date());
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));

  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of finished) {
      const key = dateKey(w.startedAt);
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return map;
  }, [finished]);

  const weeks = monthGrid(cursor.y, cursor.m);
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
  const shift = (d: number) => {
    const next = new Date(cursor.y, cursor.m + d, 1);
    setCursor({ y: next.getFullYear(), m: next.getMonth() });
  };
  const selectedWeek = weekStartKey(selected);
  const weekOn = deloadWeeks.has(selectedWeek);
  const dayWorkouts = byDay.get(selected) ?? [];
  const recent = finished.filter((w) => dateKey(w.startedAt) !== selected).slice(0, 15);

  return (
    <div className="page">
      <h1>Dagbok</h1>

      <section className="card">
        <header className="card-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Forrige måned">
            ‹
          </button>
          <strong>{capitalize(monthFormat.format(new Date(cursor.y, cursor.m, 1)))}</strong>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Neste måned">
            ›
          </button>
        </header>
        <div className="cal" role="grid" aria-label="Kalender">
          <div className="cal-row cal-head">
            <span>Uke</span>
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {weeks.map((week) => {
            const start = week[0]!;
            return (
              <div className={`cal-row${deloadWeeks.has(start) ? ' cal-deload' : ''}`} key={start}>
                <span className="cal-week">{isoWeek(start)}</span>
                {week.map((day) => {
                  const list = byDay.get(day);
                  const cls = [
                    'cal-day',
                    day.startsWith(monthPrefix) ? '' : 'cal-out',
                    day === today ? 'cal-today' : '',
                    day === selected ? 'cal-selected' : '',
                    list ? 'cal-trained' : '',
                    list?.some((w) => w.isDeload) ? 'cal-light' : '',
                  ].join(' ');
                  const label = `${dayFormat.format(fromDateKey(day))}${list ? `, ${list.length} økt${list.length > 1 ? 'er' : ''}` : ''}${notes.has(day) ? ', notat' : ''}`;
                  return (
                    <button key={day} className={cls} aria-label={label} aria-pressed={day === selected} onClick={() => setSelected(day)}>
                      {Number(day.slice(8))}
                      {notes.has(day) && <i className="cal-note" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="muted small pad-x">
          Fylt dag er treningsdag. Ring med stiplet kant er lettuke-økt. Prikk betyr notat. Uker med ravgul stripe er
          lettuker.
        </p>
      </section>

      <h2>{capitalize(dayFormat.format(fromDateKey(selected)))}</h2>
      {dayWorkouts.length === 0 && <p className="muted">Ingen økt denne dagen.</p>}
      {dayWorkouts.map((w) => (
        <WorkoutCard key={w.id} workout={w} actions />
      ))}
      <NoteField date={selected} />
      <button className="btn btn-wide" onClick={() => void setWeekDeload(selectedWeek, !weekOn)}>
        {weekOn ? `Fjern lettuke for uke ${isoWeek(selectedWeek)}` : `Marker uke ${isoWeek(selectedWeek)} som lettuke`}
      </button>
      <p className="muted small">
        Uke {isoWeek(selectedWeek)} går fra {dayFormat.format(fromDateKey(selectedWeek))} til{' '}
        {dayFormat.format(fromDateKey(addDays(selectedWeek, 6)))}. Markeringen gjelder alle øktene i uka.
      </p>

      {recent.length > 0 && <h2>Siste økter</h2>}
      {recent.map((w) => (
        <WorkoutCard key={w.id} workout={w} actions />
      ))}
    </div>
  );
}
