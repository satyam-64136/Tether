const CACHE = 'us-v4';
const BASE = '/Tether';
const ASSETS = [`${BASE}/`, `${BASE}/index.html`, `${BASE}/manifest.json`];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first fetch strategy
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

// Handle messages from the page
self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
    return;
  }

  // Show a notification directly (tab is hidden but page is open)
  if(e.data.type === 'SHOW_NOTIF'){
    self.registration.showNotification(e.data.title || 'us.', {
      body: e.data.body || '…',
      icon: `${BASE}/icon.png`,
      badge: `${BASE}/icon.png`,
      tag: 'us-message',          // replaces previous notif instead of stacking
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: `${BASE}/` }
    });
    return;
  }

  // Watch Supabase realtime channel for background push
  // When the page is fully closed, the SW keeps a polling interval
  if(e.data.type === 'WATCH_CHANNEL'){
    const { supabaseUrl, supabaseKey, currentUser } = e.data;
    startBgWatch(supabaseUrl, supabaseKey, currentUser);
    return;
  }

  if(e.data.type === 'STOP_WATCH'){
    stopBgWatch();
  }
});

// Notification click — focus or open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || `${BASE}/`;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for(const c of list){
        if(c.url.includes(BASE) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});

// ── BACKGROUND POLLING ──
// When app is closed, poll Supabase REST every 30s for new messages
let bgInterval = null;
let bgLastId = null;

function stopBgWatch(){
  if(bgInterval){ clearInterval(bgInterval); bgInterval = null; }
}

async function startBgWatch(url, key, currentUser){
  stopBgWatch(); // clear any existing
  // Run immediately then every 30s
  await bgPoll(url, key, currentUser);
  bgInterval = setInterval(() => bgPoll(url, key, currentUser), 30000);
}

async function bgPoll(url, key, currentUser){
  // Only fire when no clients are visible (app is truly in background/closed)
  const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const anyVisible = list.some(c => c.visibilityState === 'visible');
  if(anyVisible) return; // page is open and visible — it'll handle its own notifs

  try {
    const query = bgLastId
      ? `${url}/rest/v1/messages?select=id,sender,content,image_url,video,created_at&sender=neq.${encodeURIComponent(currentUser)}&seen=eq.false&id=gt.${bgLastId}&order=created_at.asc&limit=5`
      : `${url}/rest/v1/messages?select=id,sender,content,image_url,video,created_at&sender=neq.${encodeURIComponent(currentUser)}&seen=eq.false&order=created_at.desc&limit=1`;

    const res = await fetch(query, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
    if(!res.ok) return;
    const msgs = await res.json();
    if(!msgs || !msgs.length) return;

    for(const msg of msgs){
      if(!bgLastId || msg.id > bgLastId){
        bgLastId = msg.id;
        const body = msg.video ? '🎥 sent a video'
                   : msg.image_url ? '📷 sent a photo'
                   : msg.content || '…';
        await self.registration.showNotification(msg.sender, {
          body,
          icon: `${BASE}/icon.png`,
          badge: `${BASE}/icon.png`,
          tag: 'us-message',
          renotify: true,
          vibrate: [120, 60, 120],
          data: { url: `${BASE}/` }
        });
      }
    }
  } catch(err) {
    // Silently fail — no internet etc.
  }
}
