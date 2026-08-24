-- ================================================================
-- Admin: Search users by name / email / phone (not just ID)
-- ================================================================
-- Supports the Manual verify user flow so an admin can look a user
-- up by full name, email, or phone number instead of only pasting a
-- raw UUID. Admin only.
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query text DEFAULT '',
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  avatar_url text,
  is_verified boolean,
  verification_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_limit int := COALESCE(p_limit, 20);
  v_q text := NULLIF(btrim(COALESCE(p_query, '')), '');
BEGIN
  -- Require admin privileges
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF v_limit < 1 THEN v_limit := 1; END IF;
  IF v_limit > 100 THEN v_limit := 100; END IF;

  -- No query: return most recent profiles as a fallback list
  IF v_q IS NULL THEN
    RETURN QUERY
    SELECT
      p.id, p.full_name, p.email, p.phone, p.city, p.avatar_url,
      p.is_verified, p.verification_status, p.created_at
    FROM public.profiles p
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT v_limit;
    RETURN;
  END IF;

  -- Allow searching directly by a UUID as well
  IF v_q ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN QUERY
    SELECT
      p.id, p.full_name, p.email, p.phone, p.city, p.avatar_url,
      p.is_verified, p.verification_status, p.created_at
    FROM public.profiles p
    WHERE p.id::text = v_q
    LIMIT v_limit;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.full_name, p.email, p.phone, p.city, p.avatar_url,
    p.is_verified, p.verification_status, p.created_at
  FROM public.profiles p
  WHERE
    p.full_name ILIKE '%' || v_q || '%'
    OR p.email ILIKE '%' || v_q || '%'
    OR p.phone ILIKE '%' || v_q || '%'
    OR p.city ILIKE '%' || v_q || '%'
  ORDER BY
    (CASE WHEN p.full_name ILIKE v_q || '%' THEN 0
          WHEN p.full_name ILIKE '%' || v_q || '%' THEN 1
          ELSE 2 END),
    p.created_at DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.admin_search_users IS
  'Admin-only user lookup by full name, email, phone, city, or ID. Used by manual verification.';

GRANT EXECUTE ON FUNCTION public.admin_search_users(text, int) TO authenticated;
