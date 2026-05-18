// AICO Ticket Sales — Service Worker
// Strategy: network-first for same-origin requests with cache fallback.
// Cross-origin requests (Firebase, CDN libraries) always go straight to network
// so the SDK and Firestore data stay fresh and Firebase's own offline cache handles outages.

const CACHE_NAME = 'aico-tickets-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch((err) => {
        // Don't fail install if a single resource is missing
        console.warn('Pre-cache partial failure:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass cross-origin requests entirely (Firebase, gstatic, jsdelivr, emailjs CDN).
  // Firebase's own persistence handles its offline story.
  if (url.origin !== location.origin) return;

  // Network-first with cache fallback for same-origin assets
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Cache successful, basic-typed responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});

// Allow the page to request immediate activation of a new worker
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
