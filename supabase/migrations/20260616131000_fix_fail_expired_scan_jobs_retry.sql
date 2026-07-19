-- fail_expired_scan_jobs: retry-eligible timeouts go back to pending instead of permanent fail.
-- Also catch processing rows with NULL expires_at stuck >3 min.

CREATE OR REPLACE FUNCTION public.fail_expired_scan_jobs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count int := 0;
  row_count int;
BEGIN
  -- Retry-eligible: increment attempts and requeue
  WITH expired AS (
    SELECT id, COALESCE(attempts, 0) AS attempts, COALESCE(max_attempts, 3) AS max_attempts
    FROM public.scan_queue
    WHERE status = 'processing'
      AND (
        (expires_at IS NOT NULL AND expires_at < now())
        OR (expires_at IS NULL AND locked_at IS NOT NULL AND locked_at < now() - interval '3 minutes')
        OR (expires_at IS NULL AND started_at IS NOT NULL AND started_at < now() - interval '3 minutes')
      )
  ),
  requeue AS (
    UPDATE public.scan_queue sq
    SET
      status = 'pending',
      attempts = e.attempts + 1,
      error = 'scan_timeout',
      result = jsonb_build_object('error', 'scan_timeout'),
      locked_at = NULL,
      locked_by = NULL,
      expires_at = NULL,
      started_at = NULL,
      scheduled_for = now() + interval '30 seconds',
      completed_at = NULL
    FROM expired e
    WHERE sq.id = e.id
      AND e.attempts + 1 < e.max_attempts
    RETURNING sq.id
  )
  SELECT COUNT(*)::int INTO row_count FROM requeue;
  affected_count := affected_count + row_count;

  -- Permanent fail when max attempts exhausted
  WITH expired AS (
    SELECT id, COALESCE(attempts, 0) AS attempts, COALESCE(max_attempts, 3) AS max_attempts, scan_id
    FROM public.scan_queue
    WHERE status = 'processing'
      AND (
        (expires_at IS NOT NULL AND expires_at < now())
        OR (expires_at IS NULL AND locked_at IS NOT NULL AND locked_at < now() - interval '3 minutes')
        OR (expires_at IS NULL AND started_at IS NOT NULL AND started_at < now() - interval '3 minutes')
      )
  ),
  fail_queue AS (
    UPDATE public.scan_queue sq
    SET
      status = 'failed',
      attempts = e.attempts + 1,
      error = 'scan_timeout',
      result = jsonb_build_object('error', 'scan_timeout'),
      completed_at = now(),
      locked_at = NULL,
      locked_by = NULL,
      expires_at = NULL,
      scheduled_for = NULL
    FROM expired e
    WHERE sq.id = e.id
      AND e.attempts + 1 >= e.max_attempts
    RETURNING sq.id, sq.scan_id
  )
  SELECT COUNT(*)::int INTO row_count FROM fail_queue;
  affected_count := affected_count + row_count;

  UPDATE public.scans s
  SET
    status = 'failed',
    error_message = 'scan_timeout',
    completed_at = now()
  FROM public.scan_queue sq
  WHERE sq.status IN ('failed', 'pending')
    AND sq.error = 'scan_timeout'
    AND sq.completed_at >= now() - interval '2 minutes'
    AND s.id = sq.scan_id
    AND s.status IN ('pending', 'running');

  UPDATE public.scans s
  SET
    status = 'failed',
    error_message = 'scan_timeout',
    completed_at = now()
  WHERE s.status = 'running'
    AND s.started_at < now() - interval '3 minutes';

  RETURN affected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_expired_scan_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_expired_scan_jobs() TO service_role;
