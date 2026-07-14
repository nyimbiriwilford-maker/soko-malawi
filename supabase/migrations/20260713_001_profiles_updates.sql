-- ============================================================
-- 001_profiles_updates.sql
-- Purpose: Profile columns for dashboard, completion, security
-- Safe / idempotent for existing SokoMw profiles table.
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._soko_column_exists(t text, c text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  );
$$;

DO $$
BEGIN
  IF NOT public._soko_table_exists('profiles') THEN
    RAISE NOTICE 'profiles missing — skip 001';
    RETURN;
  END IF;

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS cover_url text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS last_seen timestamptz,
    ADD COLUMN IF NOT EXISTS profile_view_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS profile_completion_pct integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_response_seconds integer,
    ADD COLUMN IF NOT EXISTS response_sample_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fast_responder boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS seller_level_tier smallint NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS seller_level_name text DEFAULT 'New seller',
    ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
    ADD COLUMN IF NOT EXISTS email text;

  COMMENT ON COLUMN public.profiles.profile_view_count IS 'Denormalized public profile views';
  COMMENT ON COLUMN public.profiles.profile_completion_pct IS '0-100 profile strength for dashboard';
  COMMENT ON COLUMN public.profiles.fast_responder IS 'Avg reply under 30m with enough samples';
  COMMENT ON COLUMN public.profiles.seller_level_tier IS '1=New 2=Rising 3=Pro 4=Elite (UI cache)';
END $$;
