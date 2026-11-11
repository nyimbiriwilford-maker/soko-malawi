ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
notify pgrst, 'reload schema';
