import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  fingerprint,
  syncKey,
  syncOnce,
  type PushRow,
  type RemoteRow,
  type SyncLocal,
  type SyncRecord,
  type SyncRemote,
} from '../src';

/** Server i minnet: setter updatedAt selv, slik Supabase gjør. */
class FakeServer implements SyncRemote {
  rows = new Map<string, RemoteRow>();
  private clock = 0;
  failNextPush = false;
  private stamp() {
    return `2026-11-14T12:00:${String(++this.clock).padStart(6, '0')}Z`;
  }
  async pull(cursor: string | undefined): Promise<RemoteRow[]> {
    return [...this.rows.values()]
      .filter((r) => !cursor || r.updatedAt > cursor)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((r) => JSON.parse(JSON.stringify(r)) as RemoteRow);
  }
  async push(rows: PushRow[]): Promise<void> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('nettfeil');
    }
    for (const r of rows) {
      this.rows.set(syncKey(r.kind, r.id), { ...(JSON.parse(JSON.stringify(r)) as PushRow), updatedAt: this.stamp() });
    }
  }
}

class Device implements SyncLocal {
  records = new Map<string, SyncRecord>();
  synced = new Map<string, string>();
  cursor: string | undefined;
  constructor(seed: SyncRecord[] = []) {
    for (const r of seed) this.records.set(syncKey(r.kind, r.id), r);
  }
  set(kind: string, id: string, data: unknown) {
    this.records.set(syncKey(kind, id), { kind, id, data });
  }
  get(kind: string, id: string) {
    return this.records.get(syncKey(kind, id))?.data;
  }
  del(kind: string, id: string) {
    this.records.delete(syncKey(kind, id));
  }
  async all() {
    return [...this.records.values()];
  }
  async put(r: SyncRecord) {
    this.records.set(syncKey(r.kind, r.id), r);
  }
  async remove(kind: string, id: string) {
    this.records.delete(syncKey(kind, id));
  }
  async getSynced() {
    return new Map(this.synced);
  }
  async setSynced(changes: Map<string, string | undefined>) {
    for (const [k, v] of changes) v === undefined ? this.synced.delete(k) : this.synced.set(k, v);
  }
  async getCursor() {
    return this.cursor;
  }
  async setCursor(c: string) {
    this.cursor = c;
  }
  isProtected(r: SyncRecord) {
    return r.kind === 'workout' && !(r.data as { endedAt?: string }).endedAt;
  }
}

const seed = (): SyncRecord[] => [
  { kind: 'exercise', id: 'ex-squat', data: { name: 'Knebøy', rest: 180 } },
  { kind: 'routine', id: 'routine-a', data: { name: 'Økt A' } },
];

describe('fingeravtrykk', () => {
  it('er uavhengig av nøkkelrekkefølge og udefinerte felt', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe('{"a":[1,{"d":2}],"b":1}');
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1, c: undefined }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});

describe('synk', () => {
  it('første enhet sender alt, og en ny runde gjør ingenting', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    expect(await syncOnce(phone, server)).toEqual({ pulled: 0, pushed: 2 });
    expect(server.rows.size).toBe(2);
    expect(await syncOnce(phone, server)).toEqual({ pulled: 0, pushed: 0 });
  });

  it('ny enhet med startdata tar over det som ligger på serveren', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    phone.set('exercise', 'ex-squat', { name: 'Knebøy', rest: 240 });
    phone.set('workout', 'w1', { endedAt: 'x', sets: 3 });
    phone.del('routine', 'routine-a');
    await syncOnce(phone, server); // sender: endret øvelse og økt
    // Slettingen av startrutinen må også nå serveren som en sletting.
    const pc = new Device(seed());
    const r = await syncOnce(pc, server);
    expect(pc.get('exercise', 'ex-squat')).toEqual({ name: 'Knebøy', rest: 240 });
    expect(pc.get('workout', 'w1')).toEqual({ endedAt: 'x', sets: 3 });
    expect(r.pulled).toBe(2);
  });

  it('sletting på én enhet fjerner posten på den andre', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    const pc = new Device(seed());
    await syncOnce(phone, server);
    await syncOnce(pc, server);
    phone.del('routine', 'routine-a');
    await syncOnce(phone, server);
    expect(server.rows.get('routine:routine-a')?.deleted).toBe(true);
    await syncOnce(pc, server);
    expect(pc.get('routine', 'routine-a')).toBeUndefined();
    // Ingen ping-pong etterpå.
    expect(await syncOnce(pc, server)).toEqual({ pulled: 0, pushed: 0 });
    expect(await syncOnce(phone, server)).toEqual({ pulled: 0, pushed: 0 });
  });

  it('en startpost som er slettet på serveren, fjernes på en ny enhet', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    await syncOnce(phone, server);
    phone.del('routine', 'routine-a');
    await syncOnce(phone, server);
    const pc = new Device(seed());
    await syncOnce(pc, server);
    expect(pc.get('routine', 'routine-a')).toBeUndefined();
    expect(server.rows.get('routine:routine-a')?.deleted).toBe(true);
  });

  it('økter logget uten nett sendes opp og kommer fram til den andre enheten', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    const pc = new Device(seed());
    await syncOnce(phone, server);
    await syncOnce(pc, server);
    phone.set('workout', 'w1', { endedAt: 'x', sets: 3 });
    pc.set('diary', '2026-11-14', { text: 'Bra' });
    await syncOnce(phone, server);
    await syncOnce(pc, server);
    await syncOnce(phone, server);
    expect(pc.get('workout', 'w1')).toEqual({ endedAt: 'x', sets: 3 });
    expect(phone.get('diary', '2026-11-14')).toEqual({ text: 'Bra' });
  });

  it('egne endringer overskrives ikke av ekkoet fra forrige opplasting', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    await syncOnce(phone, server);
    phone.set('exercise', 'ex-squat', { name: 'Knebøy', rest: 90 });
    await syncOnce(phone, server);
    expect(phone.get('exercise', 'ex-squat')).toEqual({ name: 'Knebøy', rest: 90 });
    expect(server.rows.get('exercise:ex-squat')?.data).toEqual({ name: 'Knebøy', rest: 90 });
  });

  it('endret begge steder: serveren vinner', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    const pc = new Device(seed());
    await syncOnce(phone, server);
    await syncOnce(pc, server);
    pc.set('exercise', 'ex-squat', { name: 'Knebøy', rest: 200 });
    await syncOnce(pc, server);
    phone.set('exercise', 'ex-squat', { name: 'Knebøy', rest: 120 });
    await syncOnce(phone, server);
    expect(phone.get('exercise', 'ex-squat')).toEqual({ name: 'Knebøy', rest: 200 });
  });

  it('økta som er i gang overskrives ikke av serveren', async () => {
    const server = new FakeServer();
    const phone = new Device();
    const pc = new Device();
    phone.set('workout', 'w1', { sets: 1 });
    await syncOnce(phone, server);
    await syncOnce(pc, server);
    pc.set('workout', 'w1', { sets: 99 });
    await syncOnce(pc, server);
    phone.set('workout', 'w1', { sets: 2 });
    await syncOnce(phone, server);
    expect(phone.get('workout', 'w1')).toEqual({ sets: 2 });
    await syncOnce(pc, server);
    expect(pc.get('workout', 'w1')).toEqual({ sets: 2 });
  });

  it('slettet på serveren, men endret her: posten beholdes og sendes opp igjen', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    const pc = new Device(seed());
    await syncOnce(phone, server);
    await syncOnce(pc, server);
    pc.del('exercise', 'ex-squat');
    await syncOnce(pc, server);
    phone.set('exercise', 'ex-squat', { name: 'Knebøy', rest: 150 });
    await syncOnce(phone, server);
    expect(phone.get('exercise', 'ex-squat')).toEqual({ name: 'Knebøy', rest: 150 });
    expect(server.rows.get('exercise:ex-squat')?.deleted).toBe(false);
  });

  it('en avbrutt runde gjentas uten tap', async () => {
    const server = new FakeServer();
    const phone = new Device(seed());
    server.failNextPush = true;
    await expect(syncOnce(phone, server)).rejects.toThrow('nettfeil');
    expect(phone.synced.size).toBe(0);
    expect(await syncOnce(phone, server)).toEqual({ pulled: 0, pushed: 2 });
  });
});
