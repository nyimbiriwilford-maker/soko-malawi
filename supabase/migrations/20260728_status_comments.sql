-- Status comments: full-length comments on statuses, separate from quick replies.
-- Unlike replies, comments live only in this table (no chat message created).
-- Safe to re-run.

DO $$
BEGIN
  IF to_regclass('public.user_statuses') IS NULL THEN
    RAISE NOTICE 'user_statuses missing — skip status_comments';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.status_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now()
  );

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comments' AND column_name = 'status_id'
  ) THEN
    ALTER TABLE public.status_comments
      ADD COLUMN status_id uuid REFERENCES public.user_statuses(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.status_comments
      ADD COLUMN user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comments' AND column_name = 'body'
  ) THEN
    ALTER TABLE public.status_comments ADD COLUMN body text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.status_comments
      ADD COLUMN parent_id uuid REFERENCES public.status_comments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comments' AND column_name = 'media_urls'
  ) THEN
    ALTER TABLE public.status_comments ADD COLUMN media_urls jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Index for loading comments per status (most recent first)
  CREATE INDEX IF NOT EXISTS idx_status_comments_status
    ON public.status_comments (status_id, created_at DESC);

  -- Index for user's own comments
  CREATE INDEX IF NOT EXISTS idx_status_comments_user
    ON public.status_comments (user_id, created_at DESC);

  -- Index for threaded replies (child comments)
  CREATE INDEX IF NOT EXISTS idx_status_comments_parent
    ON public.status_comments (parent_id, created_at ASC);

  ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "status_comments_select" ON public.status_comments;
  CREATE POLICY "status_comments_select" ON public.status_comments
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_statuses s
        WHERE s.id = status_id AND s.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "status_comments_insert" ON public.status_comments;
  CREATE POLICY "status_comments_insert" ON public.status_comments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "status_comments_delete" ON public.status_comments;
  CREATE POLICY "status_comments_delete" ON public.status_comments
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

  -- ── Comment reactions ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.status_comment_reactions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comment_reactions' AND column_name = 'comment_id'
  ) THEN
    ALTER TABLE public.status_comment_reactions
      ADD COLUMN comment_id uuid REFERENCES public.status_comments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comment_reactions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.status_comment_reactions ADD COLUMN user_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_comment_reactions' AND column_name = 'reaction'
  ) THEN
    ALTER TABLE public.status_comment_reactions ADD COLUMN reaction text DEFAULT 'love';
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reactions_unique
    ON public.status_comment_reactions (comment_id, user_id);

  ALTER TABLE public.status_comment_reactions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "comment_reactions_select" ON public.status_comment_reactions;
  CREATE POLICY "comment_reactions_select" ON public.status_comment_reactions
    FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "comment_reactions_insert" ON public.status_comment_reactions;
  CREATE POLICY "comment_reactions_insert" ON public.status_comment_reactions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "comment_reactions_delete" ON public.status_comment_reactions;
  CREATE POLICY "comment_reactions_delete" ON public.status_comment_reactions
    FOR DELETE TO authenticated USING (user_id = auth.uid());
END $$;
