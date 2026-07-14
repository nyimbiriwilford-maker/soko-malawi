-- ============================================================
-- 101_verification_rls_indexes.sql
-- PHASE 1 — RLS policies + performance indexes for verification
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_verification_requests_seller_status
  ON public.verification_requests (seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status_created
  ON public.verification_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_requests_payment_ref
  ON public.verification_requests (payment_ref)
  WHERE payment_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_requests_type
  ON public.verification_requests (verification_type_id)
  WHERE verification_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_requests_expires
  ON public.verification_requests (expires_at)
  WHERE expires_at IS NOT NULL AND status NOT IN ('approved', 'rejected', 'cancelled', 'expired');

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON public.profiles (verification_status)
  WHERE verification_status IS NOT NULL AND verification_status <> 'none';

CREATE INDEX IF NOT EXISTS idx_profiles_verified_at
  ON public.profiles (verified_at DESC NULLS LAST)
  WHERE COALESCE(is_verified, false) = true;

CREATE INDEX IF NOT EXISTS idx_verification_types_active
  ON public.verification_types (is_active, sort_order);

-- ── Enable RLS ───────────────────────────────────────────────
ALTER TABLE public.verification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_setting_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_status_events ENABLE ROW LEVEL SECURITY;

-- ── verification_types: public read active; admin write ─────
DROP POLICY IF EXISTS "verification_types_select" ON public.verification_types;
CREATE POLICY "verification_types_select" ON public.verification_types
  FOR SELECT TO authenticated, anon
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "verification_types_admin_all" ON public.verification_types;
CREATE POLICY "verification_types_admin_all" ON public.verification_types
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── verification_settings: read for authenticated; admin write
DROP POLICY IF EXISTS "verification_settings_select" ON public.verification_settings;
CREATE POLICY "verification_settings_select" ON public.verification_settings
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "verification_settings_admin_update" ON public.verification_settings;
CREATE POLICY "verification_settings_admin_update" ON public.verification_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "verification_settings_admin_insert" ON public.verification_settings;
CREATE POLICY "verification_settings_admin_insert" ON public.verification_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ── setting kv ───────────────────────────────────────────────
DROP POLICY IF EXISTS "verification_setting_kv_select" ON public.verification_setting_kv;
CREATE POLICY "verification_setting_kv_select" ON public.verification_setting_kv
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "verification_setting_kv_admin" ON public.verification_setting_kv;
CREATE POLICY "verification_setting_kv_admin" ON public.verification_setting_kv
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── verification_requests ────────────────────────────────────
DROP POLICY IF EXISTS "verification_requests_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_select_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_insert_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_update_own" ON public.verification_requests;

CREATE POLICY "verification_requests_select_own" ON public.verification_requests
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "verification_requests_insert_own" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

-- Sellers may update own non-terminal rows (limited fields enforced in RPCs ideally)
CREATE POLICY "verification_requests_update_own" ON public.verification_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND status IN (
        'draft', 'submitted', 'payment_pending',
        'additional_info_required', 'payment_confirmed'
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR seller_id = auth.uid()
  );

-- Prefer delete only for own cancelled/draft or admin
DROP POLICY IF EXISTS "verification_requests_delete_own" ON public.verification_requests;
CREATE POLICY "verification_requests_delete_own" ON public.verification_requests
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (seller_id = auth.uid() AND status IN ('draft', 'payment_pending', 'cancelled'))
  );

-- ── status events ────────────────────────────────────────────
DROP POLICY IF EXISTS "verification_status_events_select" ON public.verification_status_events;
CREATE POLICY "verification_status_events_select" ON public.verification_status_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.verification_requests r
      WHERE r.id = request_id AND r.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "verification_status_events_insert" ON public.verification_status_events;
CREATE POLICY "verification_status_events_insert" ON public.verification_status_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR actor_id = auth.uid());

-- Service role / security definer functions bypass RLS as designed.
COMMENT ON POLICY "verification_requests_select_own" ON public.verification_requests IS
  'Seller sees own requests; admins see all';
