-- ═══════════════════════════════════════════════════
--  THE GOTED — WIPE TEST DATA (Friends & Messages)
--  Run in Supabase SQL Editor to reset for production
-- ═══════════════════════════════════════════════════

-- 1. Delete all chat messages
DELETE FROM messages;

-- 2. Delete all friend requests (pending, accepted, denied)
DELETE FROM collab_requests;

-- 3. Clear any shared mind maps (optional: uncomment if you want to un-share maps)
-- UPDATE mindmaps SET shared_with = '{}';

-- Optional: If you also want to delete all Mind Maps and Items,
-- you can uncomment the lines below.
-- DELETE FROM mindmaps;
-- DELETE FROM items;
