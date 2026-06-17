-- Agency priority monitoring slots: per-website 5-minute vs hourly cadence.

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS priority_monitoring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_monitoring_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority_monitoring_enabled_by UUID;

CREATE INDEX IF NOT EXISTS idx_websites_org_priority_monitoring
  ON public.websites (org_id, priority_monitoring)
  WHERE priority_monitoring = true;

CREATE INDEX IF NOT EXISTS idx_websites_user_priority_monitoring
  ON public.websites (user_id, priority_monitoring)
  WHERE priority_monitoring = true AND org_id IS NULL;

COMMENT ON COLUMN public.websites.priority_monitoring IS
  'Agency/owner: true = 5-minute monitoring cadence; false = hourly monitoring.';
COMMENT ON COLUMN public.websites.priority_monitoring_enabled_at IS
  'When priority 5-minute monitoring was enabled for this website.';
COMMENT ON COLUMN public.websites.priority_monitoring_enabled_by IS
  'User who enabled priority monitoring for this website.';

-- Safe backfill: no site is priority by default.
UPDATE public.websites
SET priority_monitoring = false
WHERE priority_monitoring IS DISTINCT FROM false;

-- Move agency/owner sites off blanket 5-minute hourly_monitor to hourly daily_scan.
UPDATE public.websites w
SET
  scan_frequency = 'daily_scan',
  next_scan_at = NOW()
WHERE w.is_active = true
  AND w.priority_monitoring = false
  AND (
    w.org_id IN (SELECT id FROM public.organizations WHERE plan = 'agency')
    OR w.user_id IN (SELECT id FROM public.profiles WHERE plan IN ('agency', 'owner'))
    OR w.user_id IN (SELECT id FROM public.profiles WHERE lower(email) = 'avanbailey@gmail.com')
  )
  AND (w.scan_frequency = 'hourly_monitor' OR w.scan_frequency IS NULL);
