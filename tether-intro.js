/* ═════════════════════════════════════════════════════════════════
   tether-intro.js: the opening animation, built to be quick and light.

   Two orbs glide together, merge into a heart (ripple + a few sparkles), and
   "Tether" rises. About one second, and it leaves the moment the app is ready.
   If the app is slow to open, the heart simply keeps beating.

   Why it is light:
   - Pure CSS. There is no JavaScript running every frame, so the app starting up
     behind it can't make it stutter, and it can't slow the app down.
   - Only transform and opacity are animated (handled by the graphics chip).
   - No blur, no filters, no SVG path maths.
   Repeat visits within 30 minutes (or back/forward navigation) get only a quick
   fade, so the app never "restarts" with a long intro. prefers-reduced-motion
   gets a still heart.

   Starts when #ldr exists. Call TetherIntro.hide() when the app is ready.
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
  const FULL_MS = 950, QUICK_MS = 250, FADE_MS = 380;

  const css = document.createElement('style');
  css.textContent = `
  #ldr{transition:none;overflow:hidden}
  #ldr::before{display:none}
  #ldr.ldr3-leave{opacity:0;transition:opacity ${FADE_MS}ms ease-out}
  #ldr.off{opacity:0;visibility:hidden;pointer-events:none}
  #ldr .ldr-name,#ldr .ldots{display:none}
  #ldr .ldr-quote{display:none}
  .ldr3-glow{position:absolute;width:320px;height:320px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(var(--accent-rgb),.14) 0%,transparent 68%)}
  .ldr3-wrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform ${FADE_MS}ms ease-out}
  #ldr.ldr3-leave .ldr3-wrap{transform:scale(1.08)}
  .ldr3-mark{position:relative;width:132px;height:112px}
  .ldr3-mark>*{position:absolute;left:50%;top:50%}

  /* every rule below describes the FINISHED picture; the animations only describe where each piece comes from.
     Pieces that END invisible (orbs, ring, sparkles) must NOT use a backwards fill, or their starting pose shows during the delay. */
  .ldr3-orb{width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;opacity:0;animation:ldr3Orb .4s cubic-bezier(.5,0,.75,.4) .04s}
  .ldr3-orb.a{background:var(--accent);--dx:-74px}
  .ldr3-orb.b{background:rgba(var(--accent-rgb),.5);--dx:74px}
  @keyframes ldr3Orb{0%{opacity:1;transform:translate3d(var(--dx),0,0) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate3d(0,0,0) scale(.35)}}

  .ldr3-heart{width:84px;height:84px;margin:-42px 0 0 -42px;overflow:visible;animation:ldr3Pop .5s cubic-bezier(.34,1.56,.64,1) .34s both,ldr3Beat 1.5s ease-in-out 1.15s infinite}
  .ldr3-heart .h{fill:var(--accent)} .ldr3-heart .s{fill:#fff;opacity:.5}
  @keyframes ldr3Pop{from{opacity:0;transform:scale(.2)}}
  @keyframes ldr3Beat{0%,28%,56%,100%{transform:scale(1)}14%{transform:scale(1.09)}42%{transform:scale(1.06)}}

  .ldr3-ring{width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;border:3px solid var(--accent);opacity:0;animation:ldr3Ring .65s cubic-bezier(.2,.8,.3,1) .34s}
  @keyframes ldr3Ring{from{opacity:.55;transform:scale(.4)}to{opacity:0;transform:scale(1.9)}}

  .ldr3-spark{width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:var(--accent);opacity:0;animation:ldr3Spark .7s cubic-bezier(.2,.8,.3,1) .38s}
  .ldr3-spark.alt{width:5px;height:5px;margin:-2.5px 0 0 -2.5px;background:rgba(var(--accent-rgb),.55)}
  @keyframes ldr3Spark{from{opacity:1;transform:rotate(var(--a)) translateY(-14px) scale(.5)}60%{opacity:1}to{opacity:0;transform:rotate(var(--a)) translateY(-62px) scale(.15)}}

  .ldr3-word{font-family:'DM Serif Display',serif;font-style:italic;font-size:54px;line-height:1;color:var(--accent);letter-spacing:-1px;animation:ldr3Word .5s cubic-bezier(.2,.9,.2,1) .52s both}
  @keyframes ldr3Word{from{opacity:0;transform:translateY(14px)}}

  .ldr3-quick .ldr3-mark>*,.ldr3-quick .ldr3-word{animation:none!important}
  .ldr3-quick .ldr3-ring,.ldr3-quick .ldr3-spark{display:none}
  @media (prefers-reduced-motion:reduce){.ldr3-mark>*,.ldr3-word{animation:none!important}.ldr3-ring,.ldr3-spark{display:none}}`;
  document.head.appendChild(css);

  let sparks = '';
  for (let i = 0; i < 8; i++) sparks += `<i class="ldr3-spark${i % 2 ? ' alt' : ''}" style="--a:${i * 45 + (i % 2 ? 12 : -6)}deg"></i>`;
  ldr.innerHTML = `
    <div class="ldr3-glow"></div>
    <div class="ldr3-wrap">
      <div class="ldr3-mark" aria-hidden="true">
        <span class="ldr3-orb a"></span><span class="ldr3-orb b"></span>
        <span class="ldr3-ring"></span>
        <svg class="ldr3-heart" viewBox="-42 -42 84 84"><path class="h" d="M0 24C-40-4-22-37 0-15C22-37 40-4 0 24Z"/><ellipse class="s" cx="-13" cy="-9" rx="6" ry="3.4" transform="rotate(-35 -13 -9)"/></svg>
        ${sparks}
      </div>
      <div class="ldr3-word" aria-label="Tether">Tether</div>
      <div class="ldr-quote" id="ldr-quote"></div>
    </div>`;
  if (mode === 'quick') ldr.classList.add('ldr3-quick');

  const startedAt = performance.now();
  let leaving = false, waiter = 0;
  function leave() {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { /* ignore */ }
    ldr.classList.add('ldr3-leave');
    setTimeout(() => { ldr.classList.add('off'); ldr.classList.remove('ldr3-leave'); }, FADE_MS + 30);
  }
  // hide(): the app calls this when it is ready. It never cuts the animation short, and never makes you wait longer than it needs.
  function hide() {
    if (leaving || waiter) return;
    const need = (mode === 'full' ? FULL_MS : QUICK_MS) - (performance.now() - startedAt);
    if (need > 0) waiter = setTimeout(() => { waiter = 0; leave(); }, need); else leave();
  }
  global.TetherIntro = { mode, hide, skip: leave };
})(window);
