-- Chat sources: identify marketplace / services / jobs / shops / looking-for / direct
-- Safe additive migration — all columns nullable.

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE NOTICE 'messages table missing — skip chat_sources migration';
    RETURN;
  END IF;

  ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS chat_source text;

  ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS request_id uuid;

  ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS job_id uuid;

  ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS shop_id uuid;

  -- Optional check constraint (drop/recreate so re-runs are safe)
  BEGIN
    ALTER TABLE public.messages
      DROP CONSTRAINT IF EXISTS messages_chat_source_check;
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_chat_source_check
      CHECK (
        chat_source IS NULL
        OR chat_source IN ('listing', 'service', 'job', 'shop', 'request', 'direct')
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'chat_source check skip: %', SQLERRM;
  END;

  CREATE INDEX IF NOT EXISTS idx_messages_chat_source
    ON public.messages (chat_source)
    WHERE chat_source IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_messages_request_id
    ON public.messages (request_id)
    WHERE request_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_messages_job_id
    ON public.messages (job_id)
    WHERE job_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_messages_shop_id
    ON public.messages (shop_id)
    WHERE shop_id IS NOT NULL;

  -- Backfill chat_source from existing FK columns
  UPDATE public.messages
  SET chat_source = CASE
    WHEN service_id IS NOT NULL THEN 'service'
    WHEN listing_id IS NOT NULL THEN 'listing'
    WHEN request_id IS NOT NULL THEN 'request'
    WHEN job_id IS NOT NULL THEN 'job'
    WHEN shop_id IS NOT NULL THEN 'shop'
    ELSE COALESCE(chat_source, 'direct')
  END
  WHERE chat_source IS NULL;
END $$;
