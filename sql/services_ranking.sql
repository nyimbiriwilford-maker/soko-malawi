-- services_ranking.sql
-- Adds ranking/tracking columns, a safe increment function, and an index. Do NOT run automatically.

-- 1. Add missing columns (only those not already present)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2),
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chats_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS region text;

-- 2. Safe increment function for views and chats_count only
CREATE OR REPLACE FUNCTION public.increment_service_stat(p_service_id uuid, p_stat text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_stat = 'views' THEN
    UPDATE public.services SET views = COALESCE(views, 0) + 1 WHERE id = p_service_id;
  ELSIF p_stat = 'chats_count' THEN
    UPDATE public.services SET chats_count = COALESCE(chats_count, 0) + 1 WHERE id = p_service_id;
  ELSE
    RAISE EXCEPTION 'invalid stat: %', p_stat;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_service_stat(uuid, text) TO authenticated, anon;

-- 3. Index for status + created_at ordering
CREATE INDEX IF NOT EXISTS idx_services_status_created_at
  ON public.services (status, created_at DESC);

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
