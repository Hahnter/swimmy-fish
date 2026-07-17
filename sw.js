const CACHE_NAME = 'hahnter-arcade-v4';
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
  './games/magikarp-flap/assets/screenshot.png',
  './games/magikarp-flap/assets/icon-192.png',
  './games/magikarp-flap/assets/icon-512.png',
  './games/starmie-breaker/index.html',
  './games/starmie-breaker/style.css',
  './games/starmie-breaker/game.js',
  './games/starmie-breaker/manifest.webmanifest',
  './games/starmie-breaker/assets/underwater_background_tile.png',
  './games/starmie-breaker/assets/starmie_pokeapi_121.png',
  './games/starmie-breaker/assets/bubble.png',
  './games/starmie-breaker/assets/screenshot.png',
  './games/starmie-breaker/assets/icon-192.png',
  './games/starmie-breaker/assets/icon-512.png',
  './games/reel-em-all/index.html',
  './games/reel-em-all/style.css',
  './games/reel-em-all/game.js',
  './games/reel-em-all/manifest.webmanifest',
  './games/reel-em-all/assets/underwater_background_tile.png',
  './games/reel-em-all/assets/bubble.png',
  './games/reel-em-all/assets/magikarp_pokeapi_129.png',
  './games/reel-em-all/assets/poliwag_pokeapi_60.png',
  './games/reel-em-all/assets/goldeen_pokeapi_118.png',
  './games/reel-em-all/assets/horsea_pokeapi_116.png',
  './games/reel-em-all/assets/shellder_pokeapi_90.png',
  './games/reel-em-all/assets/starmie_pokeapi_121.png',
  './games/reel-em-all/assets/gyarados_pokeapi_130.png',
  './games/reel-em-all/assets/lapras_pokeapi_131.png',
  './games/reel-em-all/assets/tentacool_pokeapi_72.png',
  './games/reel-em-all/assets/qwilfish_pokeapi_211.png',
  './games/reel-em-all/assets/screenshot.png',
  './games/reel-em-all/assets/icon-192.png',
  './games/reel-em-all/assets/icon-512.png'
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
