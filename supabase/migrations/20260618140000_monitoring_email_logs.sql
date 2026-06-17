-- Monitoring cron run logs + email alert audit trail + alert dispatch tracking.

CREATE TABLE IF NOT EXISTS public.cron_monitoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  websites_considered INT NOT NULL DEFAULT 0,
  websites_due INT NOT NULL DEFAULT 0,
  websites_enqueued INT NOT NULL DEFAULT 0,
  websites_skipped INT NOT NULL DEFAULT 0,
  websites_blocked INT NOT NULL DEFAULT 0,
  websites_errors INT NOT NULL DEFAULT 0,
  batch_processed INT NOT NULL DEFAULT 0,
  batch_failed INT NOT NULL DEFAULT 0,
  emails_attempted INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  emails_skipped INT NOT NULL DEFAULT 0,
  errors JSONB,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_cron_monitoring_runs_started_at
  ON public.cron_monitoring_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.email_alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  website_ids UUID[] NOT NULL DEFAULT '{}',
  alert_ids UUID[] NOT NULL DEFAULT '{}',
  severity_summary TEXT,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  skip_reason TEXT,
  error_message TEXT,
  cron_run_id UUID REFERENCES public.cron_monitoring_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_alert_logs_user_created
  ON public.email_alert_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_alert_logs_created_at
  ON public.email_alert_logs (created_at DESC);

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS email_dispatch_status TEXT
    CHECK (email_dispatch_status IS NULL OR email_dispatch_status IN ('pending', 'sent', 'skipped')),
  ADD COLUMN IF NOT EXISTS email_skip_reason TEXT;

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS last_deep_scan_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_alerts_pending_email_dispatch
  ON public.alerts (user_id, created_at DESC)
  WHERE email_dispatch_status = 'pending';

COMMENT ON COLUMN public.alerts.email_dispatch_status IS
  'Grouped email pipeline: pending until flush, then sent or skipped.';
COMMENT ON COLUMN public.websites.last_deep_scan_at IS
  'Last completed weekly deep scan timestamp for plan cadence rotation.';

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS scan_kind TEXT
    CHECK (scan_kind IS NULL OR scan_kind IN ('monitoring_check', 'deep_scan'));
