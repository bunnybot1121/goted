-- ═══════════════════════════════════════════════════════
--  THE GOTED — Updated Reverse Item Access Flow SQL Setup
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_friend_vault(uuid);

-- This returns a JSON array of items AND mindmaps for the target_uid.
-- It ONLY includes the 'content' or 'nodes/connections' if the caller (auth.uid()) is in the item's shared_with array.
CREATE OR REPLACE FUNCTION get_friend_vault(target_uid uuid)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', sub.id,
            'user_id', sub.user_id,
            'title', sub.title,
            'type', sub.type,
            'category', sub.category,
            'status', sub.status,
            'created_at', sub.created_at,
            'content', sub.content,
            'is_shared', sub.is_shared,
            'name', sub.name
        ) ORDER BY sub.created_at DESC
    ) INTO result
    FROM (
        -- Select standard items
        SELECT 
            i.id,
            i.user_id,
            i.title,
            i.type,
            i.category,
            i.status,
            i.created_at,
            CASE WHEN auth.uid() = ANY(i.shared_with) THEN i.content ELSE NULL END as content,
            (auth.uid() = ANY(i.shared_with)) as is_shared,
            NULL as name
        FROM items i
        WHERE i.user_id = target_uid
          AND i.status = 'active'
        
        UNION ALL
        
        -- Select mind maps
        SELECT 
            m.id,
            m.user_id,
            m.name as title,
            'mindmap' as type,
            'Map' as category,
            'active' as status,
            m.updated_at as created_at,
            CASE WHEN auth.uid() = ANY(COALESCE(m.shared_with, '{}'::uuid[])) THEN 'Interactive Mind Map' ELSE NULL END as content,
            (auth.uid() = ANY(COALESCE(m.shared_with, '{}'::uuid[]))) as is_shared,
            m.name as name
        FROM mindmaps m
        WHERE m.user_id = target_uid
    ) sub;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
