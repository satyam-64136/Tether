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

  // Page is hidden — show notification via SW (routing all notifs through SW only)
  if(e.data.type === 'SHOW_NOTIF'){
    // Don't show if any window is currently visible (user is looking at the app)
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
    return;
  }

  // App fully closed — start background polling
  if(e.data.type === 'WATCH_CHANNEL'){
    const { supabaseUrl, supabaseKey, currentUser, latestMsgTs, lastActiveTs } = e.data;
    startBgWatch(supabaseUrl, supabaseKey, currentUser, latestMsgTs, lastActiveTs);
    return;
  }

  if(e.data.type === 'STOP_WATCH') stopBgWatch();

  // Page went hidden — update lastActiveTs so SW skips already-seen messages
  if(e.data.type === 'PAGE_HIDDEN'){
    bgLastActiveTs = e.data.ts || new Date().toISOString();
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

// ── BACKGROUND POLLING ──
let bgInterval = null;
// bgLastTs only ever moves forward — never reset to Date.now() on restart
// Initialised from the page via WATCH_CHANNEL (latest message ts the user has seen)
let bgLastTs = null;
// lastActiveTs — set by page when app goes hidden, used to skip already-seen messages
let bgLastActiveTs = null;
let bgCreds = null;

function stopBgWatch(){
  if(bgInterval){ clearInterval(bgInterval); bgInterval = null; }
}

function startBgWatch(url, key, currentUser, latestMsgTs, lastActiveTs){
  bgCreds = { url, key, currentUser };
  // Only move bgLastTs forward, never backward, never to Date.now()
  if(latestMsgTs && (!bgLastTs || latestMsgTs > bgLastTs)){
    bgLastTs = latestMsgTs;
  }
  // If we have no baseline at all, use the passed timestamp or a safe fallback
  if(!bgLastTs) bgLastTs = latestMsgTs || new Date().toISOString();
  // lastActiveTs: page tells us when the user was last active
  if(lastActiveTs) bgLastActiveTs = lastActiveTs;
  stopBgWatch();
  bgInterval = setInterval(() => bgPoll(), 25000);
}

async function bgPoll(){
  if(!bgCreds) return;
  const { url, key, currentUser } = bgCreds;

  // If any window is currently visible, the page handles its own notifications — skip
  const list = await clients.matchAll({ type:'window', includeUncontrolled:true });
  const anyVisible = list.some(c => c.visibilityState === 'visible');
  if(anyVisible) return;

  try {
    // Use bgLastTs as the cutoff so we never re-notify old messages
    const ts = bgLastTs;

    const query = `${url}/rest/v1/messages`
      + `?select=id,sender,content,image_url,created_at,seen`
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
      // Always advance the watermark — even if we skip the notification
      if(msg.created_at > bgLastTs) bgLastTs = msg.created_at;

      // Skip if the user was active after this message was sent
      // (means they already saw it in the app)
      if(bgLastActiveTs && msg.created_at <= bgLastActiveTs) continue;

      // Double-check seen flag is still false before notifying
      if(msg.seen) continue;

      const isVid = isVideoUrl(msg.image_url);
      const body = isVid ? '🎥 sent a video'
                 : msg.image_url ? '📷 sent a photo'
                 : msg.content || '…';

      await self.registration.showNotification(msg.sender, {
        body,
        icon:  `${BASE}/icon.png`,
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
