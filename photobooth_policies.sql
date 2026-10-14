-- ═══════════════════════════════════════════════════════════════════
-- Photo Booth: permissions for "Send to chat"
-- Run once in the Supabase SQL editor. Safe to run again.
--
-- The booth now sends the same way the chat sends an image:
--   • signed in (anonymous sign-in, shared with the chat on the phone)
--   • file goes in the "images" bucket, named chat_<time>.jpg
--   • the message is posted as the signed-in person
--
-- These policies allow exactly that and nothing wider: signed-in users
-- only (never anonymous visitors), only the images bucket, only chat_*
-- names, and a message only as yourself (the sessions table says who you
-- are). If your existing policies already allow this, these are harmless
-- duplicates. Nothing is removed or loosened.
-- ═══════════════════════════════════════════════════════════════════

-- 1. upload a chat_* file into the images bucket
drop policy if exists "tether booth upload" on storage.objects;
create policy "tether booth upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and name like 'chat\_%');

-- 2. post a message as yourself
drop policy if exists "tether booth message" on public.messages;
create policy "tether booth message" on public.messages
  for insert to authenticated
  with check (sender = (select s.user_name from public.sessions s where s.auth_uid = auth.uid() limit 1));


-- ───────────────────────────────────────────────────────────────────
-- STILL FAILING? Run this on its own and read the result. It lists every
-- rule on those two tables, so we can see exactly what is blocking:
--
-- select tablename, policyname, cmd, roles, permissive, with_check
--   from pg_policies
--  where (schemaname = 'storage' and tablename = 'objects')
--     or (schemaname = 'public'  and tablename = 'messages')
--  order by tablename, cmd;
-- ═══════════════════════════════════════════════════════════════════
