-- ============================================================
-- Phase 2.1 — featured_until as single source of truth
--
-- 1. Ensure public.listings.featured_until exists
-- 2. Backfill from existing promotions / promoted_until / flags
-- 3. Keep legacy booleans (is_featured, featured) in sync for
--    existing readers (no UI changes required)
-- 4. Activator/clear helpers write featured_until first
--
-- Does not drop is_featured / featured / promoted_until (preserve data).
-- ============================================================

-- ── 1. Column ───────────────────────────────────────────────
DO $$ BEGIN
  IF to_regclass('public.listings') IS NULL THEN
    RAISE EXCEPTION 'public.listings does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'featured_until'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN featured_until timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN public.listings.featured_until IS
  'Phase 2.1 single source of truth for homepage featured window end. Listing is featured when featured_until > now().';

CREATE INDEX IF NOT EXISTS idx_listings_featured_until_active
  ON public.listings (featured_until DESC)
  WHERE featured_until IS NOT NULL;

-- ── 2. Backfill (preserve / derive from existing data) ──────
-- Guard trigger blocks feature-column writes unless allow flag is set.
-- Temporarily disable feature guards for migration bulk UPDATE only.
DO $$ BEGIN
  ALTER TABLE public.listings DISABLE TRIGGER trg_guard_listing_feature_columns;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.listings DISABLE TRIGGER trg_sync_legacy_featured_from_until;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Also set session flag (defense in depth if trigger name differs)
SELECT set_config('app.allow_feature_write', 'on', true);

-- Priority for each listing:
--   a) max expires_at of active featured promotions still valid
--   b) promoted_until if set
--   c) featured_until if already set (keep)
--   d) if is_featured OR featured and still no end → now() + 7 days
--      (avoids silent loss of currently-flagged featured rows)

UPDATE public.listings l
SET featured_until = sub.best_until
FROM (
  SELECT
    l2.id AS listing_id,
    COALESCE(
      -- a) best active promotion end
      (
        SELECT max(p.expires_at)
        FROM public.listing_promotions p
        WHERE p.listing_id = l2.id
          AND p.promotion_type = 'featured'
          AND p.status = 'active'
          AND (p.expires_at IS NULL OR p.expires_at > now())
      ),
      -- b) legacy promoted_until
      CASE
        WHEN l2.promoted_until IS NOT NULL AND l2.promoted_until > now()
          THEN l2.promoted_until
        ELSE NULL
      END,
      -- c) already-populated featured_until
      CASE
        WHEN l2.featured_until IS NOT NULL AND l2.featured_until > now()
          THEN l2.featured_until
        ELSE NULL
      END,
      -- d) flagged featured with no window → grant 7 days from now
      CASE
        WHEN COALESCE(l2.is_featured, false) OR COALESCE(l2.featured, false)
          THEN now() + interval '7 days'
        ELSE NULL
      END
    ) AS best_until
  FROM public.listings l2
) sub
WHERE l.id = sub.listing_id
  AND sub.best_until IS NOT NULL
  AND (
    l.featured_until IS NULL
    OR l.featured_until < sub.best_until
  );

-- Clear featured_until when past (stale window) and no active promo
UPDATE public.listings l
SET featured_until = null
WHERE l.featured_until IS NOT NULL
  AND l.featured_until <= now()
  AND NOT EXISTS (
    SELECT 1 FROM public.listing_promotions p
    WHERE p.listing_id = l.id
      AND p.promotion_type = 'featured'
      AND p.status = 'active'
      AND (p.expires_at IS NULL OR p.expires_at > now())
  );

-- ── 3. Sync legacy booleans + promoted_until from featured_until ─
-- Read path: featured || is_featured still works in existing app code.
UPDATE public.listings
SET
  is_featured = (featured_until IS NOT NULL AND featured_until > now()),
  featured    = (featured_until IS NOT NULL AND featured_until > now()),
  promoted_until = CASE
    WHEN featured_until IS NOT NULL AND featured_until > now() THEN featured_until
    ELSE null
  END
WHERE true;

-- Re-enable feature guards after bulk backfill
DO $$ BEGIN
  ALTER TABLE public.listings ENABLE TRIGGER trg_guard_listing_feature_columns;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.listings ENABLE TRIGGER trg_sync_legacy_featured_from_until;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ── 4. Helper: currently featured? ──────────────────────────
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

GRANT EXECUTE ON FUNCTION public.is_currently_featured(uuid) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.is_currently_featured(uuid) IS
  'Phase 2.1: true iff listings.featured_until > now().';

-- ── 5. Keep legacy columns in sync whenever featured_until changes ─
CREATE OR REPLACE FUNCTION public.sync_legacy_featured_from_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when featured_until is part of the write
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.featured_until IS DISTINCT FROM OLD.featured_until) THEN
    IF NEW.featured_until IS NOT NULL AND NEW.featured_until > now() THEN
      NEW.is_featured := true;
      NEW.featured := true;
      NEW.promoted_until := NEW.featured_until;
      IF NEW.promotion_type IS NULL OR NEW.promotion_type = '' THEN
        NEW.promotion_type := 'featured';
      END IF;
    ELSE
      -- expired or cleared
      NEW.is_featured := false;
      NEW.featured := false;
      NEW.promoted_until := null;
      IF NEW.promotion_type IN ('featured', 'premium') THEN
        NEW.promotion_type := null;
      END IF;
      IF NEW.featured_until IS NOT NULL AND NEW.featured_until <= now() THEN
        NEW.featured_until := null;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_featured_from_until ON public.listings;
CREATE TRIGGER trg_sync_legacy_featured_from_until
  BEFORE INSERT OR UPDATE OF featured_until ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_featured_from_until();

COMMENT ON FUNCTION public.sync_legacy_featured_from_until() IS
  'Phase 2.1: derives is_featured / featured / promoted_until from featured_until.';

-- ── 6. Activators write featured_until as source of truth ───
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

  -- featured_until is authoritative; legacy sync trigger fills booleans
  UPDATE public.listings
  SET featured_until = v_until,
      promotion_type = 'featured'
  WHERE id = p_listing_id;

  -- Explicit legacy write for environments without UPDATE OF trigger firing order issues
  UPDATE public.listings
  SET is_featured = true,
      featured = true,
      promoted_until = v_until
  WHERE id = p_listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._clear_featured_if_no_active(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz;
BEGIN
  -- If another active promo remains, set window to its end (not full clear)
  SELECT max(p.expires_at) INTO v_until
  FROM public.listing_promotions p
  WHERE p.listing_id = p_listing_id
    AND p.promotion_type = 'featured'
    AND p.status = 'active'
    AND (p.expires_at IS NULL OR p.expires_at > now());

  PERFORM set_config('app.allow_feature_write', 'on', true);

  IF v_until IS NOT NULL THEN
    UPDATE public.listings
    SET featured_until = v_until,
        is_featured = true,
        featured = true,
        promoted_until = v_until,
        promotion_type = 'featured'
    WHERE id = p_listing_id;
    RETURN;
  END IF;

  UPDATE public.listings
  SET featured_until = null,
      is_featured = false,
      featured = false,
      promoted_until = null,
      promotion_type = null
  WHERE id = p_listing_id;
END;
$$;

-- Admin unset clears featured_until
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
  SET featured_until = null,
      is_featured = false,
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

GRANT EXECUTE ON FUNCTION public.admin_unset_listing_featured(uuid) TO authenticated, service_role;

-- Expire job: clear by featured_until + promo ledger
CREATE OR REPLACE FUNCTION public.expire_featured_promotions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo_expired int := 0;
  v_listings_cleared int := 0;
  r record;
BEGIN
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
    v_promo_expired := v_promo_expired + 1;
  END LOOP;

  PERFORM set_config('app.allow_feature_write', 'on', true);

  -- Clear listings whose featured_until lapsed with no active promo
  WITH stale AS (
    SELECT l.id
    FROM public.listings l
    WHERE l.featured_until IS NOT NULL
      AND l.featured_until <= now()
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
      promotion_type = null
  FROM stale
  WHERE l.id = stale.id;

  GET DIAGNOSTICS v_listings_cleared = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'expired_promos', v_promo_expired,
    'listings_cleared', v_listings_cleared
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_featured_promotions() TO authenticated, service_role;

-- ── 7. Guard includes featured_until (Phase 1.2 alignment) ──
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
  v_allow := current_setting('app.allow_feature_write', true);

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

    IF v_blocked AND v_allow IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION
        'Not allowed to update feature fields. Use feature RPCs (featured_until is source of truth).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure column still revoked for clients
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'featured_until'
  ) THEN
    REVOKE UPDATE (featured_until) ON public.listings FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
