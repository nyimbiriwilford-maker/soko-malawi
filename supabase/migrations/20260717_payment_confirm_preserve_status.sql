-- Preserve actionable statuses when confirming payment.
-- Do not overwrite additional_info_required / under_review / approved / etc.

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
  v_to text;
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
    -- Keep terminal + actionable statuses; only advance draft / payment_pending / submitted
    v_to := CASE
      WHEN v_from IN (
        'approved', 'rejected', 'cancelled', 'expired',
        'additional_info_required', 'under_review', 'payment_confirmed'
      ) THEN v_from
      WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review'
      ELSE 'payment_confirmed'
    END;

    UPDATE public.verification_requests SET
      amount_paid = COALESCE(v_row.payment_amount, amount_paid),
      payment_ref = COALESCE(payment_ref, v_row.transaction_reference),
      payment_method = v_row.payment_method,
      payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
      latest_payment_id = v_row.id,
      status = v_to,
      under_review_at = CASE
        WHEN v_to = 'under_review' THEN COALESCE(under_review_at, now())
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
      CASE
        WHEN v_from IN (
          'approved', 'rejected', 'cancelled', 'expired',
          'additional_info_required', 'under_review', 'payment_confirmed'
        ) THEN 'payment_confirmed'
        WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review'
        ELSE 'payment_confirmed'
      END,
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

CREATE OR REPLACE FUNCTION public.confirm_verification_gateway_payment(
  p_tx_ref text,
  p_gateway text DEFAULT 'paychangu',
  p_gateway_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.verification_payments;
  v_req public.verification_requests;
  v_settings public.verification_settings;
  v_from text;
  v_to text;
BEGIN
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) < 3 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  SELECT * INTO v_row
  FROM public.verification_payments
  WHERE transaction_reference = p_tx_ref
     OR gateway_session_id = p_tx_ref
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Try attach to open request by payment_ref
    SELECT * INTO v_req
    FROM public.verification_requests
    WHERE payment_ref = p_tx_ref
    ORDER BY updated_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment not found for tx_ref %', p_tx_ref;
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
    IF v_row.payment_status = 'confirmed' THEN
      -- Still ensure request payment flags are set
      NULL;
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
  END IF;

  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;
  SELECT status INTO v_from FROM public.verification_requests WHERE id = v_row.request_id;

  v_to := CASE
    WHEN v_from IN (
      'approved', 'rejected', 'cancelled', 'expired',
      'additional_info_required', 'under_review', 'payment_confirmed'
    ) THEN v_from
    WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review'
    ELSE 'payment_confirmed'
  END;

  UPDATE public.verification_requests SET
    amount_paid = COALESCE(v_row.payment_amount, amount_paid),
    payment_ref = COALESCE(payment_ref, p_tx_ref),
    payment_method = v_row.payment_method,
    payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
    latest_payment_id = v_row.id,
    status = v_to,
    under_review_at = CASE
      WHEN v_to = 'under_review' THEN COALESCE(under_review_at, now())
      ELSE under_review_at
    END,
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE id = v_row.request_id;

  BEGIN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note, meta)
    VALUES (
      v_row.request_id,
      COALESCE(v_from, 'payment_pending'),
      CASE
        WHEN v_from IN (
          'approved', 'rejected', 'cancelled', 'expired',
          'additional_info_required', 'under_review', 'payment_confirmed'
        ) THEN 'payment_confirmed'
        WHEN COALESCE(v_settings.auto_submit_on_payment, true) THEN 'under_review'
        ELSE 'payment_confirmed'
      END,
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
