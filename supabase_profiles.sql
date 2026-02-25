-- ═══════════════════════════════════════════════════
--  THE GOTED — Profiles table for user search
--  Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Public profiles table (searchable by anyone logged in)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read profiles (for search)
CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can insert/update their own profile
CREATE POLICY "profiles_write" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());


-- 2. Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


-- 3. Also fix collab_requests: target_id can now stay non-null
--    since we always have the real user_id from profiles search
--    (Keep target_id NOT NULL — no change needed if you haven't run supabase_fix_collab.sql)
--    If you already ran supabase_fix_collab.sql, this is fine as-is.

-- 4. Make sure existing users get a profile row (backfill)
INSERT INTO profiles (id, email, display_name)
SELECT id, email, split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;
