-- ═══════════════════════════════════════════════════════
--  THE GOTED — Fix Collab Requests for Mindmaps
--  Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════


-- 1. Drop the foreign key constraint on collab_requests.item_id
-- We need to do this because item_id could point to the items table OR the mindmaps table.
ALTER TABLE collab_requests DROP CONSTRAINT IF EXISTS collab_requests_item_id_fkey;


-- 2. Update the trigger function to grant access to items OR mindmaps
CREATE OR REPLACE FUNCTION grant_item_access_on_accept()
RETURNS TRIGGER AS $$
BEGIN
    -- If an item request is marked as 'accepted'
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' AND NEW.item_id IS NOT NULL THEN
        
        -- Try updating the items table first
        UPDATE items
        SET shared_with = array_append(
            array_remove(shared_with, NEW.requester_id), -- Remove first to prevent duplicates
            NEW.requester_id
        )
        WHERE id = NEW.item_id;

        -- If no item was found (row count is 0), try updating the mindmaps table
        IF NOT FOUND THEN
            UPDATE mindmaps
            SET shared_with = array_append(
                array_remove(COALESCE(shared_with, '{}'::uuid[]), NEW.requester_id),
                NEW.requester_id
            )
            WHERE id = NEW.item_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
