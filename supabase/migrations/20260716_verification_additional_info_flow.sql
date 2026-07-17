-- ============================================================
-- Additional-info seller workflow hardening
-- - Sellers may resubmit: additional_info_required → under_review
-- - Admins may insert notifications for other users (need-info alert)
-- - Document soft-replace statuses stay free-form text (no enum)
-- ============================================================

-- 1) Allow seller resubmit after admin "need more info"
CREATE OR REPLACE FUNCTION public.transition_verification_status(
  p_request_id uuid,
  p_to_status text,
  p_note text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_additional_info_message text DEFAULT NULL
)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.verification_requests;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_to_status NOT IN (
    'draft','submitted','payment_pending','payment_confirmed','under_review',
    'additional_info_required','approved','rejected','expired','cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid status: %', p_to_status;
  END IF;

  SELECT * INTO v_row FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF v_row.seller_id <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Sellers: limited transitions only
  IF NOT public.is_admin() THEN
    IF p_to_status = 'cancelled' AND v_row.status IN (
      'draft','submitted','payment_pending','additional_info_required'
    ) THEN
      NULL;
    ELSIF p_to_status = 'submitted' AND v_row.status IN ('draft', 'additional_info_required') THEN
      NULL;
    -- Resubmit after additional info: back into review queue
    ELSIF p_to_status = 'under_review' AND v_row.status = 'additional_info_required' THEN
      NULL;
    ELSIF p_to_status = 'payment_pending' AND v_row.status IN ('draft', 'submitted') THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Sellers cannot set status %', p_to_status;
    END IF;
  END IF;

  UPDATE public.verification_requests SET
    status = p_to_status,
    admin_note = CASE WHEN public.is_admin() AND p_note IS NOT NULL THEN p_note ELSE admin_note END,
    rejection_reason = CASE
      WHEN p_to_status = 'rejected' THEN COALESCE(p_rejection_reason, p_note, rejection_reason)
      ELSE rejection_reason
    END,
    additional_info_message = CASE
      WHEN p_to_status = 'additional_info_required'
        THEN COALESCE(p_additional_info_message, p_note, additional_info_message)
      WHEN p_to_status = 'under_review' AND v_row.status = 'additional_info_required'
        THEN additional_info_message -- keep last admin message for history
      ELSE additional_info_message
    END,
    reviewed_by = CASE
      WHEN p_to_status IN ('approved','rejected','additional_info_required','under_review')
        AND public.is_admin() THEN v_uid
      ELSE reviewed_by
    END,
    reviewed_at = CASE
      WHEN p_to_status IN ('approved','rejected') THEN now()
      ELSE reviewed_at
    END,
    submitted_at = CASE
      WHEN p_to_status IN ('submitted', 'under_review') AND submitted_at IS NULL THEN now()
      WHEN p_to_status = 'under_review' AND v_row.status = 'additional_info_required' THEN now()
      ELSE submitted_at
    END,
    payment_confirmed_at = CASE
      WHEN p_to_status = 'payment_confirmed' THEN COALESCE(payment_confirmed_at, now())
      ELSE payment_confirmed_at
    END,
    under_review_at = CASE
      WHEN p_to_status = 'under_review' THEN now()
      ELSE under_review_at
    END,
    cancelled_at = CASE
      WHEN p_to_status = 'cancelled' THEN now()
      ELSE cancelled_at
    END,
    meta = CASE
      WHEN p_to_status = 'under_review' AND v_row.status = 'additional_info_required' THEN
        COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'resubmitted', true,
          'resubmitted_at', now(),
          'resubmitted_by', v_uid,
          'resubmit_note', COALESCE(p_note, ''),
          'wizard_step', 'status'
        )
      ELSE meta
    END,
    updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_verification_status(uuid, text, text, text, text) TO authenticated;

-- 2) Admins can notify sellers (insert into notifications for other users)
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE NOTICE 'notifications table missing — skip admin notify policy';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "notifications_admin_insert" ON public.notifications;
  CREATE POLICY "notifications_admin_insert" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      OR public.is_admin()
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications_admin_insert skip: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.transition_verification_status IS
  'Status transitions; sellers may resubmit additional_info_required → under_review';

-- Status event note for seller resubmit (trigger is SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.log_verification_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'created');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE
        WHEN NEW.status = 'under_review' AND OLD.status = 'additional_info_required'
          THEN COALESCE(NEW.meta->>'resubmit_note', 'resubmitted')
        WHEN NEW.status = 'additional_info_required'
          THEN COALESCE(NEW.additional_info_message, NEW.admin_note, 'additional information required')
        ELSE NULL
      END,
      CASE
        WHEN NEW.status = 'under_review' AND OLD.status = 'additional_info_required'
          THEN jsonb_build_object('event', 'resubmitted')
        ELSE '{}'::jsonb
      END
    );
  END IF;
  RETURN NEW;
END;
$$;
