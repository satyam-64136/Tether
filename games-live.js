/* ═════════════════════════════════════════════════════════════════
   games-live.js: the one place every Tether game gets its live sync.

   Why this exists. The three older games each had their own copy of a
   "subscribe, and reconnect if it drops" routine with the same flaws:

   1. Replacing a channel calls removeChannel(), and supabase-js reports that
      as status CLOSED. The old code treated it as a dropped connection,
      showed "Reconnecting...", and scheduled another resubscribe, which
      removed the healthy new channel, which reported CLOSED again, and so on
      forever. Every ~2s the game was briefly deaf and re-fetched everything.
   2. Resubscribing on every visibilitychange / online / pageshow, even when
      the channel was perfectly healthy (pageshow also fires on first load).
   3. "Latest request wins" resyncs: a new sync cancelled the one in flight,
      so a burst of events could starve the UI of any update at all.
   4. Re-rendering the whole UI on every poll, even when nothing had changed,
      which replays animations and looks like the page refreshed.

   What it does instead:
   - One channel per game, however many tables it watches.
   - Every channel carries a generation number; callbacks from a channel that
     was replaced on purpose are ignored.
   - Exponential backoff with jitter, a join watchdog, and a calm status
     indicator that only says "Reconnecting" if the outage lasts a moment.
   - Coming back to the app only re-syncs; it reconnects only if the channel
     is not actually live.
   - Catch-up runs one at a time and runs again afterwards if something
     arrived meanwhile (coalesce), so nothing is cancelled and nothing is
     applied out of order.
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* Runs fn one at a time. Calls made while it is running are folded into a
     single follow-up run. Every caller gets a promise for "fn has run since I
     asked". */
  function coalesce(fn) {
    let running = null, again = false;
    return function run() {
      if (running) { again = true; return running; }
      running = (async () => {
        try { do { again = false; await fn(); } while (again); }
        finally { running = null; }
      })();
      return running;
    };
  }

  /* bindings: [{ event, table, filter?, schema?, cb(payload) }]
     onCatchup(): re-read everything from the server (called on every
                  (re)connect, on wake-up, and as a slow backstop poll)
     onStatus(live): true when connected; false only after a real outage   */
  function hub(sb, opts) {
    const o = Object.assign({
      name: 'live', bindings: [],
      onCatchup() {}, onStatus() {},
      pollLiveMs: 12000, pollDownMs: 4000,
      downGraceMs: 1500, joinTimeoutMs: 10000,
    }, opts);

    const catchup = coalesce(async () => {
      try { await o.onCatchup(); } catch (e) { console.warn('[live] catch-up failed, will retry:', e); }
    });

    let ch = null, gen = 0, state = 'idle', attempt = 0;
    let retryT = 0, joinT = 0, downT = 0, pollT = 0;
    let started = false, wantReconnect = false;
    const stats = { joins: 0, retries: 0, staleIgnored: 0 };

    function report(live) {
      clearTimeout(downT);
      if (live) o.onStatus(true);
      else downT = setTimeout(() => o.onStatus(false), o.downGraceMs);
    }

    function connect() {
      clearTimeout(retryT); retryT = 0;
      clearTimeout(joinT);
      const mine = ++gen;                        // only the newest channel may speak
      if (ch) { const old = ch; ch = null; try { sb.removeChannel(old); } catch (e) { /* already gone */ } }
      state = 'connecting';
      stats.joins++;

      let c = sb.channel(o.name + '-' + mine);
      for (const b of o.bindings) {
        const f = { event: b.event || '*', schema: b.schema || 'public', table: b.table };
        if (b.filter) f.filter = b.filter;
        c = c.on('postgres_changes', f, (payload) => { if (mine === gen) b.cb(payload); });
      }
      ch = c.subscribe((status) => {
        if (mine !== gen) { stats.staleIgnored++; return; }   // e.g. the CLOSED that removeChannel() just caused
        if (status === 'SUBSCRIBED') {
          state = 'live'; attempt = 0; clearTimeout(joinT);
          report(true);
          catchup();                             // pick up anything missed while we were away
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          state = 'down';
          report(false);
          scheduleRetry();
        }
      });
      joinT = setTimeout(() => {                 // watchdog: a join that never answers is a failed join
        if (mine === gen && state !== 'live') { state = 'down'; report(false); scheduleRetry(); }
      }, o.joinTimeoutMs);
    }

    function scheduleRetry() {
      if (retryT) return;
      stats.retries++;
      const delay = Math.min(15000, 800 * Math.pow(2, Math.min(attempt++, 5))) + Math.random() * 300;
      retryT = setTimeout(() => {
        retryT = 0;
        if (hidden()) wantReconnect = true;      // don't burn battery reconnecting in the background
        else connect();
      }, delay);
    }

    function poll() {                            // slow safety net; realtime is the fast path
      clearTimeout(pollT);
      const ms = (state === 'live' ? o.pollLiveMs : o.pollDownMs) * (0.85 + Math.random() * 0.3);
      pollT = setTimeout(() => { if (!hidden()) catchup(); poll(); }, ms);
    }

    /* The app came back (tab shown, network back, restored from cache). Always re-sync;
       only rebuild the channel if it is not actually live. */
    function wake() {
      catchup();
      if (state !== 'live' || wantReconnect) { wantReconnect = false; attempt = 0; connect(); }
    }

    function start() {
      if (started) return;
      started = true;
      connect();
      poll();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
        document.addEventListener('resume', wake);                      // Page Lifecycle: unfrozen
        global.addEventListener('online', wake);
        global.addEventListener('pageshow', (e) => { if (e.persisted) wake(); });   // bfcache restore only
      }
    }

    function stop() {
      started = false; gen++;
      [retryT, joinT, downT, pollT].forEach(clearTimeout);
      if (ch) { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } ch = null; }
    }

    return { start, wake, stop, catchup, stats, get state() { return state; } };
  }

  const api = { hub, coalesce, same };
  global.TetherLive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
