-- ═══════════════════════════════════════════════════════
--  THE GOTED — MindVault Supabase Setup SQL
--  Run this ONCE in your Supabase SQL Editor:
--  Dashboard > SQL Editor > New Query > Paste & Run
-- ═══════════════════════════════════════════════════════

-- ── 1. collab_requests table ─────────────────────────
create table if not exists collab_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade not null,
  requester_email text not null,
  target_id uuid references auth.users(id) on delete cascade not null,
  target_email text,
  status text default 'pending' check (status in ('pending', 'accepted', 'denied')),
  created_at timestamptz default now(),
  unique (requester_id, target_id)
);

alter table collab_requests enable row level security;

-- Requester can create requests and read their own
create policy "collab_req_insert" on collab_requests
  for insert with check (requester_id = auth.uid());

create policy "collab_req_read" on collab_requests
  for select using (requester_id = auth.uid() or target_id = auth.uid());

-- Target can update (accept / deny)
create policy "collab_req_update" on collab_requests
  for update using (target_id = auth.uid());

-- Either party can delete
create policy "collab_req_delete" on collab_requests
  for delete using (requester_id = auth.uid() or target_id = auth.uid());


-- ── 2. mindmaps table ────────────────────────────────
create table if not exists mindmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  nodes jsonb default '[]',
  connections jsonb default '[]',
  node_id_counter int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);

alter table mindmaps enable row level security;

-- Only owner can do anything
create policy "mindmaps_owner_all" on mindmaps
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── 3. Fix items RLS for per-user isolation ──────────
-- Drop any overly permissive existing policy (adjust name if yours differs)
drop policy if exists "Enable all for authenticated" on items;
drop policy if exists "Allow all" on items;
drop policy if exists "Users can do anything" on items;

-- Per-user CRUD for items
drop policy if exists "items_owner_select" on items;
create policy "items_owner_select" on items
  for select using (user_id = auth.uid());

drop policy if exists "items_owner_insert" on items;
create policy "items_owner_insert" on items
  for insert with check (user_id = auth.uid());

drop policy if exists "items_owner_update" on items;
create policy "items_owner_update" on items
  for update using (user_id = auth.uid());

drop policy if exists "items_owner_delete" on items;
create policy "items_owner_delete" on items
  for delete using (user_id = auth.uid());

-- Allow reading another user's items if they approved a collab request
drop policy if exists "items_collab_peek" on items;
create policy "items_collab_peek" on items
  for select using (
    exists (
      select 1 from collab_requests cr
      where cr.requester_id = auth.uid()
        and cr.target_id = items.user_id
        and cr.status = 'accepted'
    )
  );
