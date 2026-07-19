-- Allow status posts to tag listings, jobs, services, shops, or looking-for requests.

DO $$
BEGIN
  IF to_regclass('public.user_statuses') IS NULL THEN
    RAISE NOTICE 'user_statuses missing — skip status tag entities';
    RETURN;
  END IF;

  ALTER TABLE public.user_statuses
    ADD COLUMN IF NOT EXISTS tagged_kind text;

  ALTER TABLE public.user_statuses
    ADD COLUMN IF NOT EXISTS tagged_ref_id uuid;

  -- Backfill listing tags
  UPDATE public.user_statuses
  SET tagged_kind = 'listing',
      tagged_ref_id = COALESCE(tagged_ref_id, tagged_listing_id)
  WHERE tagged_listing_id IS NOT NULL
    AND (tagged_kind IS NULL OR tagged_kind = '');

  BEGIN
    ALTER TABLE public.user_statuses
      DROP CONSTRAINT IF EXISTS user_statuses_tagged_kind_check;
    ALTER TABLE public.user_statuses
      ADD CONSTRAINT user_statuses_tagged_kind_check
      CHECK (
        tagged_kind IS NULL
        OR tagged_kind IN ('listing', 'job', 'service', 'shop', 'request')
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'tagged_kind check skip: %', SQLERRM;
  END;

  CREATE INDEX IF NOT EXISTS idx_user_statuses_tagged_ref
    ON public.user_statuses (tagged_kind, tagged_ref_id)
    WHERE tagged_ref_id IS NOT NULL;
END $$;
