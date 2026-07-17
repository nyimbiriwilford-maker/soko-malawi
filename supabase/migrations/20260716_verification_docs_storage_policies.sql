-- ============================================================
-- 20260716_verification_docs_storage_policies.sql
-- OPTIONAL / SEPARATE — only if main hardening skipped storage policies
--
-- Error that requires this file:
--   ERROR: 42501: must be owner of relation objects
--
-- On hosted Supabase, storage.objects is owned by supabase_storage_admin.
-- If SQL Editor cannot create policies, either:
--   A) Run this in SQL Editor as postgres (Dashboard → SQL → role with ownership), OR
--   B) Create the same policies in Dashboard → Storage → verification-docs → Policies
--
-- Bucket must stay PRIVATE. Viewing uses signed URLs in the app.
-- ============================================================

-- Ensure private bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-docs',
  'verification-docs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Clean old names
DROP POLICY IF EXISTS "verification_docs_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_admin_all" ON storage.objects;

-- Seller: only own folder {auth.uid()}/...
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

-- Admin: read all for review (profiles.role = 'admin' via public.is_admin())
CREATE POLICY "verification_docs_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND public.is_admin()
  );
