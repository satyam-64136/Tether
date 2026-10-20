/* ═════════════════════════════════════════════════════════════════
   tether-pages.js: automatic menu + smooth overlay for every sub-page.

   ADDING A NEW PAGE (a game, a tool, anything): put the .html file in the repo
   and add these lines inside its <head>. Nothing else. No index.html edit.

       <meta name="tether:page"  content="game">           game | tool | (any word)
       <meta name="tether:title" content="My New Game">
       <meta name="tether:icon"  content="g-ttt">           an icon name, see ICONS below
       <meta name="tether:blurb" content="One short line">   (optional)
       <meta name="tether:order" content="50">               (optional, lower = higher up)
       <meta name="tether:action" content="Play">            (optional: button verb; games default to "Play")

   How it finds pages: it asks GitHub for the list of .html files in your repo
   (the owner and repo name come from the site address, e.g. you.github.io/Tether),
   reads each file's tether:* tags, and builds the menu. The result is cached on
   the phone and refreshed in the background every few hours, so the menu appears
   instantly and a newly uploaded page shows up on its own. If GitHub can't be
   reached, the cached list (or the built-in list below) is used.

   How pages open: on top of the chat in a slide-up sheet (an iframe), so the chat
   never unloads, reconnects, or replays the intro. The page's back arrow and the
   phone's back button both just slide the sheet away.
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /*ICONS:START*/
  // Generated from games-ui.js (the single source of truth for icons). Do not edit here.
  const ICONS = {
    back: 'M15 18l-6-6 6-6',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    plus: 'M12 5v14M5 12h14',
    settings: 'M4 7h9M17 7h3M4 17h3M11 17h9|<circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    volume: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z|M15.5 9a4.5 4.5 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4',
    'volume-off': 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z|M16 9.5l5 5M21 9.5l-5 5',
    vibrate: '<rect x="8" y="3.5" width="8" height="17" rx="2.2"/>|M4.5 9v6M19.5 9v6',
    sparkle: 'M12 3c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5C9.1 9.8 11.3 7.6 12 3z|M19 16.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z',
    reset: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.4"/>|M8 11V8a4 4 0 0 1 8 0v3',
    send: 'M5 12h14M13 6l6 6-6 6',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
    help: '<circle cx="12" cy="12" r="9"/>|M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6M12 17h.01',
    star: 'F|M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8L12 3z',
    heart: 'F|M12 20.4s-7.6-4.5-7.6-10.2A4.4 4.4 0 0 1 12 7.7a4.4 4.4 0 0 1 7.6 2.5c0 5.7-7.6 10.2-7.6 10.2z',
    users: '<circle cx="9" cy="8" r="3.4"/>|M2.8 20a6.2 6.2 0 0 1 12.4 0|M16 4.8a3.4 3.4 0 0 1 0 6.4M17.6 14.4A6.2 6.2 0 0 1 21.4 20',
    bolt: 'M13 3L5.5 13.5H11L10 21l8.5-10.5H13L13 3z',
    swap: 'M17 3l4 4-4 4M21 7H8a4 4 0 0 0-4 4M7 21l-4-4 4-4M3 17h13a4 4 0 0 0 4-4',
    camera: 'M4 8h3l1.5-2.2h7L17 8h3v11.5H4V8z|<circle cx="12" cy="13.4" r="3.6"/>',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
    share: 'M12 15V4M8 7.5l4-4 4 4M6 11.5v8h12v-8',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.6"/>|M3.5 16l5-5 4 4 2.5-2.5 5.5 5.5|<circle cx="9" cy="9.5" r="1.4"/>',
    film: '<rect x="5" y="3.5" width="14" height="17" rx="2"/>|M5 8h3M5 12h3M5 16h3M16 8h3M16 12h3M16 16h3',
    timer: '<circle cx="12" cy="13.5" r="7"/>|M12 10v3.8l2.2 1.4M9.5 3.5h5',
    grid: 'M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17',
    // brand icons
    'g-ttt': 'M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17|M5.2 5.2l2.6 2.6M7.8 5.2L5.2 7.8|<circle cx="12" cy="12" r="1.9"/>',
    'g-fox': 'M4 4.5l4.2 3.3h7.6L20 4.5v8c0 4-3.6 7.5-8 7.5s-8-3.5-8-7.5v-8z|M9 12.4h.01M15 12.4h.01M10.8 16h2.4',
    'g-thought': 'M7 15.8a3.8 3.8 0 0 1-.4-7.5 5 5 0 0 1 9.5-.9 3.9 3.9 0 0 1 1.2 7.6 3.2 3.2 0 0 1-1.6.8H7z|<circle cx="7.4" cy="19.4" r="1.2"/><circle cx="4.8" cy="21.4" r=".7"/>',
    'g-dab': '<circle cx="5.5" cy="5.5" r="1.5"/><circle cx="18.5" cy="5.5" r="1.5"/><circle cx="5.5" cy="18.5" r="1.5"/><circle cx="18.5" cy="18.5" r="1.5"/>|M7.2 5.5h9.6M5.5 7.2v9.6M18.5 7.2v9.6|F|M12 8.9l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1z',
    'g-booth': 'M4 8h3l1.5-2.2h7L17 8h3v11.5H4V8z|<circle cx="12" cy="13.4" r="3.6"/>',
    trophy: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z|M7 5H4a1 1 0 0 0-1 1c0 2.5 1.5 4.5 4 5M17 5h3a1 1 0 0 1 1 1c0 2.5-1.5 4.5-4 5',
  };
  /*ICONS:END*/

  const DEFAULT_PAGES = [
    { file: 'wildguess.html',   type: 'game', title: 'WildGuess',        icon: 'g-fox',     blurb: 'Guess each other\'s animal', order: 10 },
    { file: 'tictactoe.html',   type: 'game', title: 'Tic Tac Toe',      icon: 'g-ttt',     blurb: 'Three in a row',             order: 20 },
    { file: 'whoami.html',      type: 'game', title: 'Who Am I To You',  icon: 'g-thought', blurb: 'Clues and guesses',          order: 30 },
    { file: 'dotsandboxes.html',type: 'game', title: 'Dots & Boxes',     icon: 'g-dab',     blurb: 'Close the boxes',            order: 40 },
    { file: 'photobooth.html',  type: 'tool', title: 'Photo Booth',      icon: 'g-booth',   blurb: 'Vintage film-strip collages', order: 10, action: 'Open' },
  ];
  const SECTION_LABEL = { game: 'Games', tool: 'Extras' };
  const SECTION_ORDER = ['game', 'tool'];
  const CACHE_KEY = 'tether:pages:v1';
  const TTL_MS = 6 * 60 * 60 * 1000;
  const SHARED_ASSETS = ['games.css', 'games-ui.js', 'games-live.js'];

  /* ───────────── icons ───────────── */
  function iconSvg(name) {
    const def = ICONS[name] || ICONS.sparkle;
    if (!def) return '';
    let filled = false, body = '';
    for (const p of def.split('|')) {
      if (p === 'F') { filled = true; continue; }
      body += p.charAt(0) === '<' ? p : '<path d="' + p + '"/>';
    }
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* ───────────── discovery ───────────── */
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  function readTags(html, file) {
    const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : 6000);
    const tags = {};
    const re = /<meta\s+([^>]*?)\/?>/gi;
    let m;
    while ((m = re.exec(head))) {
      const name = /name\s*=\s*["']tether:([a-z-]+)["']/i.exec(m[1]);
      const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(m[1]);
      if (name && content) tags[name[1].toLowerCase()] = decode(content[1] != null ? content[1] : content[2]);
    }
    if (!tags.page || !tags.title) return null;          // not a Tether page
    return {
      file, type: tags.page.toLowerCase(), title: tags.title, icon: tags.icon || 'sparkle',
      blurb: tags.blurb || '', order: +tags.order || 100, action: tags.action || '', section: tags.section || '',
    };
  }
  function repoGuess() {
    const tag = document.querySelector('meta[name="tether:repo"]');
    if (tag && tag.content.indexOf('/') > 0) return tag.content.split('/');
    if (global.TETHER_REPO && String(global.TETHER_REPO).indexOf('/') > 0) return String(global.TETHER_REPO).split('/');
    const host = location.hostname;
    if (/\.github\.io$/i.test(host)) {
      const owner = host.split('.')[0], repo = location.pathname.split('/').filter(Boolean)[0];
      if (owner && repo) return [owner, repo];
    }
    return null;
  }
  async function discover() {
    const repo = repoGuess();
    if (!repo) throw new Error('not on GitHub Pages');
    const res = await fetch('https://api.github.com/repos/' + repo[0] + '/' + repo[1] + '/contents/', { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub answered ' + res.status);
    const files = (await res.json()).filter((f) => f.type === 'file' && /\.html?$/i.test(f.name) && f.name !== 'index.html');
    const found = await Promise.all(files.map(async (f) => {
      try { const r = await fetch(f.name); return r.ok ? readTags(await r.text(), f.name) : null; }   // a page uploaded seconds ago may not be live yet; it appears next refresh
      catch (e) { return null; }
    }));
    return found.filter(Boolean);
  }
  function readCache() { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c && Array.isArray(c.pages) ? c : null; } catch (e) { return null; } }
  function writeCache(pages) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), pages })); } catch (e) { /* ignore */ } }

  /* ───────────── menu ───────────── */
  let mountSel = null, current = DEFAULT_PAGES;
  const sortPages = (a, b) => (a.order - b.order) || a.title.localeCompare(b.title);
  function sectionLabel(p) {
    if (p.section) return p.section;
    if (SECTION_LABEL[p.type]) return SECTION_LABEL[p.type];
    const t = p.type.charAt(0).toUpperCase() + p.type.slice(1);
    return /s$/.test(t) ? t : t + 's';
  }
  function render(pages) {
    current = pages;
    const host = mountSel && document.querySelector(mountSel);
    if (!host) return;
    const sig = JSON.stringify(pages);
    if (host.dataset.sig === sig) return;               // nothing changed: leave the DOM alone, no flicker
    host.dataset.sig = sig;
    host.style.display = 'contents';
    host.replaceChildren();
    const groups = new Map();
    pages.slice().sort(sortPages).forEach((p) => { const k = sectionLabel(p); if (!groups.has(k)) groups.set(k, { type: p.type, items: [] }); groups.get(k).items.push(p); });
    const keys = [...groups.keys()].sort((a, b) => {
      const ia = SECTION_ORDER.indexOf(groups.get(a).type), ib = SECTION_ORDER.indexOf(groups.get(b).type);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    for (const k of keys) {
      const sec = document.createElement('div');
      const ttl = document.createElement('div'); ttl.className = 'msec-ttl'; ttl.textContent = k; sec.appendChild(ttl);
      groups.get(k).items.forEach((p, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'wg-menu-btn tp-btn'; b.dataset.file = p.file;
        if (i) b.style.marginTop = '8px';
        const verb = p.action !== undefined && p.action !== '' ? p.action : (p.type === 'game' ? 'Play' : '');
        const ico = document.createElement('span'); ico.className = 'tp-ico'; ico.innerHTML = iconSvg(p.icon);
        const txt = document.createElement('span'); txt.className = 'tp-txt'; txt.textContent = (verb ? verb + ' ' : '') + p.title;
        if (p.blurb) { const s = document.createElement('small'); s.textContent = p.blurb; txt.appendChild(s); }
        b.append(ico, txt);
        b.addEventListener('click', () => open(p.file, p.title));
        sec.appendChild(b);
      });
      host.appendChild(sec);
    }
  }
  async function refresh() {
    try {
      const pages = await discover();
      if (!pages.length) return;                        // GitHub reachable but no page declares itself yet: keep what we have
      writeCache(pages); render(pages);
    } catch (e) { console.info('[tether-pages] keeping the saved list:', e.message || e); }
  }
  function mount(selector) {
    mountSel = selector;
    const cached = readCache();
    render(cached ? cached.pages : DEFAULT_PAGES);      // instant, from the phone's own memory
    if (!cached || Date.now() - cached.at > TTL_MS) refresh();
    warm();
  }

  /* ───────────── warm-up: fetch pages in the background so they open instantly ───────────── */
  let warmed = false;
  function warm() {
    if (warmed || (navigator.connection && navigator.connection.saveData)) return;
    warmed = true;
    const go = () => {
      const urls = SHARED_ASSETS.concat(current.map((p) => p.file));
      urls.forEach((u, i) => setTimeout(() => { fetch(u, { priority: 'low' }).catch(() => {}); }, i * 120));
    };
    (global.requestIdleCallback || ((f) => setTimeout(f, 1800)))(go);
  }

  /* ───────────── overlay ───────────── */
  const css = document.createElement('style');
  css.textContent = `
  .tp-btn .tp-ico{display:grid;place-items:center;flex:none;width:20px;color:var(--accent)}
  .tp-btn .tp-txt{display:flex;flex-direction:column;align-items:flex-start;text-align:left;line-height:1.25}
  .tp-btn .tp-txt small{font-size:11px;font-weight:500;color:var(--text2);margin-top:1px}
  .tp-ov{position:fixed;inset:0;z-index:5000;visibility:hidden;pointer-events:none;--tp-paper:#fff4e6;--tp-ink:#3b2a45}
  .tp-ov.dark{--tp-paper:#241a2d;--tp-ink:#fff1e4}
  .tp-ov.on{visibility:visible;pointer-events:auto}
  .tp-scrim{position:absolute;inset:0;background:rgba(30,15,40,0);transition:background .4s ease}
  .tp-ov.show .tp-scrim{background:rgba(30,15,40,.5)}
  .tp-sheet{position:absolute;inset:0;background:var(--tp-paper);transform:translate3d(0,100%,0);border-radius:28px 28px 0 0;overflow:hidden;
    transition:transform .46s cubic-bezier(.2,.9,.2,1),border-radius .46s ease;will-change:transform;box-shadow:0 -10px 40px rgba(0,0,0,.22)}
  .tp-ov.show .tp-sheet{transform:none;border-radius:0}
  .tp-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;opacity:0;transition:opacity .32s ease}
  .tp-ov.ready .tp-frame{opacity:1}
  .tp-load{position:absolute;inset:0;display:grid;place-items:center;transition:opacity .3s ease}
  .tp-ov.ready .tp-load{opacity:0;pointer-events:none}
  .tp-dots{display:flex;gap:9px}
  .tp-dots span{width:13px;height:13px;border-radius:50%;border:2px solid var(--tp-ink);background:#ff9cc0;animation:tpBounce 1s ease-in-out infinite}
  .tp-dots span:nth-child(2){background:#ffe27a;animation-delay:.12s}
  .tp-dots span:nth-child(3){background:#8ccfff;animation-delay:.24s}
  @keyframes tpBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}}
  .tp-note{position:absolute;z-index:6;top:max(10px,env(safe-area-inset-top));left:50%;max-width:min(92vw,26rem);display:flex;gap:8px;align-items:baseline;
    padding:9px 16px;border:0;border-radius:99px;cursor:pointer;background:#fff;color:#3b2a45;font:600 13px/1.3 'Geist',system-ui,sans-serif;
    box-shadow:0 8px 24px rgba(30,15,40,.28);transform:translate(-50%,-160%);transition:transform .38s cubic-bezier(.2,.9,.2,1)}
  .tp-note.on{transform:translate(-50%,0)}
  .tp-note b{color:#ff5f9e;white-space:nowrap}.tp-note span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tp-ov.dark .tp-note{background:#34263f;color:#fff1e4}
  @media (prefers-reduced-motion:reduce){.tp-sheet,.tp-scrim,.tp-frame{transition-duration:.01ms}.tp-dots span{animation:none}}`;
  document.head.appendChild(css);

  const handlers = {};   // messages a page can send the home screen: TetherPages.on('send-image', fn)
  let root = null, frame = null, opened = false, pushed = false, fallbackT = 0, hideT = 0;
  function isDark() {
    let pref = 'auto';
    try { pref = (JSON.parse(localStorage.getItem('tether:ui')) || {}).theme || 'auto'; } catch (e) { /* ignore */ }
    return pref === 'dark' || (pref === 'auto' && global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function build() {
    root = document.createElement('div');
    root.className = 'tp-ov'; root.id = 'tpOverlay';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="tp-scrim"></div><div class="tp-sheet"><div class="tp-load"><div class="tp-dots"><span></span><span></span><span></span></div></div></div>';
    root.querySelector('.tp-scrim').addEventListener('click', () => close());
    document.body.appendChild(root);
  }
  function relay() {
    if (!opened || !frame || !frame.contentWindow) return;
    const vv = global.visualViewport;
    frame.contentWindow.postMessage({ type: 'tether:vv', h: vv ? vv.height : innerHeight, top: vv ? vv.offsetTop : 0 }, location.origin);
  }
  function reveal() { if (!root) return; clearTimeout(fallbackT); relay(); root.classList.add('ready'); }

  function open(file, title) {
    if (opened) return;
    if (typeof api.onBeforeOpen === 'function') { try { api.onBeforeOpen(file); } catch (e) { /* the host page's hook must never block opening */ } }
    if (!root) build();
    clearTimeout(hideT);
    opened = true;
    root.setAttribute('aria-label', title || 'Page');
    root.classList.toggle('dark', isDark());
    root.classList.remove('ready', 'show');
    frame = document.createElement('iframe');
    frame.className = 'tp-frame'; frame.title = title || 'Page';
    frame.setAttribute('allow', 'camera; microphone; clipboard-write; web-share; autoplay');
    frame.addEventListener('load', () => { relay(); fallbackT = setTimeout(reveal, 900); });   // normally the page announces itself sooner
    frame.src = file;
    root.querySelector('.tp-sheet').appendChild(frame);
    root.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('show')));       // two frames: lets the browser commit the start position, so the slide-up animates
    try { history.pushState({ tetherOverlay: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
  }
  function hide() {
    if (!opened) return;
    opened = false; pushed = false;
    clearTimeout(fallbackT);
    root.classList.remove('show', 'ready');
    if (noteEl) noteEl.classList.remove('on');
    hideT = setTimeout(() => {                                              // after the slide-down finishes: free the page (sockets, camera, memory)
      root.classList.remove('on', 'dark');
      if (frame) { frame.src = 'about:blank'; frame.remove(); frame = null; }
    }, 520);
  }
  // A message arrived while a page is open: slide a small banner down over it. Tap it to go back to the chat.
  let noteEl = null, noteT = 0;
  function notify(title, body) {
    if (!opened || !root) return;
    if (!noteEl) {
      noteEl = document.createElement('button'); noteEl.type = 'button'; noteEl.className = 'tp-note';
      noteEl.setAttribute('role', 'status'); noteEl.innerHTML = '<b></b><span></span>';
      noteEl.addEventListener('click', () => close()); root.appendChild(noteEl);
    }
    noteEl.firstChild.textContent = title + ':'; noteEl.lastChild.textContent = body;
    noteEl.classList.add('on'); clearTimeout(noteT); noteT = setTimeout(() => noteEl.classList.remove('on'), 4500);
  }
  function close() {
    if (!opened) return;
    if (pushed && history.state && history.state.tetherOverlay) history.back();   // popstate below does the closing, and keeps the phone's back button in step
    else hide();
  }
  global.addEventListener('popstate', () => { if (opened) hide(); });
  global.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'tether:ready') reveal();
    else if (e.data.type === 'tether:close') close();
    else if (typeof e.data.type === 'string' && e.data.type.indexOf('tether:') === 0 && handlers[e.data.type.slice(7)]) handlers[e.data.type.slice(7)](e.data);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opened) close(); });
  if (global.visualViewport) { visualViewport.addEventListener('resize', relay); visualViewport.addEventListener('scroll', relay); }

  // onBeforeOpen: optional hook the host page can set (index.html uses it to close its menu panel)
  const api = { mount, refresh, open, close, readTags, on(type, fn) { handlers[type] = fn; }, notify, onBeforeOpen: null, get pages() { return current; }, get isOpen() { return opened; } };
  global.TetherPages = api;
})(window);
