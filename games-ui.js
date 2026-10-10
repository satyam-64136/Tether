/* ═════════════════════════════════════════════════════════════════
   games-ui.js: the shared UI layer for every Tether game and the photo booth.

   - Icons:    one SVG sprite (no emoji, no icon font). <svg class="i"><use href="#i-heart"/></svg>
   - Sound:    a small synth, no audio files. TetherUI.sfx.play('win')
   - Haptics:  TetherUI.haptic([20, 40, 20])
   - Settings: sound, volume, vibration, animations, theme. Saved on the device,
               shared by every game. TetherUI.mount({ extras: [...] }) adds the
               gear button and the settings sheet to any page.
   - Viewport: keeps the page exactly the size of what is visible, so it never
               scrolls, bounces or jumps when the keyboard opens.
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ───────────── preferences ───────────── */
  const KEY = 'tether:ui';
  const prefs = {
    sound: true, volume: 0.7, haptics: true,
    motion: !(global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
    theme: 'auto',
  };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* private mode */ }
  const listeners = new Set();

  function applyPrefs() {
    const r = document.documentElement;
    if (prefs.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', prefs.theme);
    r.setAttribute('data-motion', prefs.motion ? 'on' : 'off');
    if (master) master.gain.value = prefs.volume * 0.9;
  }
  function setPref(k, v) {
    prefs[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
    applyPrefs();
    listeners.forEach((f) => f(k, v));
  }

  /* ───────────── sound ───────────── */
  let ctx = null, master = null;
  function unlock() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = prefs.volume * 0.9; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => global.addEventListener(ev, unlock, { passive: true }));

  function tone(f, t, d, o) {
    o = o || {};
    const osc = ctx.createOscillator(), a = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    const g = o.g == null ? 0.1 : o.g;
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(g, t + (o.attack || 0.012));
    a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(a).connect(master);
    osc.start(t); osc.stop(t + d + 0.03);
  }
  function noise(t, d, o) {
    o = o || {};
    const len = Math.max(1, Math.floor(ctx.sampleRate * d)), buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.hp || 900;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 7000;
    const a = ctx.createGain(); a.gain.value = o.g == null ? 0.12 : o.g;
    src.connect(hp); hp.connect(lp); lp.connect(a); a.connect(master);
    src.start(t);
  }
  const N = (f, t, d, o) => tone(f, t, d, o);
  const SOUNDS = {
    tap:      (t) => N(660, t, 0.05, { type: 'triangle', g: 0.06, to: 520 }),
    place:    (t) => { N(420, t, 0.09, { g: 0.11, to: 700 }); N(900, t + 0.04, 0.07, { type: 'triangle', g: 0.04 }); },
    opp:      (t) => N(330, t, 0.12, { g: 0.07, to: 280 }),
    draw:     (t) => N(520, t, 0.09, { g: 0.08, to: 880 }),
    claim:    (t) => { N(784, t, 0.16, { type: 'triangle', g: 0.09 }); N(988, t + 0.07, 0.16, { type: 'triangle', g: 0.08 }); N(1319, t + 0.14, 0.34, { g: 0.08 }); },
    oppClaim: (t) => { N(523, t, 0.18, { type: 'triangle', g: 0.06 }); N(659, t + 0.09, 0.3, { g: 0.06 }); },
    send:     (t) => { N(520, t, 0.07, { g: 0.08 }); N(780, t + 0.06, 0.1, { g: 0.08 }); },
    ping:     (t) => { N(880, t, 0.1, { type: 'triangle', g: 0.07 }); N(1175, t + 0.09, 0.18, { type: 'triangle', g: 0.06 }); },
    yes:      (t) => { N(587, t, 0.09, { type: 'triangle', g: 0.09 }); N(880, t + 0.08, 0.2, { type: 'triangle', g: 0.09 }); },
    no:       (t) => { N(330, t, 0.1, { type: 'triangle', g: 0.09 }); N(247, t + 0.09, 0.22, { type: 'triangle', g: 0.09 }); },
    right:    (t) => [523, 659, 784, 1047].forEach((f, i) => N(f, t + i * 0.07, 0.22, { type: 'triangle', g: 0.08 })),
    wrong:    (t) => { N(220, t, 0.16, { type: 'sawtooth', g: 0.05, to: 150 }); N(165, t + 0.1, 0.22, { type: 'triangle', g: 0.07 }); },
    lock:     (t) => { N(300, t, 0.05, { type: 'square', g: 0.04 }); N(988, t + 0.05, 0.25, { g: 0.08 }); },
    start:    (t) => [392, 523, 659].forEach((f, i) => N(f, t + i * 0.06, 0.14, { type: 'triangle', g: 0.07 })),
    win:      (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => N(f, t + i * 0.09, 0.36, { type: 'triangle', g: 0.09 })),
    lose:     (t) => { N(392, t, 0.3, { g: 0.07 }); N(330, t + 0.18, 0.5, { g: 0.07 }); },
    tie:      (t) => { N(523, t, 0.25, { g: 0.07 }); N(523, t + 0.2, 0.4, { g: 0.07 }); },
    error:    (t) => { N(200, t, 0.09, { type: 'square', g: 0.05 }); N(160, t + 0.1, 0.12, { type: 'square', g: 0.05 }); },
    count:    (t) => N(880, t, 0.09, { g: 0.1 }),
    shutter:  (t) => { noise(t, 0.05, { g: 0.2, hp: 1800 }); N(180, t, 0.05, { type: 'square', g: 0.06 }); noise(t + 0.07, 0.09, { g: 0.12, hp: 600, lp: 3500 }); },
    flash:    (t) => N(1400, t, 0.18, { g: 0.04, to: 300 }),
  };
  const sfx = {
    play(name) {
      if (!prefs.sound || document.hidden || !ctx || ctx.state !== 'running') return;
      const s = SOUNDS[name];
      if (s) s(ctx.currentTime + 0.003);
    },
    names: Object.keys(SOUNDS),
  };

  function haptic(p) { if (prefs.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } }

  /* ───────────── screen-reader announcements ───────────── */
  let live = null, lastSaid = '';
  function say(text) {
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (!text || text === lastSaid) return;
    lastSaid = text;
    if (!live) { live = document.createElement('div'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true'); document.body.appendChild(live); }
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = text; });
  }

  /* ───────────── icons ───────────── */
  // 24x24 grid, 2px round strokes. Filled icons are marked with F.
  const I = {
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
  function symbolFor(name) {
    const parts = I[name].split('|');
    let filled = false, body = '';
    for (const p of parts) {
      if (p === 'F') { filled = true; continue; }
      body += p.startsWith('<') ? p : '<path d="' + p + '"/>';
    }
    return '<symbol id="i-' + name + '" viewBox="0 0 24 24"' + (filled ? ' class="filled"' : '') + '>' + body + '</symbol>';
  }
  function icon(name, cls) {
    return '<svg class="i' + (I[name] && I[name].indexOf('F|') === 0 || (I[name] || '').indexOf('|F|') > -1 ? ' fill' : '') + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  function injectSprite() {
    if (document.getElementById('tui-sprite')) return;
    const s = document.createElement('div');
    s.id = 'tui-sprite';
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    s.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + Object.keys(I).map(symbolFor).join('') + '</svg>';
    document.body.insertBefore(s, document.body.firstChild);
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      el.insertAdjacentHTML('afterbegin', icon(el.getAttribute('data-icon'), el.getAttribute('data-icon-class') || ''));
      el.removeAttribute('data-icon');
    });
  }

  /* ───────────── viewport fitting ───────────── */
  function fitViewport() {
    const vv = global.visualViewport, root = document.documentElement;
    const set = () => {
      root.style.setProperty('--vvh', (vv ? vv.height : global.innerHeight) + 'px');
      root.style.setProperty('--vvt', (vv ? vv.offsetTop : 0) + 'px');
    };
    set();
    if (vv) { vv.addEventListener('resize', set); vv.addEventListener('scroll', set); }
    global.addEventListener('orientationchange', () => setTimeout(set, 250));
    document.addEventListener('focusout', () => setTimeout(() => { if (global.scrollY) global.scrollTo(0, 0); }, 80));
  }

  /* ───────────── settings sheet ───────────── */
  let sheet = null;
  function row(label, control, id) {
    const li = document.createElement('li'); li.className = 'row';
    const l = document.createElement(id ? 'label' : 'span'); l.textContent = label; if (id) l.htmlFor = id;
    li.append(l, control); return li;
  }
  function mount(opts) {
    opts = opts || {};
    if (sheet) return api.settings;
    // gear button: takes the empty spacer slot in the top bar
    const bar = document.querySelector('.topbar');
    const gear = document.createElement('button');
    gear.type = 'button'; gear.className = 'icon-btn'; gear.id = 'tuiGear';
    gear.setAttribute('aria-label', 'Settings'); gear.setAttribute('aria-haspopup', 'dialog');
    gear.innerHTML = icon('settings');
    if (bar) { const spacer = bar.querySelector(':scope > div:empty'); if (spacer) spacer.replaceWith(gear); else bar.appendChild(gear); }

    const dlg = document.createElement('dialog');
    dlg.className = 'sheet'; dlg.setAttribute('aria-labelledby', 'tuiTitle');
    const body = document.createElement('div'); body.className = 'sheet__body';
    body.innerHTML = '<div class="sheet__head"><h2 id="tuiTitle">Settings</h2><button type="button" class="icon-btn" data-close aria-label="Close settings">' + icon('close') + '</button></div>';
    const rows = document.createElement('ul'); rows.className = 'rows';

    const sw = (id, key, after) => { const i = document.createElement('input'); i.type = 'checkbox'; i.id = id; i.className = 'switch'; i.setAttribute('role', 'switch'); i.checked = !!prefs[key]; i.addEventListener('change', () => { setPref(key, i.checked); if (after) after(i.checked); }); return i; };
    const sound = sw('tuiSound', 'sound', (on) => { if (on) { unlock(); setTimeout(() => sfx.play('tap'), 30); } vol.disabled = !on; });
    const vol = document.createElement('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = prefs.volume; vol.id = 'tuiVol'; vol.className = 'range'; vol.disabled = !prefs.sound;
    vol.addEventListener('input', () => setPref('volume', +vol.value));
    vol.addEventListener('change', () => { unlock(); sfx.play('claim'); });
    const hap = sw('tuiHaptics', 'haptics', (on) => { if (on) haptic(20); });
    const mot = sw('tuiMotion', 'motion');
    const theme = document.createElement('div'); theme.className = 'seg'; theme.setAttribute('role', 'group'); theme.setAttribute('aria-label', 'Theme');
    [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(([v, t]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(prefs.theme === v));
      b.addEventListener('click', () => { setPref('theme', v); theme.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      theme.appendChild(b);
    });
    rows.append(row('Sound effects', sound, 'tuiSound'), row('Volume', vol, 'tuiVol'), row('Vibration', hap, 'tuiHaptics'), row('Animations', mot, 'tuiMotion'), row('Theme', theme));
    (opts.extras || []).forEach((x) => {
      if (typeof x === 'string') { const li = document.createElement('li'); li.innerHTML = x; rows.appendChild(li); }
      else if (x) rows.appendChild(x.tagName === 'LI' ? x : (() => { const li = document.createElement('li'); li.appendChild(x); return li; })());
    });
    body.appendChild(rows); dlg.appendChild(body); document.body.appendChild(dlg);
    sheet = dlg;
    gear.addEventListener('click', () => { unlock(); sfx.play('tap'); dlg.showModal(); if (opts.onOpen) opts.onOpen(); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    return api.settings;
  }

  /* ───────────── boot ───────────── */
  applyPrefs();                           // theme + motion before first paint
  function ready() { injectSprite(); hydrate(); fitViewport(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  const api = {
    prefs, setPref, onPref: (f) => listeners.add(f),
    sfx, haptic, say, unlock,
    icon, hydrate, icons: Object.keys(I),
    mount,
    settings: { open() { if (sheet) sheet.showModal(); }, close() { if (sheet) sheet.close(); }, get dialog() { return sheet; } },
  };
  global.TetherUI = api;
})(window);
