-- 0007_vocab_learning_count.sql
-- Per-vocab formal learning session counter + user learning state.
-- Per docs/vocabuly0831.md (Frank #7397, 2026-08-31).
--
-- ============================================================================
-- DECOUPLING INVARIANTS — do NOT break in future migrations
-- ============================================================================
--   1. 5s/word/DAY cap (0006 increment_vocab_learning_time RPC) is
--      UNTOUCHED. learning_count has NO relationship to learning_time_ms.
--   2. vocabulary_reviews.mastery +/-10 algorithm (lib/vocabulary/reviews.ts
--      recordReview) is UNTOUCHED. learning_count has NO relationship to
--      mastery or reviewCount.
--   3. daily_status (今日学习已完成) is independent of learningCount,
--      mastery, reviewCount, and 5s timer. Toggled only by explicit user
--      action (set_daily_learning_status RPC).
--
-- What this migration adds:
--   A. vocabulary_items.learning_count — counter incremented by
--      start_learning_session RPC on each fresh session_token.
--   B. vocabulary_items.last_learned_at — timestamp of the most recent
--      session start (used by detail-page UI; not coupled to anything).
--   C. user_learning_state — single-row-per-user table for resume.
--      Stores (last_learning_vocabulary_id, filter context, daily
--      completion status). Drives the list-page "继续学习" card.
--   D. vocab_learning_session_tokens — idempotency table for the
--      start_learning_session RPC. PK (user_id, session_token) so
--      duplicate tokens for the same user are silently ignored.
--   E. RPC start_learning_session — atomic (UPSERT state + FOR UPDATE
--      vocab + increment counter + insert token).
--   F. RPC set_daily_learning_status — toggle active/completed for
--      a user-supplied local date.
--   G. RPC get_user_learning_state — read-only state fetch for the
--      list-page "继续学习" card.

-- ==========================================================================
-- 1. vocabulary_items: learning_count + last_learned_at
-- ==========================================================================
ALTER TABLE public.vocabulary_items
ADD COLUMN IF NOT EXISTS learning_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.vocabulary_items
ADD COLUMN IF NOT EXISTS last_learned_at timestamptz;

-- DB-level floor on learning_count. Ceiling is implicit (no upper
-- bound — a long-lived user might have hundreds of sessions). The
-- RPC only ever adds +1, so overflow is not a realistic concern.
ALTER TABLE public.vocabulary_items
DROP CONSTRAINT IF EXISTS vocabulary_items_learning_count_nonneg;

ALTER TABLE public.vocabulary_items
ADD CONSTRAINT vocabulary_items_learning_count_nonneg
  CHECK (learning_count >= 0);

-- ==========================================================================
-- 2. user_learning_state (one row per user)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.user_learning_state (
  user_id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_learning_vocabulary_id   uuid REFERENCES public.vocabulary_items(id) ON DELETE SET NULL,
  last_learning_at              timestamptz,
  -- Filter context captured at the time of the last learning session
  -- entry, so the list-page "继续学习" card can display "(原 filter:
  -- 文法 N3)" even after the user navigates away with different
  -- filters (per Frank #7397 Q5-α). All nullable — null = filter not
  -- applied when the last session started.
  filter_type                   text,
  filter_level                  text,
  filter_sort                   text,
  filter_query                  text,
  -- Daily completion state (Frank #7397 Q4-A). "completed" with
  -- daily_status_date matching today's client-local date means the
  -- user clicked [完成今日学习] today. The list-page UI does the
  -- date comparison in JS (matching use-vocab-learning-timer's
  -- todayKey() local-time pattern) — this column is just the
  -- server-side record.
  daily_status                  text NOT NULL DEFAULT 'active'
                                CHECK (daily_status IN ('active', 'completed')),
  daily_status_date             date,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger (reuses public.set_updated_at() from 0003)
DROP TRIGGER IF EXISTS trg_user_learning_state_updated_at ON public.user_learning_state;
CREATE TRIGGER trg_user_learning_state_updated_at
  BEFORE UPDATE ON public.user_learning_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_learning_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_learning_state_select_own"
  ON public.user_learning_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_learning_state_insert_own"
  ON public.user_learning_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_learning_state_update_own"
  ON public.user_learning_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy — RLS denies by default. The user's row only goes
-- away via ON DELETE CASCADE from auth.users.

-- ==========================================================================
-- 3. vocab_learning_session_tokens (idempotency for start_learning_session)
-- ==========================================================================
-- Client generates a session_token (UUID) on /vocabulary/learn mount,
-- persists in sessionStorage keyed by vocab_id. Same tab refresh →
-- same token → no double-count. New tab / day / tab-close → fresh
-- token → legitimate new session.
--
-- PK (user_id, session_token) makes the insert idempotent at the DB
-- level — duplicate tokens for the same user silently no-op via
-- ON CONFLICT, no need for client-side dedup logic.
CREATE TABLE IF NOT EXISTS public.vocab_learning_session_tokens (
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token    text NOT NULL,
  vocabulary_id    uuid NOT NULL REFERENCES public.vocabulary_items(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_token)
);
CREATE INDEX IF NOT EXISTS vocab_learning_session_tokens_user_idx
  ON public.vocab_learning_session_tokens (user_id);

ALTER TABLE public.vocab_learning_session_tokens ENABLE ROW LEVEL SECURITY;
-- SELECT only — INSERTs go through the SECURITY DEFINER RPC below.
CREATE POLICY "vocab_learning_session_tokens_select_own"
  ON public.vocab_learning_session_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- ==========================================================================
-- 4. RPC: start_learning_session
-- ==========================================================================
-- Atomically:
--   1. Verify p_vocab_id is owned by p_user_id (defensive — RPC is
--      SECURITY DEFINER so we don't trust client p_user_id alone).
--   2. Attempt INSERT into vocab_learning_session_tokens. PK conflict
--      ⇒ is_new_session=false ⇒ no count increment.
--   3. If new session: SELECT FOR UPDATE on vocabulary_items, then
--      UPDATE learning_count = learning_count + 1 +
--      last_learned_at = now().
--   4. If duplicate session: still UPDATE last_learned_at = now() so
--      detail-page "最近学习" reflects the user's current activity,
--      but DO NOT increment the counter.
--   5. UPSERT user_learning_state with new last_learning_vocabulary_id +
--      last_learning_at + filter context + daily_status_date = today.
--      NOTE: daily_status is NOT touched — "completed" is preserved
--      across new sessions until tomorrow's date comparison rolls it
--      over (per Frank #7397 Q4-A: don't auto-couple).
--
-- Args:
--   p_vocab_id        uuid   — the vocab being entered
--   p_user_id         uuid   — the user (ownership check inside RPC)
--   p_session_token   text   — UUID from client sessionStorage
--   p_filter_type     text   — 'word'|'phrase'|'grammar'|'sentence'|null
--   p_filter_level    text   — 'N5'|...|null
--   p_filter_sort     text   — 'newest'|'oldest'|'word'|null
--   p_filter_query    text   — search string or null
-- Returns:
--   new_learning_count int   — counter after this call (== prior+1 if new)
--   is_new_session     bool  — true iff the token was fresh (counter +1)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.start_learning_session(
  p_vocab_id uuid,
  p_user_id uuid,
  p_session_token text,
  p_filter_type text DEFAULT NULL,
  p_filter_level text DEFAULT NULL,
  p_filter_sort text DEFAULT NULL,
  p_filter_query text DEFAULT NULL
) RETURNS TABLE(new_learning_count integer, is_new_session boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_new boolean := false;
  v_current_count integer;
  v_new_count integer;
BEGIN
  -- (1) Ownership check.
  IF NOT EXISTS (
    SELECT 1 FROM public.vocabulary_items
    WHERE id = p_vocab_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Vocabulary % not found or not owned by user %', p_vocab_id, p_user_id;
  END IF;

  -- (2) Idempotency check via CTE (RETURNING is empty on conflict,
  -- so EXISTS returns false ⇒ v_is_new stays false).
  WITH ins AS (
    INSERT INTO public.vocab_learning_session_tokens (user_id, session_token, vocabulary_id)
    VALUES (p_user_id, p_session_token, p_vocab_id)
    ON CONFLICT (user_id, session_token) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_is_new;

  -- (3 + 4) Lock + update vocab_items. FOR UPDATE row lock serializes
  -- parallel flushes from same user (multiple tabs / devices).
  SELECT learning_count INTO v_current_count
  FROM public.vocabulary_items
  WHERE id = p_vocab_id
  FOR UPDATE;

  IF v_is_new THEN
    v_new_count := v_current_count + 1;
    UPDATE public.vocabulary_items
    SET learning_count = v_new_count,
        last_learned_at = now()
    WHERE id = p_vocab_id;
  ELSE
    -- Duplicate token — update last_learned_at to "right now" so
    -- detail-page UI reflects current activity, but DO NOT increment.
    v_new_count := v_current_count;
    UPDATE public.vocabulary_items
    SET last_learned_at = now()
    WHERE id = p_vocab_id;
  END IF;

  -- (5) UPSERT user_learning_state. daily_status intentionally NOT
  -- in the UPDATE clause — preserved across session entries.
  --
  -- Filter fields use COALESCE(p_filter_*, user_learning_state.filter_*)
  -- so a NULL filter param (sent by the [继续学习] button, which goes
  -- to /vocabulary/learn without filter query params) preserves the
  -- previously-stored filter context. A non-null filter (sent by the
  -- [开始学习] button with current /vocabulary filters) overwrites it.
  -- This is what makes the list-page "原学习类型: 文法" display stick
  -- across [继续学习] clicks even when the user is on /vocabulary with
  -- a different filter (per Frank #7397 Q5-α).
  INSERT INTO public.user_learning_state (
    user_id,
    last_learning_vocabulary_id,
    last_learning_at,
    filter_type,
    filter_level,
    filter_sort,
    filter_query,
    daily_status_date
  ) VALUES (
    p_user_id,
    p_vocab_id,
    now(),
    p_filter_type,
    p_filter_level,
    p_filter_sort,
    p_filter_query,
    CURRENT_DATE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    last_learning_vocabulary_id = EXCLUDED.last_learning_vocabulary_id,
    last_learning_at = EXCLUDED.last_learning_at,
    filter_type = COALESCE(p_filter_type, user_learning_state.filter_type),
    filter_level = COALESCE(p_filter_level, user_learning_state.filter_level),
    filter_sort = COALESCE(p_filter_sort, user_learning_state.filter_sort),
    filter_query = COALESCE(p_filter_query, user_learning_state.filter_query),
    daily_status_date = EXCLUDED.daily_status_date;

  new_learning_count := v_new_count;
  is_new_session := v_is_new;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_learning_session(uuid, uuid, text, text, text, text, text)
  TO authenticated;

-- ==========================================================================
-- 5. RPC: set_daily_learning_status
-- ==========================================================================
-- Toggle the daily completion flag for a specific local date (passed
-- by the client so JST users get the right day boundary). Used by:
--   - [完成今日学习] button in /vocabulary/learn → status='completed'
--   - [重新开始] (optional) → status='active'
-- Decoupled from learningCount / mastery / reviewCount / 5s timer
-- (per Frank #7397 Q4-A: manual toggle only).
--
-- Args:
--   p_user_id  uuid
--   p_status   text  — 'active' | 'completed'
--   p_date     date  — client-local today (matches todayKey() in
--                     use-vocab-learning-timer.ts)
-- Returns: void
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.set_daily_learning_status(
  p_user_id uuid,
  p_status text,
  p_date date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'Invalid daily status: % (expected active | completed)', p_status;
  END IF;

  INSERT INTO public.user_learning_state (
    user_id,
    daily_status,
    daily_status_date
  ) VALUES (
    p_user_id,
    p_status,
    p_date
  )
  ON CONFLICT (user_id) DO UPDATE SET
    daily_status = EXCLUDED.daily_status,
    daily_status_date = EXCLUDED.daily_status_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_daily_learning_status(uuid, text, date)
  TO authenticated;

-- ==========================================================================
-- 6. RPC: get_user_learning_state
-- ==========================================================================
-- Single-shot fetch for the list-page "继续学习" card. LEFT JOIN on
-- vocabulary_items so deleted-vocab edge case returns NULL vocab
-- fields (user_learning_state.last_learning_vocabulary_id is
-- auto-cleared via FK ON DELETE SET NULL, so the LEFT JOIN is just
-- defensive — the client helper checks for the JOIN's NULL too).
--
-- Args:
--   p_user_id  uuid
-- Returns: TABLE of all state columns joined with vocab snapshot
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_user_learning_state(p_user_id uuid)
RETURNS TABLE(
  last_learning_vocabulary_id uuid,
  last_learning_word text,
  last_learning_reading text,
  last_learning_meaning text,
  last_learning_type text,
  last_learning_level text,
  last_learning_at timestamptz,
  filter_type text,
  filter_level text,
  filter_sort text,
  filter_query text,
  daily_status text,
  daily_status_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.last_learning_vocabulary_id,
    v.word,
    v.reading,
    v.meaning,
    v.type,
    v.level,
    s.last_learning_at,
    s.filter_type,
    s.filter_level,
    s.filter_sort,
    s.filter_query,
    s.daily_status,
    s.daily_status_date
  FROM public.user_learning_state s
  LEFT JOIN public.vocabulary_items v ON v.id = s.last_learning_vocabulary_id
  WHERE s.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_learning_state(uuid) TO authenticated;

-- ==========================================================================
-- Verify
-- ==========================================================================
-- After running this migration, expect:
--
--   \d public.vocabulary_items
-- to show learning_count + last_learned_at + learning_count_nonneg CHECK.
--
--   \d public.user_learning_state
-- to show 11 columns + PK on user_id + daily_status CHECK.
--
--   \d public.vocab_learning_session_tokens
-- to show PK (user_id, session_token).
--
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name IN (
--       'start_learning_session',
--       'set_daily_learning_status',
--       'get_user_learning_state'
--     );
-- to return 3 rows.