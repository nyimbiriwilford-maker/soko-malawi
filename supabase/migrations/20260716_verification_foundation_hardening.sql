-- ============================================================
-- 20260716_verification_foundation_hardening.sql
-- Production-ready security for verification foundation
-- Idempotent. Apply AFTER 100–103.
--
-- Fixes:
--   • verification_documents RLS (missing from 102)
--   • storage verification-docs: private, seller folder isolation, admin read
--   • status_events: seller read own; insert admin/trigger only
--   • payments: sellers cannot self-confirm payment_status
--   • requests: sellers cannot self-approve or force under_review
--
-- PRODUCTION CHECKLIST (Supabase dashboard / ops — not automated here):
--   [ ] Apply migrations 100 → 101 → 102 → 103 → this file
--   [ ] Bucket verification-docs exists and public = false
--   [ ] Edge function secrets: PAYCHANGU_SECRET_KEY
--   [ ] Deploy edge functions: initiate-payment, verify-transaction
--   [ ] At least one profiles.role = 'admin'
--   [ ] Smoke: upload doc → pay → under_review → admin opens signed URL
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

-- Canonical admin check (profiles.role = 'admin')
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

-- ════════════════════════════════════════════════════════════
-- 1) verification_documents — schema + RLS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'id',
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF public._soko_table_exists('verification_documents') THEN
    ALTER TABLE public.verification_documents
      ADD COLUMN IF NOT EXISTS request_id uuid,
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD COLUMN IF NOT EXISTS doc_type text DEFAULT 'id',
      ADD COLUMN IF NOT EXISTS storage_path text,
      ADD COLUMN IF NOT EXISTS file_name text,
      ADD COLUMN IF NOT EXISTS mime_type text,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'uploaded',
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF public._soko_table_exists('verification_documents')
     AND public._soko_table_exists('verification_requests') THEN
    BEGIN
      ALTER TABLE public.verification_documents
        DROP CONSTRAINT IF EXISTS verification_documents_request_id_fkey;
      ALTER TABLE public.verification_documents
        ADD CONSTRAINT verification_documents_request_id_fkey
        FOREIGN KEY (request_id)
        REFERENCES public.verification_requests(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'verification_documents request_id FK skip: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_verification_documents_user
  ON public.verification_documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_documents_request
  ON public.verification_documents (request_id, created_at DESC)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verification_documents_path
  ON public.verification_documents (storage_path);

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_documents_own" ON public.verification_documents;
DROP POLICY IF EXISTS "verification_documents_select" ON public.verification_documents;
DROP POLICY IF EXISTS "verification_documents_insert" ON public.verification_documents;
DROP POLICY IF EXISTS "verification_documents_update" ON public.verification_documents;
DROP POLICY IF EXISTS "verification_documents_delete" ON public.verification_documents;

-- SELECT: own docs, or admin (review desk). Never public/anon.
CREATE POLICY "verification_documents_select" ON public.verification_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- INSERT: only as self (path ownership enforced in app: {userId}/...)
CREATE POLICY "verification_documents_insert" ON public.verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: owner may fix metadata; admin may flag status
CREATE POLICY "verification_documents_update" ON public.verification_documents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- DELETE: owner or admin (least privilege)
CREATE POLICY "verification_documents_delete" ON public.verification_documents
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ════════════════════════════════════════════════════════════
-- 2) Storage bucket verification-docs (private; signed URLs only)
-- ════════════════════════════════════════════════════════════
-- NOTE: On hosted Supabase, storage.objects is often owned by
-- supabase_storage_admin. Policy DDL may raise 42501
-- "must be owner of relation objects". Bucket insert + public.table RLS
-- still run; storage policies are best-effort with a clear NOTICE.
-- Fallback: Dashboard → Storage → verification-docs → Policies
--   or run: supabase/migrations/20260716_verification_docs_storage_policies.sql
--   as a role that owns storage.objects (postgres / service role).

DO $$
BEGIN
  -- Bucket metadata (usually allowed for postgres / dashboard SQL)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'verification-docs',
    'verification-docs',
    false,  -- NEVER public
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = COALESCE(storage.buckets.file_size_limit, 10485760),
    allowed_mime_types = COALESCE(
      storage.buckets.allowed_mime_types,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'SKIP storage.buckets update (42501/privilege): ensure bucket verification-docs exists, public=false';
  WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'SKIP storage.buckets update (42501): %', SQLERRM;
    ELSE
      RAISE;
    END IF;
END $$;

DO $$
BEGIN
  -- Drop existing policies (may fail without ownership)
  DROP POLICY IF EXISTS "verification_docs_owner_all" ON storage.objects;
  DROP POLICY IF EXISTS "verification_docs_owner_select" ON storage.objects;
  DROP POLICY IF EXISTS "verification_docs_owner_insert" ON storage.objects;
  DROP POLICY IF EXISTS "verification_docs_owner_update" ON storage.objects;
  DROP POLICY IF EXISTS "verification_docs_owner_delete" ON storage.objects;
  DROP POLICY IF EXISTS "verification_docs_admin_select" ON storage.objects;
  DROP POLICY IF EXISTS "verification_docs_admin_all" ON storage.objects;

  -- Path convention: {auth.uid()}/... → seller isolation
  CREATE POLICY "verification_docs_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "verification_docs_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "verification_docs_owner_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "verification_docs_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'verification-docs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Admin review: SELECT all objects (app uses createSignedUrl — not public URLs)
  CREATE POLICY "verification_docs_admin_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'verification-docs'
      AND public.is_admin()
    );

  RAISE NOTICE 'storage.objects policies for verification-docs applied OK';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'SKIP storage.objects policies (privilege). Apply via Dashboard or 20260716_verification_docs_storage_policies.sql as table owner. %', SQLERRM;
  WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'SKIP storage.objects policies (42501 must be owner of relation objects). Apply storage policies separately. %', SQLERRM;
    ELSE
      RAISE;
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 3) verification_status_events — least privilege
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF public._soko_table_exists('verification_status_events') THEN
    ALTER TABLE public.verification_status_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "verification_status_events_select" ON public.verification_status_events;
DROP POLICY IF EXISTS "verification_status_events_insert" ON public.verification_status_events;
DROP POLICY IF EXISTS "verification_status_events_update" ON public.verification_status_events;
DROP POLICY IF EXISTS "verification_status_events_delete" ON public.verification_status_events;

-- Seller: events for own requests only. Admin: all.
CREATE POLICY "verification_status_events_select" ON public.verification_status_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.verification_requests r
      WHERE r.id = request_id AND r.seller_id = auth.uid()
    )
  );

-- Inserts come from SECURITY DEFINER triggers / admin tools.
-- Clients must not forge audit events.
CREATE POLICY "verification_status_events_insert" ON public.verification_status_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- No client update/delete (immutable audit log)
-- (No policies = deny for authenticated non-owner roles; service role bypasses)

-- Ensure status logger is SECURITY DEFINER (bypass insert policy for pipeline)
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

-- ════════════════════════════════════════════════════════════
-- 4) verification_payments — sellers cannot self-confirm
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF public._soko_table_exists('verification_payments') THEN
    ALTER TABLE public.verification_payments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('verification_payment_methods') THEN
    ALTER TABLE public.verification_payment_methods ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "vpay_select_own" ON public.verification_payments;
DROP POLICY IF EXISTS "vpay_insert_own" ON public.verification_payments;
DROP POLICY IF EXISTS "vpay_update_own" ON public.verification_payments;
DROP POLICY IF EXISTS "vpay_delete_own" ON public.verification_payments;

CREATE POLICY "vpay_select_own" ON public.verification_payments
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "vpay_insert_own" ON public.verification_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (seller_id = auth.uid() AND payment_status IN ('pending', 'initiated', 'awaiting_confirmation'))
    OR public.is_admin()
  );

-- Sellers may only keep status in open non-confirmed states.
-- Confirmed / refunded / cancelled must come from SECURITY DEFINER RPCs or admin.
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
      AND payment_status IN ('pending', 'initiated', 'awaiting_confirmation')
    )
  );

-- No seller DELETE of payment ledger rows
CREATE POLICY "vpay_delete_admin" ON public.verification_payments
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Payment confirmation only via:
--   • admin_confirm_verification_payment (admin)
--   • confirm_verification_gateway_payment / confirm_verification_payment (SECURITY DEFINER)
-- RLS WITH CHECK above blocks sellers from setting payment_status = confirmed.

-- ════════════════════════════════════════════════════════════
-- 5) verification_requests — sellers cannot self-approve
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF public._soko_table_exists('verification_requests') THEN
    ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "verification_requests_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_select_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_insert_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_update_own" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_delete_own" ON public.verification_requests;

CREATE POLICY "verification_requests_select_own" ON public.verification_requests
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "verification_requests_insert_own" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (seller_id = auth.uid() AND status IN ('draft', 'submitted', 'payment_pending'))
    OR public.is_admin()
  );

-- Sellers may only keep/move among seller-owned workflow statuses.
-- Never approved / rejected / under_review / payment_confirmed via direct UPDATE
-- (those transitions are SECURITY DEFINER RPCs / admin).
CREATE POLICY "verification_requests_update_own" ON public.verification_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND status IN (
        'draft', 'submitted', 'payment_pending',
        'additional_info_required', 'cancelled'
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      seller_id = auth.uid()
      AND status IN (
        'draft', 'submitted', 'payment_pending',
        'additional_info_required', 'cancelled'
      )
    )
  );

CREATE POLICY "verification_requests_delete_own" ON public.verification_requests
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (seller_id = auth.uid() AND status IN ('draft', 'cancelled'))
  );

-- ════════════════════════════════════════════════════════════
-- 6) Re-assert RLS enabled on catalog tables
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF public._soko_table_exists('verification_types') THEN
    ALTER TABLE public.verification_types ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('verification_settings') THEN
    ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('verification_setting_kv') THEN
    ALTER TABLE public.verification_setting_kv ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 7) Non-destructive production seeds
-- ════════════════════════════════════════════════════════════
INSERT INTO public.verification_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

UPDATE public.verification_settings
SET
  is_enabled = COALESCE(is_enabled, true),
  fee_amount = COALESCE(NULLIF(fee_amount, 0), 5000),
  fee_currency = COALESCE(NULLIF(fee_currency, ''), 'MWK'),
  review_period_hours = COALESCE(NULLIF(review_period_hours, 0), 24),
  accepted_document_types = COALESCE(
    NULLIF(accepted_document_types, '{}'),
    ARRAY['national_id', 'passport', 'selfie']
  ),
  supported_payment_methods = COALESCE(
    NULLIF(supported_payment_methods, '{}'),
    ARRAY['pachangu', 'airtel_money', 'tnm_mpamba', 'bank_transfer']
  ),
  require_documents = COALESCE(require_documents, true),
  auto_submit_on_payment = COALESCE(auto_submit_on_payment, true),
  updated_at = now()
WHERE id = 1;

INSERT INTO public.verification_types (code, name, description, default_fee_amount, required_document_types, sort_order)
VALUES
  ('seller', 'Seller verification', 'Identity-backed seller badge', 5000, ARRAY['national_id', 'selfie'], 10),
  ('shop', 'Shop verification', 'Shop storefront verification', 5000, ARRAY['national_id', 'business_registration', 'selfie'], 20),
  ('business', 'Business verification', 'Organization verification', 15000, ARRAY['national_id', 'business_registration', 'proof_of_address'], 30)
ON CONFLICT (code) DO UPDATE SET
  is_active = true,
  updated_at = now();

DO $$
BEGIN
  IF public._soko_table_exists('verification_payment_methods') THEN
    -- Column is "instructions" (not "description") — see 103_verification_payments.sql
    INSERT INTO public.verification_payment_methods
      (code, name, channel, provider, is_active, supports_auto_confirm, instructions, sort_order)
    VALUES
      ('pachangu', 'PayChangu (Mobile Money)', 'gateway', 'paychangu', true, true,
       'Pay via PayChangu checkout. Auto-confirm when gateway reports success.', 5),
      ('airtel_money', 'Airtel Money', 'mobile_money', 'manual', true, false,
       'Send the fee via Airtel Money and enter the transaction ID. An admin will confirm.', 10),
      ('tnm_mpamba', 'TNM Mpamba', 'mobile_money', 'manual', true, false,
       'Send the fee via TNM Mpamba and enter the transaction ID. An admin will confirm.', 20),
      ('bank_transfer', 'Bank Transfer', 'bank', 'manual', true, false,
       'Transfer the fee and upload a receipt for admin confirmation.', 30),
      ('card', 'Card Payment', 'card', 'future_gateway', true, false,
       'Card payments will be confirmed via gateway; manual confirmation available until integrated.', 40)
    ON CONFLICT (code) DO UPDATE SET
      is_active = true,
      name = EXCLUDED.name,
      supports_auto_confirm = EXCLUDED.supports_auto_confirm,
      instructions = EXCLUDED.instructions,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 8) Comments / production checklist
-- ════════════════════════════════════════════════════════════
COMMENT ON TABLE public.verification_documents IS
  'Metadata for files in private bucket verification-docs. Path: {user_id}/{request_id}/... Use signed URLs for viewing.';

COMMENT ON POLICY "verification_documents_select" ON public.verification_documents IS
  'Seller: own rows. Admin: all (review). No anon.';

DO $$
BEGIN
  COMMENT ON POLICY "verification_docs_admin_select" ON storage.objects IS
    'Admin may read all verification-docs; app must use createSignedUrl — bucket is private.';
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'SKIP comment on storage policy (not created — ownership). Apply storage policies separately.';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'SKIP comment on storage policy (privilege).';
  WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'SKIP comment on storage policy (42501).';
    ELSE
      RAISE;
    END IF;
END $$;

DO $$
BEGIN
  COMMENT ON POLICY "vpay_update_own" ON public.verification_payments IS
    'Sellers cannot set payment_status to confirmed; only open statuses or admin/SECURITY DEFINER RPCs.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP vpay_update_own comment: %', SQLERRM;
END $$;

DO $$
BEGIN
  COMMENT ON POLICY "verification_requests_update_own" ON public.verification_requests IS
    'Sellers cannot self-set approved/rejected/under_review; use payment/admin RPCs.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP verification_requests_update_own comment: %', SQLERRM;
END $$;

DO $$
BEGIN
  COMMENT ON POLICY "verification_status_events_insert" ON public.verification_status_events IS
    'Client insert admin-only; pipeline trigger is SECURITY DEFINER.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP verification_status_events_insert comment: %', SQLERRM;
END $$;
