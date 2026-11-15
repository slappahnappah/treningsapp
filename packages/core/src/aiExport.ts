import { dateKey } from './dates';
import { levelLabel } from './defaults';
import { formatNumber } from './format';
import type { DiaryNote, Exercise, ProgressionThresholds, SetEntry, Workout } from './model';
import { MUSCLE_LABEL, musclesFor } from './muscles';
import { exerciseHistory } from './records';
import { exerciseTrend } from './trend';

export interface AiExportInput {
  exercises: Exercise[];
  workouts: Workout[];
  diary: DiaryNote[];
  deloadWeeks: string[];
  thresholds: ProgressionThresholds;
  /** Bare økter og notater fra og med dette tidspunktet (ISO). Uten verdi tas alt med. */
  from?: string;
  now?: Date;
}

export interface AiExport {
  text: string;
  workouts: number;
  sets: number;
}

const TYPE_TEXT: Record<Exercise['type'], string> = {
  weight_reps: 'vekt × reps',
  bodyweight: 'kroppsvekt (kg er ekstravekt)',
  assisted: 'assistert (kg er assistanse, mindre er tyngre)',
  time: 'hold i sekunder',
  level: 'progresjonsnivå',
};
const KIND_TEXT: Record<SetEntry['kind'], string> = {
  warmup: 'oppvarming',
  working: 'arbeidssett',
  drop: 'drop set',
  failure: 'til failure',
};
const TREND_TEXT = { progress: 'progresjon', plateau: 'platå', decline: 'nedgang', unclear: 'uklart' } as const;

const oneLine = (text: string) => text.trim().replace(/\s*\n\s*/g, ' / ');

function setLine(exercise: Exercise, s: SetEntry): string {
  const parts: string[] = [KIND_TEXT[s.kind]];
  if (s.side) parts.push(s.side === 'left' ? 'venstre' : 'høyre');
  const level = exercise.levels?.find((l) => l.id === s.levelId);
  if (level) parts.push(levelLabel(level));
  if (s.weightKg != null) parts.push(`${exercise.type === 'weight_reps' ? '' : '+'}${formatNumber(s.weightKg)} kg`);
  if (s.assistanceKg != null) parts.push(`assistanse ${formatNumber(s.assistanceKg)} kg`);
  if (s.reps != null) parts.push(`${s.reps} reps`);
  if (s.durationSec != null) parts.push(`${s.durationSec} s`);
  if (s.rpe != null) parts.push(`RPE ${formatNumber(s.rpe)}`);
  if (s.restBeforeSec != null) parts.push(`pause før ${s.restBeforeSec} s`);
  return parts.join(', ');
}

/**
 * Treningsdata som ren tekst, skrevet for at en AI-assistent skal kunne lese og
 * vurdere dem. Appen selv bruker ingen AI. Fila lages og deles av brukeren.
 */
export function buildAiExport(input: AiExportInput): AiExport {
  const now = input.now ?? new Date();
  const from = input.from;
  const exMap = new Map(input.exercises.map((e) => [e.id, e]));
  const finished = input.workouts.filter((w) => w.endedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  // Økta regnes med når den ble avsluttet i perioden, så en økt som var i gang ved forrige eksport ikke faller ut.
  const inPeriod = finished.filter((w) => !from || (w.endedAt ?? w.startedAt) >= from);
  const fromDay = from ? dateKey(from) : undefined;
  const notes = input.diary
    .filter((d) => d.text.trim() && (!fromDay || d.date >= fromDay))
    .sort((a, b) => a.date.localeCompare(b.date));
  const deloads = input.deloadWeeks.filter((w) => !fromDay || w >= fromDay).sort();

  const out: string[] = [];
  out.push('# Treningsdata fra Stige');
  out.push('');
  out.push(`Eksportert: ${dateKey(now)}`);
  out.push(
    from
      ? `Periode: fra og med ${dateKey(from)} til og med ${dateKey(now)}. Eldre økter er ikke med i denne fila.`
      : `Periode: all historikk til og med ${dateKey(now)}.`,
  );
  out.push(`Antall økter i perioden: ${inPeriod.length}`);
  out.push('');
  out.push('## Slik leses fila');
  out.push('');
  out.push('- Fila er laget av styrketreningsappen Stige og er ment for vurdering av en AI-assistent.');
  out.push('- Hver økt lister øvelsene i rekkefølgen de ble gjort, med ett sett per linje.');
  out.push('- Vekt er i kg. «+ kg» er ekstravekt på kroppsvektøvelser. Assistanse er kg avlastning.');
  out.push('- RPE er opplevd anstrengelse fra 6 til 10. 10 betyr ingen reps igjen, 8 betyr to reps igjen.');
  out.push('- P1, P2 og så videre er progresjonsnivåer i kroppsvektøvelser. Høyere tall er vanskeligere.');
  out.push('- «Pause før» er målt pause i sekunder før settet.');
  out.push('- Lettuke betyr en planlagt lett uke (deload). Slike økter skal ikke tolkes som tilbakegang.');
  out.push('- Bare sett som er haket av som fullført, er med.');
  out.push('- «Dagbok for økta» og «Kommentar» er utøverens egne ord om økta og om enkeltøvelser.');
  out.push('');

  // Øvelser som er brukt i perioden.
  const usedIds = [...new Set(inPeriod.flatMap((w) => w.exercises.map((we) => we.exerciseId)))];
  const used = usedIds.map((id) => exMap.get(id)).filter((e): e is Exercise => !!e);
  used.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  out.push('## Øvelser i perioden');
  out.push('');
  if (used.length === 0) out.push('Ingen.');
  for (const e of used) {
    const facts: string[] = [TYPE_TEXT[e.type]];
    if (e.type === 'level') facts.push(e.levelMetric === 'seconds' ? 'måles i sekunder' : 'måles i reps');
    if (e.unilateral) facts.push('én side om gangen');
    if (e.perHand) facts.push('vekt per hånd');
    if (e.isMainLift) facts.push('hovedøvelse');
    const m = musclesFor(e);
    if (m.direct.length) facts.push(`hovedmuskler: ${m.direct.map((x) => MUSCLE_LABEL[x]).join(', ')}`);
    if (m.indirect.length) facts.push(`hjelpemuskler: ${m.indirect.map((x) => MUSCLE_LABEL[x]).join(', ')}`);
    out.push(`- ${e.name}${e.nameEn && e.nameEn.toLowerCase() !== e.name.toLowerCase() ? ` (${e.nameEn})` : ''}: ${facts.join('; ')}`);
    if (e.levels?.length) {
      const levels = [...e.levels].sort((a, b) => a.order - b.order);
      out.push(`  Nivåer: ${levels.map((l) => `${levelLabel(l)}${l.description ? ` ${l.description}` : ''}`).join(', ')}`);
    }
    if (e.notes?.trim()) out.push(`  Notat: ${e.notes.trim().replace(/\s+/g, ' ')}`);
  }
  out.push('');

  // Regelbasert trend, regnet over hele historikken.
  out.push('## Trend per øvelse (regnet av appen over hele historikken)');
  out.push('');
  const trends: string[] = [];
  for (const e of used) {
    const trend = exerciseTrend(e, exerciseHistory(finished, e.id), input.thresholds);
    if (trend) trends.push(`- ${e.name}: ${TREND_TEXT[trend.status]}. ${trend.reason}.`);
  }
  out.push(...(trends.length ? trends : ['Ingen.']));
  out.push('');

  out.push('## Lettuker');
  out.push('');
  out.push(deloads.length ? deloads.map((w) => `- Uka som starter mandag ${w}`).join('\n') : 'Ingen uker er markert som lettuke i perioden.');
  out.push('');

  out.push('## Økter');
  out.push('');
  let sets = 0;
  if (inPeriod.length === 0) out.push('Ingen økter i perioden.');
  for (const w of inPeriod) {
    const start = new Date(w.startedAt);
    const minutes = Math.round((Date.parse(w.endedAt!) - start.getTime()) / 60000);
    const clock = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    out.push(`### ${dateKey(start)} kl. ${clock}, ${w.title ?? 'Økt'}, ${minutes} min${w.isDeload ? ', lettuke' : ''}`);
    out.push('');
    if (w.note?.trim()) {
      out.push(`Dagbok for økta: ${oneLine(w.note)}`);
      out.push('');
    }
    for (const we of [...w.exercises].sort((a, b) => a.order - b.order)) {
      const e = exMap.get(we.exerciseId);
      const done = we.sets.filter((s) => s.done);
      if (!e || done.length === 0) continue;
      out.push(`${e.name}${we.supersetGroup ? ' (supersett)' : ''}`);
      if (we.note?.trim()) out.push(`  Kommentar: ${oneLine(we.note)}`);
      done.forEach((s, i) => out.push(`  ${i + 1}. ${setLine(e, s)}`));
      sets += done.length;
    }
    out.push('');
  }

  out.push('## Dagboknotater');
  out.push('');
  if (notes.length === 0) out.push('Ingen notater i perioden.');
  for (const n of notes) out.push(`- ${n.date}: ${oneLine(n.text)}`);
  out.push('');

  return { text: out.join('\n'), workouts: inPeriod.length, sets };
}
