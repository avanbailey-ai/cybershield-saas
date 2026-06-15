-- Queue-based background job architecture (multi-instance safe)

-- ── scan_queue extensions ────────────────────────────────────────────────────
ALTER TABLE public.scan_queue
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result JSONB;

-- Backfill domain from websites
UPDATE public.scan_queue sq
SET domain = regexp_replace(w.url, '^https?://([^/]+).*$', '\1')
FROM public.websites w
WHERE sq.website_id = w.id AND sq.domain IS NULL;

-- Drop old status constraint before renaming legacy values
ALTER TABLE public.scan_queue DROP CONSTRAINT IF EXISTS scan_queue_status_check;

-- Migrate legacy status values
UPDATE public.scan_queue SET status = 'completed' WHERE status = 'done';
UPDATE public.scan_queue SET locked_at = started_at WHERE locked_at IS NULL AND started_at IS NOT NULL;

ALTER TABLE public.scan_queue
  ADD CONSTRAINT scan_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- ── email_queue extensions ───────────────────────────────────────────────────
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Backfill new columns from legacy shape
UPDATE public.email_queue
SET
  type = COALESCE(type, template),
  payload = COALESCE(
    NULLIF(payload, '{}'::jsonb),
    jsonb_build_object(
      'email', email,
      'template', template,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'scheduled_for', scheduled_for
    )
  ),
  status = CASE
    WHEN sent = true THEN 'completed'
    WHEN status NOT IN ('pending', 'processing', 'completed', 'failed') THEN 'pending'
    ELSE status
  END
WHERE type IS NULL OR payload = '{}'::jsonb OR status IS NULL;

ALTER TABLE public.email_queue DROP CONSTRAINT IF EXISTS email_queue_status_check;
ALTER TABLE public.email_queue
  ADD CONSTRAINT email_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scan_queue_claim
  ON public.scan_queue (priority DESC, created_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_scan_queue_stale_lock
  ON public.scan_queue (locked_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_email_queue_claim
  ON public.email_queue (created_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_queue_stale_lock
  ON public.email_queue (locked_at)
  WHERE status = 'processing';

-- ── Reclaim stale locks (scan) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reclaim_stale_scan_jobs(p_stale_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reclaimed int;
BEGIN
  UPDATE public.scan_queue
  SET
    status = 'pending',
    locked_at = NULL,
    started_at = NULL
  WHERE status = 'processing'
    AND locked_at IS NOT NULL
    AND locked_at < now() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS reclaimed = ROW_COUNT;
  RETURN reclaimed;
END;
$$;

-- ── Atomic claim (scan) — FOR UPDATE SKIP LOCKED ─────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_scan_jobs(p_limit int DEFAULT 10)
RETURNS SETOF public.scan_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.scan_queue
    WHERE status = 'pending'
       OR (status = 'failed' AND attempts < COALESCE(max_attempts, 3))
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.scan_queue sq
  SET
    status = 'processing',
    locked_at = now(),
    started_at = now()
  FROM candidates c
  WHERE sq.id = c.id
  RETURNING sq.*;
END;
$$;

-- ── Reclaim stale locks (email) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reclaim_stale_email_jobs(p_stale_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reclaimed int;
BEGIN
  UPDATE public.email_queue
  SET
    status = 'pending',
    locked_at = NULL
  WHERE status = 'processing'
    AND locked_at IS NOT NULL
    AND locked_at < now() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS reclaimed = ROW_COUNT;
  RETURN reclaimed;
END;
$$;

-- ── Atomic claim (email) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_email_jobs(p_limit int DEFAULT 20)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.email_queue
    WHERE (
      status = 'pending'
      OR (status = 'failed' AND attempts < 3)
    )
    AND (
      payload->>'scheduled_for' IS NULL
      OR (payload->>'scheduled_for')::timestamptz <= now()
      OR scheduled_for <= now()
    )
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_queue eq
  SET
    status = 'processing',
    locked_at = now()
  FROM candidates c
  WHERE eq.id = c.id
  RETURNING eq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.reclaim_stale_scan_jobs(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_scan_jobs(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reclaim_stale_email_jobs(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_email_jobs(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reclaim_stale_scan_jobs(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scan_jobs(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_stale_email_jobs(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(int) TO service_role;
