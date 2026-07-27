-- Banner Security & Permissions hardening.
-- 1. Restrict get_banner_performance to admins only
-- 2. Validate banner existence in increment_banner_metric
-- Safe to re-run.

-- Fix get_banner_performance: admins only (was callable by any authenticated user)
DROP FUNCTION IF EXISTS public.get_banner_performance(uuid);
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
    AND public.is_admin()
  GROUP BY hb.id, hb.title
  ORDER BY total_impressions DESC;
$$;

-- Grant to authenticated only (is_admin() check inside handles restriction)
GRANT EXECUTE ON FUNCTION public.get_banner_performance(uuid) TO authenticated;

-- Fix increment_banner_metric: validate banner exists before recording
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

  -- Only record metrics for banners that actually exist
  IF NOT EXISTS (SELECT 1 FROM public.home_banners WHERE id = p_banner_id) THEN
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

GRANT EXECUTE ON FUNCTION public.increment_banner_metric(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_banner_metric(uuid, text) TO authenticated;
