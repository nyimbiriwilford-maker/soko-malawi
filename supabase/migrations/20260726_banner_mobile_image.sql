-- Add mobile_image_url to home_banners for responsive image support
-- Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'home_banners'
      AND column_name = 'mobile_image_url'
  ) THEN
    ALTER TABLE public.home_banners
      ADD COLUMN mobile_image_url text;
  END IF;
END $$;
