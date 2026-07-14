-- ============================================================
-- 005_achievements.sql
-- Purpose: Achievement catalog + user unlocks + recompute RPC
-- ============================================================

CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text,
  requirement text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON public.user_achievements (user_id, unlocked_at DESC);

INSERT INTO public.achievement_definitions (id, name, description, icon, requirement, sort_order)
VALUES
  ('verified', 'Verified Seller', 'Identity confirmed on SokoMw', 'shieldCheck', 'Complete identity verification', 10),
  ('trusted', 'Trusted Seller', 'Strong trust score with buyers', 'star', 'Reach trust score 30 or 5 confirmed deals', 20),
  ('active', 'Active Seller', 'Keeping inventory live', 'package', 'Post at least 1 active listing', 30),
  ('fast', 'Fast Responder', 'Reply to buyers quickly', 'activity', 'Avg reply under 30 minutes (5+ samples)', 40),
  ('community', 'Community Member', 'Part of the local network', 'users', 'Gain a follower or follow a seller', 50),
  ('top', 'Top Seller', 'Elite marketplace reputation', 'crown', 'Reach Pro or Elite seller level', 60),
  ('early', 'Early Adopter', 'Joined SokoMw early', 'sparkles', 'Joined during launch window', 70)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  requirement = EXCLUDED.requirement,
  sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_user_id uuid, p_achievement_id text, p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL OR p_achievement_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.achievement_definitions WHERE id = p_achievement_id) THEN RETURN false; END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id, meta)
  VALUES (p_user_id, p_achievement_id, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_user_achievements(p_user_id uuid DEFAULT auth.uid())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_verified boolean := false; v_deals int := 0; v_score numeric := 0;
  v_active int := 0; v_followers int := 0; v_following int := 0;
  v_fast boolean := false; v_created timestamptz; v_tier int := 1;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COALESCE(is_verified, false), created_at, COALESCE(fast_responder, false), COALESCE(seller_level_tier, 1)
    INTO v_verified, v_created, v_fast, v_tier FROM public.profiles WHERE id = p_user_id;
  END IF;

  IF to_regclass('public.deal_confirmations') IS NOT NULL THEN
    SELECT count(*)::int INTO v_deals FROM public.deal_confirmations
    WHERE (seller_id = p_user_id OR buyer_id = p_user_id)
      AND status IN ('confirmed', 'completed', 'done', 'accepted');
  END IF;

  IF to_regclass('public.trust_scores') IS NOT NULL THEN
    SELECT COALESCE(total_score, 0) INTO v_score FROM public.trust_scores WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.listings') IS NOT NULL THEN
    SELECT count(*)::int INTO v_active FROM public.listings
    WHERE seller_id = p_user_id AND COALESCE(status, 'active') NOT IN ('sold', 'deleted');
  END IF;

  IF to_regclass('public.seller_follows') IS NOT NULL THEN
    SELECT count(*)::int INTO v_followers FROM public.seller_follows WHERE seller_id = p_user_id;
    SELECT count(*)::int INTO v_following FROM public.seller_follows WHERE follower_id = p_user_id;
  END IF;

  IF v_verified THEN PERFORM public.unlock_achievement(p_user_id, 'verified'); END IF;
  IF v_score >= 30 OR v_deals >= 5 THEN PERFORM public.unlock_achievement(p_user_id, 'trusted'); END IF;
  IF v_active >= 1 THEN PERFORM public.unlock_achievement(p_user_id, 'active'); END IF;
  IF v_fast THEN PERFORM public.unlock_achievement(p_user_id, 'fast'); END IF;
  IF v_followers >= 1 OR v_following >= 1 THEN PERFORM public.unlock_achievement(p_user_id, 'community'); END IF;
  IF v_tier >= 3 THEN PERFORM public.unlock_achievement(p_user_id, 'top'); END IF;
  IF v_created IS NOT NULL AND v_created < timestamptz '2026-06-01 00:00:00+00' THEN
    PERFORM public.unlock_achievement(p_user_id, 'early');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_achievements(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id text, name text, description text, icon text, requirement text,
  sort_order integer, unlocked boolean, unlocked_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.name, d.description, d.icon, d.requirement, d.sort_order,
         (ua.id IS NOT NULL) AS unlocked, ua.unlocked_at
  FROM public.achievement_definitions d
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_id = d.id AND ua.user_id = COALESCE(p_user_id, auth.uid())
  WHERE d.is_active = true
  ORDER BY d.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_achievement(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_user_achievements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_achievements(uuid) TO authenticated;
