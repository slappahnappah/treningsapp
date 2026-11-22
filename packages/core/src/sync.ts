// Synk mellom enheter. Ren logikk uten nett og database: appen kobler på
// lokal lagring (IndexedDB) og fjernlager (Supabase) gjennom to små grensesnitt.

export interface SyncRecord {
  kind: string; // exercise, workout, routine, diary, kv
  id: string;
  data: unknown;
}

export interface RemoteRow extends SyncRecord {
  deleted: boolean;
  updatedAt: string; // settes av serveren
}

export interface PushRow extends SyncRecord {
  deleted: boolean;
}

export interface SyncLocal {
  all(): Promise<SyncRecord[]>;
  put(record: SyncRecord): Promise<void>;
  remove(kind: string, id: string): Promise<void>;
  /** Nøkkel → fingeravtrykk av innholdet sist det var likt på enheten og serveren. */
  getSynced(): Promise<Map<string, string>>;
  setSynced(changes: Map<string, string | undefined>): Promise<void>;
  getCursor(): Promise<string | undefined>;
  setCursor(cursor: string): Promise<void>;
  /** Poster som ikke skal overskrives av serveren, for eksempel økta som er i gang. */
  isProtected?(record: SyncRecord): boolean;
  /**
   * Fingeravtrykk av det som er sendt, men der svaret ikke kom fram ennå. Lagres
   * før opplasting og tømmes etterpå, så et ekko av en opplasting der svaret ble
   * borte (appen lagt i bakgrunnen) ikke overskriver nyere endringer på enheten.
   */
  getPending?(): Promise<Map<string, string>>;
  setPending?(pending: Map<string, string>): Promise<void>;
}

export interface SyncRemote {
  /** Rader endret etter `cursor`, eldste først. */
  pull(cursor: string | undefined): Promise<RemoteRow[]>;
  push(rows: PushRow[]): Promise<void>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

export const syncKey = (kind: string, id: string) => `${kind}:${id}`;

/** JSON med sorterte nøkler, slik at samme innhold alltid gir samme tekst. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/** Kort fingeravtrykk av innholdet (FNV-1a over kanonisk JSON, pluss lengden). */
export function fingerprint(value: unknown): string {
  const text = canonicalJson(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}.${text.length.toString(36)}`;
}

/**
 * Én synkrunde: hent endringer fra serveren, deretter send lokale endringer.
 *
 * Regler når samme post er endret begge steder:
 * - En post enheten aldri har synket før: serveren vinner (første innlogging på en ny enhet).
 * - Serveren har slettet, enheten har endret siden sist: enheten vinner og posten sendes opp igjen.
 * - Begge har endret: serveren vinner, unntatt for beskyttede poster (økta som er i gang).
 */
export async function syncOnce(local: SyncLocal, remote: SyncRemote): Promise<SyncResult> {
  const synced = await local.getSynced();
  const pending = (await local.getPending?.()) ?? new Map<string, string>();
  const changes = new Map<string, string | undefined>();
  const mark = (key: string, value: string | undefined) => {
    changes.set(key, value);
    if (value === undefined) synced.delete(key);
    else synced.set(key, value);
  };

  // 1. Hent
  const cursor = await local.getCursor();
  const rows = await remote.pull(cursor);
  let localNow = new Map((await local.all()).map((r) => [syncKey(r.kind, r.id), r]));
  let pulled = 0;
  let newCursor = cursor;
  for (const row of rows) {
    const key = syncKey(row.kind, row.id);
    const mine = localNow.get(key);
    const known = synced.get(key);
    const dirty = mine !== undefined && known !== undefined && fingerprint(mine.data) !== known;
    const removedLocally = mine === undefined && known !== undefined;

    if (row.deleted) {
      if (dirty) {
        // Endret her etter at den ble slettet et annet sted: behold og send opp igjen.
        mark(key, undefined);
      } else {
        if (mine) {
          await local.remove(row.kind, row.id);
          localNow.delete(key);
          pulled++;
        }
        mark(key, undefined);
      }
    } else {
      const print = fingerprint(row.data);
      const keepMine = (dirty && mine && local.isProtected?.(mine)) || false;
      if (print !== known && pending.get(key) === print) {
        // Ekko av vår egen opplasting der svaret ble borte. Serveren har det vi sendte,
        // og endringer gjort her etterpå sendes opp i steg 2.
        mark(key, print);
      } else if (print === known) {
        // Serveren har det samme som ved forrige synk (ofte vårt eget ekko).
        // Lokale endringer og slettinger siden da sendes opp i steg 2.
      } else if (keepMine) {
        // Lokal versjon sendes opp i steg 2.
      } else if (removedLocally) {
        // Slettet her, endret på serveren: serveren vinner og posten kommer tilbake.
        await local.put({ kind: row.kind, id: row.id, data: row.data });
        localNow.set(key, { kind: row.kind, id: row.id, data: row.data });
        mark(key, print);
        pulled++;
      } else {
        if (!mine || fingerprint(mine.data) !== print) {
          await local.put({ kind: row.kind, id: row.id, data: row.data });
          localNow.set(key, { kind: row.kind, id: row.id, data: row.data });
          pulled++;
        }
        mark(key, print);
      }
    }
    if (!newCursor || row.updatedAt > newCursor) newCursor = row.updatedAt;
  }

  // 2. Send
  const push: PushRow[] = [];
  const after = new Map<string, string | undefined>();
  localNow = new Map((await local.all()).map((r) => [syncKey(r.kind, r.id), r]));
  for (const [key, rec] of localNow) {
    const print = fingerprint(rec.data);
    if (synced.get(key) !== print) {
      push.push({ ...rec, deleted: false });
      after.set(key, print);
    }
  }
  for (const key of synced.keys()) {
    if (!localNow.has(key)) {
      const i = key.indexOf(':');
      push.push({ kind: key.slice(0, i), id: key.slice(i + 1), data: null, deleted: true });
      after.set(key, undefined);
    }
  }
  if (push.length > 0) {
    if (local.setPending) {
      const next = new Map(pending);
      for (const [k, v] of after) if (v !== undefined) next.set(k, v);
      await local.setPending(next);
    }
    await remote.push(push);
    for (const [k, v] of after) changes.set(k, v);
  }

  // Lagre tilstanden først når alt har gått bra, så en avbrutt runde bare gjentas.
  if (changes.size > 0) await local.setSynced(changes);
  if (newCursor && newCursor !== cursor) await local.setCursor(newCursor);
  if (local.setPending && (pending.size > 0 || push.length > 0)) await local.setPending(new Map());
  return { pulled, pushed: push.length };
}
