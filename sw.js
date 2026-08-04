// Service Worker for RV Leveler PWA
// Required for Chrome to show the Install app prompt.
//
// STRATEGY: network-first, cache fallback.
// The previous version was cache-first with a fixed cache name —
// once installed, the app served the install-time copy of
// index.html FOREVER and updates pushed to GitHub Pages never
// reached the phone. That caused the "I uploaded it but don't
// see the change" confusion. Network-first means you always get
// the latest when online; the cache only serves when offline.

const CACHE_NAME = 'rv-leveler-v2';   // bump this on breaking changes
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  // Take over immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Delete old cache versions (removes the stale v1 cache)
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME)
                      .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Keep the cache fresh with whatever we just fetched
        const copy = response.clone();
        caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy))
              .catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))  // offline → cached copy
  );
});
