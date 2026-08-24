const CACHE_NAME = 'kripto-keyfi-shell-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pwa/icon-192.png', '/pwa/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isStaticAsset = ['style', 'script', 'image', 'font'].includes(event.request.destination);

  // Never cache authenticated, personal, or live financial data.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || (!isStaticAsset && event.request.mode !== 'navigate')) return;

  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))));
});
