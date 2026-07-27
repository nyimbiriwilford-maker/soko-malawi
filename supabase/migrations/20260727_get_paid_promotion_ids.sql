-- RPC: get_paid_promotion_ids
-- Returns listing_ids of actively paid promotions.
-- SECURITY DEFINER bypasses RLS so the home page can display priority sort.
CREATE OR REPLACE FUNCTION public.get_active_promotion_data()
RETURNS TABLE (listing_id uuid, price_mwk integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT lp.listing_id, lp.price_mwk
  FROM public.listing_promotions lp
  WHERE lp.status = 'active';
END;
$$;
