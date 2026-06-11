const CACHE = 'us-v7';
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
  try { data = e.data.json(); } catch { data = { title:'Tether', body: e.data.text() }; }

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      const anyVisible = list.some(c => c.visibilityState === 'visible');
      if(anyVisible) return;
      return self.registration.showNotification(data.title || 'Tether', {
        body: data.body || '…',
        icon:  `${BASE}/icon.png`,
        badge: `${BASE}/icon.png`,
        tag: 'us-message',
        renotify: true,
        vibrate: [200, 100, 200],
        silent: false,          // ensure sound plays
        requireInteraction: false,
        data: { url: data.url || `${BASE}/` }
      });
    })
  );
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

  // Clear notification when app is opened and messages are read
  if(e.data.type === 'CLEAR_NOTIF'){
    self.registration.getNotifications({ tag:'us-message' }).then(notifs => {
      notifs.forEach(n => n.close());
    });
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
