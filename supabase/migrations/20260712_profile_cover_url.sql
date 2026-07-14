-- Profile cover photo for marketplace hub / public seller pages
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'profiles table missing — skip cover_url';
    RETURN;
  END IF;

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS cover_url text;

  COMMENT ON COLUMN public.profiles.cover_url IS
    'Public URL of the user cover/banner photo shown on profile';
END $$;
