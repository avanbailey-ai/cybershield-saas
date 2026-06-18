-- Prospect attribution + CRM linkage for Founder OS pipeline

CREATE TABLE IF NOT EXISTS owner_prospect_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES owner_prospects(id) ON DELETE CASCADE,
  outreach_draft_id uuid REFERENCES owner_outreach_drafts(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  clicked_at timestamptz,
  signed_up_user_id uuid,
  signed_up_at timestamptz,
  converted_user_id uuid,
  converted_at timestamptz,
  converted_plan text,
  converted_mrr numeric(12, 2),
  org_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_prospect_attributions_token
  ON owner_prospect_attributions (token);
CREATE INDEX IF NOT EXISTS idx_owner_prospect_attributions_prospect
  ON owner_prospect_attributions (prospect_id);
CREATE INDEX IF NOT EXISTS idx_owner_prospect_attributions_signup
  ON owner_prospect_attributions (signed_up_user_id)
  WHERE signed_up_user_id IS NOT NULL;

ALTER TABLE owner_crm_leads
  ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES owner_prospects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interest_at timestamptz,
  ADD COLUMN IF NOT EXISTS interest_source text;

CREATE INDEX IF NOT EXISTS idx_owner_crm_leads_prospect
  ON owner_crm_leads (prospect_id)
  WHERE prospect_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE owner_outreach_events DROP CONSTRAINT IF EXISTS owner_outreach_events_event_type_check;
ALTER TABLE owner_outreach_events ADD CONSTRAINT owner_outreach_events_event_type_check
  CHECK (event_type IN (
    'email_sent', 'email_approved', 'email_failed', 'follow_up_scheduled',
    'follow_up_due', 'follow_up_sent', 'contact_found', 'retention_sent',
    'customer_status_updated', 'prospect_interested', 'prospect_signup', 'prospect_converted'
  ));

ALTER TABLE owner_prospect_attributions ENABLE ROW LEVEL SECURITY;
