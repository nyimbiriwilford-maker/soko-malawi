-- ============================================================
-- 008_storage.sql
-- Purpose: Storage buckets + policies for avatars, covers, verification, shops
-- Run in project with storage schema available.
-- ============================================================

-- Create buckets (idempotent via upsert-like insert)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('shop-images', 'shop-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('listing-images', 'listing-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatars: public read; users write own folder {user_id}/*
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Covers
DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
CREATE POLICY "covers_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers_owner_write" ON storage.objects;
CREATE POLICY "covers_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "covers_owner_update" ON storage.objects;
CREATE POLICY "covers_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "covers_owner_delete" ON storage.objects;
CREATE POLICY "covers_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Verification docs (private)
DROP POLICY IF EXISTS "verification_docs_owner_all" ON storage.objects;
CREATE POLICY "verification_docs_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verification_docs_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verification_docs_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Shop images
DROP POLICY IF EXISTS "shop_images_public_read" ON storage.objects;
CREATE POLICY "shop_images_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'shop-images');
DROP POLICY IF EXISTS "shop_images_auth_write" ON storage.objects;
CREATE POLICY "shop_images_auth_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "shop_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "shop_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Listing images
DROP POLICY IF EXISTS "listing_images_public_read" ON storage.objects;
CREATE POLICY "listing_images_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'listing-images');
CREATE POLICY "listing_images_auth_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "listing_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "listing_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
