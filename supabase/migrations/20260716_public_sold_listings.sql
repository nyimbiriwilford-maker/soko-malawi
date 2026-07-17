-- Allow public profile sold history to be visible as social proof.
-- Previously listings_select only allowed status IN ('published','active'),
-- so sold items appeared on the owner's private Profile (seller_id = auth.uid())
-- but not on PublicProfile for other viewers.

DO $$
BEGIN
  IF public._soko_table_exists('listings') THEN
    ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "listings_select" ON public.listings;
    CREATE POLICY "listings_select" ON public.listings
      FOR SELECT TO authenticated, anon
      USING (
        COALESCE(status, '') IN ('published', 'active', 'sold')
        OR seller_id = auth.uid()
        OR public.is_admin()
      );
  END IF;
END $$;

-- Public sold listing cards (thumbnail / title / price) via SECURITY DEFINER
-- as a fallback when policies have not been re-applied yet.
CREATE OR REPLACE FUNCTION public.get_public_seller_sold_listings(
  p_seller_id uuid,
  p_limit integer DEFAULT 12
)
RETURNS SETOF public.listings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.listings l
  WHERE l.seller_id = p_seller_id
    AND l.status = 'sold'
  ORDER BY COALESCE(l.sold_at, l.updated_at, l.created_at) DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 48);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_seller_sold_listings(uuid, integer)
  TO authenticated, anon;

COMMENT ON FUNCTION public.get_public_seller_sold_listings(uuid, integer) IS
  'Public sold history for seller profiles (bypasses RLS for status=sold rows).';
