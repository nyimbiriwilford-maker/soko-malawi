-- ============================================================
-- Phase 1.3 — Secure admin feature control (RPC-only)
--
-- Admins feature / unfeature ONLY via:
--   admin_set_listing_featured(listing_id, duration_days)
--   admin_unset_listing_featured(listing_id)
--
-- Sellers (non-admin authenticated) always get "Admin only".
-- Direct listings / listing_promotions client writes remain blocked
-- by Phase 1.2 column REVOKE + RLS + guard trigger.
-- ============================================================

-- ── 1. Admin SET featured ───────────────────────────────────
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
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id required';
  END IF;

  v_days := GREATEST(COALESCE(p_duration_days, 14), 1);
  IF v_days > 365 THEN
    RAISE EXCEPTION 'Duration too long (max 365 days)';
  END IF;

  SELECT seller_id INTO v_seller FROM public.listings WHERE id = p_listing_id;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  v_expires := v_started + make_interval(days => v_days);

  -- Close any currently active featured promos for this listing
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
    'active',
    'ADMIN-' || replace(gen_random_uuid()::text, '-', ''),
    v_started, v_expires
  )
  RETURNING id INTO v_promo_id;

  -- Server-only flag write (sets app.allow_feature_write)
  PERFORM public._activate_listing_featured(p_listing_id, v_days, v_expires);

  RETURN jsonb_build_object(
    'ok', true,
    'admin', true,
    'promo_id', v_promo_id,
    'listing_id', p_listing_id,
    'duration_days', v_days,
    'started_at', v_started,
    'expires_at', v_expires,
    'featured', true
  );
END;
$$;

-- ── 2. Admin UNSET featured ─────────────────────────────────
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
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = p_listing_id) THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  UPDATE public.listing_promotions
  SET status = 'cancelled', updated_at = now()
  WHERE listing_id = p_listing_id
    AND promotion_type = 'featured'
    AND status IN ('active', 'pending');

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

-- ── 3. Privileges: no PUBLIC execute; authenticated only ────
REVOKE ALL ON FUNCTION public.admin_set_listing_featured(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unset_listing_featured(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_listing_featured(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unset_listing_featured(uuid) TO authenticated;

-- service_role may call for ops tooling
GRANT EXECUTE ON FUNCTION public.admin_set_listing_featured(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_unset_listing_featured(uuid) TO service_role;

COMMENT ON FUNCTION public.admin_set_listing_featured(uuid, integer) IS
  'Phase 1.3: admin-only grant of homepage featured for N days (SECURITY DEFINER). Sellers always rejected.';
COMMENT ON FUNCTION public.admin_unset_listing_featured(uuid) IS
  'Phase 1.3: admin-only remove of homepage featured (SECURITY DEFINER). Sellers always rejected.';
