const CACHE = 'us-v6';
const BASE = '/Tether';
const ASSETS = [`${BASE}/`, `${BASE}/index.html`, `${BASE}/manifest.json`];

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

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// ── WEB PUSH (from Supabase Edge Function) ──
self.addEventListener('push', e => {
  if(!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title:'us.', body: e.data.text() }; }

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      // Don't notify if user is actively looking at the app
      const anyVisible = list.some(c => c.visibilityState === 'visible');
      if(anyVisible) return;
      return self.registration.showNotification(data.title || 'us.', {
        body: data.body || '…',
        icon:  `${BASE}/icon.png`,
        badge: `${BASE}/icon.png`,
        tag: 'us-message',
        renotify: true,
        vibrate: [120, 60, 120],
        data: { url: data.url || `${BASE}/` }
      });
    })
  );
});

// ── MESSAGES FROM PAGE ──
self.addEventListener('message', e => {
  if(!e.data) return;

  // SW update
  if(e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
    return;
  }

  // Page hidden but still open — show notification immediately via SW
  if(e.data.type === 'SHOW_NOTIF'){
    e.waitUntil(
      clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
        const anyVisible = list.some(c => c.visibilityState === 'visible');
        if(anyVisible) return;
        return self.registration.showNotification(e.data.title || 'us.', {
          body: e.data.body || '…',
          icon:  `${BASE}/icon.png`,
          badge: `${BASE}/icon.png`,
          tag: 'us-message',
          renotify: true,
          vibrate: [120, 60, 120],
          data: { url: `${BASE}/` }
        });
      })
    );
  }
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || `${BASE}/`;
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for(const c of list){
        if(c.url.includes(BASE) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});
