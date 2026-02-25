-- ═══════════════════════════════════════════════════
--  THE GOTED — ADD AVATARS TO PROFILES
--  Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;
