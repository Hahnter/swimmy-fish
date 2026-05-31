const CACHE_NAME = 'magikarp-flap-v4';
const APP_SHELL = './index.html';
const ASSETS = [
  APP_SHELL,
  './style.css',
  './game.js',
  './manifest.webmanifest',
  './assets/underwater_background_tile.png',
  './assets/bubble.png',
  './assets/coral_obstacle_top.png',
  './assets/coral_obstacle_bottom.png',
  './assets/magikarp_pokeapi_129.png',
  './assets/tentacool_pokeapi_72.png',
  './assets/starmie_pokeapi_121.png',
  './assets/qwilfish_pokeapi_211.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(APP_SHELL).then((cached) => {
        const network = fetch(APP_SHELL, { cache: 'reload' })
          .then((response) => response && response.ok && !response.redirected ? response : cached)
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
