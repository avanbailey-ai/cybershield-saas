-- Per-website continuous monitoring schedule (next_scan_at + scan_frequency).
-- monitoringEnabled maps to existing is_active column.

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scan_frequency TEXT DEFAULT NULL
    CHECK (
      scan_frequency IS NULL
      OR scan_frequency IN ('daily_scan', 'weekly_deep_scan', 'hourly_monitor')
    );

CREATE INDEX IF NOT EXISTS idx_websites_next_scan_due
  ON public.websites (next_scan_at ASC)
  WHERE is_active = true AND next_scan_at IS NOT NULL;

COMMENT ON COLUMN public.websites.is_active IS
  'Monitoring enabled; cron enqueues when next_scan_at <= now().';
COMMENT ON COLUMN public.websites.scan_frequency IS
  'Scheduled scan mode: daily_scan, weekly_deep_scan, or hourly_monitor (Agency+).';
COMMENT ON COLUMN public.websites.next_scan_at IS
  'Next automated scan; computed from plan + scan_frequency after each successful scan.';
