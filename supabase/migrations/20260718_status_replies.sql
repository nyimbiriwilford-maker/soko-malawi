-- Status replies: viewers reply on a status without leaving the viewer.
-- Messages still deliver to the seller's chat with status identity.
-- Safe to re-run if a previous attempt created a partial table.

DO $$
BEGIN
  IF to_regclass('public.user_statuses') IS NULL THEN
    RAISE NOTICE 'user_statuses missing — skip status_replies';
    RETURN;
  END IF;

  -- Create base table if missing (columns may be incomplete from a failed run)
  CREATE TABLE IF NOT EXISTS public.status_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Add required columns if they don't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'status_id'
  ) THEN
    ALTER TABLE public.status_replies
      ADD COLUMN status_id uuid REFERENCES public.user_statuses(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'from_user'
  ) THEN
    ALTER TABLE public.status_replies ADD COLUMN from_user uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'to_user'
  ) THEN
    ALTER TABLE public.status_replies ADD COLUMN to_user uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'body'
  ) THEN
    ALTER TABLE public.status_replies ADD COLUMN body text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'listing_id'
  ) THEN
    ALTER TABLE public.status_replies ADD COLUMN listing_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'message_id'
  ) THEN
    ALTER TABLE public.status_replies ADD COLUMN message_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_replies' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.status_replies
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Indexes (only after columns exist)
  CREATE INDEX IF NOT EXISTS idx_status_replies_status
    ON public.status_replies (status_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_status_replies_to_user
    ON public.status_replies (to_user, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_status_replies_from_user
    ON public.status_replies (from_user, created_at DESC);

  ALTER TABLE public.status_replies ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "status_replies_select" ON public.status_replies;
  CREATE POLICY "status_replies_select" ON public.status_replies
    FOR SELECT TO authenticated
    USING (
      from_user = auth.uid()
      OR to_user = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_statuses s
        WHERE s.id = status_id AND s.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "status_replies_insert" ON public.status_replies;
  CREATE POLICY "status_replies_insert" ON public.status_replies
    FOR INSERT TO authenticated
    WITH CHECK (from_user = auth.uid());

  DROP POLICY IF EXISTS "status_replies_delete" ON public.status_replies;
  CREATE POLICY "status_replies_delete" ON public.status_replies
    FOR DELETE TO authenticated
    USING (from_user = auth.uid() OR to_user = auth.uid());
END $$;
