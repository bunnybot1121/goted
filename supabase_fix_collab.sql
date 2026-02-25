-- ═══════════════════════════════════════════════════
--  THE GOTED — Fix accept/deny buttons (cr_update policy)
--  Paste and run ONLY THIS in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Drop all existing policies (nuclear reset)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'collab_requests'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON collab_requests';
  END LOOP;
END;
$$;

-- Fix table constraints
ALTER TABLE collab_requests DROP CONSTRAINT IF EXISTS collab_requests_target_id_fkey;
ALTER TABLE collab_requests DROP CONSTRAINT IF EXISTS collab_requests_requester_id_target_id_key;
ALTER TABLE collab_requests ALTER COLUMN target_id DROP NOT NULL;

-- Recreate all policies using jwt() for email (universally supported)
CREATE POLICY "cr_insert" ON collab_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "cr_select" ON collab_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR target_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "cr_update" ON collab_requests
  FOR UPDATE USING (
    target_id = auth.uid()
    OR target_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "cr_delete" ON collab_requests
  FOR DELETE USING (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR target_email = (auth.jwt() ->> 'email')
  );
