-- Banner Analytics: daily impression & click tracking for the hero carousel.
-- Tracks banner_id + date granularity so the admin dashboard can show
-- trended performance (impressions, clicks, CTR) per banner over time.
-- Safe to re-run.

DO $$
BEGIN

  CREATE TABLE IF NOT EXISTS public.banner_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_id uuid NOT NULL REFERENCES public.home_banners(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    impressions bigint NOT NULL DEFAULT 0,
    clicks bigint NOT NULL DEFAULT 0,
    UNIQUE (banner_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_banner_analytics_banner_date
    ON public.banner_analytics (banner_id, date DESC);

  ALTER TABLE public.banner_analytics ENABLE ROW LEVEL SECURITY;

  -- Anyone can read (used by admin dashboard)
  DROP POLICY IF EXISTS "banner_analytics_select" ON public.banner_analytics;
  CREATE POLICY "banner_analytics_select" ON public.banner_analytics
    FOR SELECT USING (true);

  -- The upsert RPC is SECURITY DEFINER, so no direct INSERT/UPDATE needed
  DROP POLICY IF EXISTS "banner_analytics_no_insert" ON public.banner_analytics;
  CREATE POLICY "banner_analytics_no_insert" ON public.banner_analytics
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

  DROP POLICY IF EXISTS "banner_analytics_no_update" ON public.banner_analytics;
  CREATE POLICY "banner_analytics_no_update" ON public.banner_analytics
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

END $$;

-- RPC: atomically increment a metric (impression or click) for a banner today.
-- SECURITY DEFINER so the public-facing homepage can call it without direct table access.
CREATE OR REPLACE FUNCTION public.increment_banner_metric(
  p_banner_id uuid,
  p_metric text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_banner_id IS NULL OR p_metric NOT IN ('impression', 'click') THEN
    RETURN;
  END IF;

  INSERT INTO public.banner_analytics (banner_id, date, impressions, clicks)
  VALUES (p_banner_id, CURRENT_DATE,
    CASE WHEN p_metric = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'click' THEN 1 ELSE 0 END
  )
  ON CONFLICT (banner_id, date)
  DO UPDATE SET
    impressions = CASE
      WHEN p_metric = 'impression' THEN banner_analytics.impressions + 1
      ELSE banner_analytics.impressions
    END,
    clicks = CASE
      WHEN p_metric = 'click' THEN banner_analytics.clicks + 1
      ELSE banner_analytics.clicks
    END;
END;
$$;

-- Public-facing pages (homepage) need to call this as anon/authenticated
GRANT EXECUTE ON FUNCTION public.increment_banner_metric(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_banner_metric(uuid, text) TO authenticated;

-- Admin dashboard helper: get banner performance summary
CREATE OR REPLACE FUNCTION public.get_banner_performance(
  p_banner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  banner_id uuid,
  title text,
  total_impressions bigint,
  total_clicks bigint,
  ctr numeric,
  last_7d_impressions bigint,
  last_7d_clicks bigint,
  last_7d_ctr numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    hb.id,
    hb.title,
    COALESCE(SUM(ba.impressions), 0)::bigint AS total_impressions,
    COALESCE(SUM(ba.clicks), 0)::bigint AS total_clicks,
    CASE
      WHEN COALESCE(SUM(ba.impressions), 0) > 0
      THEN ROUND((SUM(ba.clicks)::numeric / SUM(ba.impressions)) * 100, 2)
      ELSE 0
    END AS ctr,
    COALESCE(SUM(ba.impressions) FILTER (WHERE ba.date >= CURRENT_DATE - 7), 0)::bigint AS last_7d_impressions,
    COALESCE(SUM(ba.clicks) FILTER (WHERE ba.date >= CURRENT_DATE - 7), 0)::bigint AS last_7d_clicks,
    CASE
      WHEN COALESCE(SUM(ba.impressions) FILTER (WHERE ba.date >= CURRENT_DATE - 7), 0) > 0
      THEN ROUND(
        (SUM(ba.clicks) FILTER (WHERE ba.date >= CURRENT_DATE - 7))::numeric
        / NULLIF(SUM(ba.impressions) FILTER (WHERE ba.date >= CURRENT_DATE - 7), 0)
        * 100, 2
      )
      ELSE 0
    END AS last_7d_ctr
  FROM public.home_banners hb
  LEFT JOIN public.banner_analytics ba ON ba.banner_id = hb.id
  WHERE (p_banner_id IS NULL OR hb.id = p_banner_id)
  GROUP BY hb.id, hb.title
  ORDER BY total_impressions DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_banner_performance(uuid) TO authenticated;
