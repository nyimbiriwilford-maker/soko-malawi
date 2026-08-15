-- Fix: status_replies insert failing with PGRST200.
-- The shared hook embeds the author via `author:profiles!from_user(...)`, which
-- requires a foreign key from status_replies.from_user -> profiles(id). The live
-- table only had FKs on sender_id (legacy) and status_id — never on from_user —
-- so PostgREST could not find the relationship and rejected the insert's select.
-- This adds the missing FK (matching the status_reactions.user_id /
-- status_views.viewer_id pattern) and reloads the PostgREST schema cache so the
-- relationship is visible immediately. Safe to re-run.

DO $$
BEGIN
  IF public._soko_table_exists('status_replies')
     AND public._soko_column_exists('status_replies', 'from_user')
     AND public._soko_table_exists('profiles') THEN

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'status_replies'
        AND c.contype = 'f'
        AND c.conname = 'status_replies_from_user_fkey'
    ) THEN
      ALTER TABLE public.status_replies
        ADD CONSTRAINT status_replies_from_user_fkey
        FOREIGN KEY (from_user) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

  END IF;
END $$;

-- Ask PostgREST to reload its schema cache so the new relationship is picked up
-- without waiting for the automatic cache refresh.
NOTIFY pgrst, 'reload schema';
