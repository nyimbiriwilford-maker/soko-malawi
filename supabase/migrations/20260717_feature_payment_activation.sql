-- ============================================================
-- 20260717_feature_payment_activation.sql
-- Phase 0.2: Featured only after free validation OR paid confirm.
-- Pending payment never sets is_featured / featured.
-- Failed / cancelled / expired payments never leave listing featured.
-- ============================================================

-- Reuse existing helpers public._soko_table_exists(t) / _soko_column_exists(t, c)
-- Do NOT CREATE OR REPLACE them here — parameter rename causes 42P13 on production.

-- ── listing_promotions ledger ───────────────────────────────
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

ALTER TABLE public.listing_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_promotions_own" ON public.listing_promotions;
CREATE POLICY "listing_promotions_own" ON public.listing_promotions
  FOR ALL TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin())
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

-- Ensure feature columns on listings
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
  END IF;
END $$;

-- app_settings for free feature toggle
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('free_featured_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Drop existing feature RPCs first.
-- Production may already have confirm_feature_payment(text) (etc.) with a different
-- return type; CREATE OR REPLACE cannot change return type (42P13).
DROP FUNCTION IF EXISTS public.confirm_feature_payment(text);
DROP FUNCTION IF EXISTS public.request_feature_listing(uuid, integer);
DROP FUNCTION IF EXISTS public.request_feature_listing(uuid);
DROP FUNCTION IF EXISTS public.request_feature_listing_payment(uuid, integer);
DROP FUNCTION IF EXISTS public.request_feature_listing_payment(uuid);
DROP FUNCTION IF EXISTS public.mark_feature_payment_outcome(text, text, text);
DROP FUNCTION IF EXISTS public.mark_feature_payment_outcome(text, text);
DROP FUNCTION IF EXISTS public._feature_price_mwk(integer);
DROP FUNCTION IF EXISTS public._clear_featured_if_no_active(uuid);
DROP FUNCTION IF EXISTS public._activate_listing_featured(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public._activate_listing_featured(uuid, integer);

-- Price table (must match PostListing FEATURED_TIERS)
CREATE OR REPLACE FUNCTION public._feature_price_mwk(p_days integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_days
    WHEN 3  THEN 1500
    WHEN 7  THEN 2500
    WHEN 30 THEN 8000
    ELSE NULL
  END;
$$;

-- Clear featured flags only if no other active featured promotion remains
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

  UPDATE public.listings
  SET is_featured = false,
      featured = false,
      promoted_until = null,
      promotion_type = null
  WHERE id = p_listing_id;
END;
$$;

-- Grant featured flags from a confirmed / free active promotion
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

-- ── FREE: validate eligibility then activate (no payment) ───
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
    -- free path still allows common durations; default 7 if odd
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

  -- Match client: count free featured rows (price_mwk = 0) for this seller
  SELECT count(*)::int INTO v_free_used
  FROM public.listing_promotions
  WHERE seller_id = v_seller
    AND promotion_type = 'featured'
    AND COALESCE(price_mwk, 0) = 0;

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
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_feature_listing(uuid, integer) TO authenticated;

-- ── PAID: create pending row only — NEVER set featured flags ─
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

  -- Cancel any previous unpaid pending feature for this listing
  UPDATE public.listing_promotions
  SET status = 'cancelled', updated_at = now()
  WHERE listing_id = p_listing_id
    AND promotion_type = 'featured'
    AND status = 'pending'
    AND COALESCE(price_mwk, 0) > 0;

  -- Ensure listing is not featured from a stale pending state
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

  -- Explicitly do NOT touch listings.is_featured / featured / promoted_until

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

-- ── PAID CONFIRM: only path that activates paid featured ────
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

  -- Idempotent: already activated
  IF v_promo.status = 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_active', true,
      'listing_id', v_promo.listing_id,
      'expires_at', v_promo.expires_at
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

-- Service role (edge) and authenticated (post-gateway client fallback)
GRANT EXECUTE ON FUNCTION public.confirm_feature_payment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_feature_payment(text) TO service_role;

-- ── FAIL / CANCEL / EXPIRE: never leave listing featured ────
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

  -- Do not demote an already-paid active promo
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

  -- Ensure listing is not featured solely because of a failed payment attempt
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

COMMENT ON FUNCTION public.request_feature_listing IS
  'Phase 0.2 free-feature: validates free quota then activates featured flags.';
COMMENT ON FUNCTION public.request_feature_listing_payment IS
  'Phase 0.2 paid pending: creates SOKO-FEATURE tx row; never sets featured flags.';
COMMENT ON FUNCTION public.confirm_feature_payment IS
  'Phase 0.2 paid confirm: activates featured only after gateway success path calls this.';
COMMENT ON FUNCTION public.mark_feature_payment_outcome IS
  'Phase 0.2 paid fail path: cancels pending promo and clears featured if no active promo.';
