const CACHE_NAME = 'magikarp-flap-v6';
const APP_SHELL = './index.html';
const ASSETS = [
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

async function appShellResponse() {
  const cache = await caches.open(CACHE_NAME);
  let cached = await cache.match(APP_SHELL);

  try {
    const response = await fetch(APP_SHELL, { cache: 'reload', redirect: 'follow' });
    if (response && response.ok) {
      const body = await response.clone().text();
      cached = new Response(body, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
      await cache.put(APP_SHELL, cached.clone());
    }
  } catch (error) {
    // Fall back to the cached shell below.
  }

  if (cached) {
    const body = await cached.clone().text();
    return new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }

  return new Response('Magikarp Flap is not available offline yet.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => appShellResponse())
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
    event.respondWith(appShellResponse());
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
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }));
    })
  );
});
