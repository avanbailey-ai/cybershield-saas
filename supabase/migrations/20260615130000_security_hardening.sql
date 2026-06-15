-- Lock down stripe_webhook_events (service-role only via RLS default-deny)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Revoke public execute on scan usage RPCs (service/backend only)
REVOKE EXECUTE ON FUNCTION public.increment_scan_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_scan_usage(uuid) FROM PUBLIC, anon, authenticated;
