-- Looking For request duration / expiry

DO $$
BEGIN
  IF to_regclass('public.buyer_requests') IS NULL THEN
    RAISE NOTICE 'buyer_requests missing — skip duration migration';
    RETURN;
  END IF;

  ALTER TABLE public.buyer_requests
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

  ALTER TABLE public.buyer_requests
    ADD COLUMN IF NOT EXISTS duration_days int;

  CREATE INDEX IF NOT EXISTS idx_buyer_requests_expires_at
    ON public.buyer_requests (expires_at)
    WHERE expires_at IS NOT NULL AND status = 'open';
END $$;
