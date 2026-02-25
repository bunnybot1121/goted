-- ═══════════════════════════════════════════════════
--  THE GOTED — Realtime Chat Fix
--  Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- This tells the Supabase database to broadcast INSERTs on the 
-- messages table to all subscribed web clients in real-time.
DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
