-- ============================================================
-- 102_verification_wizard.sql
-- PHASE 2 — Wizard support: ensure docs meta + draft-friendly columns
-- Idempotent; safe if Phase 1 already applied.
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

-- Ensure verification_requests has meta for wizard autosave
DO $$
BEGIN
  IF public._soko_table_exists('verification_requests') THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS amount_due numeric,
      ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MWK',
      ADD COLUMN IF NOT EXISTS payment_method text,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS verification_type_id uuid;
  END IF;
END $$;

-- Ensure verification_documents exists for wizard uploads
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

CREATE INDEX IF NOT EXISTS idx_verification_documents_request
  ON public.verification_documents (request_id, created_at DESC)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_requests_seller_draft
  ON public.verification_requests (seller_id, status)
  WHERE status IN ('draft', 'payment_pending', 'additional_info_required');

COMMENT ON COLUMN public.verification_requests.meta IS
  'Wizard autosave: wizard_step, type_code, notes, payment_method, etc.';
