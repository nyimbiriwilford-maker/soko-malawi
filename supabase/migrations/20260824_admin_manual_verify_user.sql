-- ================================================================
-- Admin Manual User Verification (without verification request)
-- ================================================================
-- Allows admins to manually verify users directly, bypassing the
-- normal verification request flow. Useful for:
-- - VIP sellers / special cases
-- - Staff accounts
-- - Migrating pre-verified users
-- - Emergency verifications
-- ================================================================

-- ── Function: Manually verify a user (admin only) ──
CREATE OR REPLACE FUNCTION public.admin_manual_verify_user(
  p_user_id uuid,
  p_verification_type text DEFAULT 'seller',
  p_admin_note text DEFAULT NULL,
  p_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_profile record;
  v_user_profile record;
  v_request_id uuid;
  v_result jsonb;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify admin privileges
  SELECT * INTO v_admin_profile FROM public.profiles WHERE id = v_admin_id;

  IF v_admin_profile.role != 'admin' THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Get target user profile
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = p_user_id;

  IF v_user_profile IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Check if user is already verified
  IF v_user_profile.is_verified = true THEN
    RAISE NOTICE 'User is already verified';
  END IF;

  -- Validate justification
  IF p_justification IS NULL OR trim(p_justification) = '' THEN
    RAISE EXCEPTION 'Justification is required for manual verification';
  END IF;

  -- 1) Update user profile to verified
  UPDATE public.profiles
  SET
    is_verified = true,
    verification_status = 'approved',
    verified_at = now(),
    rejection_reason = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  -- 2) Update shops if user has any (for shop/business verification types)
  IF p_verification_type IN ('shop', 'business') THEN
    UPDATE public.shops
    SET is_verified = true
    WHERE owner_id = p_user_id;
  END IF;

  -- 3) Create a verification request record for audit trail
  INSERT INTO public.verification_requests (
    seller_id,
    status,
    amount_due,
    amount_paid,
    currency,
    notes,
    admin_note,
    submitted_at,
    reviewed_at,
    payment_confirmed_at,
    meta
  ) VALUES (
    p_user_id,
    'approved',
    0, -- No payment for manual verification
    0,
    'MWK',
    'Manually verified by admin',
    COALESCE(p_admin_note, 'Manual verification: ' || COALESCE(p_justification, 'Admin override')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'manual_verification', true,
      'admin_id', v_admin_id,
      'admin_name', v_admin_profile.full_name,
      'verification_type', p_verification_type,
      'justification', p_justification,
      'verified_at', now()
    )
  )
  RETURNING id INTO v_request_id;

  -- 4) Create status event for audit trail
  INSERT INTO public.verification_status_events (
    request_id,
    from_status,
    to_status,
    actor_id,
    note,
    meta
  ) VALUES (
    v_request_id,
    'draft',
    'approved',
    v_admin_id,
    'Manual verification by admin: ' || COALESCE(p_justification, 'No justification provided'),
    jsonb_build_object(
      'manual_verification', true,
      'admin_name', v_admin_profile.full_name,
      'verification_type', p_verification_type,
      'timestamp', now()
    )
  );

  -- 5) Create admin audit entry
  BEGIN
    INSERT INTO public.verification_admin_audit (
      request_id,
      admin_id,
      action,
      from_status,
      to_status,
      justification,
      meta
    ) VALUES (
      v_request_id,
      v_admin_id,
      'manual_verify_user',
      NULL,
      'approved',
      p_justification,
      jsonb_build_object(
        'user_id', p_user_id,
        'user_name', v_user_profile.full_name,
        'verification_type', p_verification_type,
        'admin_note', p_admin_note
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Table may not exist yet, soft fail
    NULL;
  END;

  -- 6) Notify user (optional - they get verified!)
  BEGIN
    PERFORM public.notify_user(
      p_user_id,
      'verification_approved',
      'You are now verified!',
      'Your account has been verified by an administrator. You can now enjoy the benefits of being a verified seller.',
      '/profile/' || p_user_id::text,
      jsonb_build_object(
        'request_id', v_request_id,
        'manual', true
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Notification is optional, don't fail if it doesn't work
    NULL;
  END;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'request_id', v_request_id,
    'verification_type', p_verification_type,
    'verified_at', now(),
    'admin_id', v_admin_id,
    'admin_name', v_admin_profile.full_name
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_manual_verify_user IS
  'Manually verify a user without requiring a verification request. Admin only. Requires justification for audit trail.';

-- Grant execute only to authenticated users (RLS will check admin role)
GRANT EXECUTE ON FUNCTION public.admin_manual_verify_user(uuid, text, text, text) TO authenticated;

-- ── Function: Manually unverify/remove verification (admin only) ──
CREATE OR REPLACE FUNCTION public.admin_manual_unverify_user(
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_profile record;
  v_result jsonb;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify admin privileges
  SELECT * INTO v_admin_profile FROM public.profiles WHERE id = v_admin_id;

  IF v_admin_profile.role != 'admin' THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Validate reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required for removing verification';
  END IF;

  -- Update user profile to unverified
  UPDATE public.profiles
  SET
    is_verified = false,
    verification_status = 'removed',
    verified_at = NULL,
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_user_id;

  -- Update shops
  UPDATE public.shops
  SET is_verified = false
  WHERE owner_id = p_user_id;

  -- Notify user
  BEGIN
    PERFORM public.notify_user(
      p_user_id,
      'verification_removed',
      'Verification removed',
      'Your verification has been removed: ' || p_reason,
      '/verify',
      jsonb_build_object('reason', p_reason)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'admin_id', v_admin_id,
    'reason', p_reason,
    'unverified_at', now()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_manual_unverify_user IS
  'Remove verification from a user. Admin only. Requires reason for audit trail.';

GRANT EXECUTE ON FUNCTION public.admin_manual_unverify_user(uuid, text) TO authenticated;
