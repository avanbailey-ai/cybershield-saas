-- Production email alert pipeline: alert events, account preferences, extended email logs.

CREATE TABLE IF NOT EXISTS public.account_email_preferences (
  account_id UUID PRIMARY KEY,
  critical_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_report_enabled BOOLEAN NOT NULL DEFAULT true,
  all_clear_enabled BOOLEAN NOT NULL DEFAULT false,
  max_alert_emails_per_day INTEGER NOT NULL DEFAULT 3,
  preferred_digest_day SMALLINT CHECK (preferred_digest_day IS NULL OR preferred_digest_day BETWEEN 0 AND 6),
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  finding_key TEXT NOT NULL,
  finding_title TEXT NOT NULL,
  previous_severity TEXT,
  current_severity TEXT NOT NULL,
  previous_score INTEGER,
  current_score INTEGER,
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_worsened BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  should_email_immediately BOOLEAN NOT NULL DEFAULT false,
  digest_eligible BOOLEAN NOT NULL DEFAULT true,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'skipped', 'queued_digest', 'failed')),
  email_skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_account_pending
  ON public.alert_events (account_id, created_at DESC)
  WHERE email_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_alert_events_finding_cooldown
  ON public.alert_events (account_id, website_id, finding_key, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_digest
  ON public.alert_events (account_id, created_at DESC)
  WHERE digest_eligible = true AND email_status IN ('pending', 'queued_digest');

-- Extend email_alert_logs for production budget tracking
ALTER TABLE public.email_alert_logs
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS budget_month TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS related_alert_event_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.email_alert_logs DROP CONSTRAINT IF EXISTS email_alert_logs_status_check;
ALTER TABLE public.email_alert_logs
  ADD CONSTRAINT email_alert_logs_status_check
  CHECK (status IN ('queued', 'sent', 'skipped', 'failed'));

CREATE INDEX IF NOT EXISTS idx_email_alert_logs_budget_month
  ON public.email_alert_logs (budget_month, status);

CREATE INDEX IF NOT EXISTS idx_email_alert_logs_account_month
  ON public.email_alert_logs (account_id, created_at DESC);

COMMENT ON TABLE public.alert_events IS
  'Monitoring scan findings queued for email decision pipeline.';
COMMENT ON TABLE public.account_email_preferences IS
  'Per-account email notification preferences (account_id = org_id or user_id).';
