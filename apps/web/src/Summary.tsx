import { useMemo, useState } from 'react';
import { buildSummary, type SummaryTarget, type Workout } from '@stige/core';
import { useData } from './data';
import { ProgressList } from './Progress';
import { copyText, shareText } from './share';

const KEY = 'stige.summaryTarget';

function storedTarget(): SummaryTarget {
  try {
    return localStorage.getItem(KEY) === 'bevel' ? 'bevel' : 'whoop';
  } catch {
    return 'whoop';
  }
}

/** Kopierbart øktsammendrag, med navnene øvelsene har i Whoop eller Bevel. */
export function SummaryOverlay({ workout, onClose, finished }: { workout: Workout; onClose: () => void; finished?: boolean }) {
  const { exMap } = useData();
  const [target, setTargetState] = useState<SummaryTarget>(storedTarget);
  const [status, setStatus] = useState('');
  const text = useMemo(() => buildSummary(workout, (id) => exMap.get(id), { target }), [workout, exMap, target]);

  const setTarget = (t: SummaryTarget) => {
    setTargetState(t);
    setStatus('');
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // ikke kritisk
    }
  };
  const missing = workout.exercises.filter((we) => {
    const ex = exMap.get(we.exerciseId);
    return ex && !ex.externalNames[target]?.trim();
  });
  const missingNames = [...new Set(missing.map((we) => exMap.get(we.exerciseId)?.name))];

  return (
    <div className="overlay" role="dialog" aria-label="Øktsammendrag">
      <header className="overlay-head">
        <h2>{finished ? 'Økta er lagret' : 'Sammendrag'}</h2>
        <button className="btn" onClick={onClose}>
          Lukk
        </button>
      </header>
      <div className="overlay-scroll">
        <div className="seg seg-full">
          {(['whoop', 'bevel'] as SummaryTarget[]).map((t) => (
            <button key={t} className={`seg-item${target === t ? ' seg-on' : ''}`} onClick={() => setTarget(t)}>
              {t === 'whoop' ? 'Whoop' : 'Bevel'}
            </button>
          ))}
        </div>
        <pre className="summary-text">{text}</pre>
        <div className="grid-2">
          <button
            className="btn btn-primary"
            onClick={() => void copyText(text).then((ok) => setStatus(ok ? 'Kopiert.' : 'Kunne ikke kopiere. Marker teksten og kopier selv.'))}
          >
            Kopier
          </button>
          <button
            className="btn"
            onClick={() => void shareText(text).then((ok) => setStatus(ok ? '' : 'Deling er ikke støttet i denne nettleseren.'))}
          >
            Del
          </button>
        </div>
        <p className="muted small" role="status">
          {status}
        </p>
        {missingNames.length > 0 && (
          <p className="muted small">
            Mangler navn i {target === 'whoop' ? 'Whoop' : 'Bevel'}: {missingNames.join(', ')}. Det engelske navnet brukes
            i stedet. Navnene legger du inn under Innstillinger.
          </p>
        )}
        <h3>Progresjon mot forrige like økt</h3>
        <ProgressList workout={workout} />
      </div>
    </div>
  );
}
