-- Storage bucket for admin banner images.
-- Safe to re-run (uses ON CONFLICT).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('banners', 'banners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "banners_public_read" ON storage.objects;
CREATE POLICY "banners_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'banners');

-- Admin only upload/update/delete.
-- Uses inline admin check instead of public.is_admin() to avoid
-- schema-search-path issues in the storage context.
DROP POLICY IF EXISTS "banners_admin_insert" ON storage.objects;
CREATE POLICY "banners_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "banners_admin_update" ON storage.objects;
CREATE POLICY "banners_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "banners_admin_delete" ON storage.objects;
CREATE POLICY "banners_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
