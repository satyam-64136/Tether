<div align="center">

<img src="icon.png" width="120" height="120" style="border-radius:28px" alt="us."/>

# us.

**A private, two-person messaging app — built entirely from scratch**

[![Live](https://img.shields.io/badge/live-satyam--64136.github.io%2FTether-b86070?style=flat-square&logo=github)](https://satyam-64136.github.io/Tether/)
[![PWA](https://img.shields.io/badge/PWA-installable-5e9af0?style=flat-square)](https://satyam-64136.github.io/Tether/)
[![Stack](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20Supabase-6ebd8a?style=flat-square)]()
[![Zero deps](https://img.shields.io/badge/frontend%20deps-zero-c4a468?style=flat-square)]()

</div>

---

## What is this?

**us.** (internally *Tether*) is a real-time private messaging PWA built for exactly two people. No accounts. No app store. No third-party SDKs in the frontend. Just a single HTML file, a Supabase backend, and a service worker — delivering a native app experience entirely through the browser.

Open the link, tap "Add to Home Screen", and it installs as a full-screen app with push notifications, voice messages, link previews, and realtime sync — indistinguishable from a native app.

> Built solo as a personal project. Every feature was designed, engineered, and debugged from scratch.

---

## Live Demo

**[satyam-64136.github.io/Tether](https://satyam-64136.github.io/Tether/)**

---

## Features

### Messaging
- **Real-time chat** via Supabase Realtime — zero polling, instant delivery
- **Image sharing** with fullscreen lightbox viewer
- **Voice messages** — hold to record, waveform visualizer, tap to play
- **Link previews** — auto-detects URLs, fetches OG title + image
- **Swipe to reply** — right swipe on any bubble
- **Swipe for options** — left swipe opens action menu
- **Emoji reactions** — 6 reactions per message, synced live
- **Soft delete** — shows "this message was deleted" instead of vanishing
- **Copy message** — one tap from context menu

### UX
- **Read receipts** — ✓ sent → ✓✓ delivered → gold ✓✓ seen
- **Typing indicator** — live, disappears after 2 seconds of inactivity
- **Online / Last seen** — updates every 30s, stale-detection after 45s (survives phone kill)
- **Push notifications** — works when app is fully closed via SW background polling
- **Long-press multi-select** — select multiple messages, bulk delete
- **10 themes** — Dusty Rose (default), Midnight, Violet, Rose Pink, Navy Blue, Classic, Sage, Aurora, Lavender, Warm Peach — synced across both devices
- **Custom wallpaper** — upload once, syncs to both phones automatically
- **Install prompt** — smart install button in menu, native browser install dialog

### Technical
- **Device-locked identity** — `localStorage` binding, no login flow, no passwords
- **Auto-updates** — service worker detects new deploys silently, reloads in background
- **Reconnect without flicker** — on channel drop, fetches only missed messages (no full re-render)
- **Theme-aware status bar** — `<meta theme-color>` updates dynamically with theme switch
- **True fullscreen** — `viewport-fit=cover` + `black-translucent` status bar on iOS
- **Performance-optimised** — GPU compositing on animated elements, `backdrop-filter` stripped on low-end hardware, `prefers-reduced-motion` respected

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS — zero frameworks, zero npm, one HTML file |
| Database | Supabase (Postgres + Realtime) |
| Storage | Supabase Storage (images, voice, wallpaper) |
| Hosting | GitHub Pages |
| Notifications | Service Worker + Background Polling |
| Font | Geist by Vercel |
| Design | Liquidmorphism — frosted glass, radial gradient meshes |

**Frontend bundle size: ~0 KB** (no build step, no bundler, no framework)

---

## Architecture

```
Browser (PWA)
│
├── index.html          # Entire app — 2,400 lines, zero dependencies
│   ├── CSS             # 10 themes via CSS custom properties
│   ├── DOM             # Vanilla JS, no virtual DOM
│   └── Supabase JS     # Loaded from CDN at runtime
│
├── sw.js               # Service Worker
│   ├── Network-first caching (always fresh code)
│   ├── Background polling via Supabase REST
│   └── Push notifications when app is closed
│
└── manifest.json       # PWA manifest — standalone display, custom icon
```

```
Supabase (Backend)
│
├── messages     id, sender, content, image_url, reply_to,
│                seen, reactions, deleted, voice, created_at
├── presence     username, last_seen, online
└── settings     key/value — theme, wallpaper URL
```

---

## How It Works

**No traditional auth.** On first open, each device picks an identity and locks to it via `localStorage`. No passwords, no OAuth, no session management. Two devices, two people, done.

**Realtime without polling.** Supabase Realtime streams Postgres changes over WebSocket. New messages appear instantly on both devices with zero interval polling in the foreground. The service worker polls Supabase REST every 25s only when the app is fully closed — for background push.

**Updates silently.** The service worker uses a network-first fetch strategy. Every deploy to GitHub Pages is automatically picked up. When a new version installs, it sends `SKIP_WAITING` and silently reloads — neither user ever manually refreshes.

**Theme sync.** Picking a theme writes to the `settings` table. The other device has an active Realtime subscription on that table — it applies the new theme in under a second.

---

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) and run in SQL Editor:

```sql
create table messages (
  id uuid default gen_random_uuid() primary key,
  sender text not null,
  content text,
  image_url text,
  reply_to uuid references messages(id),
  seen boolean default false,
  reactions jsonb default '{}',
  deleted boolean default false,
  voice boolean default false,
  created_at timestamptz default now()
);
alter publication supabase_realtime add table messages;

create table presence (
  username text primary key,
  last_seen timestamptz default now(),
  online boolean default false
);
alter publication supabase_realtime add table presence;

create table settings (key text primary key, value text);
alter publication supabase_realtime add table settings;

insert into storage.buckets (id, name, public) values ('images', 'images', true);

create policy "all" on messages for all using (true) with check (true);
create policy "all" on presence for all using (true) with check (true);
create policy "all" on settings for all using (true) with check (true);
create policy "storage" on storage.objects for all
  using (bucket_id='images') with check (bucket_id='images');
```

### 2. Configure

In `index.html`, update the two constants:

```js
const SU = 'your-supabase-project-url';
const SK = 'your-supabase-anon-key';
```

### 3. Deploy

Push to GitHub with Pages enabled. Update `manifest.json` and `sw.js` with your repo name:

```json
"start_url": "/your-repo/",
"scope": "/your-repo/"
```

---

## Install as App

**Android (Chrome)** — Open in Chrome → tap ⋮ → Add to Home Screen → Install

**iOS (Safari)** — Open in Safari → tap Share ⎙ → Add to Home Screen → Add

Launches fullscreen, separate from the browser, with its own app icon.

---

## Project Stats

| Metric | Value |
|---|---|
| Total files | 3 (`index.html`, `sw.js`, `manifest.json`) |
| Lines of code | ~2,400 |
| JS functions | 76 |
| Frontend dependencies | **0** |
| Build step | **None** |
| Framework | **None** |

---

## What I Learned

Building this without any framework meant implementing from scratch: realtime state sync, DOM reconciliation, service worker lifecycle, PWA install APIs, audio recording with `MediaRecorder`, CSS custom property theming across 10 themes, mobile touch gesture handling (swipe, long-press, multi-select), and background push notifications via SW polling.

The constraint of "one HTML file, no dependencies" turned out to be a feature. The app loads instantly, updates silently, and runs on any device with a browser — no install required until you want it.

---

<div align="center">

Built by [Satyam](https://github.com/satyam-64136) &nbsp;·&nbsp; BTech CS @ DIT University, Dehradun

</div>
