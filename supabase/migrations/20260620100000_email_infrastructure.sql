-- Email delivery logging and engagement tracking for Founder OS

CREATE TABLE IF NOT EXISTS owner_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_message_id text,
  recipient_email text NOT NULL,
  subject text,
  category text NOT NULL DEFAULT 'system',
  template text,
  prospect_id uuid REFERENCES owner_prospects(id) ON DELETE SET NULL,
  draft_id uuid REFERENCES owner_outreach_drafts(id) ON DELETE SET NULL,
  user_id uuid,
  attribution_token text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'
  )),
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_email_deliveries_resend
  ON owner_email_deliveries (resend_message_id)
  WHERE resend_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owner_email_deliveries_prospect
  ON owner_email_deliveries (prospect_id)
  WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owner_email_deliveries_created
  ON owner_email_deliveries (created_at DESC);

CREATE TABLE IF NOT EXISTS owner_email_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES owner_email_deliveries(id) ON DELETE CASCADE,
  resend_message_id text,
  prospect_id uuid REFERENCES owner_prospects(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'unsubscribed'
  )),
  link_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_email_engagement_delivery
  ON owner_email_engagement_events (delivery_id);
CREATE INDEX IF NOT EXISTS idx_owner_email_engagement_type
  ON owner_email_engagement_events (event_type, created_at DESC);

DROP TRIGGER IF EXISTS owner_email_deliveries_updated ON owner_email_deliveries;
CREATE TRIGGER owner_email_deliveries_updated BEFORE UPDATE ON owner_email_deliveries
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();

ALTER TABLE owner_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_email_engagement_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE owner_prospect_attributions
  ADD COLUMN IF NOT EXISTS source_template text,
  ADD COLUMN IF NOT EXISTS source_campaign text,
  ADD COLUMN IF NOT EXISTS source_email_category text;
