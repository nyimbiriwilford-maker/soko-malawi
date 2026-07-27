-- Home Banners: admin-controlled hero carousel on the homepage.
-- Each row is one slide. The homepage fetches only active banners
-- within their date range, ordered by priority.
-- Safe to re-run.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.home_banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    image_url text NOT NULL,
    button_text text NOT NULL DEFAULT 'Learn More',
    button_link text NOT NULL DEFAULT '/',
    start_date timestamptz,
    end_date timestamptz,
    priority integer NOT NULL DEFAULT 5,
    status text NOT NULL DEFAULT 'draft',
    accent text NOT NULL DEFAULT '#0F9D58',
    image_pos text NOT NULL DEFAULT 'center center',
    badge text NOT NULL DEFAULT '',
    badge_icon text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
  );

  -- Add missing columns if table already existed from a partial run
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'home_banners' AND column_name = 'accent') THEN
    ALTER TABLE public.home_banners ADD COLUMN accent text NOT NULL DEFAULT '#0F9D58';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'home_banners' AND column_name = 'image_pos') THEN
    ALTER TABLE public.home_banners ADD COLUMN image_pos text NOT NULL DEFAULT 'center center';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'home_banners' AND column_name = 'badge') THEN
    ALTER TABLE public.home_banners ADD COLUMN badge text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'home_banners' AND column_name = 'badge_icon') THEN
    ALTER TABLE public.home_banners ADD COLUMN badge_icon text NOT NULL DEFAULT '';
  END IF;

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_home_banners_status
    ON public.home_banners (status, priority, start_date, end_date);

  -- Updated-at trigger
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_home_banners_updated'
      AND event_object_table = 'home_banners'
  ) THEN
    CREATE TRIGGER trg_home_banners_updated
      BEFORE UPDATE ON public.home_banners
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- Row-level security
  ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "home_banners_select" ON public.home_banners;
  CREATE POLICY "home_banners_select" ON public.home_banners
    FOR SELECT USING (true);

  DROP POLICY IF EXISTS "home_banners_admin_all" ON public.home_banners;
  CREATE POLICY "home_banners_admin_all" ON public.home_banners
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

  -- Seed data: 3 default banners
  INSERT INTO public.home_banners (title, description, image_url, button_text, button_link, priority, status, accent, image_pos, badge, badge_icon)
  SELECT * FROM (VALUES
    ('Buy. Sell. Discover.\nEverything Malawi.',
     'Connect with trusted sellers, discover products, services and opportunities across Malawi.',
     'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
     'Explore Marketplace', '/listings',
     1, 'active', '#0F9D58', 'center 35%', 'Malawi''s Marketplace', '★'),
    ('Sell Free. Reach Buyers\nEverywhere.',
     'List products in minutes, chat in-app, pay zero commission. Join thousands of sellers across Malawi.',
     'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=800&q=80',
     'Start Selling', '/post',
     2, 'active', '#F9AB00', 'center 35%', '0% Commission', '✓'),
    ('Buy With Confidence',
     'Verified sellers and trusted businesses across Malawi. Shop with peace of mind knowing every listing is backed by our community.',
     'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?auto=format&fit=crop&w=800&q=80',
     'Find Trusted Sellers', '/listings',
     3, 'active', '#1A73E8', 'center 35%', 'Trust & Safety', '✓')
  ) AS seed
  WHERE NOT EXISTS (SELECT 1 FROM public.home_banners LIMIT 1);

END $$;
