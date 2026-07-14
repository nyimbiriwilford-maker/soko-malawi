-- ============================================================
-- 011b_verification_fix.sql
-- Purpose: One-shot repair if 011 failed mid-way on created_at.
-- Safe to run even if full fixed 011 is re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_column_exists(t text, c text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  );
$$;

DO $$
BEGIN
  IF to_regclass('public.verification_requests') IS NULL THEN
    RAISE NOTICE 'verification_requests missing — skip 011b';
    RETURN;
  END IF;

  ALTER TABLE public.verification_requests
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS admin_note text,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS payment_method text,
    ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

  IF public._soko_column_exists('verification_requests', 'submitted_at') THEN
    UPDATE public.verification_requests
    SET created_at = COALESCE(created_at, submitted_at, now())
    WHERE created_at IS NULL;
  ELSE
    UPDATE public.verification_requests
    SET created_at = COALESCE(created_at, now())
    WHERE created_at IS NULL;
  END IF;

  BEGIN
    CREATE INDEX IF NOT EXISTS idx_verification_requests_seller
      ON public.verification_requests (seller_id, created_at DESC);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_verification_requests_seller
        ON public.verification_requests (seller_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'index skip: %', SQLERRM;
    END;
  END;
END $$;
