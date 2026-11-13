// Payroster service worker: keeps the app usable offline and lets new versions in.
const CACHE = 'payroster-2026.11.13-1036';
const SHELL = ['./', './index.html', './manifest.webmanifest', './lib/pdf.min.js', './lib/pdf.worker.min.js',
  './icons/icon5-192.png', './icons/icon5-512.png', './icons/icon5-mask-512.png', './icons/apple-touch-icon5.png'];
// big files of the 3D moving map: kept in their own cache across versions so they work in flight
const ASSETS = 'payroster-assets-1';
const BIG = ['./lib/three.min.js', './img/earth-day.jpg', './img/earth-night.jpg', './img/earth-bump.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
  caches.open(ASSETS).then(async c => { for(const u of BIG) if(!(await c.match(u))) try{ await c.add(u); }catch(err){} }); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== ASSETS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/version.json')) return; // always ask the network
  if (/open-meteo\.com$/.test(url.hostname)) return; // weather: always live, never cached
  if (/er-api\.com$/.test(url.hostname)) return; // exchange rates: live, kept by the app itself
  const isPage = e.request.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isPage) { // network first so a new version arrives as soon as there is signal
      try { const r = await fetch(e.request, { cache: 'no-store' }); if (r.ok) cache.put('./index.html', r.clone()); return r; }
      catch { return (await cache.match('./index.html')) || (await cache.match('./')); }
    }
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') cache.put(e.request, r.clone()); return r; }
    catch { return Response.error(); }
  })());
});
