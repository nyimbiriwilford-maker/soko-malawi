-- Remove Jobs feature: database cleanup (run manually; do not auto-execute from app)
-- Safe/idempotent. Leaves historical migrations untouched.

DO $$
BEGIN
  -- Drop job-related tables
  IF to_regclass('public.jobs') IS NOT NULL THEN
    DROP TABLE public.jobs CASCADE;
  END IF;
  IF to_regclass('public.job_alerts') IS NOT NULL THEN
    DROP TABLE public.job_alerts CASCADE;
  END IF;
  IF to_regclass('public.cv_profiles') IS NOT NULL THEN
    DROP TABLE public.cv_profiles CASCADE;
  END IF;

  -- Remove job_id column and index from messages
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP INDEX IF EXISTS public.idx_messages_job_id;
    ALTER TABLE public.messages DROP COLUMN IF EXISTS job_id;
    UPDATE public.messages SET chat_source = 'direct' WHERE chat_source = 'job';
    BEGIN
      ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_chat_source_check;
      ALTER TABLE public.messages
        ADD CONSTRAINT messages_chat_source_check
        CHECK (
          chat_source IS NULL
          OR chat_source IN ('listing', 'service', 'shop', 'request', 'direct')
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'messages_chat_source_check skip: %', SQLERRM;
    END;
  END IF;

  -- Remove job tagging from statuses
  IF to_regclass('public.user_statuses') IS NOT NULL THEN
    UPDATE public.user_statuses SET tagged_kind = NULL, tagged_ref_id = NULL WHERE tagged_kind = 'job';
    BEGIN
      ALTER TABLE public.user_statuses DROP CONSTRAINT IF EXISTS user_statuses_tagged_kind_check;
      ALTER TABLE public.user_statuses
        ADD CONSTRAINT user_statuses_tagged_kind_check
        CHECK (
          tagged_kind IS NULL
          OR tagged_kind IN ('listing', 'service', 'shop', 'request')
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'user_statuses_tagged_kind_check skip: %', SQLERRM;
    END;
  END IF;

  -- Remove job-match notifications
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE type = 'job_match';
  END IF;
END $$;
