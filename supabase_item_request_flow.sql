-- ═══════════════════════════════════════════════════════
--  THE GOTED — Reverse Item Access Flow SQL Setup
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Add item_id and item_title to collab_requests so users can request specific items
ALTER TABLE collab_requests ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE collab_requests ADD COLUMN IF NOT EXISTS item_title text;

-- 2. Create the RPC function for securely browsing a friend's vault
-- Drop existing variations to avoid signature conflicts
DROP FUNCTION IF EXISTS get_friend_vault(uuid);

-- This returns a JSON array of items for the target_uid.
-- It ONLY includes the 'content' if the caller (auth.uid()) is in the item's shared_with array.
-- Using JSON bypasses strict Postgres return type matching errors entirely.
CREATE OR REPLACE FUNCTION get_friend_vault(target_uid uuid)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', i.id,
            'user_id', i.user_id,
            'title', i.title,
            'type', i.type,
            'category', i.category,
            'status', i.status,
            'tags', i.tags,
            'created_at', i.created_at,
            'shared_with', i.shared_with,
            'content', CASE WHEN auth.uid() = ANY(i.shared_with) THEN i.content ELSE NULL END,
            'is_shared', (auth.uid() = ANY(i.shared_with))
        ) ORDER BY i.created_at DESC
    ) INTO result
    FROM items i
    WHERE i.user_id = target_uid
      AND i.status = 'active';

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger function to automatically grant access when a request is accepted
CREATE OR REPLACE FUNCTION grant_item_access_on_accept()
RETURNS TRIGGER AS $$
BEGIN
    -- If an item request is marked as 'accepted'
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' AND NEW.item_id IS NOT NULL THEN
        -- Add the requester's ID to the item's shared_with array
        UPDATE items
        SET shared_with = array_append(
            array_remove(shared_with, NEW.requester_id), -- Remove first to prevent duplicates
            NEW.requester_id
        )
        WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the trigger to collab_requests
DROP TRIGGER IF EXISTS tr_grant_item_access ON collab_requests;
CREATE TRIGGER tr_grant_item_access
AFTER UPDATE ON collab_requests
FOR EACH ROW
EXECUTE FUNCTION grant_item_access_on_accept();
