-- Automated prospect discovery + archive/delete hygiene for Founder OS

ALTER TABLE owner_prospects
  ADD COLUMN IF NOT EXISTS pipeline_state text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS discovery_source text,
  ADD COLUMN IF NOT EXISTS discovery_source_url text,
  ADD COLUMN IF NOT EXISTS top_issue text,
  ADD COLUMN IF NOT EXISTS dns_valid boolean,
  ADD COLUMN IF NOT EXISTS http_valid boolean,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_pipeline_state_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_pipeline_state_check
  CHECK (pipeline_state IN (
    'new', 'scanned', 'qualified', 'outreach_ready',
    'contacted', 'interested', 'customer', 'archived'
  ));

CREATE INDEX IF NOT EXISTS idx_owner_prospects_pipeline ON owner_prospects (pipeline_state)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_owner_prospects_archived ON owner_prospects (archived_at)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE owner_crm_leads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE owner_campaigns
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE owner_competitors
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE owner_outreach_drafts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE owner_content_posts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS owner_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  discovered_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  scanned_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_founder_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS owner_founder_settings_updated ON owner_founder_settings;
CREATE TRIGGER owner_founder_settings_updated BEFORE UPDATE ON owner_founder_settings
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

ALTER TABLE owner_discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_founder_settings ENABLE ROW LEVEL SECURITY;

-- CEO alerts hygiene (resolved/read alerts auto-archive)
ALTER TABLE public.ceo_alerts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
