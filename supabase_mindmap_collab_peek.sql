-- ═══════════════════════════════════════════════════════
--  THE GOTED — MindMap Collab Peek RLS Setup
--  Run this in your Supabase SQL Editor:
--  Dashboard > SQL Editor > New Query > Paste & Run
-- ═══════════════════════════════════════════════════════

-- Allow reading another user's mind maps if they approved a collab request
drop policy if exists "mindmaps_collab_peek" on mindmaps;
create policy "mindmaps_collab_peek" on mindmaps
  for select using (
    exists (
      select 1 from collab_requests cr
      where cr.requester_id = auth.uid()
        and cr.target_id = mindmaps.user_id
        and cr.status = 'accepted'
    )
  );

-- Also ensure "mindmaps_owner_all" still exists and is correct just in case
drop policy if exists "mindmaps_owner_all" on mindmaps;
create policy "mindmaps_owner_all" on mindmaps
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
