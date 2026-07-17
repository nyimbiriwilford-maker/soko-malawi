-- ============================================================
-- Phase 1.2 — Featured listing security (column protection + RLS)
--
-- Sellers must NOT be able to update:
--   is_featured, featured, featured_until, promoted_until, boost_until
-- (and promotion_type when used as a feature marker)
--
-- Only server-authorized paths may change those fields:
--   - SECURITY DEFINER RPCs (request_feature_*, confirm_feature_*,
--     admin_set/unset_listing_featured, expire_featured_*, apply_listing_boost
--     with payment/admin, _activate_listing_featured / _clear_featured_*)
--   - service_role
--
-- Preserves existing listings RLS for all other columns/operations.
-- ============================================================

-- ── 0. Ensure feature-related columns exist ─────────────────
DO $$ BEGIN
  IF to_regclass('public.listings') IS NULL THEN
    RAISE EXCEPTION 'public.listings does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'featured'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN featured boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'promoted_until'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN promoted_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'featured_until'
  ) THEN
    -- Alias window for future consolidation; kept in sync by RPCs when used
    ALTER TABLE public.listings ADD COLUMN featured_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'boost_until'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN boost_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'promotion_type'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN promotion_type text;
  END IF;
END $$;

-- ── 1. Preserve / reaffirm base listings RLS (non-feature) ───
-- Does not remove seller update rights for normal listing fields.
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_select" ON public.listings;
CREATE POLICY "listings_select" ON public.listings
  FOR SELECT TO authenticated, anon
  USING (
    COALESCE(status, '') IN ('published', 'active')
    OR seller_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "listings_insert_own" ON public.listings;
CREATE POLICY "listings_insert_own" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "listings_update_own" ON public.listings;
CREATE POLICY "listings_update_own" ON public.listings
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin())
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "listings_delete_own" ON public.listings;
CREATE POLICY "listings_delete_own" ON public.listings
  FOR DELETE TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

-- ── 2. Column-level privileges (sellers cannot UPDATE feature cols) ─
-- RLS cannot restrict individual columns; privileges enforce this at the
-- SQL privilege layer for roles authenticated / anon.
-- SECURITY DEFINER RPCs run as the function owner (table owner) and still
-- may update these columns. service_role is unaffected.

DO $$
DECLARE
  cols text[] := ARRAY[
    'is_featured',
    'featured',
    'featured_until',
    'promoted_until',
    'boost_until',
    'promotion_type'
  ];
  c text;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = c
    ) THEN
      EXECUTE format(
        'REVOKE UPDATE (%I) ON public.listings FROM PUBLIC, anon, authenticated',
        c
      );
    END IF;
  END LOOP;
END $$;

-- Ensure table owner still has full rights (function owner path)
DO $$ BEGIN
  -- no-op if current_user is not owner; migrations run as postgres/supabase_admin
  GRANT ALL ON public.listings TO postgres;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ── 3. Trigger guard (defense in depth if privileges are re-granted) ─
CREATE OR REPLACE FUNCTION public.guard_listing_feature_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow text;
  v_blocked boolean := false;
BEGIN
  -- Session flag set only inside authorized SECURITY DEFINER feature RPCs
  v_allow := current_setting('app.allow_feature_write', true);

  -- service_role / bypass: auth.uid() null with JWT role service_role is rare in
  -- triggers; allow explicit session flag or admin for client admin tools that
  -- still use is_admin() — BUT column REVOKE blocks non-owner roles either way.
  -- Trigger still blocks authenticated sellers who somehow regain column grants.

  IF TG_OP = 'INSERT' THEN
    IF (
         COALESCE(NEW.is_featured, false)
      OR COALESCE(NEW.featured, false)
      OR NEW.featured_until IS NOT NULL
      OR NEW.promoted_until IS NOT NULL
      OR NEW.boost_until IS NOT NULL
      OR COALESCE(NEW.promotion_type, '') IN ('featured', 'premium')
    ) AND v_allow IS DISTINCT FROM 'on'
      AND NOT public.is_admin()
    THEN
      NEW.is_featured := false;
      NEW.featured := false;
      NEW.featured_until := null;
      NEW.promoted_until := null;
      NEW.boost_until := null;
      IF COALESCE(NEW.promotion_type, '') IN ('featured', 'premium') THEN
        NEW.promotion_type := null;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
       OR NEW.featured IS DISTINCT FROM OLD.featured
       OR NEW.featured_until IS DISTINCT FROM OLD.featured_until
       OR NEW.promoted_until IS DISTINCT FROM OLD.promoted_until
       OR NEW.boost_until IS DISTINCT FROM OLD.boost_until
       OR (
         NEW.promotion_type IS DISTINCT FROM OLD.promotion_type
         AND (
           COALESCE(NEW.promotion_type, '') IN ('featured', 'premium')
           OR COALESCE(OLD.promotion_type, '') IN ('featured', 'premium')
         )
       )
    THEN
      v_blocked := true;
    END IF;

    IF v_blocked THEN
      -- Authorized server path
      IF v_allow = 'on' THEN
        RETURN NEW;
      END IF;
      -- Admin RPC path uses allow flag; direct admin client is blocked by REVOKE.
      -- Keep is_admin escape only when allow flag is set via admin_* RPCs.
      IF public.is_admin() AND v_allow = 'on' THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION
        'Not allowed to update feature fields (is_featured, featured, featured_until, promoted_until, boost_until). Use payment confirmation, free entitlement RPC, or admin RPC.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_listing_feature_columns ON public.listings;
CREATE TRIGGER trg_guard_listing_feature_columns
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_listing_feature_columns();

COMMENT ON FUNCTION public.guard_listing_feature_columns() IS
  'Phase 1.2: blocks client updates to feature/boost window columns unless app.allow_feature_write=on (SECURITY DEFINER RPCs).';

-- ── 4. Align activators to set featured_until + allow flag ──
-- Keep Phase 1.1 RPCs working with the new column.

CREATE OR REPLACE FUNCTION public._activate_listing_featured(
  p_listing_id uuid,
  p_duration_days integer,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz;
BEGIN
  PERFORM set_config('app.allow_feature_write', 'on', true);

  v_until := COALESCE(
    p_expires_at,
    now() + make_interval(days => GREATEST(COALESCE(p_duration_days, 7), 1))
  );

  UPDATE public.listings
  SET is_featured = true,
      featured = true,
      promoted_until = v_until,
      featured_until = v_until,
      promotion_type = 'featured'
  WHERE id = p_listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._clear_featured_if_no_active(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.listing_promotions p
    WHERE p.listing_id = p_listing_id
      AND p.promotion_type = 'featured'
      AND p.status = 'active'
      AND (p.expires_at IS NULL OR p.expires_at > now())
  ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.allow_feature_write', 'on', true);

  UPDATE public.listings
  SET is_featured = false,
      featured = false,
      promoted_until = null,
      featured_until = null,
      promotion_type = null
  WHERE id = p_listing_id;
END;
$$;

-- Admin unset must also clear featured_until
CREATE OR REPLACE FUNCTION public.admin_unset_listing_featured(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = p_listing_id) THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  UPDATE public.listing_promotions
  SET status = 'cancelled', updated_at = now()
  WHERE listing_id = p_listing_id
    AND promotion_type = 'featured'
    AND status = 'active';

  PERFORM set_config('app.allow_feature_write', 'on', true);

  UPDATE public.listings
  SET is_featured = false,
      featured = false,
      promoted_until = null,
      featured_until = null,
      promotion_type = null
  WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'ok', true,
    'admin', true,
    'listing_id', p_listing_id,
    'featured', false
  );
END;
$$;

-- apply_listing_boost: featured path uses allow flag; boost_until only via this RPC
CREATE OR REPLACE FUNCTION public.apply_listing_boost(
  p_listing_id uuid,
  p_days integer DEFAULT 7,
  p_boost_type text DEFAULT 'boost',
  p_payment_ref text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_id uuid;
  v_end timestamptz;
  v_type text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'Invalid boost duration';
  END IF;

  v_type := lower(trim(COALESCE(p_boost_type, 'boost')));
  IF v_type NOT IN ('boost', 'featured', 'premium') THEN
    RAISE EXCEPTION 'Invalid boost type';
  END IF;

  SELECT seller_id INTO v_seller FROM public.listings WHERE id = p_listing_id;
  IF v_seller IS NULL OR (v_seller <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not listing owner';
  END IF;

  IF v_type IN ('featured', 'premium') THEN
    IF NOT public.is_admin()
       AND (p_payment_ref IS NULL OR length(trim(p_payment_ref)) < 3) THEN
      RAISE EXCEPTION
        'Homepage featured requires payment or admin. Use Featured Listing checkout.';
    END IF;
  END IF;

  v_end := now() + make_interval(days => p_days);

  INSERT INTO public.listing_boosts (
    listing_id, seller_id, boost_type, starts_at, ends_at, payment_ref, status
  ) VALUES (
    p_listing_id, v_seller, v_type, now(), v_end, p_payment_ref, 'active'
  )
  RETURNING id INTO v_id;

  -- Always set allow flag when writing boost_until / feature columns
  PERFORM set_config('app.allow_feature_write', 'on', true);

  IF v_type IN ('featured', 'premium') THEN
    UPDATE public.listings
    SET boost_until = GREATEST(COALESCE(boost_until, now()), v_end),
        is_featured = true,
        featured = true,
        promoted_until = GREATEST(COALESCE(promoted_until, now()), v_end),
        featured_until = GREATEST(COALESCE(featured_until, now()), v_end)
    WHERE id = p_listing_id;
  ELSE
    UPDATE public.listings
    SET boost_until = GREATEST(COALESCE(boost_until, now()), v_end)
    WHERE id = p_listing_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_listing_boost(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unset_listing_featured(uuid) TO authenticated;

-- ── 5. listing_promotions: sellers cannot forge active paid features ─
ALTER TABLE public.listing_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_promotions_own" ON public.listing_promotions;
DROP POLICY IF EXISTS "listing_promotions_select_own" ON public.listing_promotions;
DROP POLICY IF EXISTS "listing_promotions_insert_own" ON public.listing_promotions;
DROP POLICY IF EXISTS "listing_promotions_update_own" ON public.listing_promotions;
DROP POLICY IF EXISTS "listing_promotions_delete_own" ON public.listing_promotions;

-- Read own (or admin)
CREATE POLICY "listing_promotions_select_own" ON public.listing_promotions
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

-- Sellers must not insert active featured rows client-side (RPCs are SECURITY DEFINER)
CREATE POLICY "listing_promotions_insert_deny_client" ON public.listing_promotions
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "listing_promotions_update_deny_client" ON public.listing_promotions
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "listing_promotions_delete_own_pending" ON public.listing_promotions
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND status = 'pending'
      AND COALESCE(price_mwk, 0) > 0
    )
  );

-- ── 6. listing_boosts: keep Phase 0.3 insert restriction ────
ALTER TABLE public.listing_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_boosts_select" ON public.listing_boosts;
CREATE POLICY "listing_boosts_select" ON public.listing_boosts
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "listing_boosts_insert" ON public.listing_boosts;
CREATE POLICY "listing_boosts_insert" ON public.listing_boosts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (seller_id = auth.uid() AND COALESCE(boost_type, 'boost') = 'boost')
  );

DROP POLICY IF EXISTS "listing_boosts_update_deny" ON public.listing_boosts;
CREATE POLICY "listing_boosts_update_deny" ON public.listing_boosts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 7. Notes ────────────────────────────────────────────────
COMMENT ON COLUMN public.listings.is_featured IS
  'Phase 1.2 protected: only SECURITY DEFINER feature RPCs may update.';
COMMENT ON COLUMN public.listings.featured IS
  'Phase 1.2 protected: only SECURITY DEFINER feature RPCs may update.';
COMMENT ON COLUMN public.listings.featured_until IS
  'Phase 1.2 protected feature window end; set by feature RPCs.';
COMMENT ON COLUMN public.listings.promoted_until IS
  'Phase 1.2 protected feature window end; set by feature RPCs.';
COMMENT ON COLUMN public.listings.boost_until IS
  'Phase 1.2 protected: only apply_listing_boost (authorized) may update.';
