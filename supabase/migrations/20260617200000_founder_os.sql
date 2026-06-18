-- Founder OS owner-only tables (not customer-facing schema)

CREATE TABLE IF NOT EXISTS owner_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  website text NOT NULL,
  industry text,
  city text,
  lead_score text CHECK (lead_score IN ('HOT', 'WARM', 'LOW')),
  scan_score integer,
  scan_risk_level text,
  scan_findings jsonb,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  website text,
  industry text,
  contact_name text,
  contact_email text,
  notes text,
  stage text NOT NULL DEFAULT 'new_lead' CHECK (stage IN (
    'new_lead', 'contacted', 'replied', 'demo', 'trial', 'customer', 'lost'
  )),
  lead_score text CHECK (lead_score IN ('HOT', 'WARM', 'LOW')),
  potential_revenue numeric(12, 2),
  last_contact_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days IN (7, 30)),
  start_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_campaign_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES owner_campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  day_offset integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_campaign_tasks_campaign ON owner_campaign_tasks(campaign_id);

CREATE TABLE IF NOT EXISTS owner_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  pricing_notes text,
  features text,
  positioning text,
  advantages text,
  gaps text,
  opportunities text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  title text,
  content text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  views integer NOT NULL DEFAULT 0,
  leads_generated integer NOT NULL DEFAULT 0,
  customers_acquired integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION owner_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS owner_prospects_updated ON owner_prospects;
CREATE TRIGGER owner_prospects_updated BEFORE UPDATE ON owner_prospects
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

DROP TRIGGER IF EXISTS owner_crm_leads_updated ON owner_crm_leads;
CREATE TRIGGER owner_crm_leads_updated BEFORE UPDATE ON owner_crm_leads
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

DROP TRIGGER IF EXISTS owner_campaigns_updated ON owner_campaigns;
CREATE TRIGGER owner_campaigns_updated BEFORE UPDATE ON owner_campaigns
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

DROP TRIGGER IF EXISTS owner_competitors_updated ON owner_competitors;
CREATE TRIGGER owner_competitors_updated BEFORE UPDATE ON owner_competitors
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

DROP TRIGGER IF EXISTS owner_content_posts_updated ON owner_content_posts;
CREATE TRIGGER owner_content_posts_updated BEFORE UPDATE ON owner_content_posts
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

ALTER TABLE owner_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_campaign_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_content_posts ENABLE ROW LEVEL SECURITY;
