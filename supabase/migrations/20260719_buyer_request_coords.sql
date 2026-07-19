-- Optional GPS coords on Looking For posts (buyer stay) for distance estimates

DO $$
BEGIN
  IF to_regclass('public.buyer_requests') IS NULL THEN
    RAISE NOTICE 'buyer_requests missing — skip coords migration';
    RETURN;
  END IF;

  ALTER TABLE public.buyer_requests
    ADD COLUMN IF NOT EXISTS lat double precision;

  ALTER TABLE public.buyer_requests
    ADD COLUMN IF NOT EXISTS lng double precision;
END $$;
