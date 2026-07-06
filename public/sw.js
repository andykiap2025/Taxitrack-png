// Safeco Taxi Service — service worker.
// Network-first with cache fallback: the app always gets fresh code when
// online, and the last-seen version still opens when offline.
const CACHE = 'safeco-taxi-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs — Supabase API calls pass straight through.
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((match) => {
          if (match) return match;
          if (request.mode === 'navigate') return caches.match('/');
          return Response.error();
        }),
      ),
  );
});
