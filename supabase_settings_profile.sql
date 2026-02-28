-- ═══════════════════════════════════════════════════
--  THE GOTED — Profile Settings Update
--  Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Add columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Backfill existing profiles with a unique username based on email
DO $$
DECLARE
    r RECORD;
    base_username text;
    new_username text;
    counter integer;
BEGIN
    FOR r IN SELECT id, email FROM profiles WHERE username IS NULL LOOP
        base_username := split_part(r.email, '@', 1);
        new_username := base_username;
        counter := 0;
        
        -- Find a unique username
        WHILE EXISTS (SELECT 1 FROM profiles WHERE username = new_username AND id != r.id) LOOP
            counter := counter + 1;
            new_username := base_username || counter::text;
        END LOOP;
        
        UPDATE profiles SET username = new_username WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Now make username UNIQUE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;


-- 4. Update the handle_new_user trigger to assign a default unique username
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username text;
  new_username text;
  counter integer := 0;
BEGIN
  -- Extract prefix from email as base username
  base_username := split_part(new.email, '@', 1);
  new_username := base_username;

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
    counter := counter + 1;
    new_username := base_username || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, email, display_name, username)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    new_username
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
