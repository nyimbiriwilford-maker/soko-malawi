-- Fix: status replies vanish after refresh (write-side failure).
-- The live status_replies table carries two legacy NOT NULL columns — sender_id
-- and message — that no app code writes. The shared hook inserts only
-- status_id/from_user/to_user/body/listing_id/message_id, so every insert was
-- rejected with Postgres 23502 (not-null violation) and the reply never
-- persisted. These legacy columns are not read anywhere, so we simply drop the
-- NOT NULL constraint (existing NULLs are fine going forward). Safe to re-run.

DO $$
BEGIN
  IF public._soko_table_exists('status_replies') THEN
    IF public._soko_column_exists('status_replies', 'sender_id') THEN
      ALTER TABLE public.status_replies ALTER COLUMN sender_id DROP NOT NULL;
    END IF;
    IF public._soko_column_exists('status_replies', 'message') THEN
      ALTER TABLE public.status_replies ALTER COLUMN message DROP NOT NULL;
    END IF;
  END IF;
END $$;
