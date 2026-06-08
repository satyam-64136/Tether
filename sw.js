const CACHE = 'us-v3';
// GitHub Pages subpath — adjust if repo name changes
const BASE = '/Tether';
const ASSETS = [`${BASE}/`, `${BASE}/index.html`, `${BASE}/manifest.json`];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => {
    return c.addAll(ASSETS).catch(()=>{}); // don't fail install if assets 404
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Network first — always latest code, cache as fallback
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
