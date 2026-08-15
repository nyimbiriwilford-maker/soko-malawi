-- ============================================================
-- job_alerts: per-user keyword job alerts.
-- Safe to run: uses IF NOT EXISTS so it won't fail if already applied.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.job_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_alerts_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

-- Owner-only read/write
DROP POLICY IF EXISTS "job_alerts_select" ON public.job_alerts;
CREATE POLICY "job_alerts_select" ON public.job_alerts
  FOR SELECT TO authenticated, anon
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "job_alerts_insert" ON public.job_alerts;
CREATE POLICY "job_alerts_insert" ON public.job_alerts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "job_alerts_update" ON public.job_alerts;
CREATE POLICY "job_alerts_update" ON public.job_alerts
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "job_alerts_delete" ON public.job_alerts;
CREATE POLICY "job_alerts_delete" ON public.job_alerts
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
