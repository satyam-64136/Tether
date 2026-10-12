/* ═════════════════════════════════════════════════════════════════
   tether-intro.js: the opening animation.

   Two orbs joined by a thread drift together (the thread droops as they
   close in), merge into a heart with a sparkle burst, and "Tether" springs
   in letter by letter. Everything uses your current theme colours.

   - Plays in full once per session. Come back to the app within 30 minutes
     (or from a back/forward navigation) and it only does a quick fade, so the
     app never "restarts" with a long intro.
   - Only transform / opacity are animated, so it stays smooth on any phone.
   - prefers-reduced-motion gets a still heart and a short fade.
   - Starts the moment #ldr exists. Call TetherIntro.hide() when the app is
     ready; it waits for the animation to finish if it needs to.
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const ldr = document.getElementById('ldr');
  if (!ldr) return;

  const reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'tether:introAt';
  let recent = false;
  try { recent = Date.now() - (+sessionStorage.getItem(KEY) || 0) < 30 * 60 * 1000; } catch (e) { /* private mode */ }
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  const mode = (reduce || recent || (nav && nav.type === 'back_forward')) ? 'quick' : 'full';
  const FULL_MS = 2500, QUICK_MS = 450;

  /* ───────────── styles (injected, so index.html needs no CSS edits) ───────────── */
  const css = document.createElement('style');
  css.textContent = `
  #ldr{transition:none;overflow:hidden}
  #ldr::before{display:none}
  #ldr.ldr2-leave{opacity:0;transition:opacity .6s cubic-bezier(.4,0,.2,1)}
  #ldr.off{opacity:0;visibility:hidden;pointer-events:none}
  .ldr2-wrap{display:flex;flex-direction:column;align-items:center;transition:transform .6s cubic-bezier(.4,0,.2,1);will-change:transform}
  #ldr.ldr2-leave .ldr2-wrap{transform:scale(1.07) translateY(-8px)}
  .ldr2-glow{position:absolute;width:340px;height:340px;border-radius:50%;pointer-events:none;
    background:radial-gradient(circle,rgba(var(--accent-rgb),.16) 0%,transparent 68%);opacity:0;transform:scale(.6);
    animation:ldr2Glow 1.6s cubic-bezier(.2,.9,.2,1) .9s forwards}
  @keyframes ldr2Glow{to{opacity:1;transform:scale(1)}}
  .ldr2-stage{width:300px;height:206px;position:relative}
  .ldr2-stage svg{width:100%;height:100%;overflow:visible}
  .ldr2-rope{fill:none;stroke:var(--accent);stroke-width:5;stroke-linecap:round}
  .ldr2-a{fill:var(--accent)} .ldr2-b{fill:rgba(var(--accent-rgb),.5)}
  .ldr2-hi{fill:#fff;opacity:.55}
  .ldr2-heart{fill:var(--accent)}
  .ldr2-ring{fill:none;stroke:var(--accent);stroke-width:3}
  .ldr2-spark{fill:var(--accent)}
  .ldr2-spark.alt{fill:rgba(var(--accent-rgb),.55)}
  .ldr2-name{display:flex;margin-top:-6px;font-family:'DM Serif Display',serif;font-style:italic;font-size:60px;line-height:1;color:var(--accent);letter-spacing:-1px;position:relative}
  .ldr2-name span{display:inline-block;opacity:0;animation:ldr2Rise .75s cubic-bezier(.34,1.56,.64,1) both}
  @keyframes ldr2Rise{from{opacity:0;transform:translateY(22px) scale(.55) rotate(-8deg)}to{opacity:1;transform:none}}
  #ldr .ldr-quote{opacity:0;animation:ldr2Fade 1s ease 2s forwards;margin-top:14px}
  @keyframes ldr2Fade{to{opacity:1}}
  #ldr .ldots{opacity:0;position:absolute;bottom:14%;transition:opacity .6s}
  #ldr .ldots.show{opacity:1}
  .ldr2-quick .ldr2-name span,.ldr2-quick #ldr-quote{animation:none!important;opacity:1}
  .ldr2-quick .ldr2-glow{animation:none;opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){
    .ldr2-glow,.ldr2-name span,#ldr .ldr-quote{animation:none!important;opacity:1;transform:none}
  }`;
  document.head.appendChild(css);

  /* ───────────── markup ───────────── */
  const letters = 'Tether'.split('').map((c, i) => `<span style="animation-delay:${(1.32 + i * 0.07).toFixed(2)}s">${c}</span>`).join('');
  ldr.innerHTML = `
    <div class="ldr2-glow"></div>
    <div class="ldr2-wrap">
      <div class="ldr2-stage"><svg viewBox="-150 -103 300 206" aria-hidden="true">
        <path class="ldr2-rope" id="ldr2Rope" pathLength="1"/>
        <g id="ldr2A"><circle class="ldr2-a" r="15"/><circle class="ldr2-hi" r="4.5" cx="-5" cy="-5.5"/></g>
        <g id="ldr2B"><circle class="ldr2-b" r="15"/><circle class="ldr2-hi" r="4.5" cx="-5" cy="-5.5"/></g>
        <circle class="ldr2-ring" id="ldr2Ring" r="10" opacity="0"/>
        <g id="ldr2Heart" opacity="0"><path class="ldr2-heart" d="M0 24C-40-4-22-37 0-15C22-37 40-4 0 24Z"/><ellipse class="ldr2-hi" cx="-13" cy="-9" rx="6" ry="3.4" transform="rotate(-35 -13 -9)"/></g>
        <g id="ldr2Sparks"></g>
      </svg></div>
      <div class="ldr2-name" aria-label="Tether">${letters}</div>
      <div class="ldr-quote" id="ldr-quote"></div>
    </div>
    <div class="ldots"><span></span><span></span><span></span></div>`;
  if (mode === 'quick') ldr.classList.add('ldr2-quick');

  /* ───────────── the animation ───────────── */
  const $ = (id) => document.getElementById(id);
  const rope = $('ldr2Rope'), A = $('ldr2A'), B = $('ldr2B'), heart = $('ldr2Heart'), ring = $('ldr2Ring'), sparksG = $('ldr2Sparks');
  const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  // sparkle burst: stars and dots flying outward
  const STAR = (() => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.5; d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); } return d + 'Z'; })();
  const sparks = [];
  for (let i = 0; i < 12; i++) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', i % 3 === 0 ? 'circle' : 'path');
    if (i % 3 === 0) el.setAttribute('r', '3'); else el.setAttribute('d', STAR);
    el.setAttribute('class', 'ldr2-spark' + (i % 2 ? ' alt' : ''));
    el.setAttribute('opacity', '0');
    sparksG.appendChild(el);
    const ang = i * (Math.PI * 2 / 12) + (i % 2 ? .18 : -.12);
    sparks.push({ el, ang, dist: 52 + (i * 37 % 28), spin: (i % 2 ? 1 : -1) * (80 + i * 14) });
  }

  const L = 204, N = 18;                                     // rope length (constant) and segment count
  function drawRope(xa, xb, ya, yb, wob, reveal, fade) {
    const d = Math.abs(xb - xa);
    const sag = Math.sqrt(Math.max(0, 3 * d * Math.max(0, L - d) / 8));   // a slack rope hangs in a parabola: sag = sqrt(3·d·(L−d)/8)
    let p = '';
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = lerp(xa, xb, u) + Math.sin(u * 6.28 + wob * 3) * wob * .5;
      const y = lerp(ya, yb, u) + (sag + wob) * 4 * u * (1 - u);
      p += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    rope.setAttribute('d', p);
    rope.style.strokeDasharray = '1';
    rope.style.strokeDashoffset = String(1 - reveal);
    rope.style.opacity = String(fade);
  }

  function frame(t) {
    // 0.00–0.50  orbs pop in, thread draws between them
    const pop = easeOutBack(clamp01(t / .5));
    const bob = Math.exp(-t * 1.3);
    let xa = -100, xb = 100, ya = Math.sin(t * 5) * 4 * bob, yb = Math.sin(t * 5 + 2) * 4 * bob;
    // 0.55–1.30  they drift together; the thread goes slack and sways
    const p = easeInOut(clamp01((t - .55) / .75));
    xa = lerp(-100, -17, p); xb = lerp(100, 17, p);
    const k = Math.max(0, t - .55);
    const wob = Math.sin(k * 13) * Math.exp(-k * 2.4) * 7;   // the thread sways, then settles
    // 1.30–1.45  contact: squash, then merge into the heart
    const m = easeIn(clamp01((t - 1.3) / .16));
    const squash = t > 1.2 && t < 1.34 ? 1 + .22 * Math.sin((t - 1.2) / .14 * Math.PI) : 1;
    const orbScale = pop * (1 - m);
    A.setAttribute('transform', `translate(${lerp(xa, 0, m).toFixed(1)} ${ya.toFixed(1)}) scale(${(orbScale / squash).toFixed(3)} ${(orbScale * squash).toFixed(3)})`);
    B.setAttribute('transform', `translate(${lerp(xb, 0, m).toFixed(1)} ${yb.toFixed(1)}) scale(${(orbScale / squash).toFixed(3)} ${(orbScale * squash).toFixed(3)})`);
    drawRope(xa, xb, ya, yb, wob, easeOut(clamp01((t - .12) / .45)), 1 - clamp01((t - 1.28) / .14));

    // 1.38–  the heart pops, a ring ripples out, sparkles burst, then it beats twice
    const h = clamp01((t - 1.38) / .42);
    const beat = t > 1.85 ? 1 + .085 * Math.max(0, Math.sin((t - 1.85) * 12)) * Math.exp(-(t - 1.85) * 1.4) : 1;
    heart.setAttribute('opacity', h > 0 ? '1' : '0');
    heart.setAttribute('transform', `scale(${(easeOutBack(h) * beat).toFixed(3)})`);
    const r = clamp01((t - 1.38) / .5);
    ring.setAttribute('r', (10 + easeOut(r) * 62).toFixed(1));
    ring.setAttribute('opacity', r > 0 && r < 1 ? ((1 - r) * .55).toFixed(2) : '0');
    for (const s of sparks) {
      const u = clamp01((t - 1.4) / .75);
      if (u <= 0 || u >= 1) { s.el.setAttribute('opacity', '0'); continue; }
      const d = easeOut(u) * s.dist;
      s.el.setAttribute('transform', `translate(${(Math.cos(s.ang) * d).toFixed(1)} ${(Math.sin(s.ang) * d - 4).toFixed(1)}) rotate(${(u * s.spin).toFixed(0)}) scale(${(1 - u * .8).toFixed(2)})`);
      s.el.setAttribute('opacity', (u < .15 ? u / .15 : 1 - (u - .15) / .85).toFixed(2));
    }
  }

  let raf = 0, t0 = 0, startedAt = performance.now(), leaving = false, waiter = 0;
  function loop(now) {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    frame(t);
    if (t < 2.7 && !document.hidden) raf = requestAnimationFrame(loop); else { frame(2.7); raf = 0; }
  }
  function settle() { frame(3); }                         // the finished picture, no motion
  if (mode === 'full') raf = requestAnimationFrame(loop); else settle();
  setTimeout(() => { const d = ldr.querySelector('.ldots'); if (d) d.classList.add('show'); }, 3300);   // only if the app is slow to open
  document.addEventListener('visibilitychange', () => { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; settle(); } });

  /* ───────────── leaving ───────────── */
  function leave() {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { /* ignore */ }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    ldr.classList.add('ldr2-leave');
    setTimeout(() => { ldr.classList.add('off'); ldr.classList.remove('ldr2-leave'); }, 640);
  }
  // hide(): called by the app when it is ready. Waits for the animation to finish so it never gets cut off.
  function hide() {
    if (leaving || waiter) return;
    const need = (mode === 'full' ? FULL_MS : QUICK_MS) - (performance.now() - startedAt);
    if (need > 0) waiter = setTimeout(() => { waiter = 0; leave(); }, need); else leave();
  }
  global.TetherIntro = { mode, hide, skip: leave };
})(window);
