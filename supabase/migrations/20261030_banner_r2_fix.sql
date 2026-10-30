-- Banner R2 fix: add image_key column and correct RLS policies.
-- Safe to re-run.

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS image_key text;

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS mobile_image_key text;

-- Row-level security
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_banners_select" ON public.home_banners;
CREATE POLICY "home_banners_select" ON public.home_banners
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "home_banners_admin_insert" ON public.home_banners;
CREATE POLICY "home_banners_admin_insert" ON public.home_banners
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "home_banners_admin_update" ON public.home_banners;
CREATE POLICY "home_banners_admin_update" ON public.home_banners
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "home_banners_admin_delete" ON public.home_banners;
CREATE POLICY "home_banners_admin_delete" ON public.home_banners
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Remove broad admin-all policy if present
DROP POLICY IF EXISTS "home_banners_admin_all" ON public.home_banners;
PY