// Payroster service worker: keeps the app usable offline and lets new versions in.
const CACHE = 'payroster-2026.11.06-2234';
const SHELL = ['./', './index.html', './manifest.webmanifest', './lib/pdf.min.js', './lib/pdf.worker.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/version.json')) return; // always ask the network
  const isPage = e.request.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isPage) { // network first so a new version arrives as soon as there is signal
      try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) cache.put('./index.html', r.clone()); return r; }
      catch { return (await cache.match('./index.html')) || (await cache.match('./')); }
    }
    const hit = await cache.match(e.request);
    if (hit) return hit;
    try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') cache.put(e.request, r.clone()); return r; }
    catch { return Response.error(); }
  })());
});
