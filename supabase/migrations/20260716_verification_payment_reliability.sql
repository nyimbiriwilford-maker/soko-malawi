-- ============================================================
-- Verification payment production reliability
-- - Gateway confirm only via service_role / admin (no seller self-confirm)
-- - Idempotent confirmation
-- - Cancel payment for retry without destroying request
-- - Seller cannot set payment_status=confirmed or change amount
-- - Payment lifecycle events on verification_status_events
-- ============================================================

-- 1) Harden seller payment update policy (open statuses only; never confirmed)
DROP POLICY IF EXISTS "vpay_update_own" ON public.verification_payments;
CREATE POLICY "vpay_update_own" ON public.verification_payments
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND payment_status IN ('pending', 'initiated', 'awaiting_confirmation')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND payment_status IN ('pending', 'initiated', 'awaiting_confirmation', 'failed', 'cancelled', 'expired')
      AND payment_status IS DISTINCT FROM 'confirmed'
    )
  );

-- 2) Gateway confirm: service_role or admin only; sellers cannot self-confirm
CREATE OR REPLACE FUNCTION public.confirm_verification_gateway_payment(
  p_tx_ref text,
  p_gateway text DEFAULT 'paychangu',
  p_gateway_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_row public.verification_payments;
  v_req public.verification_requests;
  v_settings public.verification_settings;
  v_is_service boolean := (v_role = 'service_role');
BEGIN
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) = 0 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  -- Only service role (edge after PayChangu verify) or admin may confirm
  IF NOT v_is_service AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Payment confirmation requires gateway verification';
  END IF;

  SELECT * INTO v_row
  FROM public.verification_payments
  WHERE transaction_reference = p_tx_ref
     OR gateway_session_id = p_tx_ref
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_row.payment_status = 'confirmed' THEN
    -- Idempotent: already confirmed
    RETURN v_row;
  END IF;

  IF NOT FOUND THEN
    SELECT * INTO v_req
    FROM public.verification_requests
    WHERE payment_ref = p_tx_ref
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment not found for reference';
    END IF;

    SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;

    INSERT INTO public.verification_payments (
      request_id, seller_id, payment_method, payment_amount, currency,
      transaction_reference, payment_status, gateway, gateway_session_id,
      gateway_payload, payment_date, confirmed_at
    ) VALUES (
      v_req.id, v_req.seller_id,
      COALESCE(v_req.payment_method, 'pachangu'),
      COALESCE(v_req.amount_due, v_settings.fee_amount, 5000),
      COALESCE(v_req.currency, v_settings.fee_currency, 'MWK'),
      p_tx_ref, 'confirmed', COALESCE(p_gateway, 'paychangu'), p_tx_ref,
      COALESCE(p_gateway_payload, '{}'::jsonb) || jsonb_build_object('confirmed_via', 'gateway'),
      now(), now()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.verification_payments SET
      payment_status = 'confirmed',
      gateway = COALESCE(p_gateway, gateway, 'paychangu'),
      gateway_payload = COALESCE(gateway_payload, '{}'::jsonb)
        || COALESCE(p_gateway_payload, '{}'::jsonb)
        || jsonb_build_object('confirmed_via', 'gateway', 'confirmed_at_server', now()),
      transaction_reference = COALESCE(transaction_reference, p_tx_ref),
      payment_date = COALESCE(payment_date, now()),
      confirmed_at = COALESCE(confirmed_at, now()),
      updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;

  UPDATE public.verification_requests SET
    amount_paid = COALESCE(v_row.payment_amount, amount_paid),
    payment_ref = COALESCE(payment_ref, p_tx_ref),
    payment_method = v_row.payment_method,
    payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
    latest_payment_id = v_row.id,
    status = CASE
      WHEN status IN ('approved', 'rejected', 'cancelled', 'expired') THEN status
      WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review'
      ELSE 'payment_confirmed'
    END,
    under_review_at = CASE
      WHEN COALESCE(v_settings.auto_submit_on_payment, true)
        AND status NOT IN ('approved', 'rejected', 'cancelled', 'expired')
        THEN COALESCE(under_review_at, now())
      ELSE under_review_at
    END,
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE id = v_row.request_id;

  -- Audit event (trigger also logs status change)
  BEGIN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      v_row.request_id,
      'payment_pending',
      CASE WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review' ELSE 'payment_confirmed' END,
      NULL,
      'Payment completed',
      jsonb_build_object(
        'event', 'payment_completed',
        'tx_ref', p_tx_ref,
        'gateway', COALESCE(p_gateway, 'paychangu'),
        'payment_id', v_row.id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;

-- 3) Mark payment failed/cancelled/expired without destroying verification request
CREATE OR REPLACE FUNCTION public.mark_verification_payment_outcome(
  p_tx_ref text,
  p_outcome text, -- failed | cancelled | expired
  p_reason text DEFAULT NULL
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_row public.verification_payments;
  v_outcome text := lower(trim(coalesce(p_outcome, '')));
BEGIN
  IF v_outcome NOT IN ('failed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Invalid outcome';
  END IF;
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) = 0 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  SELECT * INTO v_row
  FROM public.verification_payments
  WHERE transaction_reference = p_tx_ref OR gateway_session_id = p_tx_ref
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Soft no-op for unknown refs (browser cancel before ledger row)
    RETURN NULL;
  END IF;

  IF v_row.payment_status = 'confirmed' THEN
    RETURN v_row; -- never downgrade confirmed
  END IF;

  IF v_role <> 'service_role'
     AND NOT public.is_admin()
     AND (v_uid IS NULL OR v_row.seller_id <> v_uid) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.verification_payments SET
    payment_status = v_outcome,
    failure_reason = COALESCE(p_reason, failure_reason),
    failed_at = CASE WHEN v_outcome = 'failed' THEN now() ELSE failed_at END,
    updated_at = now(),
    gateway_payload = COALESCE(gateway_payload, '{}'::jsonb)
      || jsonb_build_object('outcome', v_outcome, 'reason', p_reason, 'at', now())
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  -- Keep request open for retry: payment_pending → draft (not cancelled)
  IF v_row.request_id IS NOT NULL THEN
    UPDATE public.verification_requests SET
      status = CASE
        WHEN status IN ('approved', 'rejected', 'under_review', 'payment_confirmed') THEN status
        WHEN status = 'payment_pending' THEN 'draft'
        ELSE status
      END,
      updated_at = now(),
      meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
        'last_payment_outcome', v_outcome,
        'last_payment_outcome_at', now(),
        'last_payment_tx_ref', p_tx_ref
      )
    WHERE id = v_row.request_id
      AND status IN ('draft', 'payment_pending', 'submitted');
  END IF;

  BEGIN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      v_row.request_id,
      'payment_pending',
      'draft',
      v_uid,
      CASE v_outcome
        WHEN 'cancelled' THEN 'Payment cancelled'
        WHEN 'expired' THEN 'Payment expired'
        ELSE 'Payment failed'
      END,
      jsonb_build_object('event', 'payment_' || v_outcome, 'tx_ref', p_tx_ref, 'reason', p_reason)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_verification_payment_outcome(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_verification_gateway_payment(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_verification_gateway_payment(text, text, jsonb) TO service_role;

-- 4) Admin reject payment: leave request retryable
CREATE OR REPLACE FUNCTION public.admin_reject_verification_payment(
  p_payment_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_payments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  UPDATE public.verification_payments SET
    payment_status = 'failed',
    verified_by_admin = v_uid,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    failure_reason = COALESCE(p_admin_notes, failure_reason, 'Rejected by admin'),
    failed_at = now(),
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  -- Allow seller to resubmit payment on same request
  IF v_row.request_id IS NOT NULL THEN
    UPDATE public.verification_requests SET
      status = CASE
        WHEN status IN ('approved', 'rejected', 'under_review', 'payment_confirmed') THEN status
        ELSE 'draft'
      END,
      updated_at = now(),
      meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
        'payment_rejected', true,
        'payment_reject_reason', COALESCE(p_admin_notes, 'Rejected by admin'),
        'payment_rejected_at', now()
      )
    WHERE id = v_row.request_id;
  END IF;

  BEGIN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      v_row.request_id,
      'payment_pending',
      'draft',
      v_uid,
      'Payment rejected by admin',
      jsonb_build_object('event', 'payment_failed', 'payment_id', v_row.id, 'admin', true)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;

-- 5) Admin confirm: log event
CREATE OR REPLACE FUNCTION public.admin_confirm_verification_payment(
  p_payment_id uuid,
  p_admin_notes text DEFAULT NULL,
  p_advance_request boolean DEFAULT true
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_payments;
  v_settings public.verification_settings;
  v_from text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_row FROM public.verification_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF v_row.payment_status = 'confirmed' THEN
    RETURN v_row;
  END IF;

  SELECT status INTO v_from FROM public.verification_requests WHERE id = v_row.request_id;

  UPDATE public.verification_payments SET
    payment_status = 'confirmed',
    verified_by_admin = v_uid,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    confirmed_at = COALESCE(confirmed_at, now()),
    payment_date = COALESCE(payment_date, now()),
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_row;

  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;

  IF p_advance_request AND v_row.request_id IS NOT NULL THEN
    UPDATE public.verification_requests SET
      amount_paid = COALESCE(v_row.payment_amount, amount_paid),
      payment_ref = COALESCE(payment_ref, v_row.transaction_reference),
      payment_method = v_row.payment_method,
      payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
      latest_payment_id = v_row.id,
      status = CASE
        WHEN status IN ('approved', 'rejected', 'cancelled', 'expired') THEN status
        WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review'
        ELSE 'payment_confirmed'
      END,
      under_review_at = CASE
        WHEN COALESCE(v_settings.auto_submit_on_payment, true)
          AND status NOT IN ('approved', 'rejected', 'cancelled', 'expired')
          THEN COALESCE(under_review_at, now())
        ELSE under_review_at
      END,
      submitted_at = COALESCE(submitted_at, now()),
      updated_at = now()
    WHERE id = v_row.request_id;
  END IF;

  BEGIN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      v_row.request_id,
      COALESCE(v_from, 'payment_pending'),
      CASE WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review' ELSE 'payment_confirmed' END,
      v_uid,
      'Payment confirmed by admin',
      jsonb_build_object('event', 'payment_confirmed_by_admin', 'payment_id', v_row.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;

-- 6) create_verification_payment: never let client force amount above settings without bound;
--    reuse open payment; log initiated event
CREATE OR REPLACE FUNCTION public.create_verification_payment(
  p_request_id uuid,
  p_payment_method text,
  p_payment_amount numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_gateway text DEFAULT 'manual',
  p_gateway_session_id text DEFAULT NULL,
  p_gateway_payload jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'initiated'
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.verification_requests;
  v_settings public.verification_settings;
  v_amount numeric;
  v_currency text;
  v_status text;
  v_row public.verification_payments;
  v_confirmed public.verification_payments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id required'; END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
    RAISE EXCEPTION 'payment_method required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.verification_payment_methods WHERE code = p_payment_method) THEN
    INSERT INTO public.verification_payment_methods (code, name, channel, provider, sort_order)
    VALUES (p_payment_method, initcap(replace(p_payment_method, '_', ' ')), 'other', 'custom', 100)
    ON CONFLICT (code) DO NOTHING;
  END IF;

  SELECT * INTO v_req FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found'; END IF;
  IF v_req.seller_id <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Already paid: return existing confirmed payment (no duplicate)
  SELECT * INTO v_confirmed
  FROM public.verification_payments
  WHERE request_id = p_request_id AND payment_status = 'confirmed'
  ORDER BY confirmed_at DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN
    RETURN v_confirmed;
  END IF;

  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;
  -- Amount source of truth: request due / settings (ignore client inflation)
  v_amount := COALESCE(v_req.amount_due, v_settings.fee_amount, 5000);
  IF p_payment_amount IS NOT NULL AND public.is_admin() THEN
    v_amount := p_payment_amount;
  END IF;
  v_currency := COALESCE(v_req.currency, v_settings.fee_currency, 'MWK');
  v_status := COALESCE(NULLIF(p_status, ''), 'initiated');
  IF v_status NOT IN (
    'pending','initiated','awaiting_confirmation','confirmed','failed','cancelled','refunded','expired'
  ) THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;
  -- Sellers cannot create as confirmed
  IF v_status = 'confirmed' AND NOT public.is_admin() THEN
    v_status := 'initiated';
  END IF;

  SELECT * INTO v_row
  FROM public.verification_payments
  WHERE request_id = p_request_id
    AND payment_status IN ('pending', 'initiated', 'awaiting_confirmation')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.verification_payments SET
      payment_method = p_payment_method,
      payment_amount = v_amount,
      currency = v_currency,
      transaction_reference = COALESCE(p_transaction_reference, transaction_reference),
      payment_status = v_status,
      gateway = COALESCE(p_gateway, gateway, 'manual'),
      gateway_session_id = COALESCE(p_gateway_session_id, gateway_session_id),
      gateway_payload = COALESCE(gateway_payload, '{}'::jsonb) || COALESCE(p_gateway_payload, '{}'::jsonb),
      payment_date = COALESCE(payment_date, CASE WHEN v_status IN ('awaiting_confirmation','confirmed') THEN now() ELSE payment_date END),
      updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.verification_payments (
      request_id, seller_id, payment_method, payment_amount, currency,
      transaction_reference, payment_status, gateway, gateway_session_id, gateway_payload,
      payment_date
    ) VALUES (
      p_request_id, v_req.seller_id, p_payment_method, v_amount, v_currency,
      p_transaction_reference, v_status, COALESCE(p_gateway, 'manual'), p_gateway_session_id,
      COALESCE(p_gateway_payload, '{}'::jsonb),
      CASE WHEN v_status IN ('awaiting_confirmation', 'confirmed') THEN now() ELSE NULL END
    )
    RETURNING * INTO v_row;
  END IF;

  UPDATE public.verification_requests SET
    payment_ref = COALESCE(p_transaction_reference, payment_ref, v_row.transaction_reference),
    payment_method = p_payment_method,
    amount_due = v_amount,
    currency = v_currency,
    latest_payment_id = v_row.id,
    status = CASE
      WHEN status IN ('approved', 'rejected', 'cancelled', 'expired', 'under_review', 'payment_confirmed') THEN status
      WHEN v_status IN ('initiated', 'awaiting_confirmation', 'pending')
        AND status IN ('draft', 'submitted') THEN 'payment_pending'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_request_id;

  BEGIN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      p_request_id,
      v_req.status,
      CASE WHEN v_status = 'awaiting_confirmation' THEN 'payment_pending' ELSE COALESCE(
        (SELECT status FROM public.verification_requests WHERE id = p_request_id), 'payment_pending'
      ) END,
      v_uid,
      CASE WHEN v_status = 'awaiting_confirmation' THEN 'Payment proof submitted'
           ELSE 'Payment initiated' END,
      jsonb_build_object(
        'event', CASE WHEN v_status = 'awaiting_confirmation' THEN 'payment_proof_submitted' ELSE 'payment_initiated' END,
        'payment_id', v_row.id,
        'method', p_payment_method,
        'tx_ref', p_transaction_reference
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.confirm_verification_gateway_payment IS
  'Confirm PayChangu (etc.) payment — service_role/admin only after gateway verify';
COMMENT ON FUNCTION public.mark_verification_payment_outcome IS
  'Mark payment failed/cancelled/expired; keep verification request open for retry';
