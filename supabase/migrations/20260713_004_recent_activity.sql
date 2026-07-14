-- ============================================================
-- 004_recent_activity.sql
-- Purpose: Marketplace activity log for timeline / continue sections
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketplace_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_activity_user_created
  ON public.marketplace_activity (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_activity_type
  ON public.marketplace_activity (activity_type, created_at DESC);

COMMENT ON TABLE public.marketplace_activity IS
  'Recent activity feed for profile timeline and buyer continue section';

CREATE OR REPLACE FUNCTION public.log_marketplace_activity(
  p_user_id uuid,
  p_activity_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.marketplace_activity (
    user_id, actor_id, activity_type, title, body, entity_type, entity_id, meta
  ) VALUES (
    p_user_id, auth.uid(), p_activity_type, p_title, p_body, p_entity_type, p_entity_id,
    COALESCE(p_meta, '{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recent_activity(
  p_user_id uuid DEFAULT auth.uid(),
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.marketplace_activity
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.marketplace_activity
  WHERE user_id = COALESCE(p_user_id, auth.uid())
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

-- Auto-log listing status changes into activity
CREATE OR REPLACE FUNCTION public.trg_log_listing_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_marketplace_activity(
      NEW.seller_id, 'listing_created',
      'Listed · ' || COALESCE(NEW.title, 'Item'),
      NULL, 'listing', NEW.id,
      jsonb_build_object('status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'sold' THEN
      PERFORM public.log_marketplace_activity(
        NEW.seller_id, 'listing_sold',
        'Sold · ' || COALESCE(NEW.title, 'Item'),
        NULL, 'listing', NEW.id, '{}'::jsonb
      );
      PERFORM public.log_trust_event(
        NEW.seller_id, 'sale', 'Sale completed · ' || COALESCE(NEW.title, 'Item'),
        jsonb_build_object('listing_id', NEW.id), NEW.id
      );
    ELSIF OLD.status = 'sold' AND NEW.status IS DISTINCT FROM 'sold' THEN
      PERFORM public.log_marketplace_activity(
        NEW.seller_id, 'listing_relisted',
        'Relisted · ' || COALESCE(NEW.title, 'Item'),
        NULL, 'listing', NEW.id, '{}'::jsonb
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block listing writes
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.listings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_listings_activity ON public.listings;
    CREATE TRIGGER trg_listings_activity
      AFTER INSERT OR UPDATE OF status ON public.listings
      FOR EACH ROW EXECUTE FUNCTION public.trg_log_listing_activity();
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.log_marketplace_activity(uuid, text, text, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activity(uuid, integer) TO authenticated;
