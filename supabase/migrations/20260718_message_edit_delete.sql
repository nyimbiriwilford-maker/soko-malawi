-- Message edit, soft-delete (for me / everyone), and timed auto-delete.

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE NOTICE 'messages missing — skip message_edit_delete';
    RETURN;
  END IF;

  ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS edited_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid,
    ADD COLUMN IF NOT EXISTS hidden_for uuid[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

  CREATE INDEX IF NOT EXISTS idx_messages_expires_at
    ON public.messages (expires_at)
    WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

  -- ── Hide for me (either participant) ─────────────────────
  CREATE OR REPLACE FUNCTION public.hide_message_for_me(p_message_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_uid uuid := auth.uid();
    v_row public.messages%ROWTYPE;
  BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    SELECT * INTO v_row FROM public.messages WHERE id = p_message_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
    IF v_row.from_user IS DISTINCT FROM v_uid AND v_row.to_user IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
    UPDATE public.messages
    SET hidden_for = (
      SELECT ARRAY(
        SELECT DISTINCT x FROM unnest(COALESCE(hidden_for, '{}') || ARRAY[v_uid]) AS x
      )
    )
    WHERE id = p_message_id;
    RETURN true;
  END;
  $fn$;

  -- ── Soft-delete for everyone (sender only) ───────────────
  CREATE OR REPLACE FUNCTION public.soft_delete_message(p_message_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_uid uuid := auth.uid();
  BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    UPDATE public.messages
    SET
      deleted_at = now(),
      deleted_by = v_uid,
      body = '',
      media_url = NULL,
      media_type = COALESCE(media_type, 'text')
    WHERE id = p_message_id
      AND from_user = v_uid
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      -- Try with sender_id if schema uses that
      UPDATE public.messages
      SET deleted_at = now(), deleted_by = v_uid, body = '', media_url = NULL
      WHERE id = p_message_id AND deleted_at IS NULL
        AND (from_user = v_uid OR sender_id = v_uid);
    END IF;
    RETURN true;
  END;
  $fn$;

  -- ── Edit own text message ────────────────────────────────
  CREATE OR REPLACE FUNCTION public.edit_message(p_message_id uuid, p_body text)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_uid uuid := auth.uid();
    v_body text := trim(COALESCE(p_body, ''));
  BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF length(v_body) = 0 THEN RAISE EXCEPTION 'Empty message'; END IF;
    UPDATE public.messages
    SET body = v_body, edited_at = now()
    WHERE id = p_message_id
      AND from_user = v_uid
      AND deleted_at IS NULL
      AND COALESCE(call_type, '') = ''
      AND (media_type IS NULL OR media_type IN ('text', '') OR media_url IS NULL);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot edit this message';
    END IF;
    RETURN true;
  END;
  $fn$;

  -- ── Set / clear disappearing timer (sender only) ─────────
  CREATE OR REPLACE FUNCTION public.set_message_expiry(
    p_message_id uuid,
    p_expires_at timestamptz
  )
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_uid uuid := auth.uid();
  BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
      RAISE EXCEPTION 'Expiry must be in the future';
    END IF;
    UPDATE public.messages
    SET expires_at = p_expires_at
    WHERE id = p_message_id
      AND from_user = v_uid
      AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cannot set expiry'; END IF;
    RETURN true;
  END;
  $fn$;

  GRANT EXECUTE ON FUNCTION public.hide_message_for_me(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.soft_delete_message(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.set_message_expiry(uuid, timestamptz) TO authenticated;
END $$;
