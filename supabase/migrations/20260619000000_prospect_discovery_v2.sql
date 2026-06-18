-- Prospect Discovery V2: sales intelligence fields + pipeline stages

ALTER TABLE owner_prospects
  ADD COLUMN IF NOT EXISTS opportunity_score integer,
  ADD COLUMN IF NOT EXISTS estimated_plan_fit integer,
  ADD COLUMN IF NOT EXISTS contact_page_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_email_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_phone_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_linkedin_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_linkedin text,
  ADD COLUMN IF NOT EXISTS qualification_reasons jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selection_reason text;

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_pipeline_state_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_pipeline_state_check
  CHECK (pipeline_state IN (
    'new', 'new_discovery', 'scanned', 'qualified', 'outreach_ready',
    'contacted', 'interested', 'customer', 'archived', 'ignore_forever'
  ));

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_estimated_plan_fit_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_estimated_plan_fit_check
  CHECK (estimated_plan_fit IS NULL OR estimated_plan_fit IN (79, 149, 299));

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_opportunity_score_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_opportunity_score_check
  CHECK (opportunity_score IS NULL OR (opportunity_score >= 0 AND opportunity_score <= 100));

UPDATE owner_prospects
SET pipeline_state = 'new_discovery'
WHERE pipeline_state IN ('new', 'scanned') AND deleted_at IS NULL;

ALTER TABLE owner_discovery_runs
  ADD COLUMN IF NOT EXISTS qualified_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outreach_ready_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_owner_prospects_opportunity_score
  ON owner_prospects (opportunity_score DESC NULLS LAST)
  WHERE deleted_at IS NULL AND pipeline_state NOT IN ('archived', 'ignore_forever');
