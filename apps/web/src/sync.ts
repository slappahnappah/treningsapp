import { useSyncExternalStore } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Dexie from 'dexie';
import {
  syncOnce,
  type DiaryNote,
  type Exercise,
  type PushRow,
  type RemoteRow,
  type Routine,
  type SyncLocal,
  type SyncRecord,
  type SyncRemote,
  type Workout,
} from '@stige/core';
import { db } from './db';
import { SUPABASE_KEY, SUPABASE_URL } from './syncConfig';

// Synk mot Supabase. Appen virker som før uten innlogging og uten nett:
// alt lagres lokalt først, og synken går i bakgrunnen når den kan.

const LS_URL = 'stige.sync.url';
const LS_KEY = 'stige.sync.key';
const LS_CURSOR = 'stige.sync.cursor';
const SYNCED_KV = ['settings', 'deloadWeeks'];

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  },
  set: (k: string, v: string) => {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch {
      // ikke kritisk
    }
  },
};

export interface SyncState {
  configured: boolean;
  builtIn: boolean; // adressen ligger i koden og kan ikke endres i appen
  email: string | null;
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt: number | null;
  error: string | null;
}

let state: SyncState = {
  configured: false,
  builtIn: !!(SUPABASE_URL && SUPABASE_KEY),
  email: null,
  status: 'idle',
  lastSyncAt: null,
  error: null,
};
const listeners = new Set<() => void>();
function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

let client: SupabaseClient | null = null;
let userId: string | null = null;

function config(): { url: string; key: string } | null {
  const url = SUPABASE_URL || ls.get(LS_URL);
  const key = SUPABASE_KEY || ls.get(LS_KEY);
  return url && key ? { url, key } : null;
}

function connect(): void {
  const c = config();
  if (!c) {
    client = null;
    userId = null;
    setState({ configured: false, email: null });
    return;
  }
  client = createClient(c.url, c.key);
  setState({ configured: true });
  client.auth.onAuthStateChange((_event, session) => {
    const changed = userId !== (session?.user.id ?? null);
    userId = session?.user.id ?? null;
    setState({ email: session?.user.email ?? null });
    // Utenfor selve auth-kallet, som Supabase anbefaler.
    if (changed && userId) window.setTimeout(() => void syncNow(), 0);
  });
}

/** Lagrer adresse og nøkkel på enheten og kobler til på nytt. */
export function saveSyncConfig(url: string, key: string): void {
  ls.set(LS_URL, url.trim().replace(/\/+$/, ''));
  ls.set(LS_KEY, key.trim());
  connect();
}

function norwegian(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Feil e-post eller passord.';
  if (m.includes('email not confirmed')) return 'E-posten er ikke bekreftet ennå. Åpne lenken du fikk på e-post.';
  if (m.includes('already registered')) return 'Det finnes allerede en konto med denne e-posten. Logg inn i stedet.';
  if (m.includes('password should be')) return 'Passordet er for kort. Bruk minst 6 tegn.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Det er stengt for nye kontoer i Supabase-prosjektet.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Ingen kontakt med serveren. Sjekk nettet og adressen.';
  if (m.includes('relation') && m.includes('records')) return 'Tabellen mangler i Supabase. Kjør databaseskriptet fra oppsettet.';
  return message;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!client) return 'Synk er ikke satt opp.';
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  return error ? norwegian(error.message) : null;
}

/** Oppretter konto. Returnerer en melding når e-posten må bekreftes før innlogging. */
export async function signUp(email: string, password: string): Promise<{ error?: string; confirm?: boolean }> {
  if (!client) return { error: 'Synk er ikke satt opp.' };
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) return { error: norwegian(error.message) };
  return { confirm: !data.session };
}

/** Logger ut. Dataene blir liggende på enheten, men synktilstanden nullstilles. */
export async function signOut(): Promise<void> {
  // Bare denne enheten logges ut. Andre enheter forblir innlogget.
  await client?.auth.signOut({ scope: 'local' });
  await db.synced.clear();
  ls.set(LS_CURSOR, '');
  setState({ lastSyncAt: null, error: null, status: 'idle' });
}

// --- Lokal lagring sett fra synkmotoren ---

const local: SyncLocal = {
  async all() {
    const [exercises, workouts, routines, diary, kv] = await Promise.all([
      db.exercises.toArray(),
      db.workouts.toArray(),
      db.routines.toArray(),
      db.diary.toArray(),
      db.kv.bulkGet(SYNCED_KV),
    ]);
    const out: SyncRecord[] = [];
    for (const e of exercises) out.push({ kind: 'exercise', id: e.id, data: e });
    for (const w of workouts) out.push({ kind: 'workout', id: w.id, data: w });
    for (const r of routines) out.push({ kind: 'routine', id: r.id, data: r });
    for (const d of diary) out.push({ kind: 'diary', id: d.date, data: d });
    for (const row of kv) if (row) out.push({ kind: 'kv', id: row.key, data: row.value });
    return out;
  },
  async put({ kind, id, data }) {
    if (kind === 'exercise') await db.exercises.put(data as Exercise);
    else if (kind === 'workout') await db.workouts.put(data as Workout);
    else if (kind === 'routine') await db.routines.put(data as Routine);
    else if (kind === 'diary') await db.diary.put(data as DiaryNote);
    else if (kind === 'kv' && SYNCED_KV.includes(id)) await db.kv.put({ key: id, value: data });
  },
  async remove(kind, id) {
    if (kind === 'exercise') await db.exercises.delete(id);
    else if (kind === 'workout') await db.workouts.delete(id);
    else if (kind === 'routine') await db.routines.delete(id);
    else if (kind === 'diary') await db.diary.delete(id);
    else if (kind === 'kv' && SYNCED_KV.includes(id)) await db.kv.delete(id);
  },
  async getSynced() {
    return new Map((await db.synced.toArray()).map((r) => [r.key, r.print]));
  },
  async setSynced(changes) {
    const put: { key: string; print: string }[] = [];
    const del: string[] = [];
    for (const [key, print] of changes) {
      if (print === undefined) del.push(key);
      else put.push({ key, print });
    }
    await db.transaction('rw', db.synced, async () => {
      await db.synced.bulkPut(put);
      await db.synced.bulkDelete(del);
    });
  },
  async getCursor() {
    return ls.get(LS_CURSOR) || undefined;
  },
  async setCursor(cursor) {
    ls.set(LS_CURSOR, cursor);
  },
  // Økta som er i gang på denne enheten, skal ikke overskrives av serveren.
  isProtected: (r) => r.kind === 'workout' && !(r.data as Workout).endedAt,
};

// --- Supabase sett fra synkmotoren ---

const PAGE = 500;
const remote: SyncRemote = {
  async pull(cursor) {
    if (!client) return [];
    const rows: RemoteRow[] = [];
    let after = cursor;
    for (;;) {
      let q = client.from('records').select('kind,id,data,deleted,updated_at').order('updated_at').limit(PAGE);
      if (after) q = q.gt('updated_at', after);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      for (const r of data ?? []) {
        rows.push({ kind: r.kind, id: r.id, data: r.data, deleted: r.deleted, updatedAt: r.updated_at });
      }
      if (!data || data.length < PAGE) return rows;
      after = data[data.length - 1]!.updated_at as string;
    }
  },
  async push(rows: PushRow[]) {
    if (!client || !userId) throw new Error('Ikke innlogget.');
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((r) => ({ user_id: userId, kind: r.kind, id: r.id, data: r.data, deleted: r.deleted }));
      const { error } = await client.from('records').upsert(chunk, { onConflict: 'user_id,kind,id' });
      if (error) throw new Error(error.message);
    }
  },
};

// --- Kjøring ---

let running = false;
let again = false;

/** Kjører en synkrunde nå. Trygg å kalle når som helst: runder slås sammen. */
export async function syncNow(): Promise<void> {
  if (!client || !userId) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setState({ status: 'syncing' });
  try {
    await syncOnce(local, remote);
    setState({ status: 'idle', lastSyncAt: Date.now(), error: null });
  } catch (e) {
    setState({ status: 'error', error: norwegian((e as Error).message) });
  } finally {
    running = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

let timer: number | undefined;
function schedule(delayMs: number) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delayMs);
}

/** Starter synken: ved oppstart, når appen blir synlig, etter lokale endringer og hvert annet minutt. */
export function startSync(): void {
  connect();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(300);
  });
  window.addEventListener('online', () => schedule(300));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 120_000);
  // Lokale endringer: vent litt, så flere endringer sendes samlet.
  Dexie.on('storagemutated', (parts) => {
    if (running) return;
    const tables = Object.keys(parts).filter((k) => !k.includes('/synced'));
    if (tables.length > 0) schedule(2500);
  });
}
