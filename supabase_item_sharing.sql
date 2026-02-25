-- ═══════════════════════════════════════════════════
--  THE GOTED — Item Granular Sharing SQL Setup
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Add shared_with array to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS shared_with uuid[] DEFAULT '{}';

-- 2. Drop the old blanket "collab_peek" policy
DROP POLICY IF EXISTS "items_collab_peek" ON items;

-- 3. Replace with a granular sharing policy
-- Users can read an item if its owner explicitly added their UUID to shared_with
CREATE POLICY "items_shared_read" ON items
  FOR SELECT USING (auth.uid() = ANY(shared_with));

-- NOTE: The "items_owner_select", "items_owner_insert", "items_owner_update",
-- and "items_owner_delete" policies should already be in place from previous scripts.
-- Specifically, owners can always SELECT their own items.
