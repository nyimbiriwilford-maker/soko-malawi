-- ============================================================
-- 006_notifications.sql
-- Purpose: Ensure notifications shape supports profile badges
-- ============================================================

CREATE OR REPLACE FUNCTION public._soko_table_exists(t text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT to_regclass('public.' || t) IS NOT NULL;
$$;

DO $$
BEGIN
  IF NOT public._soko_table_exists('notifications') THEN
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      type text,
      title text,
      body text,
      link text,
      read boolean NOT NULL DEFAULT false,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS type text,
      ADD COLUMN IF NOT EXISTS title text,
      ADD COLUMN IF NOT EXISTS body text,
      ADD COLUMN IF NOT EXISTS link text,
      ADD COLUMN IF NOT EXISTS read boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE COALESCE(read, false) = false;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id uuid DEFAULT auth.uid())
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(count(*)::int, 0)
  FROM public.notifications
  WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND COALESCE(read, false) = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) TO authenticated;
