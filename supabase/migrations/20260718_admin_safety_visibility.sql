-- Allow admins to view all user reports and blocks in the admin Safety tab.

DO $$
BEGIN
  -- user_reports: admin full read + update status
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_reports_admin_select" ON public.user_reports;
    CREATE POLICY "user_reports_admin_select" ON public.user_reports
      FOR SELECT TO authenticated
      USING (
        reporter_id = auth.uid()
        OR public.is_admin()
      );

    DROP POLICY IF EXISTS "user_reports_admin_update" ON public.user_reports;
    CREATE POLICY "user_reports_admin_update" ON public.user_reports
      FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- status values used by admin UI
    ALTER TABLE public.user_reports
      ADD COLUMN IF NOT EXISTS admin_note text;
  END IF;

  -- user_blocks: admin can list all blocks and remove them
  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_blocks_admin_select" ON public.user_blocks;
    CREATE POLICY "user_blocks_admin_select" ON public.user_blocks
      FOR SELECT TO authenticated
      USING (
        blocker_id = auth.uid()
        OR blocked_id = auth.uid()
        OR public.is_admin()
      );

    DROP POLICY IF EXISTS "user_blocks_admin_delete" ON public.user_blocks;
    CREATE POLICY "user_blocks_admin_delete" ON public.user_blocks
      FOR DELETE TO authenticated
      USING (
        blocker_id = auth.uid()
        OR public.is_admin()
      );
  END IF;
END $$;
