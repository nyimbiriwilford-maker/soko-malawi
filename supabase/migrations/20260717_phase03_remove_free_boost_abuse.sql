-- ============================================================
-- Phase 0.3 — Remove free boost abuse
-- Sellers cannot obtain homepage featured via free boost / bulk boost /
-- direct listing updates. Paid feature + free entitlement RPC + admin OK.
-- ============================================================

-- ── 1. apply_listing_boost: never free-feature ──────────────
-- featured/premium requires payment_ref OR admin.
-- plain "boost" only sets boost_until (never is_featured / featured).
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

  -- Phase 0.3: featured/premium is never free for sellers
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

  IF v_type IN ('featured', 'premium') THEN
    -- Allow feature column write from this SECURITY DEFINER path
    PERFORM set_config('app.allow_feature_write', 'on', true);
    UPDATE public.listings
    SET boost_until = GREATEST(COALESCE(boost_until, now()), v_end),
        is_featured = true,
        featured = true,
        promoted_until = GREATEST(COALESCE(promoted_until, now()), v_end)
    WHERE id = p_listing_id;
  ELSE
    -- Plain boost: visibility helper only — NEVER homepage featured flags
    UPDATE public.listings
    SET boost_until = GREATEST(COALESCE(boost_until, now()), v_end)
    WHERE id = p_listing_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_listing_boost(uuid, integer, text, text) TO authenticated;

-- ── 2. listing_boosts RLS: sellers cannot insert featured/premium rows ─
DROP POLICY IF EXISTS "listing_boosts_insert" ON public.listing_boosts;
CREATE POLICY "listing_boosts_insert" ON public.listing_boosts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND COALESCE(boost_type, 'boost') = 'boost'
    )
  );

-- ── 3. Guard listings feature columns (block free client self-feature) ─
CREATE OR REPLACE FUNCTION public.guard_listing_feature_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow text;
BEGIN
  v_allow := current_setting('app.allow_feature_write', true);

  IF TG_OP = 'INSERT' THEN
    IF (COALESCE(NEW.is_featured, false) OR COALESCE(NEW.featured, false))
       AND NOT public.is_admin()
       AND v_allow IS DISTINCT FROM 'on'
    THEN
      NEW.is_featured := false;
      NEW.featured := false;
      NEW.promoted_until := null;
      -- leave promotion_type null if it was a free attempt
      IF NEW.promotion_type IN ('featured', 'premium') THEN
        NEW.promotion_type := null;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.is_featured IS DISTINCT FROM OLD.is_featured)
       OR (NEW.featured IS DISTINCT FROM OLD.featured)
       OR (NEW.promoted_until IS DISTINCT FROM OLD.promoted_until)
       OR (
         NEW.promotion_type IS DISTINCT FROM OLD.promotion_type
         AND COALESCE(NEW.promotion_type, '') IN ('featured', 'premium')
       )
    THEN
      IF public.is_admin() OR v_allow = 'on' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION
        'Feature status can only change via payment confirmation, free entitlement RPC, or admin';
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

-- ── 4. Entitlement / payment RPCs must set allow_feature_write ────────
-- Patch helpers used by Phase 0.2 feature activation so they still work.
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
      promotion_type = null
  WHERE id = p_listing_id;
END;
$$;

COMMENT ON FUNCTION public.apply_listing_boost IS
  'Phase 0.3: plain boost never sets featured; featured/premium needs payment_ref or admin.';
COMMENT ON FUNCTION public.guard_listing_feature_columns IS
  'Phase 0.3: blocks seller self-feature via direct listings updates.';
