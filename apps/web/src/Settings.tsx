import { useRef, useState } from 'react';
import {
  defaultSettings,
  formatNumber,
  makeBackup,
  parseBackup,
  workoutsToCsv,
  type Backup,
  type Exercise,
  type Settings,
} from '@stige/core';
import { restDoneSignal, unlockAudio } from './audio';
import { useData } from './data';
import { db, getDeloadWeeks, saveSettings, setRestTimer } from './db';
import { HoldClock } from './HoldClock';
import { copyText, saveFile } from './share';
import { NumberField, Overlay, Sheet } from './ui';

const PLATE_CHOICES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const THRESHOLD_LABELS: [keyof Settings['thresholds'], string][] = [
  ['restDiffSec', 'Like økter: maks avvik i snittpause (sekunder)'],
  ['restDiffPct', 'Like økter: maks avvik i snittpause (prosent)'],
  ['rpeDiff', 'RPE-endring som teller som bedre eller dårligere'],
];

export function SettingsTab() {
  const { settings, active } = useData();
  const [clock, setClock] = useState(false);
  const [names, setNames] = useState(false);
  const hold = settings.holdClock;
  const testRest = () => {
    unlockAudio();
    const now = Date.now();
    void setRestTimer({ startedAt: now, endsAt: now + 10_000, label: 'test' });
  };
  const togglePlate = (p: number) => {
    const has = settings.platesKg.includes(p);
    const next = has ? settings.platesKg.filter((x) => x !== p) : [...settings.platesKg, p];
    if (next.length > 0) void saveSettings({ platesKg: next.sort((a, b) => b - a) });
  };
  const setScheme = (scheme: Settings['warmupScheme']) => void saveSettings({ warmupScheme: scheme });

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
        <p className="muted small pad-x">
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
        <h2 className="card-title-static">Stang og plater</h2>
        <div className="field">
          <span>Stang (kg)</span>
          <div className="plate-input">
            <NumberField label="Stangvekt i kg" decimal value={settings.barKg} onChange={(v) => v != null && void saveSettings({ barKg: v })} />
          </div>
        </div>
        <p className="muted small pad-x">Plater du har tilgjengelig:</p>
        <div className="plates">
          {PLATE_CHOICES.map((p) => (
            <button
              key={p}
              className={`chip${settings.platesKg.includes(p) ? ' chip-on' : ''}`}
              aria-pressed={settings.platesKg.includes(p)}
              onClick={() => togglePlate(p)}
            >
              {formatNumber(p)}
            </button>
          ))}
        </div>
        <h3 className="pad-x">Oppvarmingsforslag</h3>
        <p className="muted small pad-x">Først stanga × 10, deretter disse trinnene av arbeidsvekten:</p>
        {settings.warmupScheme.map((step, i) => (
          <div className="scheme-row" key={i}>
            <NumberField
              label="Prosent av arbeidsvekten"
              value={step.percent}
              onChange={(v) => v != null && setScheme(settings.warmupScheme.map((s, j) => (j === i ? { ...s, percent: v } : s)))}
            />
            <span className="muted">% ×</span>
            <NumberField
              label="Reps"
              value={step.reps}
              onChange={(v) => v != null && setScheme(settings.warmupScheme.map((s, j) => (j === i ? { ...s, reps: v } : s)))}
            />
            <span className="muted">reps</span>
            <button className="icon-btn" aria-label="Fjern trinnet" onClick={() => setScheme(settings.warmupScheme.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn btn-wide btn-quiet" onClick={() => setScheme([...settings.warmupScheme, { percent: 90, reps: 1 }])}>
          + Trinn
        </button>
      </section>

      <section className="card">
        <h2 className="card-title-static">Navn i Whoop og Bevel</h2>
        <p className="muted small pad-x">
          Sammendraget bruker navnet øvelsen har i den appen du limer inn i. Uten navn brukes det engelske navnet.
        </p>
        <button className="btn btn-wide" onClick={() => setNames(true)}>
          Rediger navn
        </button>
      </section>

      <section className="card">
        <h2 className="card-title-static">Progresjon</h2>
        {THRESHOLD_LABELS.map(([key, label]) => (
          <div className="field" key={key}>
            <span className="small">{label}</span>
            <div className="plate-input">
              <NumberField
                label={label}
                decimal
                value={settings.thresholds[key]}
                onChange={(v) => v != null && void saveSettings({ thresholds: { ...settings.thresholds, [key]: v } })}
              />
            </div>
          </div>
        ))}
        <button className="btn btn-wide btn-quiet" onClick={() => void saveSettings({ thresholds: defaultSettings.thresholds })}>
          Tilbakestill til standard
        </button>
      </section>

      <BackupSection />

      <section className="card">
        <h2 className="card-title-static">Om</h2>
        <p className="muted small pad-x">
          Stige {__APP_VERSION__}. Alle data ligger bare på denne enheten.
          {active ? ' En økt er i gang.' : ''}
        </p>
      </section>

      {clock && <HoldClock title="Holdeklokke" subtitle="Test" onClose={() => setClock(false)} />}
      {names && <NamesOverlay onClose={() => setNames(false)} />}
    </div>
  );
}

function NamesOverlay({ onClose }: { onClose: () => void }) {
  const { exercises } = useData();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [status, setStatus] = useState('');
  const active = exercises.filter((e) => !e.archived);
  const missing = (app: 'whoop' | 'bevel') => active.filter((e) => !e.externalNames[app]?.trim());
  const list = onlyMissing ? active.filter((e) => !e.externalNames.whoop?.trim() || !e.externalNames.bevel?.trim()) : active;

  const update = (e: Exercise, app: 'whoop' | 'bevel', value: string) => {
    const next = { ...e.externalNames };
    if (value.trim()) next[app] = value;
    else delete next[app];
    void db.exercises.update(e.id, { externalNames: next });
  };
  const copyMissing = async (app: 'whoop' | 'bevel') => {
    const label = app === 'whoop' ? 'Whoop' : 'Bevel';
    const rows = missing(app).map((e) => `[ ] ${e.nameEn}`);
    const ok = await copyText(`Øvelser som må opprettes eller kobles i ${label}:\n${rows.join('\n')}`);
    setStatus(ok ? `Sjekklista for ${label} er kopiert (${rows.length} øvelser).` : 'Kunne ikke kopiere.');
  };

  return (
    <Overlay label="Navn i Whoop og Bevel">
      <header className="overlay-head">
        <h2>Navn i andre apper</h2>
        <button className="btn" onClick={onClose}>
          Lukk
        </button>
      </header>
      <div className="overlay-scroll form">
        <div className="grid-2">
          <button className="btn" onClick={() => void copyMissing('whoop')}>
            Kopier mangler i Whoop ({missing('whoop').length})
          </button>
          <button className="btn" onClick={() => void copyMissing('bevel')}>
            Kopier mangler i Bevel ({missing('bevel').length})
          </button>
        </div>
        <p className="muted small" role="status">
          {status}
        </p>
        <label className="field field-check">
          <span>Vis bare øvelser som mangler navn</span>
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
        </label>
        {list.map((e) => (
          <section className="card" key={e.id}>
            <strong className="pad-x">{e.name}</strong>
            <div className="grid-2 names-row">
              <label className="form-row">
                <span>Whoop</span>
                <input
                  className="text"
                  defaultValue={e.externalNames.whoop ?? ''}
                  placeholder={e.nameEn}
                  onChange={(ev) => update(e, 'whoop', ev.target.value)}
                />
              </label>
              <label className="form-row">
                <span>Bevel</span>
                <input
                  className="text"
                  defaultValue={e.externalNames.bevel ?? ''}
                  placeholder={e.nameEn}
                  onChange={(ev) => update(e, 'bevel', ev.target.value)}
                />
              </label>
            </div>
          </section>
        ))}
      </div>
    </Overlay>
  );
}

function BackupSection() {
  const { exercises, workouts, routines, settings, exMap } = useData();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [status, setStatus] = useState('');
  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportJson = async () => {
    const backup = makeBackup({
      exercises,
      workouts,
      routines,
      diary: await db.diary.toArray(),
      settings,
      deloadWeeks: await getDeloadWeeks(),
    });
    await saveFile(`stige-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };
  const exportCsv = () =>
    // BOM først, slik at Excel leser æ, ø og å riktig.
    saveFile(`stige-sett-${stamp()}.csv`, '﻿' + workoutsToCsv(workouts, (id) => exMap.get(id)), 'text/csv');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
      setStatus('');
    } catch (e) {
      setStatus((e as Error).message);
    }
    if (input.current) input.current.value = '';
  };

  const restore = async (b: Backup) => {
    await db.transaction('rw', [db.exercises, db.workouts, db.routines, db.diary, db.kv], async () => {
      await Promise.all([db.exercises.clear(), db.workouts.clear(), db.routines.clear(), db.diary.clear(), db.kv.clear()]);
      await db.exercises.bulkAdd(b.exercises);
      await db.workouts.bulkAdd(b.workouts);
      await db.routines.bulkAdd(b.routines);
      await db.diary.bulkAdd(b.diary);
      await db.kv.bulkAdd([
        { key: 'settings', value: b.settings },
        { key: 'deloadWeeks', value: b.deloadWeeks },
      ]);
    });
    setPending(null);
    setStatus('Backupen er lest inn.');
  };

  return (
    <section className="card">
      <h2 className="card-title-static">Backup</h2>
      <p className="muted small pad-x">
        Dataene ligger bare på denne enheten. Ta en backup med jevne mellomrom og lagre fila et trygt sted, for eksempel
        i iCloud Drive.
      </p>
      <button className="btn btn-wide" onClick={() => void exportJson()}>
        Eksporter backup (JSON)
      </button>
      <button className="btn btn-wide" onClick={() => void exportCsv()}>
        Eksporter alle sett til regneark (CSV)
      </button>
      <button className="btn btn-wide" onClick={() => input.current?.click()}>
        Les inn backup
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <p className="muted small pad-x" role="status">
        {status}
      </p>
      {pending && (
        <Sheet title="Lese inn backupen?" onClose={() => setPending(null)}>
          <p className="muted">
            Backupen fra {pending.exportedAt.slice(0, 10) || 'ukjent dato'} inneholder {pending.workouts.length} økter,{' '}
            {pending.exercises.length} øvelser og {pending.routines.length} rutiner. Alt som ligger i appen nå, blir
            erstattet. Dette kan ikke angres.
          </p>
          <button className="btn btn-danger btn-wide" onClick={() => void restore(pending)}>
            Erstatt alle data med backupen
          </button>
          <button className="btn btn-wide" onClick={() => setPending(null)}>
            Avbryt
          </button>
        </Sheet>
      )}
    </section>
  );
}
