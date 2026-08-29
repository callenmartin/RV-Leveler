// Service Worker for RV Leveler PWA
// Required for Chrome to show the Install app prompt.
//
// STRATEGY: network-first WITH A TIMEOUT, cache fallback.
//
// Why the timeout matters
// ───────────────────────
// A plain network-first worker falls back to cache only when the
// fetch REJECTS. With no cell service a fetch often does not reject
// promptly — it hangs. Weak signal, or a campground wifi that is
// "connected" but has no route to the internet, can leave the
// request pending for 30+ seconds or effectively forever. The app
// appears to freeze on launch, which is precisely when you need it:
// parked at a campsite with no bars.
//
// Racing the fetch against a short timer fixes it. Online, the
// network almost always wins and you get the current version.
// Offline or on a bad connection, the timer wins after
// NETWORK_TIMEOUT_MS and the cached copy is served immediately.
//
// The app needs no network to function — Bluetooth is local, and
// there are no external fonts, scripts, or CDN resources. Once
// these files are cached the app is fully usable with the phone in
// airplane mode.
//
// History: the original version of this file was cache-first with a
// fixed cache name and no revalidation, which meant an installed
// PWA served the install-time copy forever and updates pushed to
// GitHub Pages never arrived on the phone. Do not go back to that.

const CACHE_NAME = 'rv-leveler-v3';     // bump on breaking changes
const NETWORK_TIMEOUT_MS = 2500;        // then serve from cache

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
  // Take over immediately rather than waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Drop older cache versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME)
                      .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch from the network, but give up after NETWORK_TIMEOUT_MS.
// Resolves with the network response, or rejects on timeout so the
// caller can fall back to cache.
function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')),
                             NETWORK_TIMEOUT_MS);
    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', event => {
  // Only handle GETs. Anything else goes straight to the network.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetchWithTimeout(event.request)
      .then(response => {
        // Refresh the cache with whatever we just fetched
        const copy = response.clone();
        caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy))
              .catch(() => {});
        return response;
      })
      .catch(() => {
        // Timed out or offline — serve the cached copy.
        // If this specific request was never cached, fall back to
        // index.html so a navigation still lands on the app rather
        // than a browser error page.
        return caches.match(event.request).then(hit => {
          if (hit) return hit;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline and not cached', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});
