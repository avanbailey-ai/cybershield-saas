-- Founder OS V2: outreach drafts, prospect scoring fields, competitor tracking

ALTER TABLE owner_prospects
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS conversion_likelihood numeric(5, 2),
  ADD COLUMN IF NOT EXISTS estimated_mrr numeric(12, 2),
  ADD COLUMN IF NOT EXISTS estimated_arr numeric(12, 2),
  ADD COLUMN IF NOT EXISTS opportunity_priority integer;

CREATE TABLE IF NOT EXISTS owner_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES owner_prospects(id) ON DELETE SET NULL,
  outreach_type text NOT NULL,
  business_name text,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_outreach_drafts_prospect ON owner_outreach_drafts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_drafts_status ON owner_outreach_drafts(status);

ALTER TABLE owner_competitors
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS changes_notes text;

ALTER TABLE owner_campaigns
  ADD COLUMN IF NOT EXISTS daily_goal text,
  ADD COLUMN IF NOT EXISTS goals_completed integer NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS owner_outreach_drafts_updated ON owner_outreach_drafts;
CREATE TRIGGER owner_outreach_drafts_updated BEFORE UPDATE ON owner_outreach_drafts
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

ALTER TABLE owner_outreach_drafts ENABLE ROW LEVEL SECURITY;
