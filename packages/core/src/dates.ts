/** Lokal dato som YYYY-MM-DD. */
export function dateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dato fra YYYY-MM-DD, klokka 12 lokal tid (unngår problemer med sommertid). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Mandagen i uka som datoen ligger i, som YYYY-MM-DD. */
export function weekStartKey(date: Date | string): string {
  const key = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dateKey(date);
  const d = fromDateKey(key);
  const weekday = (d.getDay() + 6) % 7; // mandag = 0
  return addDays(key, -weekday);
}

/** ISO-ukenummer. */
export function isoWeek(key: string): number {
  const d = fromDateKey(key);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(thursday.getFullYear(), 0, 4, 12);
  const jan4Monday = new Date(jan4);
  jan4Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  return 1 + Math.round((thursday.getTime() - jan4Monday.getTime() - 3 * 86400000) / (7 * 86400000));
}

/** Ukene (mandag–søndag) som dekker en måned. Hver uke er sju datonøkler. */
export function monthGrid(year: number, month0: number): string[][] {
  const first = dateKey(new Date(year, month0, 1, 12));
  const last = dateKey(new Date(year, month0 + 1, 0, 12));
  const weeks: string[][] = [];
  let start = weekStartKey(first);
  while (start <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    start = addDays(start, 7);
  }
  return weeks;
}
