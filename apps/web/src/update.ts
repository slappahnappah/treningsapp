import { useSyncExternalStore } from 'react';

// Oppdager at en nyere versjon av appen er publisert. En app på hjemskjermen
// lastes sjelden på nytt av seg selv, så brukeren får en knapp i stedet.

let available = false;
let lastCheck = 0;
const listeners = new Set<() => void>();

const scriptName = (html: string) => /assets\/index-[\w-]+\.js/.exec(html)?.[0];

async function check(): Promise<void> {
  if (available || !import.meta.env.PROD || Date.now() - lastCheck < 10 * 60_000) return;
  lastCheck = Date.now();
  try {
    const res = await fetch(`./index.html?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = scriptName(await res.text());
    const current = [...document.scripts].map((s) => scriptName(s.src)).find(Boolean);
    if (latest && current && latest !== current) {
      available = true;
      listeners.forEach((l) => l());
    }
  } catch {
    // Uten nett sjekker vi igjen senere.
  }
}

export function startUpdateCheck(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.setTimeout(() => void check(), 5000);
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => available,
  );
}
