-- ============================================================
-- Fix: pending feature payments insert started_at = null, but
-- production listing_promotions.started_at is NOT NULL → 400.
--
-- 1) Allow null started_at / expires_at for pending rows
-- 2) request_feature_listing_payment sets started_at = now()
--    as placeholder; confirm_feature_payment overwrites on pay
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.listing_promotions') IS NULL THEN
    RAISE EXCEPTION 'listing_promotions does not exist';
  END IF;

  -- Drop NOT NULL if present (pending promos may not have started yet)
  BEGIN
    ALTER TABLE public.listing_promotions
      ALTER COLUMN started_at DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE public.listing_promotions
      ALTER COLUMN expires_at DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
END $$;

-- Paid pending: always set started_at (placeholder) so NOT NULL envs still work
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
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Phase 4.1 single product
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
  SET status = 'cancelled', updated_at = v_now
  WHERE listing_id = p_listing_id
    AND promotion_type = 'featured'
    AND status = 'pending'
    AND COALESCE(price_mwk, 0) > 0;

  BEGIN
    PERFORM public._clear_featured_if_no_active(p_listing_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- non-fatal if helper missing
  END;

  v_tx := 'SOKO-FEATURE-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.listing_promotions (
    listing_id, seller_id, promotion_type, price_mwk, duration_days,
    status, tx_ref, started_at, expires_at, created_at, updated_at
  ) VALUES (
    p_listing_id, v_seller, 'featured', v_price, v_days,
    'pending', v_tx,
    v_now,           -- placeholder (payment not confirmed yet)
    null,            -- expires only after confirm
    v_now, v_now
  )
  RETURNING id INTO v_promo_id;

  -- Do NOT set listings.is_featured / featured_until here

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

COMMENT ON FUNCTION public.request_feature_listing_payment(uuid, integer) IS
  'Pending paid feature: started_at set to now() as placeholder; real window set on confirm_feature_payment.';
