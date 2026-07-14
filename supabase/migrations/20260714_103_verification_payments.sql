-- ============================================================
-- 103_verification_payments.sql
-- PHASE 3 — Verification payment module
-- Methods catalog + payments ledger + manual admin confirmation.
-- Architecture ready for PayChangu / future gateway APIs.
-- Idempotent / safe for existing verification_requests.
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._soko_column_exists(t text, c text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN false
    ELSE EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 1) Payment method catalog (extensible for future gateways)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_payment_methods (
  code text PRIMARY KEY,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'mobile_money'
    CHECK (channel IN ('mobile_money', 'bank', 'card', 'gateway', 'other')),
  provider text,
  is_active boolean NOT NULL DEFAULT true,
  supports_auto_confirm boolean NOT NULL DEFAULT false,
  instructions text,
  sort_order integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.verification_payment_methods
  (code, name, channel, provider, is_active, supports_auto_confirm, instructions, sort_order)
VALUES
  ('airtel_money', 'Airtel Money', 'mobile_money', 'airtel', true, false,
   'Send the fee via Airtel Money and enter the transaction ID. An admin will confirm.', 10),
  ('tnm_mpamba', 'TNM Mpamba', 'mobile_money', 'tnm', true, false,
   'Send the fee via TNM Mpamba and enter the transaction ID. An admin will confirm.', 20),
  ('bank_transfer', 'Bank Transfer', 'bank', 'manual', true, false,
   'Transfer the fee to SokoMw bank account and upload a receipt for admin confirmation.', 30),
  ('card', 'Card Payment', 'card', 'future_gateway', true, false,
   'Card payments will be confirmed via gateway; manual confirmation available until integrated.', 40),
  ('pachangu', 'PayChangu (Mobile Money)', 'gateway', 'paychangu', true, true,
   'Pay via PayChangu checkout (Airtel Money / TNM Mpamba). Auto-confirm when gateway reports success.', 5),
  ('other', 'Other', 'other', 'manual', true, false,
   'Use only if instructed by support. Provide transaction reference and receipt.', 90)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  provider = EXCLUDED.provider,
  supports_auto_confirm = EXCLUDED.supports_auto_confirm,
  instructions = EXCLUDED.instructions,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

DROP TRIGGER IF EXISTS trg_verification_payment_methods_updated ON public.verification_payment_methods;
CREATE TRIGGER trg_verification_payment_methods_updated
  BEFORE UPDATE ON public.verification_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keep settings.supported_payment_methods in sync suggestion (do not overwrite custom admin edits)
DO $$
BEGIN
  IF public._soko_table_exists('verification_settings') THEN
    UPDATE public.verification_settings
    SET supported_payment_methods = ARRAY[
      'pachangu', 'airtel_money', 'tnm_mpamba', 'bank_transfer', 'card'
    ]
    WHERE id = 1
      AND (
        supported_payment_methods IS NULL
        OR array_length(supported_payment_methods, 1) IS NULL
        OR array_length(supported_payment_methods, 1) < 3
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2) verification_payments ledger
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method text NOT NULL
    REFERENCES public.verification_payment_methods(code),
  payment_amount numeric NOT NULL CHECK (payment_amount >= 0),
  currency text NOT NULL DEFAULT 'MWK',
  transaction_reference text,
  payment_date timestamptz,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN (
      'pending',                -- created, not sent
      'initiated',              -- checkout started / user told to pay
      'awaiting_confirmation',  -- user claims paid / receipt uploaded
      'confirmed',              -- admin or gateway confirmed
      'failed',
      'cancelled',
      'refunded',
      'expired'
    )),
  gateway text DEFAULT 'manual',  -- manual | paychangu | stripe | etc.
  gateway_session_id text,
  gateway_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  receipt_path text,              -- storage path in verification-docs (or receipts)
  receipt_file_name text,
  verified_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  confirmed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Soft upgrade if table already partially exists
DO $$
BEGIN
  IF public._soko_table_exists('verification_payments') THEN
    ALTER TABLE public.verification_payments
      ADD COLUMN IF NOT EXISTS request_id uuid,
      ADD COLUMN IF NOT EXISTS seller_id uuid,
      ADD COLUMN IF NOT EXISTS payment_method text,
      ADD COLUMN IF NOT EXISTS payment_amount numeric,
      ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MWK',
      ADD COLUMN IF NOT EXISTS transaction_reference text,
      ADD COLUMN IF NOT EXISTS payment_date timestamptz,
      ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS gateway_session_id text,
      ADD COLUMN IF NOT EXISTS gateway_payload jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS receipt_path text,
      ADD COLUMN IF NOT EXISTS receipt_file_name text,
      ADD COLUMN IF NOT EXISTS verified_by_admin uuid,
      ADD COLUMN IF NOT EXISTS admin_notes text,
      ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
      ADD COLUMN IF NOT EXISTS failed_at timestamptz,
      ADD COLUMN IF NOT EXISTS failure_reason text,
      ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_verification_payments_request
  ON public.verification_payments (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_payments_seller
  ON public.verification_payments (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_payments_status
  ON public.verification_payments (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_payments_tx_ref
  ON public.verification_payments (transaction_reference)
  WHERE transaction_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_payments_gateway_session
  ON public.verification_payments (gateway, gateway_session_id)
  WHERE gateway_session_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_verification_payments_updated ON public.verification_payments;
CREATE TRIGGER trg_verification_payments_updated
  BEFORE UPDATE ON public.verification_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional link from request → latest payment
DO $$
BEGIN
  IF public._soko_table_exists('verification_requests') THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN IF NOT EXISTS latest_payment_id uuid;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3) RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.verification_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vpm_methods_select" ON public.verification_payment_methods;
CREATE POLICY "vpm_methods_select" ON public.verification_payment_methods
  FOR SELECT TO authenticated, anon
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "vpm_methods_admin" ON public.verification_payment_methods;
CREATE POLICY "vpm_methods_admin" ON public.verification_payment_methods
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "vpay_select_own" ON public.verification_payments;
CREATE POLICY "vpay_select_own" ON public.verification_payments
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "vpay_insert_own" ON public.verification_payments;
CREATE POLICY "vpay_insert_own" ON public.verification_payments
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

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
    OR seller_id = auth.uid()
  );

-- ────────────────────────────────────────────────────────────
-- 4) RPCs
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_verification_payment_methods()
RETURNS SETOF public.verification_payment_methods
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.verification_payment_methods
  WHERE is_active = true
  ORDER BY sort_order, name;
$$;

/**
 * Create or update a payment row for a verification request.
 * Used by wizard (PayChangu initiate) and manual payment paths.
 */
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_id required'; END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
    RAISE EXCEPTION 'payment_method required';
  END IF;

  -- Allow unknown method codes by inserting into catalog as 'other' channel? Prefer strict:
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

  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;
  v_amount := COALESCE(p_payment_amount, v_req.amount_due, v_settings.fee_amount, 5000);
  v_currency := COALESCE(p_currency, v_req.currency, v_settings.fee_currency, 'MWK');
  v_status := COALESCE(NULLIF(p_status, ''), 'initiated');
  IF v_status NOT IN (
    'pending','initiated','awaiting_confirmation','confirmed','failed','cancelled','refunded','expired'
  ) THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  -- Reuse open payment on same request + method if still open
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

  -- Mirror key fields onto request for backward compatibility
  UPDATE public.verification_requests SET
    payment_ref = COALESCE(p_transaction_reference, payment_ref, v_row.transaction_reference),
    payment_method = p_payment_method,
    amount_due = v_amount,
    currency = v_currency,
    latest_payment_id = v_row.id,
    status = CASE
      WHEN status IN ('approved', 'rejected', 'cancelled', 'expired') THEN status
      WHEN v_status = 'confirmed' THEN status  -- confirmation handled separately
      WHEN v_status IN ('initiated', 'awaiting_confirmation', 'pending')
        AND status IN ('draft', 'submitted') THEN 'payment_pending'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN v_row;
END;
$$;

/**
 * Seller submits proof of manual payment (tx id + optional receipt path).
 */
CREATE OR REPLACE FUNCTION public.submit_verification_payment_proof(
  p_payment_id uuid,
  p_transaction_reference text,
  p_receipt_path text DEFAULT NULL,
  p_receipt_file_name text DEFAULT NULL,
  p_payment_date timestamptz DEFAULT now()
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_payments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_transaction_reference IS NULL OR length(trim(p_transaction_reference)) < 3 THEN
    RAISE EXCEPTION 'Transaction reference required';
  END IF;

  SELECT * INTO v_row FROM public.verification_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_row.seller_id <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_row.payment_status IN ('confirmed', 'refunded', 'cancelled') THEN
    RETURN v_row;
  END IF;

  UPDATE public.verification_payments SET
    transaction_reference = trim(p_transaction_reference),
    receipt_path = COALESCE(p_receipt_path, receipt_path),
    receipt_file_name = COALESCE(p_receipt_file_name, receipt_file_name),
    payment_date = COALESCE(p_payment_date, payment_date, now()),
    payment_status = 'awaiting_confirmation',
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_row;

  UPDATE public.verification_requests SET
    payment_ref = v_row.transaction_reference,
    payment_method = v_row.payment_method,
    status = CASE
      WHEN status IN ('approved', 'rejected', 'cancelled', 'expired', 'under_review') THEN status
      ELSE 'payment_pending'
    END,
    latest_payment_id = v_row.id,
    updated_at = now()
  WHERE id = v_row.request_id;

  RETURN v_row;
END;
$$;

/**
 * Admin confirms a payment (manual path). Optionally advance request to under_review.
 */
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_row FROM public.verification_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

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

  RETURN v_row;
END;
$$;

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
  RETURN v_row;
END;
$$;

/**
 * Hook for gateway success (PayChangu). Marks payment confirmed + advances request.
 * Callable by authenticated owner of the payment or admin.
 */
CREATE OR REPLACE FUNCTION public.confirm_verification_gateway_payment(
  p_tx_ref text,
  p_gateway text DEFAULT 'paychangu',
  p_gateway_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.verification_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.verification_payments;
  v_req public.verification_requests;
  v_settings public.verification_settings;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) = 0 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  -- Prefer payment row by gateway session / transaction_reference
  SELECT * INTO v_row
  FROM public.verification_payments
  WHERE transaction_reference = p_tx_ref
     OR gateway_session_id = p_tx_ref
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create from matching request.payment_ref
    SELECT * INTO v_req
    FROM public.verification_requests
    WHERE payment_ref = p_tx_ref AND seller_id = v_uid
    ORDER BY created_at DESC
    LIMIT 1;

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
      COALESCE(p_gateway_payload, '{}'::jsonb), now(), now()
    )
    RETURNING * INTO v_row;
  ELSE
    IF v_row.seller_id <> v_uid AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
    UPDATE public.verification_payments SET
      payment_status = 'confirmed',
      gateway = COALESCE(p_gateway, gateway, 'paychangu'),
      gateway_payload = COALESCE(gateway_payload, '{}'::jsonb) || COALESCE(p_gateway_payload, '{}'::jsonb),
      transaction_reference = COALESCE(transaction_reference, p_tx_ref),
      payment_date = COALESCE(payment_date, now()),
      confirmed_at = COALESCE(confirmed_at, now()),
      updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  -- Advance request (same rules as admin confirm)
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

  RETURN v_row;
END;
$$;

-- Replace Phase 1 confirm_verification_payment to also write ledger
CREATE OR REPLACE FUNCTION public.confirm_verification_payment(p_tx_ref text)
RETURNS public.verification_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pay public.verification_payments;
  v_req public.verification_requests;
BEGIN
  -- Confirm via payment module (creates/updates payment row)
  BEGIN
    SELECT * INTO v_pay FROM public.confirm_verification_gateway_payment(p_tx_ref, 'paychangu', '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    -- Fall back to Phase 1 request-only update
    NULL;
  END;

  SELECT * INTO v_req
  FROM public.verification_requests
  WHERE payment_ref = p_tx_ref AND seller_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND AND v_pay.request_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.verification_requests WHERE id = v_pay.request_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification request not found for payment';
  END IF;

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_verification_payments_for_request(p_request_id uuid)
RETURNS SETOF public.verification_payments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.*
  FROM public.verification_payments p
  WHERE p.request_id = p_request_id
    AND (p.seller_id = auth.uid() OR public.is_admin())
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_verification_payment_methods() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_verification_payment(uuid, text, numeric, text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_verification_payment_proof(uuid, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_verification_payment(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_verification_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_verification_gateway_payment(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_verification_payment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_verification_payments_for_request(uuid) TO authenticated;

COMMENT ON TABLE public.verification_payment_methods IS
  'Catalog of verification payment rails (mobile money, bank, card, gateways)';
COMMENT ON TABLE public.verification_payments IS
  'Ledger of verification payments; supports manual admin confirm and future APIs';
COMMENT ON COLUMN public.verification_payments.gateway IS
  'manual | paychangu | stripe | ... — provider adapter key for future integrations';
COMMENT ON COLUMN public.verification_payments.verified_by_admin IS
  'Admin who manually confirmed the payment';
