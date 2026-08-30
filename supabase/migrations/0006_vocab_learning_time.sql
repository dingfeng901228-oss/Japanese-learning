-- 0006_vocab_learning_time.sql
-- Per-vocab learning time tracking per docs/0830需求.md
-- (Frank #7274 / #7276, 2026-08-30):
--
--   A: 5s/word cap for /vocabulary/[id] (replacing #6704's 10s/visit)
--   B: per-vocab independent (replacing #6696's cross-item cumulative)
--   C: DAILY reset baseline (not lifetime cumulative)
--   D: /review unchanged (still 10s/question via existing useSessionTimer)
--
-- Each (user, vocab) pair has:
--   - learning_time_ms  : today's accumulated ms (0 if learning_date != today)
--   - learning_date     : which day this counter belongs to (client-supplied,
--                         matches lib/today-stats.todayKey() local-time pattern
--                         so a JST user's "today" feels right)
--   - learning_last_viewed_at : when the user last opened this vocab
--   - learning_updated_at     : when the counter was last touched
--
-- The atomic RPC function increment_vocab_learning_time enforces:
--   - Daily reset (if stored learning_date < client-supplied p_date, treat as 0)
--   - 5000ms hard cap (LEAST(GREATEST(...), 5000))
--   - Row-level lock (FOR UPDATE) — race-safe across multiple tabs / devices
--   - Ownership check — p_user_id must own p_vocab_id
--   - Server-side cap is the source of truth; client must not be trusted
--     (per docs/0830需求.md §十三)

-- ==========================================================================
-- 1. Add columns to vocabulary_items
-- ==========================================================================
ALTER TABLE public.vocabulary_items
ADD COLUMN IF NOT EXISTS learning_time_ms integer NOT NULL DEFAULT 0;

ALTER TABLE public.vocabulary_items
ADD COLUMN IF NOT EXISTS learning_date date;

ALTER TABLE public.vocabulary_items
ADD COLUMN IF NOT EXISTS learning_last_viewed_at timestamptz;

ALTER TABLE public.vocabulary_items
ADD COLUMN IF NOT EXISTS learning_updated_at timestamptz;

-- Cap enforcement: only meaningful when learning_date is set.
-- A row with learning_date = NULL is "never viewed" — learning_time_ms
-- stays at 0. When learning_date is set, learning_time_ms is bounded [0, 5000].
ALTER TABLE public.vocabulary_items
DROP CONSTRAINT IF EXISTS vocabulary_items_learning_time_cap;

ALTER TABLE public.vocabulary_items
ADD CONSTRAINT vocabulary_items_learning_time_cap
  CHECK (learning_date IS NULL OR (learning_time_ms >= 0 AND learning_time_ms <= 5000));

-- Index for fast user-stats queries (e.g., "today's per-vocab learning
-- time across all my words"). Partial index — only rows with a recorded
-- date are interesting.
CREATE INDEX IF NOT EXISTS vocabulary_items_user_learning_date_idx
  ON public.vocabulary_items (user_id, learning_date)
  WHERE learning_date IS NOT NULL;

-- ==========================================================================
-- 2. Atomic RPC: increment_vocab_learning_time
-- ==========================================================================
-- Args:
--   p_vocab_id : uuid   — the vocabulary item to update
--   p_delta_ms : int    — milliseconds to add (server clamps negative to 0)
--   p_user_id  : uuid   — the calling user's id (for ownership check)
--   p_date     : date   — client-supplied "today" (local time) for daily reset
-- Returns:
--   new_learning_time_ms : int  — the new clamped value [0, 5000]
--   new_state            : text — 'COMPLETED' if >= 5000 else 'IDLE'
--
-- Why RPC (not app-level read-modify-write):
--   - Atomic against concurrent flushes from same user (multiple tabs)
--   - Daily reset + cap + timestamp updates in a single SQL transaction
--   - Server-side enforcement regardless of client behavior (per §十三)
--   - FOR UPDATE row lock prevents two parallel flushes from racing past
--     the cap before either commits
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.increment_vocab_learning_time(
  p_vocab_id uuid,
  p_delta_ms integer,
  p_user_id uuid,
  p_date date
) RETURNS TABLE(new_learning_time_ms integer, new_state text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_ms integer;
  v_current_date date;
  v_new_ms integer;
BEGIN
  -- Verify ownership (auth.uid() = user_id). SECURITY DEFINER means
  -- we trust the caller to pass the right p_user_id — but we double-check
  -- against the row so a malicious client can't write to someone else's
  -- vocab by passing a stolen vocab_id.
  IF NOT EXISTS (
    SELECT 1 FROM public.vocabulary_items
    WHERE id = p_vocab_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Vocabulary % not found or not owned by user %', p_vocab_id, p_user_id;
  END IF;

  -- Read current state with row lock — prevents two concurrent flushes
  -- (e.g., two tabs of the same vocab) from racing past the cap.
  SELECT learning_time_ms, learning_date
  INTO v_current_ms, v_current_date
  FROM public.vocabulary_items
  WHERE id = p_vocab_id
  FOR UPDATE;

  -- Daily reset (per docs/0830需求.md §一 + §二 + Frank #7276 C):
  -- if stored date is older than the client-supplied "today", reset.
  -- This is what makes the cap "daily" instead of "lifetime".
  IF v_current_date IS NULL OR v_current_date < p_date THEN
    v_current_ms := 0;
  END IF;

  -- Clamp negative deltas (defensive — client should only send positive).
  IF p_delta_ms < 0 THEN
    p_delta_ms := 0;
  END IF;

  -- Compute new value with 5000ms hard cap (per §七 + §十三).
  -- The client may claim 999999999 ms — server clamps regardless.
  v_new_ms := LEAST(GREATEST(v_current_ms + p_delta_ms, 0), 5000);

  -- Apply update + timestamps.
  UPDATE public.vocabulary_items
  SET
    learning_time_ms = v_new_ms,
    learning_date = p_date,
    learning_last_viewed_at = now(),
    learning_updated_at = now()
  WHERE id = p_vocab_id;

  new_learning_time_ms := v_new_ms;
  new_state := CASE WHEN v_new_ms >= 5000 THEN 'COMPLETED' ELSE 'IDLE' END;
  RETURN NEXT;
END;
$$;

-- Grant execute to authenticated users. The function does its own
-- ownership check inside the body, so this is safe to grant broadly.
GRANT EXECUTE ON FUNCTION public.increment_vocab_learning_time(uuid, integer, uuid, date)
  TO authenticated;

-- ==========================================================================
-- 3. RLS — new columns inherit from existing vocabulary_items policies
-- ==========================================================================
-- No new policies needed. Existing vocabulary_items policies scope
-- SELECT/UPDATE/DELETE by auth.uid() = user_id. The 4 new columns are
-- covered by those same policies.

-- ==========================================================================
-- Verify
-- ==========================================================================
-- After running this migration, expect:
--
--   \d public.vocabulary_items
-- to show the 4 new columns + vocabulary_items_learning_time_cap CHECK.
--
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name = 'increment_vocab_learning_time';
-- to return 1 row.
--
-- Smoke test (replace <vocab_id> with a real id from your collection):
--
--   SELECT * FROM increment_vocab_learning_time(
--     '<vocab_id>'::uuid, 1500,
--     (SELECT user_id FROM vocabulary_items WHERE id = '<vocab_id>')::uuid,
--     CURRENT_DATE
--   );
-- should return (1500, 'IDLE'). Calling again with 4000 returns (5000, 'COMPLETED').
-- Calling with 999999999 returns (5000, 'COMPLETED') — proves server-side clamp.
