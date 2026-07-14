-- ============================================================
-- 009_indexes.sql
-- Purpose: Performance indexes for profile dashboard queries
-- ============================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles (last_seen DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles (city) WHERE city IS NOT NULL;

-- Listings (if table exists — create only when present via DO)
DO $$
BEGIN
  IF to_regclass('public.listings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_seller_status ON public.listings (seller_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_seller_sold_at ON public.listings (seller_id, sold_at DESC NULLS LAST) WHERE status = ''sold''';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings (category) WHERE category IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_featured ON public.listings (seller_id) WHERE COALESCE(is_featured, featured, false) = true';
  END IF;
  IF to_regclass('public.seller_follows') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON public.seller_follows (seller_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_seller_follows_follower ON public.seller_follows (follower_id, created_at DESC)';
  END IF;
  IF to_regclass('public.deal_confirmations') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deal_confirmations_seller ON public.deal_confirmations (seller_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deal_confirmations_buyer ON public.deal_confirmations (buyer_id, status)';
  END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_to_unread ON public.messages (to_user, created_at DESC) WHERE COALESCE(read, false) = false';
  END IF;
  IF to_regclass('public.buyer_requests') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_buyer_requests_user_status ON public.buyer_requests (user_id, status)';
  END IF;
  IF to_regclass('public.saved_statuses') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_saved_statuses_user ON public.saved_statuses (user_id, created_at DESC)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sale_orders_seller_sold ON public.sale_orders (seller_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_saves_user ON public.listing_saves (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_shares_listing ON public.listing_shares (listing_id, created_at DESC);
