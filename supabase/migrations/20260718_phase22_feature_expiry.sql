-- ============================================================
-- Phase 2.2 — Automatic feature expiry
--
-- Source of truth: listings.featured_until > now()
-- Expired rows: featured_until cleared + legacy flags false
--               active promos marked expired
-- Scheduled via pg_cron when available (every minute).
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_featured_listings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promos int := 0;
  v_listings int := 0;
  r record;
BEGIN
  PERFORM set_config('app.allow_feature_write', 'on', true);

  -- 1) Mark past-due active promotions expired
  FOR r IN
    SELECT id, listing_id
    FROM public.listing_promotions
    WHERE promotion_type = 'featured'
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listing_promotions
    SET status = 'expired', updated_at = now()
    WHERE id = r.id;
    v_promos := v_promos + 1;
  END LOOP;

  -- 2) Clear listings whose featured_until has passed (immediate loss of featured status)
  WITH expired AS (
    SELECT id
    FROM public.listings
    WHERE featured_until IS NOT NULL
      AND featured_until <= now()
  )
  UPDATE public.listings l
  SET featured_until = null,
      is_featured = false,
      featured = false,
      promoted_until = null,
      promotion_type = CASE
        WHEN promotion_type IN ('featured', 'premium') THEN null
        ELSE promotion_type
      END
  FROM expired e
  WHERE l.id = e.id;

  GET DIAGNOSTICS v_listings = ROW_COUNT;

  -- 3) Also clear legacy flags stuck true with no valid featured_until window
  WITH stale AS (
    SELECT l.id
    FROM public.listings l
    WHERE (COALESCE(l.is_featured, false) OR COALESCE(l.featured, false))
      AND (l.featured_until IS NULL OR l.featured_until <= now())
      AND NOT EXISTS (
        SELECT 1 FROM public.listing_promotions p
        WHERE p.listing_id = l.id
          AND p.promotion_type = 'featured'
          AND p.status = 'active'
          AND (p.expires_at IS NULL OR p.expires_at > now())
      )
  )
  UPDATE public.listings l
  SET featured_until = null,
      is_featured = false,
      featured = false,
      promoted_until = null,
      promotion_type = CASE
        WHEN promotion_type IN ('featured', 'premium') THEN null
        ELSE promotion_type
      END
  FROM stale s
  WHERE l.id = s.id;

  -- 4) Realign windows still active via promo but missing featured_until
  UPDATE public.listings l
  SET featured_until = p.max_exp,
      is_featured = true,
      featured = true,
      promoted_until = p.max_exp,
      promotion_type = 'featured'
  FROM (
    SELECT listing_id, max(expires_at) AS max_exp
    FROM public.listing_promotions
    WHERE promotion_type = 'featured'
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at > now()
    GROUP BY listing_id
  ) p
  WHERE l.id = p.listing_id
    AND (l.featured_until IS NULL OR l.featured_until < p.max_exp);

  RETURN jsonb_build_object(
    'ok', true,
    'expired_promos', v_promos,
    'listings_cleared', v_listings,
    'ran_at', now()
  );
END;
$$;

-- Alias used by earlier migrations / ops
CREATE OR REPLACE FUNCTION public.expire_featured_promotions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.expire_featured_listings();
$$;

REVOKE ALL ON FUNCTION public.expire_featured_listings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_featured_promotions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_featured_listings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_featured_promotions() TO authenticated, service_role;

COMMENT ON FUNCTION public.expire_featured_listings() IS
  'Phase 2.2: expire featured when featured_until <= now(); clear flags immediately.';

-- is_currently_featured already uses featured_until > now(); reaffirm
CREATE OR REPLACE FUNCTION public.is_currently_featured(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = p_listing_id
      AND featured_until IS NOT NULL
      AND featured_until > now()
  );
$$;

-- ── Schedule automatic expiry (pg_cron when available) ──────
DO $$
BEGIN
  -- Supabase: enable extension if permitted
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not available — call expire_featured_listings() from an external scheduler';
      RETURN;
    END;
  END;

  -- Unschedule prior job if present
  BEGIN
    PERFORM cron.unschedule('soko_expire_featured_listings');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Every minute
  PERFORM cron.schedule(
    'soko_expire_featured_listings',
    '* * * * *',
    $cron$ SELECT public.expire_featured_listings(); $cron$
  );

  RAISE NOTICE 'Scheduled soko_expire_featured_listings (* * * * *)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
END $$;

-- One-shot cleanup on migrate
SELECT public.expire_featured_listings();
