import { useMemo, useState } from 'react';
import {
  MUSCLE_LABEL,
  deloadAdvice,
  exerciseHistory,
  exerciseTrend,
  formatNumber,
  isoWeek,
  weekStartKey,
  weeklyMuscleVolume,
  type Exercise,
  type Muscle,
  type MuscleVolume,
  type TrendStatus,
} from '@stige/core';
import { setWeekDeload } from './actions';
import { useData } from './data';

const TREND_WORD: Record<TrendStatus, string> = {
  progress: 'Progresjon',
  plateau: 'Platå',
  decline: 'Nedgang',
  unclear: 'Uavklart',
};
const TREND_ARROW: Record<TrendStatus, string> = { progress: '↗', plateau: '→', decline: '↘', unclear: '·' };

/** Trend over de siste like øktene, med forklaring. */
export function TrendCard({ exercise }: { exercise: Exercise }) {
  const { workouts, settings } = useData();
  const trend = useMemo(
    () => exerciseTrend(exercise, exerciseHistory(workouts, exercise.id), settings.thresholds),
    [exercise, workouts, settings.thresholds],
  );
  if (!trend) return null;
  return (
    <section className={`card trend trend-${trend.status}`}>
      <div className="trend-head">
        <span className="trend-arrow" aria-hidden="true">
          {TREND_ARROW[trend.status]}
        </span>
        <strong>Trend: {TREND_WORD[trend.status]}</strong>
      </div>
      <p className="muted small">{trend.reason}.</p>
    </section>
  );
}

const DISMISS_KEY = 'stige.deload.dismissed';
const DISMISS_DAYS = 7;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Forslag om lettuke når nok signaler slår ut. Vises ikke i en uke som alt er lettuke. */
export function DeloadBanner() {
  const { exercises, finished, settings, deloadWeeks } = useData();
  const [hidden, setHidden] = useState(dismissedRecently);
  const week = weekStartKey(new Date());
  const advice = useMemo(() => deloadAdvice(exercises, finished, settings.thresholds), [exercises, finished, settings.thresholds]);
  if (hidden || !advice.suggest || deloadWeeks.has(week)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Uten lagring skjules forslaget bare til appen lastes på nytt.
    }
    setHidden(true);
  };
  return (
    <section className="card deload-banner" role="status">
      <h2 className="card-title-static">Forslag: ta en lettuke</h2>
      <ul className="plain-list small">
        {advice.signals
          .filter((s) => s.fired)
          .map((s) => (
            <li key={s.id}>{s.reason}.</li>
          ))}
      </ul>
      <p className="muted small">En lettuke har omtrent halvparten så mange sett, med samme vekt.</p>
      <div className="row-gap">
        <button className="btn btn-primary" onClick={() => void setWeekDeload(week, true)}>
          Marker uke {isoWeek(week)} som lettuke
        </button>
        <button className="btn" onClick={dismiss}>
          Ikke nå
        </button>
      </div>
    </section>
  );
}

// Skjematisk kropp sett forfra (venstre) og bakfra (høyre). Hver form hører til én muskelgruppe.
type Shape = { m?: Muscle; x: number; y: number; w: number; h: number; r?: number };
const SHAPES: Shape[] = [
  // Forfra
  { x: 42, y: 6, w: 16, h: 18, r: 8 },
  { m: 'side_delts', x: 21, y: 34, w: 7, h: 14, r: 3 },
  { m: 'side_delts', x: 72, y: 34, w: 7, h: 14, r: 3 },
  { m: 'front_delts', x: 29, y: 32, w: 10, h: 12, r: 4 },
  { m: 'front_delts', x: 61, y: 32, w: 10, h: 12, r: 4 },
  { m: 'chest', x: 34, y: 38, w: 15, h: 15, r: 4 },
  { m: 'chest', x: 51, y: 38, w: 15, h: 15, r: 4 },
  { m: 'biceps', x: 21, y: 50, w: 10, h: 24, r: 4 },
  { m: 'biceps', x: 69, y: 50, w: 10, h: 24, r: 4 },
  { m: 'forearms', x: 18, y: 77, w: 10, h: 26, r: 4 },
  { m: 'forearms', x: 72, y: 77, w: 10, h: 26, r: 4 },
  { m: 'core', x: 37, y: 56, w: 26, h: 34, r: 4 },
  { m: 'quads', x: 34, y: 95, w: 15, h: 44, r: 5 },
  { m: 'quads', x: 51, y: 95, w: 15, h: 44, r: 5 },
  { x: 36, y: 143, w: 11, h: 32, r: 4 },
  { x: 53, y: 143, w: 11, h: 32, r: 4 },
  // Bakfra
  { x: 142, y: 6, w: 16, h: 18, r: 8 },
  { m: 'side_delts', x: 121, y: 34, w: 7, h: 14, r: 3 },
  { m: 'side_delts', x: 172, y: 34, w: 7, h: 14, r: 3 },
  { m: 'rear_delts', x: 129, y: 32, w: 10, h: 12, r: 4 },
  { m: 'rear_delts', x: 161, y: 32, w: 10, h: 12, r: 4 },
  { m: 'upper_back', x: 139, y: 30, w: 22, h: 22, r: 4 },
  { m: 'lats', x: 134, y: 54, w: 15, h: 26, r: 4 },
  { m: 'lats', x: 151, y: 54, w: 15, h: 26, r: 4 },
  { m: 'triceps', x: 121, y: 50, w: 10, h: 24, r: 4 },
  { m: 'triceps', x: 169, y: 50, w: 10, h: 24, r: 4 },
  { m: 'forearms', x: 118, y: 77, w: 10, h: 26, r: 4 },
  { m: 'forearms', x: 172, y: 77, w: 10, h: 26, r: 4 },
  { m: 'glutes', x: 134, y: 83, w: 15, h: 16, r: 5 },
  { m: 'glutes', x: 151, y: 83, w: 15, h: 16, r: 5 },
  { m: 'hamstrings', x: 134, y: 102, w: 15, h: 37, r: 5 },
  { m: 'hamstrings', x: 151, y: 102, w: 15, h: 37, r: 5 },
  { m: 'calves', x: 136, y: 143, w: 11, h: 32, r: 4 },
  { m: 'calves', x: 153, y: 143, w: 11, h: 32, r: 4 },
];

function MuscleMap({ volume, max }: { volume: MuscleVolume[]; max: number }) {
  const total = new Map(volume.map((v) => [v.muscle, v.total]));
  return (
    <svg className="muscle-map" viewBox="0 0 200 182" role="img" aria-label="Muskelkart for uka, forfra og bakfra">
      {SHAPES.map((s, i) => {
        const value = s.m ? (total.get(s.m) ?? 0) : 0;
        const strength = value > 0 ? 0.25 + 0.75 * Math.min(1, value / max) : 0;
        return (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.r ?? 3}
            className={s.m ? 'muscle-shape' : 'muscle-body'}
            style={strength > 0 ? { fill: 'var(--accent)', fillOpacity: strength } : undefined}
          />
        );
      })}
      <text x="50" y="181" className="muscle-caption">
        Forfra
      </text>
      <text x="150" y="181" className="muscle-caption">
        Bakfra
      </text>
    </svg>
  );
}

/** Arbeidssett per muskelgruppe i en uke, med muskelkart. */
export function MuscleVolumeCard({ weekStart }: { weekStart: string }) {
  const { exercises, finished } = useData();
  const volume = useMemo(() => weeklyMuscleVolume(exercises, finished, weekStart), [exercises, finished, weekStart]);
  const trained = volume.filter((v) => v.total > 0).sort((a, b) => b.total - a.total);
  const max = Math.max(10, ...volume.map((v) => v.total));
  return (
    <section className="card">
      <h2 className="card-title-static">Volum per muskelgruppe, uke {isoWeek(weekStart)}</h2>
      {trained.length === 0 ? (
        <p className="muted small pad-x">Ingen arbeidssett er logget denne uka.</p>
      ) : (
        <>
          <MuscleMap volume={volume} max={max} />
          <ul className="muscle-list">
            {trained.map((v) => (
              <li key={v.muscle}>
                <span>{MUSCLE_LABEL[v.muscle]}</span>
                <span className="muscle-bar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, (v.total / max) * 100)}%` }} />
                </span>
                <strong className="tabular">{formatNumber(v.total)}</strong>
              </li>
            ))}
          </ul>
          <p className="muted small pad-x">
            Tallet er arbeidssett. Sett der muskelen er hovedmuskel teller fullt, og sett der den hjelper til teller
            halvt.
          </p>
        </>
      )}
    </section>
  );
}
