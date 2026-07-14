-- ============================================================
-- 010_rls_policies.sql
-- Purpose: Enable RLS + policies for all new profile dashboard tables
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN false
    ELSE EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  END;
$$;

-- Helper macro-style: enable RLS + common policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trust_events', 'profile_views', 'listing_views', 'listing_saves', 'listing_shares',
    'seller_daily_stats', 'marketplace_activity', 'achievement_definitions', 'user_achievements',
    'sale_orders', 'sale_reviews', 'user_blocks', 'user_sessions', 'security_events',
    'shop_invites', 'listing_boosts', 'chat_response_events'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- trust_events
DROP POLICY IF EXISTS "trust_events_select" ON public.trust_events;
CREATE POLICY "trust_events_select" ON public.trust_events FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "trust_events_insert_own" ON public.trust_events;
CREATE POLICY "trust_events_insert_own" ON public.trust_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- profile_views
DROP POLICY IF EXISTS "profile_views_insert_any" ON public.profile_views;
CREATE POLICY "profile_views_insert_any" ON public.profile_views FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "profile_views_select_owner" ON public.profile_views;
CREATE POLICY "profile_views_select_owner" ON public.profile_views FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR viewer_id = auth.uid() OR public.is_admin());

-- listing_views
DROP POLICY IF EXISTS "listing_views_insert_any" ON public.listing_views;
CREATE POLICY "listing_views_insert_any" ON public.listing_views FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "listing_views_select" ON public.listing_views;
CREATE POLICY "listing_views_select" ON public.listing_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid() OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
  );

-- listing_saves
DROP POLICY IF EXISTS "listing_saves_select_own" ON public.listing_saves;
CREATE POLICY "listing_saves_select_own" ON public.listing_saves FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));
DROP POLICY IF EXISTS "listing_saves_insert_own" ON public.listing_saves;
CREATE POLICY "listing_saves_insert_own" ON public.listing_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "listing_saves_delete_own" ON public.listing_saves;
CREATE POLICY "listing_saves_delete_own" ON public.listing_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

-- listing_shares
DROP POLICY IF EXISTS "listing_shares_insert" ON public.listing_shares;
CREATE POLICY "listing_shares_insert" ON public.listing_shares FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "listing_shares_select" ON public.listing_shares;
CREATE POLICY "listing_shares_select" ON public.listing_shares FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

-- seller_daily_stats
DROP POLICY IF EXISTS "seller_daily_stats_select" ON public.seller_daily_stats;
CREATE POLICY "seller_daily_stats_select" ON public.seller_daily_stats FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

-- marketplace_activity
DROP POLICY IF EXISTS "marketplace_activity_select" ON public.marketplace_activity;
CREATE POLICY "marketplace_activity_select" ON public.marketplace_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR actor_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "marketplace_activity_insert" ON public.marketplace_activity;
CREATE POLICY "marketplace_activity_insert" ON public.marketplace_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR actor_id = auth.uid() OR public.is_admin());

-- achievements
DROP POLICY IF EXISTS "achievement_defs_read" ON public.achievement_definitions;
CREATE POLICY "achievement_defs_read" ON public.achievement_definitions FOR SELECT TO authenticated, anon
  USING (is_active = true OR public.is_admin());
DROP POLICY IF EXISTS "user_achievements_select" ON public.user_achievements;
CREATE POLICY "user_achievements_select" ON public.user_achievements FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "user_achievements_insert_self" ON public.user_achievements;
CREATE POLICY "user_achievements_insert_self" ON public.user_achievements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- sale_orders / reviews
DROP POLICY IF EXISTS "sale_orders_select" ON public.sale_orders;
CREATE POLICY "sale_orders_select" ON public.sale_orders FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR buyer_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "sale_orders_insert_seller" ON public.sale_orders;
CREATE POLICY "sale_orders_insert_seller" ON public.sale_orders FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());
DROP POLICY IF EXISTS "sale_orders_update_seller" ON public.sale_orders;
CREATE POLICY "sale_orders_update_seller" ON public.sale_orders FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "sale_reviews_select" ON public.sale_reviews;
CREATE POLICY "sale_reviews_select" ON public.sale_reviews FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "sale_reviews_insert_buyer" ON public.sale_reviews;
CREATE POLICY "sale_reviews_insert_buyer" ON public.sale_reviews FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- blocks / sessions / security
DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own" ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_sessions_own" ON public.user_sessions;
CREATE POLICY "user_sessions_select" ON public.user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_sessions_insert" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_sessions_update" ON public.user_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "security_events_own" ON public.security_events;
CREATE POLICY "security_events_select" ON public.security_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "security_events_insert" ON public.security_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- shop invites
DROP POLICY IF EXISTS "shop_invites_select" ON public.shop_invites;
CREATE POLICY "shop_invites_select" ON public.shop_invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "shop_invites_insert" ON public.shop_invites;
CREATE POLICY "shop_invites_insert" ON public.shop_invites FOR INSERT TO authenticated WITH CHECK (inviter_id = auth.uid());
DROP POLICY IF EXISTS "shop_invites_update" ON public.shop_invites;
CREATE POLICY "shop_invites_update" ON public.shop_invites FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.is_admin());

-- boosts / response events
DROP POLICY IF EXISTS "listing_boosts_select" ON public.listing_boosts;
CREATE POLICY "listing_boosts_select" ON public.listing_boosts FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "listing_boosts_insert" ON public.listing_boosts;
CREATE POLICY "listing_boosts_insert" ON public.listing_boosts FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "chat_response_select_own" ON public.chat_response_events;
CREATE POLICY "chat_response_select_own" ON public.chat_response_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "chat_response_insert_own" ON public.chat_response_events;
CREATE POLICY "chat_response_insert_own" ON public.chat_response_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DO $$ BEGIN RAISE NOTICE '010_rls_policies applied'; END $$;
