const CACHE = 'us-v12';
// Where the app lives, worked out from this file's own address instead of being typed in:
//   https://you.github.io/Tether/sw.js  ->  BASE = '/Tether'
//   https://tether.example.com/sw.js    ->  BASE = ''   (the site root, e.g. a custom domain)
const BASE = new URL('./', self.location).pathname.replace(/\/$/, '');

// Links that arrive from outside (an old notification, the push server) may still say /Tether/...
// Point them at wherever the app really is, and never at another site.
function appUrl(u) {
  try {
    const x = new URL(u, self.location.origin);
    if (x.origin !== self.location.origin) return `${BASE}/`;
    if (BASE !== '/Tether' && (x.pathname === '/Tether' || x.pathname.startsWith('/Tether/'))) {
      x.pathname = (BASE + x.pathname.slice('/Tether'.length)) || '/';
    }
    return x.href;
  } catch (e) { return `${BASE}/`; }
}
const ASSETS = [`${BASE}/`, `${BASE}/index.html`, `${BASE}/manifest.json`, `${BASE}/games.css`, `${BASE}/games-ui.js`, `${BASE}/games-live.js`, `${BASE}/tether-pages.js`, `${BASE}/tether-intro.js`];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Uploaded chat media (images, voice notes, videos) never changes once it's
// uploaded — a given Storage URL always points at the same bytes forever.
// There's no reason to ever re-fetch it from Supabase once we have a local
// copy. Re-fetching it anyway is exactly what blew through the 5GB/month
// cached-egress quota: every reopen of the chat re-downloaded every photo
// and voice note all over again instead of reusing what was already on
// the device.
function isStorageAsset(url){
  return url.pathname.includes('/storage/v1/object/');
}

// Live data: Supabase REST, RPC, auth and realtime. This must NEVER be cached or
// replayed from cache. The old catch-all handler stored every API response and,
// whenever the network blipped, answered with that stale copy as if it were
// current, so a game could silently roll back to an old board. Uploaded media
// (isStorageAsset) is the one Supabase thing that is safe to cache.
function isLiveApi(url){
  return url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in');
}

// Keep the media cache from growing forever. Cache Storage has no built-in
// size limit or eviction, so left alone it would just accumulate every photo
// and voice note either of you ever sent, indefinitely, taking up more and
// more space on-device. This keeps roughly the most-recently-fetched
// MAX_MEDIA_ENTRIES media files and quietly drops the oldest ones once that
// cap is hit — the app shell / API cache entries are untouched.
const MAX_MEDIA_ENTRIES = 300;
async function trimMediaCache(){
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const mediaKeys = keys.filter(req => isStorageAsset(new URL(req.url)));
  const excess = mediaKeys.length - MAX_MEDIA_ENTRIES;
  if(excess > 0){
    for(let i=0; i<excess; i++) await cache.delete(mediaKeys[i]);
  }
}

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if(isStorageAsset(url)){
    // Cache-first: serve instantly from disk if we've ever fetched this file
    // before, and only hit the network the very first time.
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(res => {
          if(res.ok){
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).then(trimMediaCache);
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Live API traffic goes straight to the network, untouched by the cache.
  if(isLiveApi(url)) return;

  // Everything else (app shell, game pages, scripts, fonts) is network-first,
  // with the cache as an offline fallback. Only good responses are stored.
  e.respondWith(
    fetch(e.request).then(res => {
      if(res && (res.ok || res.type === 'opaque')){
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// ── WEB PUSH ──
self.addEventListener('push', e => {
  if(!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title:'Tether', body: e.data.text() }; }

  e.waitUntil((async () => {
    const list = await clients.matchAll({ type:'window', includeUncontrolled:true });
    const anyVisible = list.some(c => c.visibilityState === 'visible');

    // ── RING PUSH ──
    if(data.type === 'ring'){
      // If app is already open and visible — tell it to ring directly
      if(anyVisible){
        list.forEach(c => c.postMessage({ type:'DO_RING', from: data.from }));
        return;
      }
      // App is closed or hidden — open it with ?ring=1 so it auto-rings on load
      const ringUrl = `${BASE}/?ring=1&from=${encodeURIComponent(data.from||'')}`;
      // Show a notification too so user sees something immediately
      await self.registration.showNotification('💌 ' + (data.from||'Tether'), {
        body: 'thinking of you',
        icon:  `${BASE}/icon.png`,
        badge: `${BASE}/icon.png`,
        tag: 'us-ring',
        renotify: true,
        vibrate: [300,100,300,100,300,100,300],
        silent: false,
        requireInteraction: true,   // stays on screen until tapped
        data: { url: ringUrl, type:'ring' }
      });
      // Also open the app immediately
      const openable = list.find(c => 'navigate' in c);
      if(openable){
        openable.navigate(ringUrl);
      } else {
        clients.openWindow(ringUrl);
      }
      return;
    }

    // ── NORMAL MESSAGE PUSH ──
    if(anyVisible) return;
    return self.registration.showNotification(data.title || 'Tether', {
      body: data.body || '…',
      icon:  `${BASE}/icon.png`,
      badge: `${BASE}/icon.png`,
      tag: 'us-message',
      renotify: true,
      vibrate: [200, 100, 200],
      silent: false,
      requireInteraction: false,
      data: { url: appUrl(data.url || `${BASE}/`) }
    });
  })());
});

// ── MESSAGES FROM PAGE ──
self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
    return;
  }

  if(e.data.type === 'SHOW_NOTIF'){
    e.waitUntil(
      clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
        const anyVisible = list.some(c => c.visibilityState === 'visible');
        if(anyVisible) return;
        return self.registration.showNotification(e.data.title || 'Tether', {
          body: e.data.body || '…',
          icon:  `${BASE}/icon.png`,
          badge: `${BASE}/icon.png`,
          tag: 'us-message',
          renotify: true,
          vibrate: [200, 100, 200],
          silent: false,
          requireInteraction: false,
          data: { url: `${BASE}/` }
        });
      })
    );
  }

  if(e.data.type === 'CLEAR_NOTIF'){
    self.registration.getNotifications().then(notifs => {
      notifs.forEach(n => n.close());
    });
  }
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = appUrl(e.notification.data?.url || `${BASE}/`);
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      // For ring notifications — focus or open with ring param
      for(const c of list){
        if(c.url.startsWith(self.location.origin) && 'focus' in c){
          // If it's a ring notif, navigate to ring URL
          if(e.notification.data?.type === 'ring'){
            c.navigate(target);
          }
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
