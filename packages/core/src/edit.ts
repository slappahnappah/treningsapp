import type { Exercise, SetEntry, Side } from './model';
import { pairPartner } from './rest';

/** Settet og partneren på den andre siden, i rekkefølgen de står. */
export function pairIds(sets: SetEntry[], setId: string): string[] {
  const pair = pairPartner(sets, setId);
  if (!pair) return sets.some((s) => s.id === setId) ? [setId] : [];
  return pair.isSecond ? [pair.partner.id, setId] : [setId, pair.partner.id];
}

/** Sorterer hvert par av venstre og høyre slik at `first` står først. Andre sett står urørt. */
export function orderSides(sets: SetEntry[], first: Side): SetEntry[] {
  const out = [...sets];
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i]!;
    const b = out[i + 1]!;
    if (a.side && b.side && a.side !== b.side) {
      if (a.side !== first) {
        out[i] = b;
        out[i + 1] = a;
      }
      i++;
    }
  }
  return out;
}

/**
 * Settene når en øvelse i økta byttes til en annen. Antall sett og settype beholdes.
 * Verdiene (kg, reps, sekunder, RPE og hake) beholdes bare når den nye øvelsen
 * logges på samme måte. Ellers tømmes settene, slik at ingenting blir feil.
 */
export function swapExerciseSets(
  from: Exercise,
  to: Exercise,
  sets: SetEntry[],
  newId: () => string,
  options: { levelId?: string; firstSide?: Side } = {},
): SetEntry[] {
  const sameShape = from.type === to.type && (from.type !== 'level' || from.levelMetric === to.levelMetric);
  const first = options.firstSide ?? 'left';
  const other: Side = first === 'left' ? 'right' : 'left';
  const levelFor = (s: SetEntry): string | undefined => {
    if (to.type !== 'level') return undefined;
    const order = from.levels?.find((l) => l.id === s.levelId)?.order;
    return (
      to.levels?.find((l) => l.order === order)?.id ?? options.levelId ?? [...(to.levels ?? [])].sort((a, b) => a.order - b.order)[0]?.id
    );
  };
  const convert = (s: SetEntry, side: Side | undefined, fresh: boolean): SetEntry => {
    const next: SetEntry = sameShape && !fresh ? { ...s } : { id: s.id, kind: s.kind, done: false };
    if (fresh) next.id = newId();
    delete next.levelId;
    delete next.side;
    const levelId = levelFor(s);
    if (levelId) next.levelId = levelId;
    if (side) next.side = side;
    return next;
  };

  // Logiske sett: et par av sider teller som ett.
  const out: SetEntry[] = [];
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]!;
    const pair = pairPartner(sets, s.id);
    if (pair && !pair.isSecond) {
      if (to.unilateral) out.push(convert(s, s.side, false), convert(pair.partner, pair.partner.side, false));
      else out.push(convert(s, undefined, false));
      i++;
    } else if (to.unilateral) {
      // Et sett uten side blir til et par. Et enslig sett med side beholder siden sin.
      if (s.side) out.push(convert(s, s.side, false));
      else out.push(convert(s, first, false), convert(s, other, true));
    } else {
      out.push(convert(s, undefined, false));
    }
  }
  return out;
}
