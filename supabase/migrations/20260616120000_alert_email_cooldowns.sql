-- Per-alert-type email cooldown tracking for continuous monitoring notifications.

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS last_alert_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alert_email_cooldowns JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.websites.last_alert_email_sent_at IS
  'Legacy global alert email cooldown timestamp (superseded by alert_email_cooldowns).';
COMMENT ON COLUMN public.websites.alert_email_cooldowns IS
  'Map of monitoring alert type -> ISO timestamp of last email sent (24h cooldown per type per site).';
