// Service worker: lets the app be installed as a PWA and load faster on
// repeat visits, without ever serving an outdated version after a deploy.
//
//  - Page navigations: network first (always the latest deploy), falling back
//    to the cached app shell only when offline.
//  - /assets/*: cache first. Vite gives these content-hashed names, so a cached
//    file can never be stale.
//  - Everything else (Supabase API, signed paper downloads, fonts): untouched.
//
// Bump CACHE_VERSION to discard all old caches.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `paper-dispatch-${CACHE_VERSION}`;
const APP_SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(APP_SHELL, { cache: 'reload' })))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API calls, downloads, fonts

  // App pages: always try the network so users get the newest version
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy));
          }
          return response;
        })
        .catch(() => caches.match(APP_SHELL).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Hashed build assets never change, so cache them forever
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
