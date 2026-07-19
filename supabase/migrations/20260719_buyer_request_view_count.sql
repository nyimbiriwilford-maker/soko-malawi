-- Looking For request view tracking

DO $$
BEGIN
  IF to_regclass('public.buyer_requests') IS NULL THEN
    RAISE NOTICE 'buyer_requests missing — skip view_count migration';
    RETURN;
  END IF;

  ALTER TABLE public.buyer_requests
    ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
END $$;

-- RPC: any authenticated user can increment views (not only owner)
CREATE OR REPLACE FUNCTION public.increment_buyer_request_view(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF request_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.buyer_requests
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = request_id
    AND status IS DISTINCT FROM 'fulfilled';
END;
$$;

-- Alias used by older client code
CREATE OR REPLACE FUNCTION public.increment_view_count(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.increment_buyer_request_view(request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_buyer_request_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_buyer_request_view(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO anon;
