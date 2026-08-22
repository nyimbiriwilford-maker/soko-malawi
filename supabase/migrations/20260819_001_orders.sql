-- ============================================================
-- 20260819_001_orders.sql
-- Purpose: Order lifecycle (Phase 1) — orders table + RLS + state
-- machine RPCs, stock auto-delist trigger + low-stock helper,
-- shop analytics RPC.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. LISTINGS — ensure commerce columns used by order RPCs exist
-- (created in Studio historically; guarded here so this file is
--  self-contained on fresh environments)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT public._soko_table_exists('listings') THEN
    RAISE NOTICE 'listings missing — skipping commerce columns';
    RETURN;
  END IF;

  IF NOT public._soko_column_exists('listings', 'stock_qty') THEN
    ALTER TABLE public.listings ADD COLUMN stock_qty integer;
  END IF;
  IF NOT public._soko_column_exists('listings', 'availability_status') THEN
    ALTER TABLE public.listings ADD COLUMN availability_status text DEFAULT 'in_stock'
      CHECK (availability_status IS NULL OR availability_status IN ('in_stock','made_to_order','not_available'));
  END IF;
  IF NOT public._soko_column_exists('listings', 'price_tiers') THEN
    ALTER TABLE public.listings ADD COLUMN price_tiers jsonb;
  END IF;
  IF NOT public._soko_column_exists('listings', 'flash_sale_price') THEN
    ALTER TABLE public.listings ADD COLUMN flash_sale_price numeric;
  END IF;
  IF NOT public._soko_column_exists('listings', 'flash_sale_expires_at') THEN
    ALTER TABLE public.listings ADD COLUMN flash_sale_expires_at timestamptz;
  END IF;
  IF NOT public._soko_column_exists('listings', 'sold_price') THEN
    ALTER TABLE public.listings ADD COLUMN sold_price numeric;
  END IF;
END $$;

-- Flash sales were read/written under two column names historically
-- (flash_sale_expires_at on write, flash_sale_ends_at on some reads).
-- This helper returns whichever is set, guarded for both schemas.
CREATE OR REPLACE FUNCTION public._soko_flash_ends_at(p_listing listings)
RETURNS timestamptz
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ends timestamptz;
BEGIN
  v_ends := p_listing.flash_sale_expires_at;
  IF v_ends IS NULL AND public._soko_column_exists('listings', 'flash_sale_ends_at') THEN
    EXECUTE 'SELECT flash_sale_ends_at FROM public.listings WHERE id = $1'
      INTO v_ends USING p_listing.id;
  END IF;
  RETURN v_ends;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 1. ORDERS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MWK',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','dispatched','delivered','rated','cancelled')),
  payment_method text NOT NULL DEFAULT 'cash_on_delivery'
    CHECK (payment_method IN ('cash_on_delivery','mobile_money','card','other')),
  delivery_method text NOT NULL DEFAULT 'pickup'
    CHECK (delivery_method IN ('pickup','delivery')),
  delivery_address text,
  buyer_phone text,
  buyer_note text,
  cancel_reason text,
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_comment text,
  accepted_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number_unique
  ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_seller_created
  ON public.orders (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON public.orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status
  ON public.orders (shop_id, status, created_at DESC)
  WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

COMMENT ON TABLE public.orders IS
  'Buyer→seller order lifecycle: pending→accepted→dispatched→delivered→rated / cancelled';

-- Keep updated_at fresh on any change
CREATE OR REPLACE FUNCTION public.orders_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_touch_updated_at ON public.orders;
CREATE TRIGGER trg_orders_touch_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_touch_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_parties" ON public.orders;
CREATE POLICY "orders_select_parties" ON public.orders
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.owner_id = auth.uid())
    OR public.is_admin()
  );

-- All mutations go through SECURITY DEFINER RPCs (place_order,
-- update_order_status, cancel_order, rate_order) which re-check status
-- transitions and authorisation server-side. No direct INSERT/UPDATE/DELETE
-- policies exist so clients cannot bypass the state machine.

-- ────────────────────────────────────────────────────────────
-- 3. STATE MACHINE — place_order
-- Effective price = flash sale price (if active) → matching bulk
-- tier (by quantity) → base price. Reserves stock atomically.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_order(
  p_listing_id uuid,
  p_quantity integer,
  p_payment_method text DEFAULT 'cash_on_delivery',
  p_delivery_method text DEFAULT 'pickup',
  p_delivery_address text DEFAULT NULL,
  p_buyer_phone text DEFAULT NULL,
  p_buyer_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid := auth.uid();
  v_listing record;
  v_shop record;
  v_flash_active boolean;
  v_tier record;
  v_unit_price numeric;
  v_total numeric;
  v_stock integer;
  v_order_id uuid;
  v_order_number text;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;
  IF COALESCE(p_payment_method, '') NOT IN ('cash_on_delivery','mobile_money','card','other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF COALESCE(p_delivery_method, '') NOT IN ('pickup','delivery') THEN
    RAISE EXCEPTION 'Invalid delivery method';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_listing.seller_id = v_buyer THEN
    RAISE EXCEPTION 'You cannot order your own listing';
  END IF;
  -- Both 'active' and 'published' are live-selling statuses in this codebase
  IF v_listing.status NOT IN ('active','published') THEN
    RAISE EXCEPTION 'Listing is not available';
  END IF;
  IF v_listing.availability_status = 'not_available' THEN
    RAISE EXCEPTION 'Item is not available';
  END IF;

  -- Enforce stock
  v_stock := COALESCE(v_listing.stock_qty, 1);
  IF v_listing.stock_qty IS NOT NULL AND v_stock < p_quantity THEN
    RAISE EXCEPTION 'Only % in stock', v_stock;
  END IF;

  -- Effective unit price: flash sale → bulk tier → base price
  v_flash_active := v_listing.flash_sale_price IS NOT NULL
    AND COALESCE(public._soko_flash_ends_at(v_listing), now()) > now();
  IF v_flash_active THEN
    v_unit_price := v_listing.flash_sale_price;
  ELSE
    v_unit_price := COALESCE(v_listing.price, 0);
    BEGIN
      IF v_listing.price_tiers IS NOT NULL THEN
        SELECT (t.value->>'min_qty')::int AS min_qty, (t.value->>'price')::numeric AS price
          INTO v_tier
        FROM jsonb_array_elements(v_listing.price_tiers::jsonb) t
        WHERE p_quantity >= (t.value->>'min_qty')::int
        ORDER BY (t.value->>'min_qty')::int DESC
        LIMIT 1;
        IF FOUND AND v_tier.price IS NOT NULL THEN
          v_unit_price := v_tier.price;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- malformed tiers: fall back to base price
    END;
  END IF;

  v_total := v_unit_price * p_quantity;

  -- Resolve shop (listing.shop_id or seller's active shop)
  SELECT id, owner_id INTO v_shop
  FROM public.shops
  WHERE (id = v_listing.shop_id OR (v_listing.shop_id IS NULL AND owner_id = v_listing.seller_id))
    AND is_active IS NOT FALSE
  ORDER BY (CASE WHEN id = v_listing.shop_id THEN 0 ELSE 1 END), created_at DESC
  LIMIT 1;

  v_order_number := 'SMW-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.orders (
    order_number, listing_id, shop_id, seller_id, buyer_id,
    quantity, unit_price, total_amount, status,
    payment_method, delivery_method, delivery_address, buyer_phone, buyer_note
  ) VALUES (
    v_order_number, p_listing_id, v_shop.id, v_listing.seller_id, v_buyer,
    p_quantity, v_unit_price, v_total, 'pending',
    p_payment_method, p_delivery_method, p_delivery_address, p_buyer_phone, p_buyer_note
  )
  RETURNING id INTO v_order_id;

  -- Decrement stock (auto-delist trigger below flips status when it hits 0)
  IF v_listing.stock_qty IS NOT NULL THEN
    UPDATE public.listings SET stock_qty = stock_qty - p_quantity WHERE id = p_listing_id;
  END IF;

  RETURN json_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(uuid, integer, text, text, text, text, text) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. STATE MACHINE — update_order_status (seller side)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_action text,             -- 'accept' | 'decline' | 'dispatch' | 'deliver'
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT o.*, s.owner_id AS shop_owner
    INTO v_order
  FROM public.orders o
  LEFT JOIN public.shops s ON s.id = o.shop_id
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF NOT (
    v_order.seller_id = v_actor
    OR (v_order.shop_owner IS NOT NULL AND v_order.shop_owner = v_actor)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_action = 'accept' THEN
    IF v_order.status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending orders can be accepted';
    END IF;
    UPDATE public.orders SET status = 'accepted', accepted_at = now() WHERE id = p_order_id;

  ELSIF p_action = 'decline' THEN
    IF v_order.status NOT IN ('pending','accepted') THEN
      RAISE EXCEPTION 'Order can no longer be declined';
    END IF;
    UPDATE public.orders
      SET status = 'cancelled', cancelled_at = now(), cancel_reason = COALESCE(p_reason, 'Declined by seller')
      WHERE id = p_order_id;
    -- Release reserved stock
    IF v_order.listing_id IS NOT NULL THEN
      UPDATE public.listings l
        SET stock_qty = stock_qty + v_order.quantity
        WHERE l.id = v_order.listing_id AND l.stock_qty IS NOT NULL;
    END IF;

  ELSIF p_action = 'dispatch' THEN
    IF v_order.status <> 'accepted' THEN
      RAISE EXCEPTION 'Only accepted orders can be dispatched';
    END IF;
    UPDATE public.orders SET status = 'dispatched', dispatched_at = now() WHERE id = p_order_id;

  ELSIF p_action = 'deliver' THEN
    IF v_order.status <> 'dispatched' THEN
      RAISE EXCEPTION 'Only dispatched orders can be marked delivered';
    END IF;
    UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = p_order_id;
    -- One-off listings: mark sold on delivery
    IF v_order.listing_id IS NOT NULL THEN
      UPDATE public.listings
        SET status = 'sold', sold_at = now(), sold_price = COALESCE(sold_price, v_order.total_amount)
        WHERE id = v_order.listing_id AND (stock_qty IS NULL OR stock_qty <= 0);
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. STATE MACHINE — buyer cancel + rate
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.buyer_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_order.status NOT IN ('pending','accepted') THEN
    RAISE EXCEPTION 'Order can no longer be cancelled';
  END IF;

  UPDATE public.orders
    SET status = 'cancelled', cancelled_at = now(), cancel_reason = COALESCE(p_reason, 'Cancelled by buyer')
    WHERE id = p_order_id;

  -- Release reserved stock
  IF v_order.listing_id IS NOT NULL THEN
    UPDATE public.listings l
      SET stock_qty = stock_qty + v_order.quantity
      WHERE l.id = v_order.listing_id AND l.stock_qty IS NOT NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rate_order(
  p_order_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.buyer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the buyer can rate an order';
  END IF;
  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Only delivered orders can be rated';
  END IF;

  UPDATE public.orders
    SET status = 'rated', rating = p_rating, rating_comment = p_comment
    WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_order(uuid, integer, text) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. INVENTORY — auto-delist at 0 stock, restore on restock
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.listings_stock_auto_delist()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty THEN
    IF NEW.stock_qty IS NOT NULL AND NEW.stock_qty <= 0
       AND NEW.status IN ('active','published')
       AND (NEW.flash_sale_price IS NULL OR COALESCE(public._soko_flash_ends_at(NEW), now()) <= now()) THEN
      NEW.status := 'inactive';
      NEW.availability_status := 'not_available';
    ELSIF (OLD.stock_qty IS NULL OR OLD.stock_qty <= 0)
       AND NEW.stock_qty IS NOT NULL AND NEW.stock_qty > 0
       AND NEW.status = 'inactive'
       AND OLD.availability_status = 'not_available' THEN
      -- Restock restores listings that were auto-delisted by this trigger
      NEW.status := 'active';
      NEW.availability_status := 'in_stock';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF public._soko_table_exists('listings')
     AND public._soko_column_exists('listings', 'stock_qty') THEN
    DROP TRIGGER IF EXISTS trg_listings_stock_auto_delist ON public.listings;
    CREATE TRIGGER trg_listings_stock_auto_delist
      BEFORE UPDATE OF stock_qty ON public.listings
      FOR EACH ROW
      EXECUTE FUNCTION public.listings_stock_auto_delist();
  ELSE
    RAISE NOTICE 'listings.stock_qty missing — skipping auto-delist trigger';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. SHOP ANALYTICS (Overview tab)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_shop_analytics(p_shop_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND OR (v_owner <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'views', COALESCE((
      SELECT count(*) FROM public.listing_views lv
      JOIN public.listings l ON l.id = lv.listing_id
      WHERE l.shop_id = p_shop_id OR (l.shop_id IS NULL AND l.seller_id = v_owner)
    ), 0),
    'saves', COALESCE((
      SELECT count(*) FROM public.listing_saves ls2
      JOIN public.listings l ON l.id = ls2.listing_id
      WHERE l.shop_id = p_shop_id OR (l.shop_id IS NULL AND l.seller_id = v_owner)
    ), 0),
    'orders_total', COALESCE((SELECT count(*) FROM public.orders WHERE shop_id = p_shop_id), 0),
    'orders_pending', COALESCE((SELECT count(*) FROM public.orders WHERE shop_id = p_shop_id AND status = 'pending'), 0),
    'orders_completed', COALESCE((
      SELECT count(*) FROM public.orders WHERE shop_id = p_shop_id AND status IN ('delivered','rated')
    ), 0),
    'revenue', COALESCE((
      SELECT sum(total_amount) FROM public.orders WHERE shop_id = p_shop_id AND status IN ('delivered','rated')
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_analytics(uuid) TO authenticated;

-- Realtime so seller/buyer UIs update live
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add orders to supabase_realtime: %', SQLERRM;
END $$;

DO $$ BEGIN RAISE NOTICE '20260819_001_orders applied'; END $$;
