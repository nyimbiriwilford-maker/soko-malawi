-- Story feed (Facebook-style) needs to show comments on any status to any signed-in user.
-- Mirrors status_views / status_reactions (already authenticated read-all). Safe to re-run.

DO $$ BEGIN
  IF public._soko_table_exists('status_replies') THEN
    DROP POLICY IF EXISTS "status_replies_select" ON public.status_replies;
    CREATE POLICY "status_replies_select" ON public.status_replies
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
