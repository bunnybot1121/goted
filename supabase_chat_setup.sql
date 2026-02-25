-- ═══════════════════════════════════════════════════════
--  THE GOTED — Chat & Mind Map Sharing SQL Setup
--  Run this in Supabase SQL Editor AFTER supabase_setup.sql
-- ═══════════════════════════════════════════════════════

-- ── 1. Messages table for real-time chat ─────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade not null,
  receiver_id uuid references auth.users(id) on delete cascade not null,
  sender_email text,
  content text not null,
  created_at timestamptz default now(),
  is_read boolean default false
);

alter table messages enable row level security;

-- Sender or receiver can read; only sender can write
create policy "msg_read" on messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "msg_insert" on messages
  for insert with check (sender_id = auth.uid());

create policy "msg_update" on messages
  for update using (receiver_id = auth.uid()); -- only receiver can mark as read


-- ── 2. Add shared_with to mindmaps ───────────────────
alter table mindmaps add column if not exists shared_with uuid[] default '{}';

-- Drop and recreate mindmaps select policy to include shared maps
drop policy if exists "mindmaps_owner_all" on mindmaps;

create policy "mindmaps_owner_all" on mindmaps
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "mindmaps_shared_read" on mindmaps;
create policy "mindmaps_shared_read" on mindmaps
  for select using (auth.uid() = any(shared_with));


-- ── 3. Enable realtime on messages table ─────────────
-- In Supabase dashboard: Database > Replication > Enable realtime on 'messages'
-- Or run:
alter publication supabase_realtime add table messages;
