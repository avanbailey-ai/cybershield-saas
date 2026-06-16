-- Per-user email notification preferences (settings page toggles).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_vulnerability_alerts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_digest BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_critical_threats BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.notify_vulnerability_alerts IS
  'Email when scans detect new vulnerabilities or security changes.';
COMMENT ON COLUMN public.profiles.notify_weekly_digest IS
  'Weekly summary email of monitored website scores.';
COMMENT ON COLUMN public.profiles.notify_critical_threats IS
  'Immediate email for critical-severity security threats.';
