-- Targeted claim for a single enqueue: avoids FIFO batch stealing the worker kick
-- from the job the user just requested when older pending jobs exist globally.

CREATE OR REPLACE FUNCTION public.claim_scan_job_by_id(
  p_job_id uuid,
  p_worker_id text DEFAULT 'worker'
)
RETURNS SETOF public.scan_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scan_queue sq
  SET
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    expires_at = now() + interval '3 minutes',
    started_at = COALESCE(sq.started_at, now())
  WHERE sq.id = p_job_id
    AND (
      (
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
    )
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scan_job_by_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scan_job_by_id(uuid, text) TO service_role;
