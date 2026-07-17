-- Admin: full seller contact for verification review
-- Joins public.profiles + auth.users so email/phone show even when only on auth.

CREATE OR REPLACE FUNCTION public.admin_get_seller_contact(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_auth jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  SELECT to_jsonb(p.*) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  SELECT jsonb_build_object(
    'auth_email', u.email,
    'auth_phone', u.phone,
    'auth_created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at,
    'phone_confirmed_at', u.phone_confirmed_at,
    'raw_user_meta_data', u.raw_user_meta_data
  ) INTO v_auth
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_profile IS NULL AND v_auth IS NULL THEN
    RETURN jsonb_build_object(
      'id', p_user_id,
      'profile', jsonb_build_object('id', p_user_id),
      'auth_email', null,
      'auth_phone', null
    );
  END IF;

  RETURN COALESCE(v_profile, '{}'::jsonb)
    || COALESCE(v_auth, '{}'::jsonb)
    || jsonb_build_object(
      'id', p_user_id,
      'profile', COALESCE(v_profile, jsonb_build_object('id', p_user_id)),
      -- Flatten common fields for the client
      'email', COALESCE(v_profile->>'email', v_auth->>'auth_email'),
      'phone', COALESCE(
        NULLIF(v_profile->>'phone', ''),
        NULLIF(v_profile->>'whatsapp', ''),
        NULLIF(v_auth->>'auth_phone', '')
      ),
      'auth_email', v_auth->>'auth_email',
      'auth_phone', v_auth->>'auth_phone',
      'auth_created_at', v_auth->>'auth_created_at',
      'last_sign_in_at', v_auth->>'last_sign_in_at',
      'email_confirmed_at', v_auth->>'email_confirmed_at',
      'phone_confirmed_at', v_auth->>'phone_confirmed_at'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_seller_contact(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_get_seller_contact(uuid) IS
  'Admin-only: profile row + auth.users email/phone for verification review drawer';
