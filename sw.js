const CACHE_NAME = 'magikarp-flap-v2';
const ASSETS = [
  './',
  './index.html',
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
