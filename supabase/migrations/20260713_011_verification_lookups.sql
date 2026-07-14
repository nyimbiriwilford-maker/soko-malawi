-- ============================================================
-- 011_verification_lookups.sql
-- Purpose: Verification requests/docs, reports, referrals,
--          saved searches, and supporting profile UI tables.
-- Idempotent / safe for existing data.
--
-- FIX: Existing verification_requests often has submitted_at
-- (not created_at). We ADD missing columns before indexes.
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

-- ── Verification requests (used by VerificationModal + Admin) ─
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  payment_ref text,
  payment_method text,
  amount_paid numeric DEFAULT 0,
  notes text,
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Align legacy verification_requests (may lack created_at / use submitted_at)
DO $$
BEGIN
  IF NOT public._soko_table_exists('verification_requests') THEN
    RETURN;
  END IF;

  ALTER TABLE public.verification_requests
    ADD COLUMN IF NOT EXISTS seller_id uuid,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_ref text,
    ADD COLUMN IF NOT EXISTS payment_method text,
    ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS admin_note text,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

  -- Backfill created_at from submitted_at when present
  IF public._soko_column_exists('verification_requests', 'submitted_at')
     AND public._soko_column_exists('verification_requests', 'created_at') THEN
    UPDATE public.verification_requests
    SET created_at = COALESCE(created_at, submitted_at, now())
    WHERE created_at IS NULL;
  END IF;

  -- Ensure created_at is never null going forward
  UPDATE public.verification_requests SET created_at = now() WHERE created_at IS NULL;
  BEGIN
    ALTER TABLE public.verification_requests
      ALTER COLUMN created_at SET DEFAULT now();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'verification_requests created_at default skip: %', SQLERRM;
  END;
END $$;

-- Indexes only after columns are guaranteed
DO $$
BEGIN
  IF public._soko_column_exists('verification_requests', 'seller_id')
     AND public._soko_column_exists('verification_requests', 'created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_verification_requests_seller
      ON public.verification_requests (seller_id, created_at DESC)';
  ELSIF public._soko_column_exists('verification_requests', 'seller_id')
     AND public._soko_column_exists('verification_requests', 'submitted_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_verification_requests_seller
      ON public.verification_requests (seller_id, submitted_at DESC)';
  ELSIF public._soko_column_exists('verification_requests', 'seller_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_verification_requests_seller
      ON public.verification_requests (seller_id)';
  END IF;

  IF public._soko_column_exists('verification_requests', 'status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_verification_requests_status
      ON public.verification_requests (status) WHERE status = ''pending''';
  END IF;
END $$;

-- ── Verification documents (storage path metadata) ───────────
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

  IF public._soko_column_exists('verification_documents', 'user_id')
     AND public._soko_column_exists('verification_documents', 'created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_verification_documents_user
      ON public.verification_documents (user_id, created_at DESC)';
  END IF;
END $$;

-- Soft FK to verification_requests when both tables exist
DO $$
BEGIN
  IF public._soko_table_exists('verification_documents')
     AND public._soko_table_exists('verification_requests') THEN
    BEGIN
      ALTER TABLE public.verification_documents
        DROP CONSTRAINT IF EXISTS verification_documents_request_id_fkey;
      ALTER TABLE public.verification_documents
        ADD CONSTRAINT verification_documents_request_id_fkey
        FOREIGN KEY (request_id) REFERENCES public.verification_requests(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'verification_documents FK skip: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── User reports (abuse / listing reports) ───────────────────
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

DO $$
BEGIN
  IF public._soko_table_exists('user_reports') THEN
    ALTER TABLE public.user_reports
      ADD COLUMN IF NOT EXISTS reporter_id uuid,
      ADD COLUMN IF NOT EXISTS reported_user_id uuid,
      ADD COLUMN IF NOT EXISTS listing_id uuid,
      ADD COLUMN IF NOT EXISTS reason text,
      ADD COLUMN IF NOT EXISTS details text,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
  END IF;

  IF public._soko_column_exists('user_reports', 'reporter_id')
     AND public._soko_column_exists('user_reports', 'created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_reports_reporter
      ON public.user_reports (reporter_id, created_at DESC)';
  END IF;
END $$;

-- ── Referrals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

DO $$
BEGIN
  IF public._soko_table_exists('referrals') THEN
    ALTER TABLE public.referrals
      ADD COLUMN IF NOT EXISTS referrer_id uuid,
      ADD COLUMN IF NOT EXISTS referred_id uuid,
      ADD COLUMN IF NOT EXISTS code text,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS reward_meta jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);

-- ── Saved searches ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  query text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify boolean NOT NULL DEFAULT false,
  last_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF public._soko_table_exists('saved_searches') THEN
    ALTER TABLE public.saved_searches
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD COLUMN IF NOT EXISTS name text,
      ADD COLUMN IF NOT EXISTS query text,
      ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS notify boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_matched_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  END IF;

  IF public._soko_column_exists('saved_searches', 'user_id')
     AND public._soko_column_exists('saved_searches', 'created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_saved_searches_user
      ON public.saved_searches (user_id, created_at DESC)';
  END IF;
END $$;

-- ── Profile completion events (audit trail) ──────────────────
CREATE TABLE IF NOT EXISTS public.profile_completion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_pct integer NOT NULL DEFAULT 0,
  missing_keys text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF public._soko_table_exists('profile_completion_events') THEN
    ALTER TABLE public.profile_completion_events
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD COLUMN IF NOT EXISTS completion_pct integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS missing_keys text[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  END IF;

  IF public._soko_column_exists('profile_completion_events', 'user_id')
     AND public._soko_column_exists('profile_completion_events', 'created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profile_completion_events_user
      ON public.profile_completion_events (user_id, created_at DESC)';
  END IF;
END $$;

-- Ensure profiles has completion columns (also in 001)
DO $$
BEGIN
  IF public._soko_table_exists('profiles') THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS profile_completion_pct integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS referral_code text;
  END IF;
END $$;

-- Generate referral code helper
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_user_id uuid DEFAULT auth.uid())
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_existing text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public._soko_table_exists('profiles') THEN
    SELECT referral_code INTO v_existing FROM public.profiles WHERE id = p_user_id;
    IF v_existing IS NOT NULL AND length(v_existing) > 0 THEN RETURN v_existing; END IF;
  END IF;
  v_code := upper(substr(replace(p_user_id::text, '-', ''), 1, 8));
  IF public._soko_table_exists('profiles') THEN
    UPDATE public.profiles SET referral_code = v_code WHERE id = p_user_id AND (referral_code IS NULL OR referral_code = '');
  END IF;
  INSERT INTO public.referrals (referrer_id, code, status)
  VALUES (p_user_id, v_code, 'pending')
  ON CONFLICT (code) DO NOTHING;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_user_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_listing_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  INSERT INTO public.user_reports (reporter_id, reported_user_id, listing_id, reason, details)
  VALUES (auth.uid(), p_reported_user_id, p_listing_id, trim(p_reason), p_details)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_search(
  p_name text,
  p_query text DEFAULT NULL,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_notify boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.saved_searches (user_id, name, query, filters, notify)
  VALUES (auth.uid(), COALESCE(p_name, 'Saved search'), p_query, COALESCE(p_filters, '{}'::jsonb), COALESCE(p_notify, false))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RLS (only when table exists)
DO $$
BEGIN
  IF public._soko_table_exists('verification_requests') THEN
    ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('verification_documents') THEN
    ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('user_reports') THEN
    ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('referrals') THEN
    ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('saved_searches') THEN
    ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
  END IF;
  IF public._soko_table_exists('profile_completion_events') THEN
    ALTER TABLE public.profile_completion_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "verification_requests_own" ON public.verification_requests;
CREATE POLICY "verification_requests_own" ON public.verification_requests
  FOR ALL TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin())
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "verification_documents_own" ON public.verification_documents;
CREATE POLICY "verification_documents_own" ON public.verification_documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_reports_own" ON public.user_reports;
DROP POLICY IF EXISTS "user_reports_select_own" ON public.user_reports;
DROP POLICY IF EXISTS "user_reports_insert_own" ON public.user_reports;
CREATE POLICY "user_reports_select_own" ON public.user_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_reports_insert_own" ON public.user_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "referrals_own" ON public.referrals;
DROP POLICY IF EXISTS "referrals_insert_own" ON public.referrals;
CREATE POLICY "referrals_own" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin());
CREATE POLICY "referrals_insert_own" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (referrer_id = auth.uid());

DROP POLICY IF EXISTS "saved_searches_own" ON public.saved_searches;
CREATE POLICY "saved_searches_own" ON public.saved_searches
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profile_completion_events_own" ON public.profile_completion_events;
CREATE POLICY "profile_completion_events_own" ON public.profile_completion_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

GRANT EXECUTE ON FUNCTION public.ensure_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_search(text, text, jsonb, boolean) TO authenticated;

COMMENT ON TABLE public.verification_requests IS 'Seller identity verification payment + review queue';
COMMENT ON TABLE public.verification_documents IS 'Metadata for files in verification-docs bucket';
COMMENT ON TABLE public.user_reports IS 'Abuse / user / listing reports from marketplace UI';
COMMENT ON TABLE public.referrals IS 'Referral codes and invite tracking';
COMMENT ON TABLE public.saved_searches IS 'Buyer saved search filters';
