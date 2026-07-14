-- ============================================================
-- 002_trust_system.sql
-- Purpose: Trust events, sale reviews, ensure trust_scores shape
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

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

-- Trust timeline events
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

COMMENT ON TABLE public.trust_events IS 'Trust Center timeline events';

-- Ensure trust_scores has common columns (do not drop existing)
DO $$
BEGIN
  IF public._soko_table_exists('trust_scores') THEN
    ALTER TABLE public.trust_scores
      ADD COLUMN IF NOT EXISTS total_score numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  ELSE
    CREATE TABLE public.trust_scores (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      total_score numeric NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Sale reviews (buyer reviews after sales)
CREATE TABLE IF NOT EXISTS public.sale_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_id uuid,
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

CREATE TABLE IF NOT EXISTS public.sale_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_order_id uuid REFERENCES public.sale_orders(id) ON DELETE CASCADE,
  listing_id uuid,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, sale_order_id)
);

CREATE OR REPLACE FUNCTION public.log_trust_event(
  p_user_id uuid,
  p_event_type text,
  p_title text,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_related_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.trust_events (user_id, event_type, title, meta, related_id)
  VALUES (p_user_id, p_event_type, p_title, COALESCE(p_meta, '{}'::jsonb), p_related_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_trust_event(uuid, text, text, jsonb, uuid) TO authenticated;
