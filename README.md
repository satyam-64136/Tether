# us. — Tether

**Live:** [https://satyam-64136.github.io/Tether/](https://satyam-64136.github.io/Tether/)

A private, two-person messaging PWA. No accounts, no ads, no third parties — just Satyam and Snks.

---

## Install as an App

### Android (Chrome)
1. Open the link above in Chrome
2. Tap the **⋮ menu → Add to Home Screen**
3. Tap **Add** — it installs like a native app

### iOS (Safari)
1. Open the link in **Safari** (not Chrome)
2. Tap the **Share ⎙** button at the bottom
3. Tap **Add to Home Screen → Add**

Once installed it opens fullscreen with no browser bar, and sends push notifications even when closed.

---

## Features

| Feature | Details |
|---|---|
| Real-time chat | Supabase Realtime, no polling |
| Images & videos | Upload from camera roll |
| Voice messages | Hold mic button to record |
| Link previews | Auto-fetches OG title + image |
| Swipe to reply | Right swipe on any bubble |
| Left swipe | Opens message options |
| Long press | Multi-select to delete |
| Reactions | 6 emoji reactions per message |
| Soft delete | Shows "this message was deleted" |
| Read receipts | ✓ sent, ✓✓ seen (gold = read) |
| Typing indicator | Live in header |
| Online / Last seen | Updates every 20s |
| Synced wallpaper | Set once, shows on both phones |
| 10 themes | Dusty Rose default, synced across devices |
| Push notifications | Works when app is fully closed (Android) |
| Auto-updates | New code deploys silently, no manual refresh |
| Switch user | Menu → Switch user |

---

## Stack

- **Frontend** — Vanilla JS, single HTML file, no build step
- **Database** — Supabase (Postgres + Realtime)
- **Storage** — Supabase Storage (images, voice, video, wallpaper)
- **Hosting** — GitHub Pages
- **Font** — Geist
- **PWA** — Service Worker with network-first caching + background push polling

---

## Supabase Schema

```sql
-- Messages
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
  video boolean default false,
  created_at timestamptz default now()
);
alter publication supabase_realtime add table messages;

-- Presence
create table presence (
  username text primary key,
  last_seen timestamptz default now(),
  online boolean default false
);
alter publication supabase_realtime add table presence;

-- Settings (theme, wallpaper)
create table settings (
  key text primary key,
  value text
);
alter publication supabase_realtime add table settings;

-- Storage bucket
insert into storage.buckets (id, name, public) values ('images', 'images', true);

-- Policies
create policy "public access" on messages for all using (true) with check (true);
create policy "public storage" on storage.objects for all using (bucket_id = 'images') with check (bucket_id = 'images');
create policy "public presence" on presence for all using (true) with check (true);
create policy "public settings" on settings for all using (true) with check (true);
```

---

## Deploying Updates

Push changes to the `main` branch. GitHub Pages deploys automatically. The service worker detects the new version within 5 minutes and silently reloads the app — no action needed from either user.

---

## Files

```
Tether/
├── index.html     # entire app — UI + logic
├── sw.js          # service worker — caching + background notifications
├── manifest.json  # PWA manifest
└── icon.png       # app icon (192×192 and 512×512)
```
