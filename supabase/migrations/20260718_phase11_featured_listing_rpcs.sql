-- ============================================================
-- Phase 1.1 — Featured listing RPC functions (server-authoritative)
--
-- Canonical set of RPCs the app / edge functions call:
--   request_feature_listing
--   request_feature_listing_payment
--   confirm_feature_payment
--   mark_feature_payment_outcome
--   admin_set_listing_featured
--   admin_unset_listing_featured
--   get_feature_eligibility
--   expire_featured_promotions
--   apply_listing_boost  (hardened; no free homepage featured)
--
-- Internal helpers:
--   _feature_price_mwk
--   _activate_listing_featured
--   _clear_featured_if_no_active
--   guard_listing_feature_columns (trigger)
--
-- Safe to re-run. Does not redefine _soko_table_exists / _soko_column_exists.
-- ============================================================

-- ── 0. Ensure is_admin() exists ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  END;
$$;

-- ── 1. Schema prerequisites (idempotent) ────────────────────
CREATE TABLE IF NOT EXISTS public.listing_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promotion_type text NOT NULL DEFAULT 'featured',
  price_mwk integer NOT NULL DEFAULT 0,
  duration_days integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'cancelled', 'failed', 'expired')),
  tx_ref text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF public._soko_table_exists('listing_promotions') THEN
    IF NOT public._soko_column_exists('listing_promotions', 'duration_days') THEN
      ALTER TABLE public.listing_promotions ADD COLUMN duration_days integer;
    END IF;
    IF NOT public._soko_column_exists('listing_promotions', 'tx_ref') THEN
      ALTER TABLE public.listing_promotions ADD COLUMN tx_ref text;
    END IF;
    IF NOT public._soko_column_exists('listing_promotions', 'updated_at') THEN
      ALTER TABLE public.listing_promotions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listing_promotions_tx_ref
  ON public.listing_promotions (tx_ref) WHERE tx_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listing_promotions_listing
  ON public.listing_promotions (listing_id, status);
CREATE INDEX IF NOT EXISTS idx_listing_promotions_seller_free
  ON public.listing_promotions (seller_id)
  WHERE promotion_type = 'featured' AND price_mwk = 0;
CREATE INDEX IF NOT EXISTS idx_listing_promotions_active_expiry
  ON public.listing_promotions (expires_at)
  WHERE status = 'active';

ALTER TABLE public.listing_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_promotions_own" ON public.listing_promotions;
CREATE POLICY "listing_promotions_own" ON public.listing_promotions
  FOR ALL TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin())
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

DO $$ BEGIN
  IF public._soko_table_exists('listings') THEN
    IF NOT public._soko_column_exists('listings', 'is_featured') THEN
      ALTER TABLE public.listings ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT public._soko_column_exists('listings', 'featured') THEN
      ALTER TABLE public.listings ADD COLUMN featured boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT public._soko_column_exists('listings', 'promoted_until') THEN
      ALTER TABLE public.listings ADD COLUMN promoted_until timestamptz;
    END IF;
    IF NOT public._soko_column_exists('listings', 'promotion_type') THEN
      ALTER TABLE public.listings ADD COLUMN promotion_type text;
    END IF;
    IF NOT public._soko_column_exists('listings', 'boost_until') THEN
      ALTER TABLE public.listings ADD COLUMN boost_until timestamptz;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('free_featured_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.listing_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boost_type text NOT NULL DEFAULT 'boost'
    CHECK (boost_type IN ('boost', 'featured', 'premium')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  payment_ref text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

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

-- ── 2. Drop existing RPC signatures (avoid 42P13 return-type errors) ─
DROP FUNCTION IF EXISTS public.confirm_feature_payment(text);
DROP FUNCTION IF EXISTS public.request_feature_listing(uuid, integer);
DROP FUNCTION IF EXISTS public.request_feature_listing(uuid);
DROP FUNCTION IF EXISTS public.request_feature_listing_payment(uuid, integer);
DROP FUNCTION IF EXISTS public.request_feature_listing_payment(uuid);
DROP FUNCTION IF EXISTS public.mark_feature_payment_outcome(text, text, text);
DROP FUNCTION IF EXISTS public.mark_feature_payment_outcome(text, text);
DROP FUNCTION IF EXISTS public.admin_set_listing_featured(uuid, integer);
DROP FUNCTION IF EXISTS public.admin_unset_listing_featured(uuid);
DROP FUNCTION IF EXISTS public.get_feature_eligibility(uuid);
DROP FUNCTION IF EXISTS public.expire_featured_promotions();
DROP FUNCTION IF EXISTS public.apply_listing_boost(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public._feature_price_mwk(integer);
DROP FUNCTION IF EXISTS public._clear_featured_if_no_active(uuid);
DROP FUNCTION IF EXISTS public._activate_listing_featured(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public._activate_listing_featured(uuid, integer);

-- ── 3. Internal helpers ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public._feature_price_mwk(p_days integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_days
    WHEN 3  THEN 1500
    WHEN 7  THEN 2500
    WHEN 30 THEN 8000
    ELSE NULL
  END;
$$;

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
  -- Bypass feature-column guard for authorized RPCs only
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

-- ── 4. Feature column guard (sellers cannot self-feature) ───
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

-- ── 5. FREE entitlement: validate then activate ─────────────
CREATE OR REPLACE FUNCTION public.request_feature_listing(
  p_listing_id uuid,
  p_duration_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_free_enabled boolean := true;
  v_free_used int := 0;
  v_free_limit int := 5;
  v_days int;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_promo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_days := COALESCE(p_duration_days, 7);
  IF v_days NOT IN (3, 7, 30) THEN
    v_days := 7;
  END IF;

  SELECT seller_id INTO v_seller FROM public.listings WHERE id = p_listing_id;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_seller <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not listing owner';
  END IF;

  SELECT COALESCE(
    (
      SELECT CASE
        WHEN value = 'true'::jsonb OR value = 'true' THEN true
        WHEN value = 'false'::jsonb OR value = 'false' THEN false
        ELSE true
      END
      FROM public.app_settings
      WHERE key = 'free_featured_enabled'
      LIMIT 1
    ),
    true
  ) INTO v_free_enabled;

  IF v_free_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Free featured listings are currently disabled';
  END IF;

  -- Free entitlement rows: price_mwk = 0 and no payment tx_ref
  SELECT count(*)::int INTO v_free_used
  FROM public.listing_promotions
  WHERE seller_id = v_seller
    AND promotion_type = 'featured'
    AND COALESCE(price_mwk, 0) = 0
    AND tx_ref IS NULL;

  IF v_free_used >= v_free_limit THEN
    RAISE EXCEPTION 'Free featured limit reached';
  END IF;

  v_expires := v_started + make_interval(days => v_days);

  INSERT INTO public.listing_promotions (
    listing_id, seller_id, promotion_type, price_mwk, duration_days,
    status, tx_ref, started_at, expires_at
  ) VALUES (
    p_listing_id, v_seller, 'featured', 0, v_days,
    'active', null, v_started, v_expires
  )
  RETURNING id INTO v_promo_id;

  PERFORM public._activate_listing_featured(p_listing_id, v_days, v_expires);

  RETURN jsonb_build_object(
    'ok', true,
    'free', true,
    'promo_id', v_promo_id,
    'listing_id', p_listing_id,
    'duration_days', v_days,
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_feature_listing(uuid, integer) TO authenticated;

-- ── 6. PAID pending: NEVER set featured flags ───────────────
CREATE OR REPLACE FUNCTION public.request_feature_listing_payment(
  p_listing_id uuid,
  p_duration_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_days int;
  v_price int;
  v_tx text;
  v_promo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_days := COALESCE(p_duration_days, 7);
  v_price := public._feature_price_mwk(v_days);
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Invalid feature duration';
  END IF;

  SELECT seller_id INTO v_seller FROM public.listings WHERE id = p_listing_id;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_seller <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not listing owner';
  END IF;

  UPDATE public.listing_promotions
  SET status = 'cancelled', updated_at = now()
  WHERE listing_id = p_listing_id
    AND promotion_type = 'featured'
    AND status = 'pending'
    AND COALESCE(price_mwk, 0) > 0;

  PERFORM public._clear_featured_if_no_active(p_listing_id);

  v_tx := 'SOKO-FEATURE-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.listing_promotions (
    listing_id, seller_id, promotion_type, price_mwk, duration_days,
    status, tx_ref, started_at, expires_at
  ) VALUES (
    p_listing_id, v_seller, 'featured', v_price, v_days,
    'pending', v_tx, null, null
  )
  RETURNING id INTO v_promo_id;

  RETURN jsonb_build_object(
    'ok', true,
    'pending', true,
    'promo_id', v_promo_id,
    'listing_id', p_listing_id,
    'tx_ref', v_tx,
    'price', v_price,
    'duration_days', v_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_feature_listing_payment(uuid, integer) TO authenticated;

-- ── 7. PAID confirm: only activation after gateway success ──
CREATE OR REPLACE FUNCTION public.confirm_feature_payment(p_tx_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo public.listing_promotions%ROWTYPE;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_days int;
BEGIN
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) < 3 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  IF left(p_tx_ref, 13) <> 'SOKO-FEATURE-' THEN
    RAISE EXCEPTION 'Not a feature payment reference';
  END IF;

  SELECT * INTO v_promo
  FROM public.listing_promotions
  WHERE tx_ref = p_tx_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature promotion not found for tx_ref';
  END IF;

  IF v_promo.status = 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_active', true,
      'listing_id', v_promo.listing_id,
      'expires_at', v_promo.expires_at,
      'featured', true
    );
  END IF;

  IF v_promo.status <> 'pending' THEN
    RAISE EXCEPTION 'Promotion is not pending (status=%)', v_promo.status;
  END IF;

  v_days := COALESCE(v_promo.duration_days, 7);
  v_expires := v_started + make_interval(days => v_days);

  UPDATE public.listing_promotions
  SET status = 'active',
      started_at = v_started,
      expires_at = v_expires,
      updated_at = now()
  WHERE id = v_promo.id;

  PERFORM public._activate_listing_featured(v_promo.listing_id, v_days, v_expires);

  RETURN jsonb_build_object(
    'ok', true,
    'listing_id', v_promo.listing_id,
    'promo_id', v_promo.id,
    'expires_at', v_expires,
    'featured', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_feature_payment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_feature_payment(text) TO service_role;

-- ── 8. FAIL / CANCEL / EXPIRE payment outcome ───────────────
CREATE OR REPLACE FUNCTION public.mark_feature_payment_outcome(
  p_tx_ref text,
  p_outcome text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo public.listing_promotions%ROWTYPE;
  v_status text;
BEGIN
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) < 3 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  v_status := CASE lower(trim(COALESCE(p_outcome, 'failed')))
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'canceled'  THEN 'cancelled'
    WHEN 'expired'   THEN 'expired'
    ELSE 'failed'
  END;

  SELECT * INTO v_promo
  FROM public.listing_promotions
  WHERE tx_ref = p_tx_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'found', false);
  END IF;

  IF v_promo.status = 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_active', true,
      'listing_id', v_promo.listing_id
    );
  END IF;

  IF v_promo.status = 'pending' THEN
    UPDATE public.listing_promotions
    SET status = v_status,
        updated_at = now()
    WHERE id = v_promo.id;
  END IF;

  PERFORM public._clear_featured_if_no_active(v_promo.listing_id);

  RETURN jsonb_build_object(
    'ok', true,
    'listing_id', v_promo.listing_id,
    'promo_id', v_promo.id,
    'status', v_status,
    'featured', false,
    'reason', p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_feature_payment_outcome(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_feature_payment_outcome(text, text, text) TO service_role;

-- ── 9. Admin grant / revoke (server-authoritative) ──────────
CREATE OR REPLACE FUNCTION public.admin_set_listing_featured(
  p_listing_id uuid,
  p_duration_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_days int;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_promo_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_days := GREATEST(COALESCE(p_duration_days, 14), 1);
  IF v_days > 365 THEN
    RAISE EXCEPTION 'Duration too long';
  END IF;

  SELECT seller_id INTO v_seller FROM public.listings WHERE id = p_listing_id;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  v_expires := v_started + make_interval(days => v_days);

  -- Cancel prior active featured promos for clean ledger
  UPDATE public.listing_promotions
  SET status = 'cancelled', updated_at = now()
  WHERE listing_id = p_listing_id
    AND promotion_type = 'featured'
    AND status = 'active';

  INSERT INTO public.listing_promotions (
    listing_id, seller_id, promotion_type, price_mwk, duration_days,
    status, tx_ref, started_at, expires_at
  ) VALUES (
    p_listing_id, v_seller, 'featured', 0, v_days,
    'active', 'ADMIN-' || replace(gen_random_uuid()::text, '-', ''),
    v_started, v_expires
  )
  RETURNING id INTO v_promo_id;

  PERFORM public._activate_listing_featured(p_listing_id, v_days, v_expires);

  RETURN jsonb_build_object(
    'ok', true,
    'admin', true,
    'promo_id', v_promo_id,
    'listing_id', p_listing_id,
    'duration_days', v_days,
    'expires_at', v_expires,
    'featured', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_listing_featured(uuid, integer) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.admin_unset_listing_featured(uuid) TO authenticated;

-- ── 10. Eligibility snapshot (read-only for clients) ────────
CREATE OR REPLACE FUNCTION public.get_feature_eligibility(p_listing_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_free_enabled boolean := true;
  v_free_used int := 0;
  v_free_limit int := 5;
  v_seller uuid;
  v_listing_featured boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(
    (
      SELECT CASE
        WHEN value = 'true'::jsonb OR value = 'true' THEN true
        WHEN value = 'false'::jsonb OR value = 'false' THEN false
        ELSE true
      END
      FROM public.app_settings
      WHERE key = 'free_featured_enabled'
      LIMIT 1
    ),
    true
  ) INTO v_free_enabled;

  SELECT count(*)::int INTO v_free_used
  FROM public.listing_promotions
  WHERE seller_id = v_uid
    AND promotion_type = 'featured'
    AND COALESCE(price_mwk, 0) = 0
    AND tx_ref IS NULL;

  IF p_listing_id IS NOT NULL THEN
    SELECT seller_id,
           COALESCE(is_featured, false) OR COALESCE(featured, false)
      INTO v_seller, v_listing_featured
    FROM public.listings
    WHERE id = p_listing_id;

    IF v_seller IS NOT NULL AND v_seller <> v_uid AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Not listing owner';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'free_featured_enabled', v_free_enabled,
    'free_used', v_free_used,
    'free_limit', v_free_limit,
    'free_remaining', GREATEST(v_free_limit - v_free_used, 0),
    'has_free_left', v_free_enabled AND v_free_used < v_free_limit,
    'listing_id', p_listing_id,
    'listing_is_featured', v_listing_featured,
    'tiers', jsonb_build_array(
      jsonb_build_object('days', 3,  'price_mwk', 1500),
      jsonb_build_object('days', 7,  'price_mwk', 2500),
      jsonb_build_object('days', 30, 'price_mwk', 8000)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feature_eligibility(uuid) TO authenticated;

-- ── 11. Expire ended promotions (cron / manual) ─────────────
CREATE OR REPLACE FUNCTION public.expire_featured_promotions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired int := 0;
  r record;
BEGIN
  -- Allow service role, authenticated admin, or scheduled job (no auth when using service role)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin or service role only';
  END IF;

  FOR r IN
    SELECT id, listing_id
    FROM public.listing_promotions
    WHERE promotion_type = 'featured'
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.listing_promotions
    SET status = 'expired', updated_at = now()
    WHERE id = r.id;

    PERFORM public._clear_featured_if_no_active(r.listing_id);
    v_expired := v_expired + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'expired_count', v_expired);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_featured_promotions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_featured_promotions() TO service_role;

-- ── 12. apply_listing_boost (no free homepage featured) ─────
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

  IF v_type IN ('featured', 'premium') THEN
    PERFORM set_config('app.allow_feature_write', 'on', true);
    UPDATE public.listings
    SET boost_until = GREATEST(COALESCE(boost_until, now()), v_end),
        is_featured = true,
        featured = true,
        promoted_until = GREATEST(COALESCE(promoted_until, now()), v_end)
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

-- ── 13. Comments ────────────────────────────────────────────
COMMENT ON FUNCTION public.request_feature_listing IS
  'Phase 1.1 free entitlement: validates quota/toggle then activates featured (SECURITY DEFINER).';
COMMENT ON FUNCTION public.request_feature_listing_payment IS
  'Phase 1.1 paid pending: creates SOKO-FEATURE tx; never sets featured flags.';
COMMENT ON FUNCTION public.confirm_feature_payment IS
  'Phase 1.1 paid confirm: activates featured only after gateway success path.';
COMMENT ON FUNCTION public.mark_feature_payment_outcome IS
  'Phase 1.1 paid fail path: cancels pending promo; clears featured if no active promo.';
COMMENT ON FUNCTION public.admin_set_listing_featured IS
  'Phase 1.1 admin grant featured for N days (server-authoritative).';
COMMENT ON FUNCTION public.admin_unset_listing_featured IS
  'Phase 1.1 admin remove featured (server-authoritative).';
COMMENT ON FUNCTION public.get_feature_eligibility IS
  'Phase 1.1 read free entitlement + price tiers for a seller/listing.';
COMMENT ON FUNCTION public.expire_featured_promotions IS
  'Phase 1.1 expire active promos past expires_at; clear listing flags.';
COMMENT ON FUNCTION public.apply_listing_boost IS
  'Phase 1.1 boost: plain boost never features; featured/premium needs payment_ref or admin.';
