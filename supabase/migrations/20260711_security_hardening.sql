-- ============================================================
-- SokoMw Security Hardening (SAFE for partial schemas)
-- Skips tables that do not exist — no 42P01 failures.
-- Apply via Supabase SQL Editor (Run) or: supabase db push
-- ============================================================

-- Helper: does table exist?
CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._soko_column_exists(t text, c text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  );
$$;

-- ── 1. OTP: code_hash ──────────────────────────────────────
DO $$
BEGIN
  IF public._soko_table_exists('otp_codes') THEN
    ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS code_hash text;

    IF public._soko_column_exists('otp_codes', 'email') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_codes_email_created
        ON public.otp_codes (email, created_at DESC)
        WHERE email IS NOT NULL;
    END IF;

    IF public._soko_column_exists('otp_codes', 'phone') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created
        ON public.otp_codes (phone, created_at DESC)
        WHERE phone IS NOT NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_otp_codes_hash
      ON public.otp_codes (code_hash)
      WHERE code_hash IS NOT NULL;

    ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "otp_codes_no_client" ON public.otp_codes;
    CREATE POLICY "otp_codes_no_client" ON public.otp_codes
      FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

    COMMENT ON COLUMN public.otp_codes.code_hash IS
      'SHA-256(identifier:code) — prefer over plaintext code';
  END IF;

  IF public._soko_table_exists('otp_attempts') THEN
    CREATE INDEX IF NOT EXISTS idx_otp_attempts_identifier_created
      ON public.otp_attempts (identifier, created_at DESC);

    ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "otp_attempts_no_client" ON public.otp_attempts;
    CREATE POLICY "otp_attempts_no_client" ON public.otp_attempts
      FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
  END IF;
END $$;

-- ── 2. profiles.email + guards ─────────────────────────────
DO $$
BEGIN
  IF NOT public._soko_table_exists('profiles') THEN
    RAISE NOTICE 'profiles table missing — skip profile hardening';
    RETURN;
  END IF;

  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

  UPDATE public.profiles p
  SET email = lower(u.email)
  FROM auth.users u
  WHERE p.id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
    ON public.profiles (lower(email))
    WHERE email IS NOT NULL AND email <> '';

  CREATE INDEX IF NOT EXISTS idx_profiles_email_lookup
    ON public.profiles (lower(email));

  COMMENT ON COLUMN public.profiles.email IS
    'Synced from auth.users; unique for admin email→id lookup';
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (id, email, full_name, updated_at)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile_email ON auth.users;
CREATE TRIGGER on_auth_user_created_profile_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile_email();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  IF NEW.is_disabled IS DISTINCT FROM OLD.is_disabled AND NOT public.is_admin() THEN
    NEW.is_disabled := OLD.is_disabled;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF public._soko_table_exists('profiles') THEN
    DROP TRIGGER IF EXISTS profiles_privilege_guard ON public.profiles;
    CREATE TRIGGER profiles_privilege_guard
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
    CREATE POLICY "profiles_select_public" ON public.profiles
      FOR SELECT TO authenticated, anon USING (true);

    DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
    CREATE POLICY "profiles_insert_own" ON public.profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

    DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = id OR public.is_admin())
      WITH CHECK (auth.uid() = id OR public.is_admin());
  END IF;
END $$;

-- ── 3. Generic RLS for known tables (only if present) ──────
-- Each block is independent so one missing table never aborts the rest.

-- users
DO $$ BEGIN
  IF public._soko_table_exists('users') THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users_select_auth" ON public.users;
    CREATE POLICY "users_select_auth" ON public.users
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "users_insert_own" ON public.users;
    CREATE POLICY "users_insert_own" ON public.users
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
    DROP POLICY IF EXISTS "users_update_own" ON public.users;
    CREATE POLICY "users_update_own" ON public.users
      FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- listings
DO $$ BEGIN
  IF public._soko_table_exists('listings') AND public._soko_column_exists('listings', 'seller_id') THEN
    ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "listings_select" ON public.listings;
    CREATE POLICY "listings_select" ON public.listings
      FOR SELECT TO authenticated, anon
      USING (
        COALESCE(status, '') IN ('published', 'active')
        OR seller_id = auth.uid()
        OR public.is_admin()
      );
    DROP POLICY IF EXISTS "listings_insert_own" ON public.listings;
    CREATE POLICY "listings_insert_own" ON public.listings
      FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
    DROP POLICY IF EXISTS "listings_update_own" ON public.listings;
    CREATE POLICY "listings_update_own" ON public.listings
      FOR UPDATE TO authenticated
      USING (seller_id = auth.uid() OR public.is_admin())
      WITH CHECK (seller_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "listings_delete_own" ON public.listings;
    CREATE POLICY "listings_delete_own" ON public.listings
      FOR DELETE TO authenticated
      USING (seller_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- shops
DO $$ BEGIN
  IF public._soko_table_exists('shops') AND public._soko_column_exists('shops', 'owner_id') THEN
    ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "shops_select" ON public.shops;
    CREATE POLICY "shops_select" ON public.shops
      FOR SELECT TO authenticated, anon
      USING (COALESCE(is_active, true) = true OR owner_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "shops_insert_own" ON public.shops;
    CREATE POLICY "shops_insert_own" ON public.shops
      FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
    DROP POLICY IF EXISTS "shops_update_own" ON public.shops;
    CREATE POLICY "shops_update_own" ON public.shops
      FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "shops_delete_own" ON public.shops;
    CREATE POLICY "shops_delete_own" ON public.shops
      FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- jobs
DO $$ BEGIN
  IF public._soko_table_exists('jobs') AND public._soko_column_exists('jobs', 'poster_id') THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
    CREATE POLICY "jobs_select" ON public.jobs
      FOR SELECT TO authenticated, anon
      USING (COALESCE(status, 'active') = 'active' OR poster_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
    CREATE POLICY "jobs_insert" ON public.jobs
      FOR INSERT TO authenticated WITH CHECK (poster_id = auth.uid());
    DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
    CREATE POLICY "jobs_update" ON public.jobs
      FOR UPDATE TO authenticated USING (poster_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
    CREATE POLICY "jobs_delete" ON public.jobs
      FOR DELETE TO authenticated USING (poster_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- services
DO $$ BEGIN
  IF public._soko_table_exists('services') AND public._soko_column_exists('services', 'provider_id') THEN
    ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "services_select" ON public.services;
    CREATE POLICY "services_select" ON public.services
      FOR SELECT TO authenticated, anon
      USING (COALESCE(status, 'active') = 'active' OR provider_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "services_insert" ON public.services;
    CREATE POLICY "services_insert" ON public.services
      FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid());
    DROP POLICY IF EXISTS "services_update" ON public.services;
    CREATE POLICY "services_update" ON public.services
      FOR UPDATE TO authenticated USING (provider_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "services_delete" ON public.services;
    CREATE POLICY "services_delete" ON public.services
      FOR DELETE TO authenticated USING (provider_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- buyer_requests
DO $$ BEGIN
  IF public._soko_table_exists('buyer_requests') AND public._soko_column_exists('buyer_requests', 'user_id') THEN
    ALTER TABLE public.buyer_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "buyer_requests_select" ON public.buyer_requests;
    CREATE POLICY "buyer_requests_select" ON public.buyer_requests
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "buyer_requests_insert" ON public.buyer_requests;
    CREATE POLICY "buyer_requests_insert" ON public.buyer_requests
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "buyer_requests_update" ON public.buyer_requests;
    CREATE POLICY "buyer_requests_update" ON public.buyer_requests
      FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
    DROP POLICY IF EXISTS "buyer_requests_delete" ON public.buyer_requests;
    CREATE POLICY "buyer_requests_delete" ON public.buyer_requests
      FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- buyer_request_offers
DO $$ BEGIN
  IF public._soko_table_exists('buyer_request_offers') AND public._soko_column_exists('buyer_request_offers', 'seller_id') THEN
    ALTER TABLE public.buyer_request_offers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "buyer_request_offers_select" ON public.buyer_request_offers;
    CREATE POLICY "buyer_request_offers_select" ON public.buyer_request_offers
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "buyer_request_offers_insert" ON public.buyer_request_offers;
    CREATE POLICY "buyer_request_offers_insert" ON public.buyer_request_offers
      FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
    DROP POLICY IF EXISTS "buyer_request_offers_update" ON public.buyer_request_offers;
    CREATE POLICY "buyer_request_offers_update" ON public.buyer_request_offers
      FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- wanted_alerts
DO $$ BEGIN
  IF public._soko_table_exists('wanted_alerts') AND public._soko_column_exists('wanted_alerts', 'user_id') THEN
    ALTER TABLE public.wanted_alerts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "wanted_alerts_own" ON public.wanted_alerts;
    CREATE POLICY "wanted_alerts_own" ON public.wanted_alerts
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- chats (ONLY if table exists — your DB currently does not have it)
DO $$ BEGIN
  IF public._soko_table_exists('chats')
     AND public._soko_column_exists('chats', 'buyer_id')
     AND public._soko_column_exists('chats', 'seller_id') THEN
    ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "chats_participant" ON public.chats;
    CREATE POLICY "chats_participant" ON public.chats
      FOR ALL TO authenticated
      USING (auth.uid() IN (buyer_id, seller_id) OR public.is_admin())
      WITH CHECK (auth.uid() IN (buyer_id, seller_id) OR public.is_admin());
  ELSIF public._soko_table_exists('chats') THEN
    -- Unknown schema: enable RLS + authenticated read/write only
    ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "chats_auth_all" ON public.chats;
    CREATE POLICY "chats_auth_all" ON public.chats
      FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- messages
DO $$ BEGIN
  IF public._soko_table_exists('messages') AND public._soko_column_exists('messages', 'sender_id') THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "messages_select" ON public.messages;
    IF public._soko_table_exists('chats')
       AND public._soko_column_exists('messages', 'chat_id')
       AND public._soko_column_exists('chats', 'buyer_id') THEN
      CREATE POLICY "messages_select" ON public.messages
        FOR SELECT TO authenticated
        USING (
          sender_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.chats c
            WHERE c.id = messages.chat_id
              AND auth.uid() IN (c.buyer_id, c.seller_id)
          )
          OR public.is_admin()
        );
    ELSE
      CREATE POLICY "messages_select" ON public.messages
        FOR SELECT TO authenticated
        USING (sender_id = auth.uid() OR public.is_admin());
    END IF;
    DROP POLICY IF EXISTS "messages_insert" ON public.messages;
    CREATE POLICY "messages_insert" ON public.messages
      FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
    DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
    CREATE POLICY "messages_update_own" ON public.messages
      FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- notifications
DO $$ BEGIN
  IF public._soko_table_exists('notifications') AND public._soko_column_exists('notifications', 'user_id') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
    CREATE POLICY "notifications_own" ON public.notifications
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- comments
DO $$ BEGIN
  IF public._soko_table_exists('comments') AND public._soko_column_exists('comments', 'user_id') THEN
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "comments_select" ON public.comments;
    CREATE POLICY "comments_select" ON public.comments
      FOR SELECT TO authenticated, anon USING (true);
    DROP POLICY IF EXISTS "comments_insert" ON public.comments;
    CREATE POLICY "comments_insert" ON public.comments
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "comments_delete" ON public.comments;
    CREATE POLICY "comments_delete" ON public.comments
      FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- user_statuses
DO $$ BEGIN
  IF public._soko_table_exists('user_statuses') AND public._soko_column_exists('user_statuses', 'user_id') THEN
    ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user_statuses_select" ON public.user_statuses;
    CREATE POLICY "user_statuses_select" ON public.user_statuses
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "user_statuses_insert" ON public.user_statuses;
    CREATE POLICY "user_statuses_insert" ON public.user_statuses
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS "user_statuses_update" ON public.user_statuses;
    CREATE POLICY "user_statuses_update" ON public.user_statuses
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "user_statuses_delete" ON public.user_statuses;
    CREATE POLICY "user_statuses_delete" ON public.user_statuses
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- status_views
DO $$ BEGIN
  IF public._soko_table_exists('status_views') AND public._soko_column_exists('status_views', 'user_id') THEN
    ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "status_views_select" ON public.status_views;
    CREATE POLICY "status_views_select" ON public.status_views
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "status_views_insert" ON public.status_views;
    CREATE POLICY "status_views_insert" ON public.status_views
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- status_reactions
DO $$ BEGIN
  IF public._soko_table_exists('status_reactions') AND public._soko_column_exists('status_reactions', 'user_id') THEN
    ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "status_reactions_select" ON public.status_reactions;
    CREATE POLICY "status_reactions_select" ON public.status_reactions
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "status_reactions_write" ON public.status_reactions;
    CREATE POLICY "status_reactions_write" ON public.status_reactions
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- saved_statuses
DO $$ BEGIN
  IF public._soko_table_exists('saved_statuses') AND public._soko_column_exists('saved_statuses', 'user_id') THEN
    ALTER TABLE public.saved_statuses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "saved_statuses_own" ON public.saved_statuses;
    CREATE POLICY "saved_statuses_own" ON public.saved_statuses
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- seller_follows
DO $$ BEGIN
  IF public._soko_table_exists('seller_follows') AND public._soko_column_exists('seller_follows', 'follower_id') THEN
    ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "seller_follows_select" ON public.seller_follows;
    CREATE POLICY "seller_follows_select" ON public.seller_follows
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "seller_follows_write" ON public.seller_follows;
    CREATE POLICY "seller_follows_write" ON public.seller_follows
      FOR ALL TO authenticated
      USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());
  END IF;
END $$;

-- shop_followers
DO $$ BEGIN
  IF public._soko_table_exists('shop_followers') AND public._soko_column_exists('shop_followers', 'user_id') THEN
    ALTER TABLE public.shop_followers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "shop_followers_select" ON public.shop_followers;
    CREATE POLICY "shop_followers_select" ON public.shop_followers
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "shop_followers_write" ON public.shop_followers;
    CREATE POLICY "shop_followers_write" ON public.shop_followers
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- trust_scores
DO $$ BEGIN
  IF public._soko_table_exists('trust_scores') AND public._soko_column_exists('trust_scores', 'user_id') THEN
    ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "trust_scores_select" ON public.trust_scores;
    CREATE POLICY "trust_scores_select" ON public.trust_scores
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "trust_scores_write" ON public.trust_scores;
    CREATE POLICY "trust_scores_write" ON public.trust_scores
      FOR ALL TO authenticated
      USING (user_id = auth.uid() OR public.is_admin())
      WITH CHECK (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- deal_confirmations
DO $$ BEGIN
  IF public._soko_table_exists('deal_confirmations')
     AND public._soko_column_exists('deal_confirmations', 'buyer_id')
     AND public._soko_column_exists('deal_confirmations', 'seller_id') THEN
    ALTER TABLE public.deal_confirmations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "deal_confirmations_participants" ON public.deal_confirmations;
    CREATE POLICY "deal_confirmations_participants" ON public.deal_confirmations
      FOR ALL TO authenticated
      USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin())
      WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- vouches
DO $$ BEGIN
  IF public._soko_table_exists('vouches') AND public._soko_column_exists('vouches', 'voucher_id') THEN
    ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "vouches_select" ON public.vouches;
    CREATE POLICY "vouches_select" ON public.vouches
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "vouches_insert" ON public.vouches;
    CREATE POLICY "vouches_insert" ON public.vouches
      FOR INSERT TO authenticated WITH CHECK (voucher_id = auth.uid());
    DROP POLICY IF EXISTS "vouches_delete_own" ON public.vouches;
    CREATE POLICY "vouches_delete_own" ON public.vouches
      FOR DELETE TO authenticated USING (voucher_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- buyer_wall
DO $$ BEGIN
  IF public._soko_table_exists('buyer_wall') AND public._soko_column_exists('buyer_wall', 'user_id') THEN
    ALTER TABLE public.buyer_wall ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "buyer_wall_select" ON public.buyer_wall;
    CREATE POLICY "buyer_wall_select" ON public.buyer_wall
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "buyer_wall_write" ON public.buyer_wall;
    CREATE POLICY "buyer_wall_write" ON public.buyer_wall
      FOR ALL TO authenticated
      USING (user_id = auth.uid() OR public.is_admin())
      WITH CHECK (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- verification_requests
DO $$ BEGIN
  IF public._soko_table_exists('verification_requests') AND public._soko_column_exists('verification_requests', 'seller_id') THEN
    ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "verification_requests_own" ON public.verification_requests;
    CREATE POLICY "verification_requests_own" ON public.verification_requests
      FOR ALL TO authenticated
      USING (seller_id = auth.uid() OR public.is_admin())
      WITH CHECK (seller_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- listing_promotions
DO $$ BEGIN
  IF public._soko_table_exists('listing_promotions') AND public._soko_column_exists('listing_promotions', 'seller_id') THEN
    ALTER TABLE public.listing_promotions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "listing_promotions_own" ON public.listing_promotions;
    CREATE POLICY "listing_promotions_own" ON public.listing_promotions
      FOR ALL TO authenticated
      USING (seller_id = auth.uid() OR public.is_admin())
      WITH CHECK (seller_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- user_interactions
DO $$ BEGIN
  IF public._soko_table_exists('user_interactions') AND public._soko_column_exists('user_interactions', 'user_id') THEN
    ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user_interactions_own" ON public.user_interactions;
    CREATE POLICY "user_interactions_own" ON public.user_interactions
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- user_searches
DO $$ BEGIN
  IF public._soko_table_exists('user_searches') AND public._soko_column_exists('user_searches', 'user_id') THEN
    ALTER TABLE public.user_searches ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user_searches_own" ON public.user_searches;
    CREATE POLICY "user_searches_own" ON public.user_searches
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- push_subscriptions
DO $$ BEGIN
  IF public._soko_table_exists('push_subscriptions') AND public._soko_column_exists('push_subscriptions', 'user_id') THEN
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
    CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- call_signals
DO $$ BEGIN
  IF public._soko_table_exists('call_signals')
     AND public._soko_column_exists('call_signals', 'from_user')
     AND public._soko_column_exists('call_signals', 'to_user') THEN
    ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "call_signals_participants" ON public.call_signals;
    CREATE POLICY "call_signals_participants" ON public.call_signals
      FOR ALL TO authenticated
      USING (from_user = auth.uid() OR to_user = auth.uid() OR public.is_admin())
      WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());
  END IF;
END $$;

-- ice_candidates
DO $$ BEGIN
  IF public._soko_table_exists('ice_candidates') THEN
    ALTER TABLE public.ice_candidates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ice_candidates_auth" ON public.ice_candidates;
    IF public._soko_column_exists('ice_candidates', 'from_user')
       AND public._soko_column_exists('ice_candidates', 'to_user') THEN
      CREATE POLICY "ice_candidates_auth" ON public.ice_candidates
        FOR ALL TO authenticated
        USING (from_user = auth.uid() OR to_user = auth.uid() OR auth.uid() IS NOT NULL)
        WITH CHECK (from_user = auth.uid() OR to_user = auth.uid() OR auth.uid() IS NOT NULL);
    ELSE
      CREATE POLICY "ice_candidates_auth" ON public.ice_candidates
        FOR ALL TO authenticated
        USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
  END IF;
END $$;

-- Cleanup helper functions are kept (used by policies via is_admin).
-- Optional: DROP FUNCTION public._soko_table_exists(text);
-- Optional: DROP FUNCTION public._soko_column_exists(text, text);

-- Done.
SELECT 'SokoMw security hardening applied (missing tables skipped).' AS result;
