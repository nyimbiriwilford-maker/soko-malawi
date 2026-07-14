-- ============================================================
-- 100_verification_foundation.sql
-- PHASE 1 — Verification Foundation
-- Proper status lifecycle, types, settings, profiles fields.
-- Idempotent / compatible with existing verification_requests.
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
-- 1) verification_types
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  default_fee_amount numeric,
  required_document_types text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.verification_types (code, name, description, default_fee_amount, required_document_types, sort_order)
VALUES
  (
    'seller',
    'Seller verification',
    'Identity-backed seller badge for individual marketplace sellers',
    5000,
    ARRAY['national_id', 'selfie'],
    10
  ),
  (
    'shop',
    'Shop verification',
    'Business / shop storefront verification',
    5000,
    ARRAY['national_id', 'business_registration', 'selfie'],
    20
  ),
  (
    'business',
    'Business verification',
    'Higher-trust business verification for organizations',
    15000,
    ARRAY['national_id', 'business_registration', 'proof_of_address'],
    30
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_fee_amount = COALESCE(public.verification_types.default_fee_amount, EXCLUDED.default_fee_amount),
  required_document_types = EXCLUDED.required_document_types,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

DROP TRIGGER IF EXISTS trg_verification_types_updated ON public.verification_types;
CREATE TRIGGER trg_verification_types_updated
  BEFORE UPDATE ON public.verification_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2) verification_settings (singleton + key/value extensibility)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Fee
  fee_amount numeric NOT NULL DEFAULT 5000,
  fee_currency text NOT NULL DEFAULT 'MWK',
  -- Review / lifecycle
  review_period_hours integer NOT NULL DEFAULT 24
    CHECK (review_period_hours > 0),
  request_expiry_days integer NOT NULL DEFAULT 30
    CHECK (request_expiry_days > 0),
  additional_info_deadline_days integer NOT NULL DEFAULT 7
    CHECK (additional_info_deadline_days > 0),
  verification_validity_days integer
    CHECK (verification_validity_days IS NULL OR verification_validity_days > 0),
  -- Documents & payments (configurable — not hardcoded in app)
  accepted_document_types text[] NOT NULL DEFAULT ARRAY[
    'national_id', 'passport', 'drivers_license', 'selfie',
    'business_registration', 'proof_of_address', 'other'
  ],
  supported_payment_methods text[] NOT NULL DEFAULT ARRAY[
    'pachangu', 'airtel_money', 'tnm_mpamba'
  ],
  default_verification_type_code text NOT NULL DEFAULT 'seller',
  auto_submit_on_payment boolean NOT NULL DEFAULT true,
  require_documents boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  -- Extensible bag for future flags without schema churn
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.verification_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_verification_settings_updated ON public.verification_settings;
CREATE TRIGGER trg_verification_settings_updated
  BEFORE UPDATE ON public.verification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional key/value overlay for admin tools
CREATE TABLE IF NOT EXISTS public.verification_setting_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ────────────────────────────────────────────────────────────
-- 3) verification_requests — create or upgrade
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_type_id uuid REFERENCES public.verification_types(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  payment_ref text,
  payment_method text,
  amount_due numeric,
  amount_paid numeric DEFAULT 0,
  currency text DEFAULT 'MWK',
  notes text,
  admin_note text,
  rejection_reason text,
  additional_info_message text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  payment_confirmed_at timestamptz,
  under_review_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade legacy columns
DO $$
BEGIN
  IF NOT public._soko_table_exists('verification_requests') THEN RETURN; END IF;

  ALTER TABLE public.verification_requests
    ADD COLUMN IF NOT EXISTS seller_id uuid,
    ADD COLUMN IF NOT EXISTS verification_type_id uuid,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS payment_ref text,
    ADD COLUMN IF NOT EXISTS payment_method text,
    ADD COLUMN IF NOT EXISTS amount_due numeric,
    ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MWK',
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS admin_note text,
    ADD COLUMN IF NOT EXISTS rejection_reason text,
    ADD COLUMN IF NOT EXISTS additional_info_message text,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS under_review_at timestamptz,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
    ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

  -- Backfill created_at from submitted_at when needed
  IF public._soko_column_exists('verification_requests', 'submitted_at') THEN
    UPDATE public.verification_requests
    SET created_at = COALESCE(created_at, submitted_at, now())
    WHERE created_at IS NULL;
  END IF;
  UPDATE public.verification_requests SET created_at = now() WHERE created_at IS NULL;
  UPDATE public.verification_requests SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;

  -- Map legacy statuses into new vocabulary (preserve approved/rejected/pending semantics)
  UPDATE public.verification_requests SET status = lower(trim(status)) WHERE status IS NOT NULL;
  UPDATE public.verification_requests SET status = 'under_review'
    WHERE status IN ('pending', 'review', 'in_review');
  UPDATE public.verification_requests SET status = 'payment_pending'
    WHERE status IN ('awaiting_payment', 'unpaid');
  UPDATE public.verification_requests SET status = 'draft'
    WHERE status IS NULL OR status = '';

  -- Default type = seller
  UPDATE public.verification_requests vr
  SET verification_type_id = vt.id
  FROM public.verification_types vt
  WHERE vr.verification_type_id IS NULL AND vt.code = 'seller';

  -- Attach FK for type when missing
  BEGIN
    ALTER TABLE public.verification_requests
      DROP CONSTRAINT IF EXISTS verification_requests_verification_type_id_fkey;
    ALTER TABLE public.verification_requests
      ADD CONSTRAINT verification_requests_verification_type_id_fkey
      FOREIGN KEY (verification_type_id) REFERENCES public.verification_types(id) ON DELETE SET NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'verification_type_id FK skip: %', SQLERRM;
  END;
END $$;

-- Status CHECK constraint (drop/recreate for upgrade safety)
DO $$
BEGIN
  ALTER TABLE public.verification_requests
    DROP CONSTRAINT IF EXISTS verification_requests_status_check;
  ALTER TABLE public.verification_requests
    ADD CONSTRAINT verification_requests_status_check
    CHECK (status IN (
      'draft',
      'submitted',
      'payment_pending',
      'payment_confirmed',
      'under_review',
      'additional_info_required',
      'approved',
      'rejected',
      'expired',
      'cancelled'
    ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'status check skip (clean bad rows first if needed): %', SQLERRM;
END $$;

DROP TRIGGER IF EXISTS trg_verification_requests_updated ON public.verification_requests;
CREATE TRIGGER trg_verification_requests_updated
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4) profiles verification columns
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT public._soko_table_exists('profiles') THEN RETURN; END IF;

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS verification_level text DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS verified_at timestamptz,
    ADD COLUMN IF NOT EXISTS verified_by uuid,
    ADD COLUMN IF NOT EXISTS verification_expiry timestamptz,
    ADD COLUMN IF NOT EXISTS rejection_reason text,
    ADD COLUMN IF NOT EXISTS verification_request_id uuid;

  -- verification_status for profile summary (none = never applied)
  BEGIN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_verification_status_check
      CHECK (verification_status IN (
        'none',
        'draft',
        'submitted',
        'payment_pending',
        'payment_confirmed',
        'under_review',
        'additional_info_required',
        'approved',
        'rejected',
        'expired',
        'cancelled'
      ));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'profiles verification_status check skip: %', SQLERRM;
  END;

  -- Backfill from is_verified
  UPDATE public.profiles
  SET verification_status = 'approved',
      verification_level = COALESCE(NULLIF(verification_level, 'none'), 'seller'),
      verified_at = COALESCE(verified_at, now())
  WHERE COALESCE(is_verified, false) = true
    AND (verification_status IS NULL OR verification_status IN ('none', 'draft'));

  BEGIN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_verification_request_id_fkey;
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_verification_request_id_fkey
      FOREIGN KEY (verification_request_id)
      REFERENCES public.verification_requests(id) ON DELETE SET NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'profiles.verification_request_id FK skip: %', SQLERRM;
  END;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5) Audit log for verification lifecycle
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verification_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_status_events_request
  ON public.verification_status_events (request_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 6) RPCs: settings, status transitions, apply approval
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_verification_settings()
RETURNS public.verification_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.verification_settings WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.get_active_verification_types()
RETURNS SETOF public.verification_types
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.verification_types
  WHERE is_active = true
  ORDER BY sort_order, name;
$$;

CREATE OR REPLACE FUNCTION public.log_verification_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'created');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.verification_status_events (request_id, from_status, to_status, actor_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verification_requests_status_log ON public.verification_requests;
CREATE TRIGGER trg_verification_requests_status_log
  AFTER INSERT OR UPDATE OF status ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_verification_status_change();

-- Sync profiles when request status changes
CREATE OR REPLACE FUNCTION public.sync_profile_from_verification_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level text := 'seller';
  v_expiry timestamptz := NULL;
  v_days integer;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN RETURN NEW; END IF;

  SELECT t.code INTO v_level
  FROM public.verification_types t
  WHERE t.id = NEW.verification_type_id;

  SELECT verification_validity_days INTO v_days
  FROM public.verification_settings WHERE id = 1;

  IF NEW.status = 'approved' THEN
    IF v_days IS NOT NULL THEN
      v_expiry := COALESCE(NEW.reviewed_at, now()) + make_interval(days => v_days);
    END IF;
    UPDATE public.profiles SET
      is_verified = true,
      verification_status = 'approved',
      verification_level = COALESCE(v_level, 'seller'),
      verified_at = COALESCE(NEW.reviewed_at, now()),
      verified_by = NEW.reviewed_by,
      verification_expiry = v_expiry,
      rejection_reason = NULL,
      verification_request_id = NEW.id,
      updated_at = now()
    WHERE id = NEW.seller_id;

    -- Also mark owned shops verified (preserve existing product behavior)
    IF to_regclass('public.shops') IS NOT NULL
       AND public._soko_column_exists('shops', 'is_verified') THEN
      UPDATE public.shops SET is_verified = true WHERE owner_id = NEW.seller_id;
    END IF;

  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles SET
      is_verified = false,
      verification_status = 'rejected',
      verification_level = COALESCE(v_level, verification_level, 'none'),
      rejection_reason = COALESCE(NEW.rejection_reason, NEW.admin_note),
      verification_request_id = NEW.id,
      verified_at = NULL,
      verification_expiry = NULL,
      updated_at = now()
    WHERE id = NEW.seller_id;

  ELSIF NEW.status IN (
    'draft', 'submitted', 'payment_pending', 'payment_confirmed',
    'under_review', 'additional_info_required', 'expired', 'cancelled'
  ) THEN
    UPDATE public.profiles SET
      verification_status = NEW.status,
      verification_request_id = NEW.id,
      -- Keep badge only if previously approved and still valid; clear if this is the active request
      is_verified = CASE
        WHEN NEW.status IN ('expired', 'cancelled', 'rejected') THEN false
        WHEN COALESCE(is_verified, false) AND verification_status = 'approved' THEN true
        ELSE false
      END,
      rejection_reason = CASE
        WHEN NEW.status = 'additional_info_required' THEN NEW.additional_info_message
        ELSE rejection_reason
      END,
      updated_at = now()
    WHERE id = NEW.seller_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sync_profile_from_verification_request: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verification_requests_sync_profile ON public.verification_requests;
CREATE TRIGGER trg_verification_requests_sync_profile
  AFTER INSERT OR UPDATE OF status, reviewed_at, reviewed_by, rejection_reason, additional_info_message, verification_type_id
  ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_verification_request();

-- Admin / system transition helper
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

  -- Sellers may only cancel their own open requests or submit drafts
  IF NOT public.is_admin() THEN
    IF p_to_status = 'cancelled' AND v_row.status IN (
      'draft','submitted','payment_pending','additional_info_required'
    ) THEN
      NULL; -- allowed
    ELSIF p_to_status = 'submitted' AND v_row.status IN ('draft', 'additional_info_required') THEN
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
      WHEN p_to_status = 'submitted' AND submitted_at IS NULL THEN now()
      ELSE submitted_at
    END,
    payment_confirmed_at = CASE
      WHEN p_to_status = 'payment_confirmed' THEN COALESCE(payment_confirmed_at, now())
      ELSE payment_confirmed_at
    END,
    under_review_at = CASE
      WHEN p_to_status = 'under_review' THEN COALESCE(under_review_at, now())
      ELSE under_review_at
    END,
    cancelled_at = CASE
      WHEN p_to_status = 'cancelled' THEN now()
      ELSE cancelled_at
    END,
    updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Called after PayChangu confirms (replaces instant approve)
CREATE OR REPLACE FUNCTION public.confirm_verification_payment(p_tx_ref text)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.verification_requests;
  v_uid uuid := auth.uid();
  v_settings public.verification_settings;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) = 0 THEN
    RAISE EXCEPTION 'tx_ref required';
  END IF;

  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;

  SELECT * INTO v_row
  FROM public.verification_requests
  WHERE payment_ref = p_tx_ref
    AND seller_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification request not found for payment';
  END IF;

  IF v_row.status IN ('approved', 'rejected', 'cancelled', 'expired') THEN
    RETURN v_row; -- idempotent
  END IF;

  UPDATE public.verification_requests SET
    status = CASE
      WHEN COALESCE(v_settings.auto_submit_on_payment, true)
        THEN 'under_review'
      ELSE 'payment_confirmed'
    END,
    payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
    under_review_at = CASE
      WHEN COALESCE(v_settings.auto_submit_on_payment, true)
        THEN COALESCE(under_review_at, now())
      ELSE under_review_at
    END,
    amount_paid = COALESCE(NULLIF(amount_paid, 0), amount_due, v_settings.fee_amount, 5000),
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Start a payment-pending request (used by VerificationModal)
CREATE OR REPLACE FUNCTION public.start_verification_payment(
  p_payment_ref text,
  p_payment_method text DEFAULT 'pachangu',
  p_type_code text DEFAULT NULL
)
RETURNS public.verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings public.verification_settings;
  v_type public.verification_types;
  v_existing public.verification_requests;
  v_row public.verification_requests;
  v_code text;
  v_expiry timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_settings FROM public.verification_settings WHERE id = 1;
  IF NOT FOUND OR COALESCE(v_settings.is_enabled, true) = false THEN
    RAISE EXCEPTION 'Verification is currently disabled';
  END IF;

  -- Block if already approved on profile
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND COALESCE(is_verified, false) = true
      AND verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Account is already verified';
  END IF;

  -- Block open pipeline requests
  SELECT * INTO v_existing
  FROM public.verification_requests
  WHERE seller_id = v_uid
    AND status IN (
      'draft','submitted','payment_pending','payment_confirmed',
      'under_review','additional_info_required'
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status IN ('under_review', 'payment_confirmed', 'additional_info_required', 'submitted') THEN
      RAISE EXCEPTION 'You already have a verification request in progress (%).', v_existing.status;
    END IF;
    -- Reuse draft / payment_pending
    IF v_existing.status IN ('draft', 'payment_pending') THEN
      UPDATE public.verification_requests SET
        payment_ref = p_payment_ref,
        payment_method = COALESCE(p_payment_method, payment_method, 'pachangu'),
        status = 'payment_pending',
        amount_due = COALESCE(amount_due, v_settings.fee_amount),
        currency = COALESCE(currency, v_settings.fee_currency, 'MWK'),
        expires_at = now() + make_interval(days => v_settings.request_expiry_days),
        updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_row;
      RETURN v_row;
    END IF;
  END IF;

  v_code := COALESCE(NULLIF(p_type_code, ''), v_settings.default_verification_type_code, 'seller');
  SELECT * INTO v_type FROM public.verification_types WHERE code = v_code AND is_active = true;
  IF NOT FOUND THEN
    SELECT * INTO v_type FROM public.verification_types WHERE is_active = true ORDER BY sort_order LIMIT 1;
  END IF;

  v_expiry := now() + make_interval(days => v_settings.request_expiry_days);

  INSERT INTO public.verification_requests (
    seller_id, verification_type_id, status, payment_ref, payment_method,
    amount_due, amount_paid, currency, expires_at, submitted_at
  ) VALUES (
    v_uid,
    v_type.id,
    'payment_pending',
    p_payment_ref,
    COALESCE(p_payment_method, 'pachangu'),
    COALESCE(v_type.default_fee_amount, v_settings.fee_amount),
    0,
    COALESCE(v_settings.fee_currency, 'MWK'),
    v_expiry,
    now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_verification_settings() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_active_verification_types() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.transition_verification_status(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_verification_payment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_verification_payment(text, text, text) TO authenticated;

COMMENT ON TABLE public.verification_types IS 'Catalog of verification products (seller, shop, business)';
COMMENT ON TABLE public.verification_settings IS 'Singleton config: fee, review period, docs, payment methods';
COMMENT ON TABLE public.verification_requests IS 'Seller verification pipeline with full status lifecycle';
COMMENT ON TABLE public.verification_status_events IS 'Audit trail of verification status transitions';
COMMENT ON COLUMN public.profiles.verification_status IS 'Mirror of latest verification pipeline status or none/approved';
COMMENT ON COLUMN public.profiles.verification_level IS 'Type level: none|seller|shop|business';
COMMENT ON COLUMN public.profiles.verification_request_id IS 'Active or last verification request';
