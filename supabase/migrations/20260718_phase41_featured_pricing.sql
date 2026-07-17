-- ============================================================
-- Phase 4.1 — Single Featured Listing pricing
-- One price: MWK 2,500 · One duration: 7 days · One paid flow
-- ============================================================

CREATE OR REPLACE FUNCTION public._feature_price_mwk(p_days integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  -- Only the single product is valid; ignore alternate day counts
  SELECT CASE
    WHEN p_days IS NULL OR p_days = 7 THEN 2500
    ELSE 2500  -- always one price (duration forced to 7 by payment RPC)
  END;
$$;

-- Paid pending: always 7 days / 2500 MWK regardless of client input
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
  v_days int := 7;
  v_price int := 2500;
  v_tx text;
  v_promo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Phase 4.1: single product — ignore alternate durations
  v_days := 7;
  v_price := 2500;

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

-- Free entitlement also uses the single duration (7 days)
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
  v_days int := 7;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_promo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Phase 4.1: one duration only
  v_days := 7;

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

-- Eligibility exposes single tier only
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
           (featured_until IS NOT NULL AND featured_until > now())
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
    'product', jsonb_build_object(
      'id', 'featured',
      'name', 'Featured Listing',
      'price_mwk', 2500,
      'duration_days', 7
    ),
    'tiers', jsonb_build_array(
      jsonb_build_object('days', 7, 'price_mwk', 2500)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feature_eligibility(uuid) TO authenticated;

COMMENT ON FUNCTION public._feature_price_mwk(integer) IS
  'Phase 4.1: single Featured product price MWK 2500 (7 days).';
COMMENT ON FUNCTION public.request_feature_listing_payment(uuid, integer) IS
  'Phase 4.1: pending paid feature — always 7 days / MWK 2500.';
COMMENT ON FUNCTION public.request_feature_listing(uuid, integer) IS
  'Phase 4.1: free entitlement feature — always 7 days.';
