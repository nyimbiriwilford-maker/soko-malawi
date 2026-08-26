-- Status comments now render publicly in the story viewer and the story feed
-- (any signed-in user can read the comment thread on any status), matching the
-- public-read treatment already applied to status_replies on 2026-08-11.
-- Writes remain restricted: insert only your own rows, delete only your own rows.
-- Safe to re-run.

DO $$ BEGIN
  IF public._soko_table_exists('status_comments') THEN
    DROP POLICY IF EXISTS "status_comments_select" ON public.status_comments;
    CREATE POLICY "status_comments_select" ON public.status_comments
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
