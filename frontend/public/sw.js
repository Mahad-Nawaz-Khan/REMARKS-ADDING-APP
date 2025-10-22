const CACHE_NAME = 'addremarks-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json'
];

// Install: pre-cache the shell (only safe, static urls)
self.addEventListener('install', event => {
  self.skipWaiting(); // activate this SW immediately on install
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Don't try to cache server-rendered HTML like /index.html explicitly.
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: use cache-first for same-origin GET requests, fallback to network.
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin resources
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return; // allow browser to handle
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        // Optionally cache network responses for future navigations
        // but avoid caching opaque responses and large POST results.
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone).catch(() => {
              // ignore cache put failures (quota, etc.)
            });
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed; return cached root if available
        return caches.match('/').then(root => root || Promise.reject('no-cache'));
      });
    })
  );
});
