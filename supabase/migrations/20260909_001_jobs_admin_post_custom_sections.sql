-- Jobs: admin-only posting + admin-defined custom sections.
-- 1) Tighten jobs INSERT so only admins can post jobs.
-- 2) Add custom_sections jsonb so a job can carry sections with any
--    admin-chosen heading (array of {heading, content}).

DO $$ BEGIN
  IF public._soko_table_exists('jobs') THEN
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS custom_sections jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF public._soko_table_exists('jobs') AND public._soko_column_exists('jobs', 'poster_id') THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
    CREATE POLICY "jobs_insert" ON public.jobs
      FOR INSERT TO authenticated
      WITH CHECK (poster_id = auth.uid() AND public.is_admin());
  END IF;
END $$;
