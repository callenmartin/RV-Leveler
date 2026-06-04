// Service Worker for RV Leveler PWA
// Required for Chrome to show the Install app prompt
// Caches the app for offline use

const CACHE_NAME = 'rv-leveler-v1';
const FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
