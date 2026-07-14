-- ============================================================
-- 003_profile_analytics.sql
-- Purpose: Profile views, listing views/saves/shares, daily stats RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._soko_column_exists(t text, c text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  );
$$;

-- Listings analytics columns
DO $$
BEGIN
  IF public._soko_table_exists('listings') THEN
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS save_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sold_at timestamptz,
      ADD COLUMN IF NOT EXISTS sold_price numeric,
      ADD COLUMN IF NOT EXISTS boost_until timestamptz,
      ADD COLUMN IF NOT EXISTS delivery_status text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_key text,
  source text DEFAULT 'public_profile',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_created
  ON public.profile_views (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listing_views_listing_created
  ON public.listing_views (listing_id, created_at DESC);

DO $$
BEGIN
  IF public._soko_table_exists('listings') THEN
    BEGIN
      ALTER TABLE public.listing_views
        DROP CONSTRAINT IF EXISTS listing_views_listing_id_fkey;
      ALTER TABLE public.listing_views
        ADD CONSTRAINT listing_views_listing_id_fkey
        FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'listing_views FK skip: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.listing_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.listing_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text DEFAULT 'link',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  profile_views integer NOT NULL DEFAULT 0,
  listing_views integer NOT NULL DEFAULT 0,
  messages_in integer NOT NULL DEFAULT 0,
  new_followers integer NOT NULL DEFAULT 0,
  sales integer NOT NULL DEFAULT 0,
  UNIQUE (seller_id, day)
);

-- sold_at trigger
CREATE OR REPLACE FUNCTION public.listings_set_sold_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'sold' AND NEW.sold_at IS NULL THEN
      NEW.sold_at := COALESCE(NEW.updated_at, now());
      IF NEW.sold_price IS NULL AND NEW.price IS NOT NULL THEN
        NEW.sold_price := NEW.price;
      END IF;
    ELSIF NEW.status IS DISTINCT FROM 'sold' AND OLD.status = 'sold' THEN
      NEW.sold_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF public._soko_table_exists('listings') THEN
    DROP TRIGGER IF EXISTS trg_listings_set_sold_at ON public.listings;
    CREATE TRIGGER trg_listings_set_sold_at
      BEFORE UPDATE OF status ON public.listings
      FOR EACH ROW EXECUTE FUNCTION public.listings_set_sold_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_profile_view(
  p_profile_id uuid,
  p_session_key text DEFAULT NULL,
  p_source text DEFAULT 'public_profile'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent boolean := false;
BEGIN
  IF p_profile_id IS NULL OR (v_uid IS NOT NULL AND v_uid = p_profile_id) THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.profile_views pv
    WHERE pv.profile_id = p_profile_id AND pv.created_at > now() - interval '30 minutes'
      AND ((v_uid IS NOT NULL AND pv.viewer_id = v_uid) OR (p_session_key IS NOT NULL AND pv.session_key = p_session_key))
  ) INTO v_recent;
  IF v_recent THEN RETURN; END IF;
  INSERT INTO public.profile_views (profile_id, viewer_id, session_key, source)
  VALUES (p_profile_id, v_uid, p_session_key, p_source);
  IF public._soko_column_exists('profiles', 'profile_view_count') THEN
    UPDATE public.profiles SET profile_view_count = COALESCE(profile_view_count, 0) + 1 WHERE id = p_profile_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_listing_view(p_listing_id uuid, p_session_key text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent boolean := false;
BEGIN
  IF p_listing_id IS NULL THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.listing_views lv
    WHERE lv.listing_id = p_listing_id AND lv.created_at > now() - interval '30 minutes'
      AND ((v_uid IS NOT NULL AND lv.viewer_id = v_uid) OR (p_session_key IS NOT NULL AND lv.session_key = p_session_key))
  ) INTO v_recent;
  IF v_recent THEN RETURN; END IF;
  INSERT INTO public.listing_views (listing_id, viewer_id, session_key) VALUES (p_listing_id, v_uid, p_session_key);
  IF public._soko_table_exists('listings') THEN
    UPDATE public.listings SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_listing_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_listing_share(p_listing_id uuid, p_channel text DEFAULT 'link')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_listing_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.listing_shares (listing_id, user_id, channel)
  VALUES (p_listing_id, auth.uid(), COALESCE(p_channel, 'link'));
  IF public._soko_table_exists('listings') THEN
    UPDATE public.listings SET share_count = COALESCE(share_count, 0) + 1 WHERE id = p_listing_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_listing_save(p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_exists boolean;
BEGIN
  IF v_uid IS NULL OR p_listing_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.listing_saves WHERE listing_id = p_listing_id AND user_id = v_uid) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.listing_saves WHERE listing_id = p_listing_id AND user_id = v_uid;
    UPDATE public.listings SET save_count = GREATEST(COALESCE(save_count, 0) - 1, 0) WHERE id = p_listing_id;
    RETURN false;
  ELSE
    INSERT INTO public.listing_saves (listing_id, user_id) VALUES (p_listing_id, v_uid) ON CONFLICT DO NOTHING;
    UPDATE public.listings SET save_count = COALESCE(save_count, 0) + 1 WHERE id = p_listing_id;
    RETURN true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_dashboard_stats(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_active int := 0; v_sold int := 0; v_followers int := 0; v_following int := 0;
  v_deals int := 0; v_profile_views int := 0; v_listing_views int := 0;
  v_sales_rate numeric := NULL; v_avg_age numeric := NULL; v_trust numeric := NULL;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;

  IF public._soko_table_exists('listings') THEN
    SELECT
      count(*) FILTER (WHERE COALESCE(status, 'active') NOT IN ('sold', 'deleted')),
      count(*) FILTER (WHERE status = 'sold')
    INTO v_active, v_sold FROM public.listings WHERE seller_id = v_uid;
    SELECT COALESCE(sum(view_count), 0)::int INTO v_listing_views FROM public.listings WHERE seller_id = v_uid;
    SELECT avg(EXTRACT(EPOCH FROM (COALESCE(sold_at, updated_at, created_at) - created_at)) / 86400.0)
    INTO v_avg_age FROM public.listings WHERE seller_id = v_uid AND status = 'sold' AND created_at IS NOT NULL;
  END IF;

  IF public._soko_table_exists('seller_follows') THEN
    SELECT count(*)::int INTO v_followers FROM public.seller_follows WHERE seller_id = v_uid;
    SELECT count(*)::int INTO v_following FROM public.seller_follows WHERE follower_id = v_uid;
  END IF;

  IF public._soko_table_exists('deal_confirmations') THEN
    SELECT count(*)::int INTO v_deals FROM public.deal_confirmations
    WHERE (seller_id = v_uid OR buyer_id = v_uid)
      AND status IN ('confirmed', 'completed', 'done', 'accepted');
  END IF;

  IF public._soko_column_exists('profiles', 'profile_view_count') THEN
    SELECT COALESCE(profile_view_count, 0) INTO v_profile_views FROM public.profiles WHERE id = v_uid;
  ELSIF public._soko_table_exists('profile_views') THEN
    SELECT count(*)::int INTO v_profile_views FROM public.profile_views WHERE profile_id = v_uid;
  END IF;

  IF public._soko_table_exists('trust_scores') THEN
    SELECT total_score INTO v_trust FROM public.trust_scores WHERE user_id = v_uid;
  END IF;

  IF (v_active + v_sold) > 0 THEN
    v_sales_rate := round((v_sold::numeric / (v_active + v_sold)::numeric) * 100, 1);
  END IF;

  RETURN jsonb_build_object(
    'active_listings', v_active,
    'sold_listings', v_sold,
    'followers', v_followers,
    'following', v_following,
    'deals', v_deals,
    'profile_views', v_profile_views,
    'listing_views', v_listing_views,
    'sales_rate_pct', v_sales_rate,
    'avg_listing_age_days', CASE WHEN v_avg_age IS NULL THEN NULL ELSE round(v_avg_age, 1) END,
    'trust_score', v_trust
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_analytics_series(
  p_days integer DEFAULT 14,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (day date, profile_views integer, listing_views integer, sales integer, new_followers integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_days int := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series((current_date - (v_days - 1)), current_date, interval '1 day')::date AS d
  ),
  rollup AS (
    SELECT s.day, s.profile_views, s.listing_views, s.sales, s.new_followers
    FROM public.seller_daily_stats s
    WHERE s.seller_id = v_uid AND s.day >= current_date - (v_days - 1)
  )
  SELECT days.d, COALESCE(r.profile_views, 0), COALESCE(r.listing_views, 0),
         COALESCE(r.sales, 0), COALESCE(r.new_followers, 0)
  FROM days LEFT JOIN rollup r ON r.day = days.d ORDER BY days.d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_listing_view(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_listing_share(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.toggle_listing_save(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_analytics_series(integer, uuid) TO authenticated;
