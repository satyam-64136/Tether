const CACHE = 'us-v5';
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

// ── MESSAGES FROM PAGE ──
self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
    return;
  }

  // Page is hidden but still open — show notif directly
  if(e.data.type === 'SHOW_NOTIF'){
    self.registration.showNotification(e.data.title || 'us.', {
      body: e.data.body || '…',
      icon: `${BASE}/icon.png`,
      badge: `${BASE}/icon.png`,
      tag: 'us-message',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: `${BASE}/` }
    });
    return;
  }

  // App fully closed — start background polling
  if(e.data.type === 'WATCH_CHANNEL'){
    const { supabaseUrl, supabaseKey, currentUser } = e.data;
    // Store credentials so they survive SW restarts
    self._bgCreds = { supabaseUrl, supabaseKey, currentUser };
    startBgWatch(supabaseUrl, supabaseKey, currentUser);
    return;
  }

  if(e.data.type === 'STOP_WATCH') stopBgWatch();
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

// ── BACKGROUND POLLING ──
let bgInterval = null;
let bgLastTs = null;   // ISO timestamp of last notified message

function stopBgWatch(){
  if(bgInterval){ clearInterval(bgInterval); bgInterval = null; }
}

function startBgWatch(url, key, currentUser){
  stopBgWatch();
  // Set baseline timestamp to now so we only notify about NEW messages
  if(!bgLastTs) bgLastTs = new Date().toISOString();
  bgInterval = setInterval(() => bgPoll(url, key, currentUser), 25000);
}

async function bgPoll(url, key, currentUser){
  // If any window is visible the page handles its own notifs
  const list = await clients.matchAll({ type:'window', includeUncontrolled:true });
  const anyVisible = list.some(c => c.visibilityState === 'visible');
  if(anyVisible) return;

  try {
    // Correct Supabase REST filter syntax:
    // sender=neq.X  →  sender != X
    // seen=is.false →  seen is false (boolean)
    // created_at=gt.X → created_at > X
    const ts = bgLastTs || new Date().toISOString();
    const qs = new URLSearchParams({
      select: 'id,sender,content,image_url,created_at',
      'sender': `neq.${currentUser}`,
      'seen':   'is.false',
      'created_at': `gt.${ts}`,
      order: 'created_at.asc',
      limit: '5'
    });
    // Supabase REST needs filter operators as column=op.value in the URL
    // URLSearchParams doesn't handle this right — build manually
    const query = `${url}/rest/v1/messages?select=id,sender,content,image_url,created_at`
      + `&sender=neq.${encodeURIComponent(currentUser)}`
      + `&seen=is.false`
      + `&created_at=gt.${encodeURIComponent(ts)}`
      + `&order=created_at.asc&limit=5`;

    const res = await fetch(query, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if(!res.ok) return;
    const msgs = await res.json();
    if(!Array.isArray(msgs) || !msgs.length) return;

    for(const msg of msgs){
      // Update timestamp watermark
      if(!bgLastTs || msg.created_at > bgLastTs) bgLastTs = msg.created_at;

      const isVid = isVideoUrl(msg.image_url);
      const body = isVid ? '🎥 sent a video'
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
  } catch(err) {
    // No internet or DB error — silently skip
  }
}

function isVideoUrl(url){
  if(!url) return false;
  return /\.(mp4|mov|webm|mkv|avi|m4v)(\?|$)/i.test(url);
}
