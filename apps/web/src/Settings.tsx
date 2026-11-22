import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  defaultSettings,
  formatNumber,
  buildAiExport,
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
import { saveSyncConfig, signIn, signOut, signUp, syncNow, useSync } from './sync';
import { NumberField, Overlay, Sheet } from './ui';

const PLATE_CHOICES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const THRESHOLD_LABELS: [keyof Settings['thresholds'], string][] = [
  ['restDiffSec', 'Like økter: maks avvik i snittpause (sekunder)'],
  ['restDiffPct', 'Like økter: maks avvik i snittpause (prosent)'],
  ['rpeDiff', 'RPE-endring som teller som bedre eller dårligere'],
  ['trendSessions', 'Trend: antall like økter som regnes med'],
  ['trendProgressPctPerWeek', 'Trend: progresjon over (prosent per uke)'],
  ['trendPlateauPctPerWeek', 'Trend: platå innenfor (prosent per uke)'],
  ['trendPlateauWeeks', 'Trend: platå må vare minst (uker)'],
  ['trendDeclinePctPerWeek', 'Trend: nedgang under minus (prosent per uke)'],
  ['declineSessionsInRow', 'Trend: tilbakegang på rad som teller som nedgang (økter)'],
  ['deloadDeclineSharePct', 'Lettuke: andel øvelser med nedgang (prosent)'],
  ['deloadWindowDays', 'Lettuke: perioden andelen regnes over (dager)'],
  ['deloadMainLiftSessions', 'Lettuke: hovedøvelse med tilbakegang på rad (økter)'],
  ['deloadRpeSessions', 'Lettuke: økter RPE-stigningen måles over'],
  ['deloadWeeksSinceLast', 'Lettuke: uker siden forrige lettuke'],
  ['deloadSignalsNeeded', 'Lettuke: antall signaler som må slå ut'],
];

export function SettingsTab() {
  const { settings, active } = useData();
  const sync = useSync();
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
        <label className="field field-check">
          <span>Lyd også når telefonen står på lydløs</span>
          <input
            type="checkbox"
            checked={settings.soundOverMute ?? false}
            onChange={(e) => void saveSettings({ soundOverMute: e.target.checked })}
          />
        </label>
        <p className="muted small pad-x">
          Av (anbefalt): musikk og podkast spiller videre, og pipene legges oppå. Da følger pipene lydbryteren på iPhone,
          så de høres ikke når telefonen står på lydløs. På: pipene kommer også på lydløs, men musikk og podkast fra
          andre apper stopper mens økta pågår. Volumet følger volumknappene på telefonen.
        </p>
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

      <SyncSection />

      <AiExportSection />

      <BackupSection />

      <section className="card">
        <h2 className="card-title-static">Om</h2>
        <p className="muted small pad-x">
          Stige {__APP_VERSION__}.{' '}
          {sync.email ? 'Dataene ligger på denne enheten og synkes til kontoen din.' : 'Alle data ligger bare på denne enheten.'}
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

const AI_PERIODS: { id: string; label: string; months?: number }[] = [
  { id: 'new', label: 'Nytt siden sist' },
  { id: '3', label: '3 md', months: 3 },
  { id: '6', label: '6 md', months: 6 },
  { id: '12', label: '12 md', months: 12 },
  { id: 'all', label: 'Alt' },
];
const longDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

/** Eksport av treningsdata til en tekstfil som en AI-assistent kan lese. Appen selv bruker ingen AI. */
function AiExportSection() {
  const { exercises, workouts, settings, notes, deloadWeeks } = useData();
  const last = useLiveQuery(async () => ((await db.kv.get('aiExport'))?.value as { lastAt?: string } | undefined)?.lastAt ?? '', []);
  const [period, setPeriod] = useState('new');
  const [status, setStatus] = useState('');

  const from = (): string | undefined => {
    const p = AI_PERIODS.find((x) => x.id === period);
    if (p?.months) {
      const d = new Date();
      d.setMonth(d.getMonth() - p.months);
      return d.toISOString();
    }
    return period === 'new' && last ? last : undefined;
  };
  const build = () => {
    const input: Parameters<typeof buildAiExport>[0] = {
      exercises,
      workouts,
      diary: [...notes].map(([date, text]) => ({ date, text })),
      deloadWeeks: [...deloadWeeks],
      thresholds: settings.thresholds,
    };
    const f = from();
    if (f) input.from = f;
    return buildAiExport(input);
  };
  const preview = build();
  const done = async (what: string, count: number) => {
    // «Nytt siden sist» regnes fra dette tidspunktet neste gang.
    await db.kv.put({ key: 'aiExport', value: { lastAt: new Date().toISOString() } });
    setStatus(`${what} med ${count} ${count === 1 ? 'økt' : 'økter'}.`);
    setPeriod('new');
  };
  const save = async () => {
    const out = build();
    await saveFile(`stige-til-ai-${new Date().toISOString().slice(0, 10)}.txt`, out.text, 'text/plain');
    await done('Fila er laget', out.workouts);
  };
  const copy = async () => {
    const out = build();
    if (await copyText(out.text)) await done('Teksten er kopiert', out.workouts);
    else setStatus('Kunne ikke kopiere.');
  };

  return (
    <section className="card">
      <h2 className="card-title-static">Eksport til AI-assistent</h2>
      <p className="muted small pad-x">
        Lager en tekstfil med økter, sett, RPE, pauser, nivåer, trend, lettuker og dagboknotater. Fila kan lastes opp til
        for eksempel Claude eller Grok, som kan lese og vurdere treningen. Appen sender ingenting selv.
      </p>
      <p className="muted small pad-x">
        {last ? `Sist eksportert ${longDate.format(new Date(last))}.` : 'Ingen eksport er laget ennå, så «Nytt siden sist» tar med alt.'}
      </p>
      <div className="seg seg-wrap pad-x" role="group" aria-label="Periode for eksporten">
        {AI_PERIODS.map((p) => (
          <button
            key={p.id}
            className={`seg-item${period === p.id ? ' seg-on' : ''}`}
            aria-pressed={period === p.id}
            onClick={() => {
              setPeriod(p.id);
              setStatus('');
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted small pad-x">
        Valget gir {preview.workouts} {preview.workouts === 1 ? 'økt' : 'økter'} og {preview.sets} sett.
      </p>
      <button className="btn btn-wide" onClick={() => void save()}>
        Lag fil til AI-assistent
      </button>
      <button className="btn btn-wide" onClick={() => void copy()}>
        Kopier som tekst
      </button>
      <p className="muted small pad-x" role="status">
        {status}
      </p>
    </section>
  );
}

function BackupSection() {
  const { exercises, workouts, routines, settings, exMap } = useData();
  const sync = useSync();
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
        {sync.email
          ? 'Dataene synkes til kontoen din. En backup er likevel en ekstra sikkerhet. Lagre fila et trygt sted, for eksempel i iCloud Drive.'
          : 'Dataene ligger bare på denne enheten. Ta en backup med jevne mellomrom og lagre fila et trygt sted, for eksempel i iCloud Drive.'}
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

const syncTime = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function SyncSection() {
  const sync = useSync();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | null | undefined>) => {
    setBusy(true);
    setMessage('');
    try {
      setMessage((await fn()) ?? '');
    } finally {
      setBusy(false);
    }
  };
  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  return (
    <section className="card">
      <h2 className="card-title-static">Konto og synk</h2>

      {!sync.configured && (
        <>
          <p className="muted small pad-x">
            Logg inn for å få de samme dataene på alle enheter. Først må appen kobles til Supabase-prosjektet ditt. Lim inn
            adressen og den offentlige nøkkelen fra prosjektets innstillinger.
          </p>
          <label className="form-row">
            <span>Prosjektadresse (Project URL)</span>
            <input className="text" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="form-row">
            <span>Offentlig nøkkel (publishable eller anon key)</span>
            <input className="text" autoCapitalize="off" autoCorrect="off" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <button
            className="btn btn-primary btn-wide"
            disabled={!/^https:\/\/.+/.test(url.trim()) || key.trim().length < 20}
            onClick={() => saveSyncConfig(url, key)}
          >
            Koble til
          </button>
        </>
      )}

      {sync.configured && !sync.email && (
        <>
          <p className="muted small pad-x">
            Logg inn med e-post og passord. Dataene på denne enheten beholdes og slås sammen med det som ligger på kontoen.
          </p>
          <label className="form-row">
            <span>E-post</span>
            <input className="text" type="email" autoComplete="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="form-row">
            <span>Passord (minst 6 tegn)</span>
            <input className="text" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="grid-2">
            <button className="btn btn-primary" disabled={!canSubmit} onClick={() => void run(() => signIn(email, password))}>
              Logg inn
            </button>
            <button
              className="btn"
              disabled={!canSubmit}
              onClick={() =>
                void run(async () => {
                  const r = await signUp(email, password);
                  if (r.error) return r.error;
                  return r.confirm ? 'Kontoen er opprettet. Bekreft e-posten med lenken du fikk, og logg inn etterpå.' : null;
                })
              }
            >
              Opprett konto
            </button>
          </div>
          {!sync.builtIn && (
            <button className="btn btn-wide btn-quiet" onClick={() => saveSyncConfig('', '')}>
              Bytt Supabase-prosjekt
            </button>
          )}
        </>
      )}

      {sync.configured && sync.email && (
        <>
          <p className="pad-x">
            Innlogget som <strong>{sync.email}</strong>
          </p>
          <p className="muted small pad-x" role="status">
            {sync.status === 'syncing'
              ? 'Synker …'
              : sync.status === 'error'
                ? `Synken feilet: ${sync.error} Dataene ligger trygt på enheten, og appen prøver igjen.`
                : sync.lastSyncAt
                  ? `Sist synket ${syncTime.format(new Date(sync.lastSyncAt))}.`
                  : 'Ikke synket ennå.'}
          </p>
          <div className="grid-2">
            <button className="btn" disabled={sync.status === 'syncing'} onClick={() => void syncNow()}>
              Synk nå
            </button>
            <button className="btn" onClick={() => void run(async () => (await signOut(), 'Du er logget ut. Dataene ligger fortsatt på denne enheten.'))}>
              Logg ut
            </button>
          </div>
        </>
      )}

      <p className="muted small pad-x" role="status">
        {message}
      </p>
    </section>
  );
}
