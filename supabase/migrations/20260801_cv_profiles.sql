-- ============================================================
-- cv_profiles: per-user parsed CV data for job matching.
-- Task 14 step 1 — schema only, no matching/notifications.
-- Safe / idempotent for existing SokoMw database.
-- ============================================================

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.cv_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    cv_url text,
    raw_text text,
    skills text[],
    job_titles text[],
    experience_years int,
    sectors text[],
    parsed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Owner-only access, mirroring the jobs_insert/jobs_update owner pattern
  ALTER TABLE public.cv_profiles ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "cv_profiles_select" ON public.cv_profiles;
  CREATE POLICY "cv_profiles_select" ON public.cv_profiles
    FOR SELECT TO authenticated, anon
    USING (user_id = auth.uid() OR public.is_admin());

  DROP POLICY IF EXISTS "cv_profiles_insert" ON public.cv_profiles;
  CREATE POLICY "cv_profiles_insert" ON public.cv_profiles
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "cv_profiles_update" ON public.cv_profiles;
  CREATE POLICY "cv_profiles_update" ON public.cv_profiles
    FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

  DROP POLICY IF EXISTS "cv_profiles_delete" ON public.cv_profiles;
  CREATE POLICY "cv_profiles_delete" ON public.cv_profiles
    FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
END $$;

-- Add nullable AI-matching columns to jobs (used by step 2 matching)
DO $$
BEGIN
  IF public._soko_table_exists('jobs') THEN
    ALTER TABLE public.jobs
      ADD COLUMN IF NOT EXISTS required_skills text[],
      ADD COLUMN IF NOT EXISTS sector text,
      ADD COLUMN IF NOT EXISTS experience_level text;
  END IF;
END $$;
