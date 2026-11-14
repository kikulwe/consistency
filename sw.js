// Offline support. Every app file is cached when the app is installed, then served from the cache
// first (so it opens instantly and works with no signal) while a fresh copy is fetched in the
// background for next time. If you add a file to the app, add it to FILES below.
const CACHE = 'life-os-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
  './js/app.js', './js/home.js', './js/settings.js',
  './js/core/util.js', './js/core/store.js', './js/core/ui.js', './js/core/nav.js', './js/core/lock.js', './js/core/legacy.js',
  './js/modules/budget.js', './js/modules/tasks.js', './js/modules/gym.js', './js/modules/gym-data.js', './js/modules/gym-demo.js',
  './js/modules/style.js', './js/modules/consistency.js',
];
const fill = () => caches.open(CACHE).then(c => Promise.all(FILES.map(u => fetch(u, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); }))));

self.addEventListener('install', e => { e.waitUntil(fill().then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then(r => { if (r.ok) cache.put(key, r.clone()); return r; });
    if (hit) { fresh.catch(() => {}); return hit; }
    return fresh;
  })());
});
// Settings > "Check for updates" asks for every file to be downloaded again.
self.addEventListener('message', e => {
  if (e.data !== 'refresh') return;
  const port = e.ports[0];
  e.waitUntil(fill().then(() => port && port.postMessage({ ok: true }), () => port && port.postMessage({ ok: false })));
});
