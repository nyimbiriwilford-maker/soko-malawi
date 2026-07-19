-- One person = one view on Looking For requests

DO $$
BEGIN
  IF to_regclass('public.buyer_requests') IS NULL THEN
    RAISE NOTICE 'buyer_requests missing — skip unique views migration';
    RETURN;
  END IF;

  ALTER TABLE public.buyer_requests
    ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS public.buyer_request_views (
    request_id uuid NOT NULL REFERENCES public.buyer_requests(id) ON DELETE CASCADE,
    viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (request_id, viewer_id)
  );

  CREATE INDEX IF NOT EXISTS idx_buyer_request_views_viewer
    ON public.buyer_request_views (viewer_id);

  ALTER TABLE public.buyer_request_views ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "buyer_request_views_select_own" ON public.buyer_request_views;
  CREATE POLICY "buyer_request_views_select_own" ON public.buyer_request_views
    FOR SELECT TO authenticated
    USING (viewer_id = auth.uid());

  -- Inserts only via security definer RPC
END $$;

-- Unique view increment: returns true only when a NEW view was recorded
CREATE OR REPLACE FUNCTION public.increment_buyer_request_view(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted boolean := false;
BEGIN
  IF request_id IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Owner viewing their own request does not count
  IF EXISTS (
    SELECT 1 FROM public.buyer_requests br
    WHERE br.id = request_id AND br.user_id = v_uid
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.buyer_request_views (request_id, viewer_id)
  VALUES (request_id, v_uid)
  ON CONFLICT (request_id, viewer_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  -- ROW_COUNT is 1 if inserted, 0 if conflict
  IF NOT v_inserted THEN
    RETURN false;
  END IF;

  UPDATE public.buyer_requests
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = request_id
    AND status IS DISTINCT FROM 'fulfilled';

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_view_count(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.increment_buyer_request_view(request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_buyer_request_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO authenticated;
