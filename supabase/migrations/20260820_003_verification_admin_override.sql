-- ============================================================
-- 20260820_003_verification_admin_override.sql
-- Justified admin override of request status — allows ANY transition,
-- including reopening terminal statuses. Fully audited.
-- Idempotent. Apply after 20260820_001 (reuses issues-resolve hook).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_override_verification_status(
  p_request_id uuid,
  p_to_status text,
  p_justification text
)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_requests;
  v_from_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF p_to_status NOT IN (
    'draft','submitted','payment_pending','payment_confirmed','under_review',
    'additional_info_required','approved','rejected','expired','cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid status: %', p_to_status;
  END IF;

  IF p_justification IS NULL OR trim(p_justification) = '' THEN
    RAISE EXCEPTION 'Justification is required to override a status';
  END IF;

  SELECT * INTO v_row FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  v_from_status := v_row.status;

  -- Override move (any transition; terminal reopen allowed)
  UPDATE public.verification_requests SET
    status = p_to_status,
    reviewed_by = CASE
      WHEN p_to_status IN ('approved','rejected','additional_info_required','under_review') THEN v_uid
      ELSE reviewed_by
    END,
    reviewed_at = CASE WHEN p_to_status IN ('approved','rejected') THEN now() ELSE reviewed_at END,
    submitted_at = CASE
      WHEN p_to_status IN ('submitted','under_review') AND submitted_at IS NULL THEN now()
      ELSE submitted_at
    END,
    under_review_at = CASE WHEN p_to_status = 'under_review' THEN now() ELSE under_review_at END,
    payment_confirmed_at = CASE
      WHEN p_to_status = 'payment_confirmed' THEN COALESCE(payment_confirmed_at, now())
      ELSE payment_confirmed_at
    END,
    cancelled_at = CASE WHEN p_to_status = 'cancelled' THEN now() ELSE cancelled_at END,
    meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
      'override', jsonb_build_object(
        'admin_id', v_uid,
        'at', now(),
        'from_status', v_from_status,
        'justification', trim(p_justification)
      )
    ),
    updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;
  -- (Status change event is logged automatically by the status-log trigger.)

  -- Audit trail (mandatory)
  INSERT INTO public.verification_admin_audit (admin_id, action, entity_type, entity_id, note, meta)
  VALUES (v_uid, 'override_status', 'verification_request', p_request_id::text,
    trim(p_justification),
    jsonb_build_object('from_status', v_from_status, 'to_status', p_to_status));

  -- Explicit status event with justification note (trigger also logs a bare event)
  INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
  VALUES (p_request_id, v_from_status, p_to_status, v_uid,
    'Admin override: ' || trim(p_justification),
    jsonb_build_object('override', true));

  -- Issue lifecycle hooks mirror transition_verification_status
  BEGIN
    IF to_regclass('public.verification_issues') IS NOT NULL THEN
      IF v_from_status = 'additional_info_required'
         AND p_to_status IN ('submitted','under_review') THEN
        UPDATE public.verification_issues
        SET status = 'needs_recheck'
        WHERE request_id = p_request_id AND status = 'open';
      ELSIF p_to_status IN ('approved','rejected','cancelled') THEN
        UPDATE public.verification_issues
        SET status = 'resolved', resolved_at = now(), resolved_by = v_uid
        WHERE request_id = p_request_id AND status IN ('open','needs_recheck');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'verification_issues hook failed: %', SQLERRM;
  END;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_override_verification_status(uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.admin_override_verification_status IS
  'Admin: force any status transition (including terminal reopen) with mandatory justification; fully audited.';
