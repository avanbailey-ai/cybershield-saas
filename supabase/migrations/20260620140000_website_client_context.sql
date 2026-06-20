-- Agency client context fields (additive only)
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS client_company TEXT,
  ADD COLUMN IF NOT EXISTS client_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_report_frequency TEXT,
  ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS agency_internal_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_websites_org_client_name
  ON public.websites (org_id, client_name)
  WHERE org_id IS NOT NULL AND client_name IS NOT NULL;

COMMENT ON COLUMN public.websites.client_name IS 'Agency client display name for reports and portfolio views';
COMMENT ON COLUMN public.websites.client_contact_name IS 'Primary client contact for agency communication';
COMMENT ON COLUMN public.websites.client_contact_email IS 'Client contact email — copy-only, never auto-sent';
COMMENT ON COLUMN public.websites.client_company IS 'Client company name for reports';
COMMENT ON COLUMN public.websites.client_notes IS 'Client-visible notes for agency context';
COMMENT ON COLUMN public.websites.client_report_frequency IS 'Preferred report cadence: monthly, weekly, quarterly, etc.';
COMMENT ON COLUMN public.websites.client_status IS 'Agency workflow status: active, paused, archived, etc.';
COMMENT ON COLUMN public.websites.agency_internal_notes IS 'Internal agency notes — not shown to clients';
