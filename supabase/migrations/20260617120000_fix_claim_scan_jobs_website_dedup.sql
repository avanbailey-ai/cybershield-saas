-- Fix claim_scan_jobs: one active job per website (matches idx_scan_queue_website_active).
-- Failed retry-eligible rows must not be claimed when pending/processing exists for the same website.

-- Supersede failed jobs that were replaced by newer pending enqueue for the same website.
UPDATE public.scan_queue sq
SET
  attempts = COALESCE(sq.max_attempts, 3),
  error = COALESCE(sq.error, 'superseded_by_new_enqueue'),
  completed_at = COALESCE(sq.completed_at, now())
WHERE sq.status = 'failed'
  AND sq.attempts < COALESCE(sq.max_attempts, 3)
  AND EXISTS (
    SELECT 1
    FROM public.scan_queue newer
    WHERE newer.website_id = sq.website_id
      AND newer.status IN ('pending', 'processing')
      AND newer.created_at > sq.created_at
  );

-- Drop legacy single-arg overload (ambiguous with int,text version).
DROP FUNCTION IF EXISTS public.claim_scan_jobs(int);

CREATE OR REPLACE FUNCTION public.claim_scan_jobs(
  p_limit int DEFAULT 10,
  p_worker_id text DEFAULT 'worker'
)
RETURNS SETOF public.scan_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH locked AS (
    SELECT
      sq.id,
      sq.website_id,
      sq.priority,
      sq.created_at,
      sq.status
    FROM public.scan_queue sq
    WHERE (
      sq.status = 'pending'
      AND (sq.scheduled_for IS NULL OR sq.scheduled_for <= now())
    )
    OR (
      sq.status = 'failed'
      AND sq.attempts < COALESCE(sq.max_attempts, 3)
      AND NOT EXISTS (
        SELECT 1
        FROM public.scan_queue active
        WHERE active.website_id = sq.website_id
          AND active.status IN ('pending', 'processing')
          AND active.id <> sq.id
      )
    )
    ORDER BY sq.priority DESC, sq.created_at ASC
    FOR UPDATE OF sq SKIP LOCKED
  ),
  candidates AS (
    SELECT DISTINCT ON (website_id) id
    FROM locked
    ORDER BY
      website_id,
      CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
      priority DESC,
      created_at ASC
    LIMIT p_limit
  )
  UPDATE public.scan_queue sq
  SET
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    expires_at = now() + interval '3 minutes',
    started_at = COALESCE(sq.started_at, now())
  FROM candidates c
  WHERE sq.id = c.id
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scan_jobs(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scan_jobs(int, text) TO service_role;
