-- ============================================================
-- Allow admins to notify sellers (need-info, decisions, etc.)
-- SECURITY DEFINER so it works even if RLS only allows own inserts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN to_regclass('public.profiles') IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_body text := COALESCE(NULLIF(trim(p_body), ''), p_title);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_user_id IS NULL OR p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'user_id and title required';
  END IF;

  -- Self-notify or admin notifying another user
  IF p_user_id <> v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed to notify this user';
  END IF;

  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'notifications table missing';
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, body, message, link, read, data, meta, created_at
  ) VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(p_type), ''), 'system'),
    trim(p_title),
    v_body,
    v_body,
    p_link,
    false,
    COALESCE(p_data, '{}'::jsonb),
    COALESCE(p_data, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN undefined_column THEN
    -- Older schema without message/link/data/meta
    INSERT INTO public.notifications (user_id, type, title, body, read, created_at)
    VALUES (
      p_user_id,
      COALESCE(NULLIF(trim(p_type), ''), 'system'),
      trim(p_title),
      v_body,
      false,
      now()
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, jsonb) TO authenticated;

-- Also ensure admin insert policy exists (belt and suspenders)
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;
  DROP POLICY IF EXISTS "notifications_admin_insert" ON public.notifications;
  CREATE POLICY "notifications_admin_insert" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications_admin_insert: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.notify_user IS
  'Create in-app notification for a user; admins may notify any user (verification need-info etc.)';
