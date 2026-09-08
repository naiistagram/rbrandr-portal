-- Lets subscribed portal clients receive content changes instantly.
-- Safe to run more than once.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.content_items;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
