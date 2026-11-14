// Enkel service worker: appen skal åpne og virke uten nett etter første besøk.
const CACHE = 'stige-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Siden sender en liste over filene den allerede har lastet, så de også havner i cachen.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'cache' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(event.data.urls).catch(() => undefined)));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Nett først for selve siden, slik at nye versjoner kommer inn. Cache når nettet mangler.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./').then((r) => r ?? Response.error())),
    );
    return;
  }

  // Filene har hash i navnet, så cache først er trygt.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
