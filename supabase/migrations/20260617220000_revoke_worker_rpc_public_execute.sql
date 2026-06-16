-- Restrict worker queue RPCs to service_role only.
-- REVOKE FROM PUBLIC does not remove Supabase default grants to anon/authenticated.

REVOKE EXECUTE ON FUNCTION public.claim_scan_jobs(integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_scan_job_by_id(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_expired_scan_jobs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_email_jobs(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reclaim_stale_scan_jobs(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reclaim_stale_email_jobs(integer) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_scan_jobs(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scan_job_by_id(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_expired_scan_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_stale_scan_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_stale_email_jobs(integer) TO service_role;
