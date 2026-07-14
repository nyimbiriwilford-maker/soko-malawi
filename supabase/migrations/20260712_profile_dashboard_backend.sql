-- ============================================================
-- SokoMw — Profile Dashboard Backend (Phases 4–10 placeholders)
-- SAFE / idempotent for partial schemas.
-- Apply: Supabase SQL Editor → Run, or: supabase db push
--
-- Covers backend needs for:
--   Profile views · Listing views/saves · Sold analytics
--   Boost/featured helpers · Bulk-friendly RPCs
--   Buyer reviews · Delivery status · Invoices/receipts
--   Response-time (Fast Responder) · Achievements
--   Trust timeline events · People you may know
--   Block user · Shop invites · Message deep-links metadata
-- Does NOT remove or break existing tables/RPCs.
-- ============================================================

-- ── Helpers (shared with security migration if already present) ──
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

-- Safe admin helper if security migration not yet applied
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  END;
$$;

-- ============================================================
-- 1. LISTINGS — analytics + sold metadata columns
-- ============================================================
DO $$
BEGIN
  IF NOT public._soko_table_exists('listings') THEN
    RAISE NOTICE 'listings missing — skip listing columns';
    RETURN;
  END IF;

  ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS save_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sold_at timestamptz,
    ADD COLUMN IF NOT EXISTS sold_price numeric,
    ADD COLUMN IF NOT EXISTS boost_until timestamptz,
    ADD COLUMN IF NOT EXISTS delivery_status text
      CHECK (delivery_status IS NULL OR delivery_status IN (
        'none', 'pending', 'in_transit', 'delivered', 'cancelled'
      ));

  -- Mirror common featured flags used by the app
  IF NOT public._soko_column_exists('listings', 'is_featured') THEN
    ALTER TABLE public.listings ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT public._soko_column_exists('listings', 'featured') THEN
    ALTER TABLE public.listings ADD COLUMN featured boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT public._soko_column_exists('listings', 'category') THEN
    ALTER TABLE public.listings ADD COLUMN category text;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_listings_seller_status
    ON public.listings (seller_id, status);
  CREATE INDEX IF NOT EXISTS idx_listings_seller_sold_at
    ON public.listings (seller_id, sold_at DESC NULLS LAST)
    WHERE status = 'sold';
  CREATE INDEX IF NOT EXISTS idx_listings_category
    ON public.listings (category)
    WHERE category IS NOT NULL;

  COMMENT ON COLUMN public.listings.view_count IS 'Denormalized listing detail views';
  COMMENT ON COLUMN public.listings.save_count IS 'Denormalized saves/bookmarks count';
  COMMENT ON COLUMN public.listings.sold_at IS 'When listing was marked sold';
  COMMENT ON COLUMN public.listings.boost_until IS 'Boost/featured expiry timestamp';
  COMMENT ON COLUMN public.listings.delivery_status IS 'Post-sale delivery lifecycle (placeholder-ready)';
END $$;

-- Auto-set sold_at when status flips to sold
CREATE OR REPLACE FUNCTION public.listings_set_sold_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'sold' AND NEW.sold_at IS NULL THEN
      NEW.sold_at := COALESCE(NEW.updated_at, now());
      IF NEW.sold_price IS NULL AND NEW.price IS NOT NULL THEN
        NEW.sold_price := NEW.price;
      END IF;
    ELSIF NEW.status IS DISTINCT FROM 'sold' AND OLD.status = 'sold' THEN
      -- Relist: clear sold markers
      NEW.sold_at := NULL;
      NEW.delivery_status := COALESCE(NEW.delivery_status, 'none');
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
      FOR EACH ROW
      EXECUTE FUNCTION public.listings_set_sold_at();
  END IF;
END $$;

-- ============================================================
-- 2. LISTING VIEWS & SAVES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_created
  ON public.listing_views (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_viewer
  ON public.listing_views (viewer_id, created_at DESC)
  WHERE viewer_id IS NOT NULL;

-- Dedup same viewer/session within a short window handled in RPC; keep raw events
COMMENT ON TABLE public.listing_views IS 'Impression/detail open events for seller analytics';

CREATE TABLE IF NOT EXISTS public.listing_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_saves_user
  ON public.listing_saves (user_id, created_at DESC);

COMMENT ON TABLE public.listing_saves IS 'Users who saved/bookmarked a listing';

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_views_insert_any" ON public.listing_views;
CREATE POLICY "listing_views_insert_any" ON public.listing_views
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "listing_views_select_owner" ON public.listing_views;
CREATE POLICY "listing_views_select_owner" ON public.listing_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
    OR viewer_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "listing_saves_own" ON public.listing_saves;
CREATE POLICY "listing_saves_select_own" ON public.listing_saves
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
    OR public.is_admin()
  );
CREATE POLICY "listing_saves_insert_own" ON public.listing_saves
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "listing_saves_delete_own" ON public.listing_saves
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RPC: record listing view (+ increment denormalized counter, throttled per user/session 30m)
CREATE OR REPLACE FUNCTION public.record_listing_view(
  p_listing_id uuid,
  p_session_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent boolean := false;
BEGIN
  IF p_listing_id IS NULL OR to_regclass('public.listings') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.listing_views lv
    WHERE lv.listing_id = p_listing_id
      AND lv.created_at > now() - interval '30 minutes'
      AND (
        (v_uid IS NOT NULL AND lv.viewer_id = v_uid)
        OR (p_session_key IS NOT NULL AND lv.session_key = p_session_key)
      )
  ) INTO v_recent;

  IF v_recent THEN
    RETURN;
  END IF;

  INSERT INTO public.listing_views (listing_id, viewer_id, session_key)
  VALUES (p_listing_id, v_uid, p_session_key);

  UPDATE public.listings
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_listing_view(uuid, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.toggle_listing_save(p_listing_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_uid IS NULL OR p_listing_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.listing_saves
    WHERE listing_id = p_listing_id AND user_id = v_uid
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.listing_saves
    WHERE listing_id = p_listing_id AND user_id = v_uid;
    UPDATE public.listings
    SET save_count = GREATEST(COALESCE(save_count, 0) - 1, 0)
    WHERE id = p_listing_id;
    RETURN false;
  ELSE
    INSERT INTO public.listing_saves (listing_id, user_id)
    VALUES (p_listing_id, v_uid)
    ON CONFLICT (listing_id, user_id) DO NOTHING;
    UPDATE public.listings
    SET save_count = COALESCE(save_count, 0) + 1
    WHERE id = p_listing_id;
    RETURN true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_listing_save(uuid) TO authenticated;

-- ============================================================
-- 3. PROFILE VIEWS (Public profile analytics)
-- ============================================================
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
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer
  ON public.profile_views (viewer_id, created_at DESC)
  WHERE viewer_id IS NOT NULL;

COMMENT ON TABLE public.profile_views IS 'Public profile page views for seller dashboard KPI';

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_views_insert_any" ON public.profile_views;
CREATE POLICY "profile_views_insert_any" ON public.profile_views
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "profile_views_select_owner" ON public.profile_views;
CREATE POLICY "profile_views_select_owner" ON public.profile_views
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR viewer_id = auth.uid() OR public.is_admin());

-- Optional denormalized counter on profiles
DO $$
BEGIN
  IF public._soko_table_exists('profiles') THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS profile_view_count integer NOT NULL DEFAULT 0;
    COMMENT ON COLUMN public.profiles.profile_view_count IS
      'Denormalized public profile view count';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_profile_view(
  p_profile_id uuid,
  p_session_key text DEFAULT NULL,
  p_source text DEFAULT 'public_profile'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent boolean := false;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;
  -- Don't count self-views
  IF v_uid IS NOT NULL AND v_uid = p_profile_id THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_views pv
    WHERE pv.profile_id = p_profile_id
      AND pv.created_at > now() - interval '30 minutes'
      AND (
        (v_uid IS NOT NULL AND pv.viewer_id = v_uid)
        OR (p_session_key IS NOT NULL AND pv.session_key = p_session_key)
      )
  ) INTO v_recent;

  IF v_recent THEN
    RETURN;
  END IF;

  INSERT INTO public.profile_views (profile_id, viewer_id, session_key, source)
  VALUES (p_profile_id, v_uid, p_session_key, p_source);

  IF public._soko_table_exists('profiles')
     AND public._soko_column_exists('profiles', 'profile_view_count') THEN
    UPDATE public.profiles
    SET profile_view_count = COALESCE(profile_view_count, 0) + 1
    WHERE id = p_profile_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid, text, text) TO authenticated, anon;

-- ============================================================
-- 4. USER BLOCKS (Network future action)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
  ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON public.user_blocks (blocked_id);

COMMENT ON TABLE public.user_blocks IS 'Users blocked from interacting with blocker';

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid blocked user';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
  VALUES (auth.uid(), p_blocked_id, p_reason)
  ON CONFLICT (blocker_id, blocked_id) DO UPDATE
    SET reason = EXCLUDED.reason;

  -- Best-effort: drop follow edges both ways
  IF public._soko_table_exists('seller_follows') THEN
    DELETE FROM public.seller_follows
    WHERE (seller_id = auth.uid() AND follower_id = p_blocked_id)
       OR (seller_id = p_blocked_id AND follower_id = auth.uid());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.user_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ============================================================
-- 5. SHOP INVITES (Network future action)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

-- Optional FK to shops if table exists
DO $$
BEGIN
  IF public._soko_table_exists('shops') THEN
    BEGIN
      ALTER TABLE public.shop_invites
        DROP CONSTRAINT IF EXISTS shop_invites_shop_id_fkey;
      ALTER TABLE public.shop_invites
        ADD CONSTRAINT shop_invites_shop_id_fkey
        FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'shop_invites FK to shops skipped: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shop_invites_invitee
  ON public.shop_invites (invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_invites_inviter
  ON public.shop_invites (inviter_id, created_at DESC);

COMMENT ON TABLE public.shop_invites IS 'Invite a user to a shop (future Network action)';

ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_invites_parties" ON public.shop_invites;
CREATE POLICY "shop_invites_select" ON public.shop_invites
  FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.is_admin());
CREATE POLICY "shop_invites_insert" ON public.shop_invites
  FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid());
CREATE POLICY "shop_invites_update_parties" ON public.shop_invites
  FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 6. SALE ORDERS / RECEIPTS / DELIVERY (Sold dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sale_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_id uuid, -- optional link to deal_confirmations.id when present
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MWK',
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  delivery_status text NOT NULL DEFAULT 'none'
    CHECK (delivery_status IN ('none', 'pending', 'in_transit', 'delivered', 'cancelled')),
  invoice_number text,
  receipt_url text,
  notes text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_orders_seller_sold
  ON public.sale_orders (seller_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_orders_buyer
  ON public.sale_orders (buyer_id, sold_at DESC)
  WHERE buyer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_orders_invoice_unique
  ON public.sale_orders (invoice_number)
  WHERE invoice_number IS NOT NULL;

COMMENT ON TABLE public.sale_orders IS
  'Completed sales ledger for invoices, receipts, delivery status';

ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_orders_parties" ON public.sale_orders;
CREATE POLICY "sale_orders_select" ON public.sale_orders
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR buyer_id = auth.uid() OR public.is_admin());
CREATE POLICY "sale_orders_insert_seller" ON public.sale_orders
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "sale_orders_update_seller" ON public.sale_orders
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

-- Buyer reviews on completed sales / deals
CREATE TABLE IF NOT EXISTS public.sale_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_order_id uuid REFERENCES public.sale_orders(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, sale_order_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_reviews_seller
  ON public.sale_reviews (seller_id, created_at DESC);

COMMENT ON TABLE public.sale_reviews IS 'Buyer reviews after completed sales';

ALTER TABLE public.sale_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_reviews_policies" ON public.sale_reviews;
CREATE POLICY "sale_reviews_select" ON public.sale_reviews
  FOR SELECT TO authenticated, anon
  USING (true);
CREATE POLICY "sale_reviews_insert_buyer" ON public.sale_reviews
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "sale_reviews_update_buyer" ON public.sale_reviews
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid());

-- Helper: create sale_order when listing marked sold (optional, from client or trigger)
CREATE OR REPLACE FUNCTION public.create_sale_order_from_listing(
  p_listing_id uuid,
  p_buyer_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing record;
  v_id uuid;
  v_invoice text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_listing.seller_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not listing owner';
  END IF;

  v_invoice := 'SKO-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.sale_orders (
    listing_id, seller_id, buyer_id, amount, status, delivery_status, invoice_number, sold_at
  ) VALUES (
    p_listing_id,
    v_listing.seller_id,
    p_buyer_id,
    COALESCE(p_amount, v_listing.sold_price, v_listing.price, 0),
    'completed',
    'none',
    v_invoice,
    COALESCE(v_listing.sold_at, now())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale_order_from_listing(uuid, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_sale_delivery_status(
  p_order_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_status NOT IN ('none', 'pending', 'in_transit', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid delivery status';
  END IF;

  UPDATE public.sale_orders
  SET delivery_status = p_status,
      updated_at = now()
  WHERE id = p_order_id
    AND (seller_id = auth.uid() OR public.is_admin());

  -- Keep listing in sync when linked
  UPDATE public.listings l
  SET delivery_status = p_status
  FROM public.sale_orders o
  WHERE o.id = p_order_id
    AND l.id = o.listing_id
    AND o.seller_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_sale_delivery_status(uuid, text) TO authenticated;

-- ============================================================
-- 7. LISTING BOOSTS (disabled Boost button backend)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listing_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boost_type text NOT NULL DEFAULT 'boost'
    CHECK (boost_type IN ('boost', 'featured', 'premium')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  payment_ref text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_boosts_listing
  ON public.listing_boosts (listing_id, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_boosts_seller
  ON public.listing_boosts (seller_id, created_at DESC);

COMMENT ON TABLE public.listing_boosts IS 'Paid boost/featured windows for listings';

ALTER TABLE public.listing_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_boosts_select" ON public.listing_boosts
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());
CREATE POLICY "listing_boosts_insert" ON public.listing_boosts
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_listing_boost(
  p_listing_id uuid,
  p_days integer DEFAULT 7,
  p_boost_type text DEFAULT 'boost',
  p_payment_ref text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_id uuid;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'Invalid boost duration';
  END IF;

  SELECT seller_id INTO v_seller FROM public.listings WHERE id = p_listing_id;
  IF v_seller IS NULL OR (v_seller <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not listing owner';
  END IF;

  v_end := now() + make_interval(days => p_days);

  INSERT INTO public.listing_boosts (
    listing_id, seller_id, boost_type, starts_at, ends_at, payment_ref, status
  ) VALUES (
    p_listing_id, v_seller, COALESCE(p_boost_type, 'boost'), now(), v_end, p_payment_ref, 'active'
  )
  RETURNING id INTO v_id;

  UPDATE public.listings
  SET boost_until = GREATEST(COALESCE(boost_until, now()), v_end),
      is_featured = CASE WHEN p_boost_type IN ('featured', 'premium') THEN true ELSE is_featured END,
      featured = CASE WHEN p_boost_type IN ('featured', 'premium') THEN true ELSE featured END
  WHERE id = p_listing_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_listing_boost(uuid, integer, text, text) TO authenticated;

-- ============================================================
-- 8. CHAT RESPONSE METRICS (Fast Responder achievement)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_response_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid,
  inbound_at timestamptz NOT NULL,
  replied_at timestamptz,
  response_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_response_user
  ON public.chat_response_events (user_id, created_at DESC);

COMMENT ON TABLE public.chat_response_events IS
  'Per-reply latency samples for Fast Responder analytics';

ALTER TABLE public.chat_response_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_response_select_own" ON public.chat_response_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "chat_response_insert_own" ON public.chat_response_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Denormalized rolling stats on profiles
DO $$
BEGIN
  IF public._soko_table_exists('profiles') THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS avg_response_seconds integer,
      ADD COLUMN IF NOT EXISTS response_sample_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fast_responder boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_chat_response(
  p_chat_id uuid,
  p_inbound_at timestamptz,
  p_replied_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_secs integer;
  v_avg integer;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_inbound_at IS NULL OR p_replied_at IS NULL OR p_replied_at < p_inbound_at THEN
    RETURN;
  END IF;

  v_secs := GREATEST(0, EXTRACT(EPOCH FROM (p_replied_at - p_inbound_at))::integer);

  INSERT INTO public.chat_response_events (user_id, chat_id, inbound_at, replied_at, response_seconds)
  VALUES (v_uid, p_chat_id, p_inbound_at, p_replied_at, v_secs);

  IF public._soko_table_exists('profiles') THEN
    SELECT
      COALESCE(avg_response_seconds, 0),
      COALESCE(response_sample_count, 0)
    INTO v_avg, v_count
    FROM public.profiles WHERE id = v_uid;

    IF v_count = 0 THEN
      v_avg := v_secs;
      v_count := 1;
    ELSE
      v_avg := ((v_avg * v_count) + v_secs) / (v_count + 1);
      v_count := v_count + 1;
    END IF;

    UPDATE public.profiles
    SET avg_response_seconds = v_avg,
        response_sample_count = v_count,
        -- Fast responder: avg under 30 minutes with at least 5 samples
        fast_responder = (v_count >= 5 AND v_avg <= 1800)
    WHERE id = v_uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_chat_response(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 9. ACHIEVEMENTS
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

COMMENT ON TABLE public.achievement_definitions IS 'Catalog of badges for Trust Center';
COMMENT ON TABLE public.user_achievements IS 'Unlocked badges per user';

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achievement_defs_read" ON public.achievement_definitions;
CREATE POLICY "achievement_defs_read" ON public.achievement_definitions
  FOR SELECT TO authenticated, anon
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "user_achievements_read" ON public.user_achievements;
CREATE POLICY "user_achievements_select" ON public.user_achievements
  FOR SELECT TO authenticated, anon
  USING (true);
CREATE POLICY "user_achievements_insert_self" ON public.user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

INSERT INTO public.achievement_definitions (id, name, description, icon, requirement, sort_order)
VALUES
  ('verified', 'Verified Seller', 'Identity confirmed on SokoMw', '🛡️', 'Complete identity verification', 10),
  ('trusted', 'Trusted Seller', 'Strong trust score with buyers', '⭐', 'Reach trust score 30 or 5 confirmed deals', 20),
  ('active', 'Active Seller', 'Keeping inventory live', '📦', 'Post at least 1 active listing', 30),
  ('fast', 'Fast Responder', 'Reply to buyers quickly', '⚡', 'Avg reply under 30 minutes (5+ samples)', 40),
  ('community', 'Community Member', 'Part of the local network', '👥', 'Gain a follower or follow a seller', 50),
  ('top', 'Top Seller', 'Elite marketplace reputation', '♛', 'Reach Pro or Elite seller level', 60),
  ('early', 'Early Adopter', 'Joined SokoMw early', '🌱', 'Joined during launch window', 70)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      requirement = EXCLUDED.requirement,
      sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.unlock_achievement(
  p_user_id uuid,
  p_achievement_id text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_achievement_id IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.achievement_definitions WHERE id = p_achievement_id) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id, meta)
  VALUES (p_user_id, p_achievement_id, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_achievement(uuid, text, jsonb) TO authenticated;

-- Recompute common achievements from existing signals
CREATE OR REPLACE FUNCTION public.recompute_user_achievements(p_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean := false;
  v_deals integer := 0;
  v_score numeric := 0;
  v_active integer := 0;
  v_followers integer := 0;
  v_following integer := 0;
  v_fast boolean := false;
  v_created timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF public._soko_table_exists('profiles') THEN
    SELECT COALESCE(is_verified, false), created_at, COALESCE(fast_responder, false)
    INTO v_verified, v_created, v_fast
    FROM public.profiles WHERE id = p_user_id;
  END IF;

  IF public._soko_table_exists('deal_confirmations') THEN
    SELECT count(*)::integer INTO v_deals
    FROM public.deal_confirmations
    WHERE (seller_id = p_user_id OR buyer_id = p_user_id)
      AND status IN ('confirmed', 'completed', 'done');
  END IF;

  IF public._soko_table_exists('trust_scores') THEN
    SELECT COALESCE(total_score, 0) INTO v_score
    FROM public.trust_scores WHERE user_id = p_user_id;
  END IF;

  IF public._soko_table_exists('listings') THEN
    SELECT count(*)::integer INTO v_active
    FROM public.listings
    WHERE seller_id = p_user_id
      AND COALESCE(status, 'active') NOT IN ('sold', 'deleted');
  END IF;

  IF public._soko_table_exists('seller_follows') THEN
    SELECT count(*)::integer INTO v_followers
    FROM public.seller_follows WHERE seller_id = p_user_id;
    SELECT count(*)::integer INTO v_following
    FROM public.seller_follows WHERE follower_id = p_user_id;
  END IF;

  IF v_verified THEN
    PERFORM public.unlock_achievement(p_user_id, 'verified');
  END IF;
  IF v_score >= 30 OR v_deals >= 5 THEN
    PERFORM public.unlock_achievement(p_user_id, 'trusted');
  END IF;
  IF v_active >= 1 THEN
    PERFORM public.unlock_achievement(p_user_id, 'active');
  END IF;
  IF v_fast THEN
    PERFORM public.unlock_achievement(p_user_id, 'fast');
  END IF;
  IF v_followers >= 1 OR v_following >= 1 THEN
    PERFORM public.unlock_achievement(p_user_id, 'community');
  END IF;
  -- Early adopter: accounts created before a fixed launch cutoff (adjust as needed)
  IF v_created IS NOT NULL AND v_created < timestamptz '2026-01-01 00:00:00+00' THEN
    PERFORM public.unlock_achievement(p_user_id, 'early');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_user_achievements(uuid) TO authenticated;

-- ============================================================
-- 10. TRUST / ACTIVITY TIMELINE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_events_user_created
  ON public.trust_events (user_id, created_at DESC);

COMMENT ON TABLE public.trust_events IS
  'Trust Center timeline (verify, deals, vouches, sales, profile milestones)';

ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trust_events_select" ON public.trust_events
  FOR SELECT TO authenticated, anon
  USING (true);
CREATE POLICY "trust_events_insert_own" ON public.trust_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.log_trust_event(
  p_user_id uuid,
  p_event_type text,
  p_title text,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_related_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.trust_events (user_id, event_type, title, meta, related_id)
  VALUES (p_user_id, p_event_type, p_title, COALESCE(p_meta, '{}'::jsonb), p_related_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_trust_event(uuid, text, text, jsonb, uuid) TO authenticated;

-- ============================================================
-- 11. SELLER DASHBOARD STATS RPC (Overview / Sold KPIs)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_seller_dashboard_stats(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_active integer := 0;
  v_sold integer := 0;
  v_followers integer := 0;
  v_following integer := 0;
  v_deals integer := 0;
  v_profile_views integer := 0;
  v_listing_views integer := 0;
  v_sales_rate numeric := NULL;
  v_avg_age_days numeric := NULL;
  v_trust numeric := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF public._soko_table_exists('listings') THEN
    SELECT
      count(*) FILTER (WHERE COALESCE(status, 'active') NOT IN ('sold', 'deleted')),
      count(*) FILTER (WHERE status = 'sold')
    INTO v_active, v_sold
    FROM public.listings WHERE seller_id = v_uid;

    SELECT COALESCE(sum(view_count), 0)::integer INTO v_listing_views
    FROM public.listings WHERE seller_id = v_uid;

    SELECT avg(
      EXTRACT(EPOCH FROM (COALESCE(sold_at, updated_at, created_at) - created_at)) / 86400.0
    ) INTO v_avg_age_days
    FROM public.listings
    WHERE seller_id = v_uid AND status = 'sold' AND created_at IS NOT NULL;
  END IF;

  IF public._soko_table_exists('seller_follows') THEN
    SELECT count(*)::integer INTO v_followers
    FROM public.seller_follows WHERE seller_id = v_uid;
    SELECT count(*)::integer INTO v_following
    FROM public.seller_follows WHERE follower_id = v_uid;
  END IF;

  IF public._soko_table_exists('deal_confirmations') THEN
    SELECT count(*)::integer INTO v_deals
    FROM public.deal_confirmations
    WHERE (seller_id = v_uid OR buyer_id = v_uid)
      AND status IN ('confirmed', 'completed', 'done');
  END IF;

  IF public._soko_table_exists('profiles')
     AND public._soko_column_exists('profiles', 'profile_view_count') THEN
    SELECT COALESCE(profile_view_count, 0) INTO v_profile_views
    FROM public.profiles WHERE id = v_uid;
  ELSIF public._soko_table_exists('profile_views') THEN
    SELECT count(*)::integer INTO v_profile_views
    FROM public.profile_views WHERE profile_id = v_uid;
  END IF;

  IF public._soko_table_exists('trust_scores') THEN
    SELECT total_score INTO v_trust
    FROM public.trust_scores WHERE user_id = v_uid;
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
    'avg_listing_age_days', CASE WHEN v_avg_age_days IS NULL THEN NULL ELSE round(v_avg_age_days, 1) END,
    'trust_score', v_trust
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_dashboard_stats(uuid) TO authenticated;

-- ============================================================
-- 12. PEOPLE YOU MAY KNOW (Network placeholder → real RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_people_you_may_know(
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  is_verified boolean,
  city text,
  mutual_count integer,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 50);
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- Strategy: people followed by people you follow, excluding self / already following / blocked
  RETURN QUERY
  WITH my_following AS (
    SELECT sf.seller_id
    FROM public.seller_follows sf
    WHERE sf.follower_id = v_uid
  ),
  candidates AS (
    SELECT
      sf2.seller_id AS uid,
      count(*)::integer AS mutuals
    FROM public.seller_follows sf2
    WHERE sf2.follower_id IN (SELECT seller_id FROM my_following)
      AND sf2.seller_id <> v_uid
      AND sf2.seller_id NOT IN (SELECT seller_id FROM my_following)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_uid AND b.blocked_id = sf2.seller_id)
           OR (b.blocker_id = sf2.seller_id AND b.blocked_id = v_uid)
      )
    GROUP BY sf2.seller_id
  )
  SELECT
    c.uid,
    p.full_name,
    p.avatar_url,
    COALESCE(p.is_verified, false),
    p.city,
    c.mutuals,
    CASE
      WHEN c.mutuals > 0 THEN c.mutuals || ' mutual connection(s)'
      ELSE 'Suggested seller'
    END
  FROM candidates c
  JOIN public.profiles p ON p.id = c.uid
  ORDER BY c.mutuals DESC, p.is_verified DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(integer) TO authenticated;

-- ============================================================
-- 13. BULK LISTING HELPERS (Selling bulk bar)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_update_listing_status(
  p_listing_ids uuid[],
  p_status text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_status NOT IN ('active', 'sold', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_listing_ids IS NULL OR array_length(p_listing_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.listings
  SET status = p_status,
      updated_at = now()
  WHERE id = ANY (p_listing_ids)
    AND seller_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_update_listing_status(uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_delete_listings(p_listing_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_listing_ids IS NULL OR array_length(p_listing_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.listings
  WHERE id = ANY (p_listing_ids)
    AND seller_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_delete_listings(uuid[]) TO authenticated;

-- ============================================================
-- 14. MESSAGE INTENT HELPER (Network "Send Message" prep)
-- Soft helper: ensure a chat row exists between two users if chats table present
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_direct_chat(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chat_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_uid THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;
  IF to_regclass('public.chats') IS NULL THEN
    RAISE EXCEPTION 'chats table not available';
  END IF;

  -- Prefer existing chat if schema has user_a/user_b or participant columns vary.
  -- Generic attempt: look for chats table with user1/user2 style; else insert minimal.
  BEGIN
    SELECT c.id INTO v_chat_id
    FROM public.chats c
    WHERE (
      (c.user1 = v_uid AND c.user2 = p_other_user_id)
      OR (c.user2 = v_uid AND c.user1 = p_other_user_id)
    )
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    v_chat_id := NULL;
  END;

  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  BEGIN
    INSERT INTO public.chats (user1, user2, created_at)
    VALUES (v_uid, p_other_user_id, now())
    RETURNING id INTO v_chat_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    -- Fallback for alternate schemas (buyer_id/seller_id etc.) — return null
    RETURN NULL;
  END;

  RETURN v_chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_direct_chat(uuid) TO authenticated;

-- ============================================================
-- 15. ANALYTICS SNAPSHOT (charts placeholder → real series)
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_seller_daily_stats_seller_day
  ON public.seller_daily_stats (seller_id, day DESC);

COMMENT ON TABLE public.seller_daily_stats IS
  'Daily rollups for Overview analytics charts';

ALTER TABLE public.seller_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller_daily_stats_select" ON public.seller_daily_stats
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.get_seller_analytics_series(
  p_days integer DEFAULT 14,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  day date,
  profile_views integer,
  listing_views integer,
  sales integer,
  new_followers integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (current_date - (v_days - 1)),
      current_date,
      interval '1 day'
    )::date AS d
  ),
  rollup AS (
    SELECT s.day, s.profile_views, s.listing_views, s.sales, s.new_followers
    FROM public.seller_daily_stats s
    WHERE s.seller_id = v_uid
      AND s.day >= current_date - (v_days - 1)
  )
  SELECT
    days.d,
    COALESCE(r.profile_views, 0),
    COALESCE(r.listing_views, 0),
    COALESCE(r.sales, 0),
    COALESCE(r.new_followers, 0)
  FROM days
  LEFT JOIN rollup r ON r.day = days.d
  ORDER BY days.d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_analytics_series(integer, uuid) TO authenticated;

-- Nightly-friendly recompute for one seller/day (call from edge cron or client)
CREATE OR REPLACE FUNCTION public.recompute_seller_day_stats(
  p_seller_id uuid,
  p_day date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pv integer := 0;
  v_lv integer := 0;
  v_sales integer := 0;
  v_fol integer := 0;
BEGIN
  IF p_seller_id IS NULL THEN
    RETURN;
  END IF;

  IF public._soko_table_exists('profile_views') THEN
    SELECT count(*)::integer INTO v_pv
    FROM public.profile_views
    WHERE profile_id = p_seller_id
      AND created_at::date = p_day;
  END IF;

  IF public._soko_table_exists('listing_views') AND public._soko_table_exists('listings') THEN
    SELECT count(*)::integer INTO v_lv
    FROM public.listing_views lv
    JOIN public.listings l ON l.id = lv.listing_id
    WHERE l.seller_id = p_seller_id
      AND lv.created_at::date = p_day;
  END IF;

  IF public._soko_table_exists('listings') THEN
    SELECT count(*)::integer INTO v_sales
    FROM public.listings
    WHERE seller_id = p_seller_id
      AND status = 'sold'
      AND COALESCE(sold_at, updated_at)::date = p_day;
  END IF;

  IF public._soko_table_exists('seller_follows') THEN
    SELECT count(*)::integer INTO v_fol
    FROM public.seller_follows
    WHERE seller_id = p_seller_id
      AND created_at::date = p_day;
  END IF;

  INSERT INTO public.seller_daily_stats (
    seller_id, day, profile_views, listing_views, sales, new_followers
  ) VALUES (
    p_seller_id, p_day, v_pv, v_lv, v_sales, v_fol
  )
  ON CONFLICT (seller_id, day) DO UPDATE SET
    profile_views = EXCLUDED.profile_views,
    listing_views = EXCLUDED.listing_views,
    sales = EXCLUDED.sales,
    new_followers = EXCLUDED.new_followers;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_seller_day_stats(uuid, date) TO authenticated;

-- ============================================================
-- 16. GRANTS / COMMENTS
-- ============================================================
COMMENT ON FUNCTION public.get_seller_dashboard_stats(uuid) IS
  'Overview + Sold KPI payload for premium dashboard';
COMMENT ON FUNCTION public.get_people_you_may_know(integer) IS
  'Network recommendations from 2nd-degree follows';
COMMENT ON FUNCTION public.bulk_update_listing_status(uuid[], text) IS
  'Bulk Mark sold / Relist for Selling select mode';
COMMENT ON FUNCTION public.bulk_delete_listings(uuid[]) IS
  'Bulk delete for Selling select mode';

-- Done
DO $$
BEGIN
  RAISE NOTICE 'SokoMw profile dashboard backend migration applied successfully';
END $$;
