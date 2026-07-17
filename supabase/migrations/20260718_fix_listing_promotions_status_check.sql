-- ============================================================
-- Fix listing_promotions status check (allow pending for paid flow)
-- 1) Normalize any legacy status values
-- 2) Re-add CHECK including pending
-- 3) Reaffirm request_feature_listing_payment
-- ============================================================

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.listing_promotions') IS NULL THEN
    RAISE EXCEPTION 'listing_promotions does not exist';
  END IF;

  -- Drop existing status CHECKs
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'listing_promotions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.listing_promotions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Normalize legacy / invalid status values so the new CHECK can apply
UPDATE public.listing_promotions
SET status = 'cancelled'
WHERE lower(trim(status)) IN ('canceled', 'cancel', 'void', 'revoked', 'inactive');

UPDATE public.listing_promotions
SET status = 'expired'
WHERE lower(trim(status)) IN ('complete', 'completed', 'done', 'ended', 'finished');

UPDATE public.listing_promotions
SET status = 'active'
WHERE lower(trim(status)) IN ('live', 'running', 'success', 'confirmed')
   OR status IS NULL
   OR trim(status) = '';

UPDATE public.listing_promotions
SET status = 'failed'
WHERE lower(trim(status)) IN ('error', 'fail', 'declined', 'rejected');

UPDATE public.listing_promotions
SET status = 'pending'
WHERE lower(trim(status)) IN ('awaiting', 'processing', 'initiated', 'open');

-- Catch-all: anything still outside the allowed set → cancelled
UPDATE public.listing_promotions
SET status = 'cancelled'
WHERE status IS NULL
   OR status NOT IN ('pending', 'active', 'cancelled', 'failed', 'expired');

-- Nullable windows for pending rows
DO $$ BEGIN
  BEGIN
    ALTER TABLE public.listing_promotions ALTER COLUMN started_at DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.listing_promotions ALTER COLUMN expires_at DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Add constraint only after data is clean
ALTER TABLE public.listing_promotions
  DROP CONSTRAINT IF EXISTS listing_promotions_status_check;

ALTER TABLE public.listing_promotions
  ADD CONSTRAINT listing_promotions_status_check
  CHECK (status IN ('pending', 'active', 'cancelled', 'failed', 'expired'));

-- Pending payment RPC
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
    NULL;
  END;

  v_tx := 'SOKO-FEATURE-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.listing_promotions (
    listing_id, seller_id, promotion_type, price_mwk, duration_days,
    status, tx_ref, started_at, expires_at, created_at, updated_at
  ) VALUES (
    p_listing_id, v_seller, 'featured', v_price, v_days,
    'pending', v_tx, v_now, null, v_now, v_now
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
