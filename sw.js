const CACHE_NAME = 'hahnter-arcade-v1';
const HUB_SHELL = './index.html';
const ASSETS = [
  './',
  './index.html',
  './hub.css',
  './manifest.webmanifest',
  './games/magikarp-flap/index.html',
  './games/magikarp-flap/style.css',
  './games/magikarp-flap/game.js',
  './games/magikarp-flap/manifest.webmanifest',
  './games/magikarp-flap/assets/underwater_background_tile.png',
  './games/magikarp-flap/assets/bubble.png',
  './games/magikarp-flap/assets/coral_obstacle_top.png',
  './games/magikarp-flap/assets/coral_obstacle_bottom.png',
  './games/magikarp-flap/assets/magikarp_pokeapi_129.png',
  './games/magikarp-flap/assets/tentacool_pokeapi_72.png',
  './games/magikarp-flap/assets/starmie_pokeapi_121.png',
  './games/magikarp-flap/assets/qwilfish_pokeapi_211.png',
  './games/magikarp-flap/assets/swimmy_fish_game.png',
  './games/magikarp-flap/assets/icon-192.png',
  './games/magikarp-flap/assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

// Navigations: network-first so updates land immediately, cached page as the
// offline fallback (each page falls back to its own cached copy, then the hub).
// Other GETs: network-first with cache fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        return cached || caches.match(HUB_SHELL) || new Response('Hahnter Arcade is not available offline yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached || new Response('Asset is not available offline yet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }));
    })
  );
});
