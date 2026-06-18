-- Founder OS Real Execution Layer: outreach send tracking, events, follow-ups, inbox dismissals

ALTER TABLE owner_outreach_drafts
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS resend_message_id text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS send_error text,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text;

ALTER TABLE owner_outreach_drafts DROP CONSTRAINT IF EXISTS owner_outreach_drafts_status_check;
ALTER TABLE owner_outreach_drafts ADD CONSTRAINT owner_outreach_drafts_status_check
  CHECK (status IN ('draft', 'approved', 'sent', 'failed'));

CREATE TABLE IF NOT EXISTS owner_outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES owner_outreach_drafts(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES owner_prospects(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'email_sent', 'email_approved', 'email_failed', 'follow_up_scheduled',
    'follow_up_due', 'follow_up_sent', 'contact_found', 'retention_sent'
  )),
  recipient_email text,
  resend_message_id text,
  subject text,
  detail text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_outreach_events_draft ON owner_outreach_events(draft_id);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_events_prospect ON owner_outreach_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_events_type ON owner_outreach_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS owner_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES owner_prospects(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES owner_outreach_drafts(id) ON DELETE SET NULL,
  follow_up_number integer NOT NULL CHECK (follow_up_number BETWEEN 1 AND 5),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'due', 'sent', 'cancelled'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_follow_ups_due ON owner_follow_ups(scheduled_at)
  WHERE status IN ('scheduled', 'due');
CREATE INDEX IF NOT EXISTS idx_owner_follow_ups_prospect ON owner_follow_ups(prospect_id);

CREATE TABLE IF NOT EXISTS owner_inbox_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_item_id text NOT NULL UNIQUE,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_inbox_dismissals_item ON owner_inbox_dismissals(inbox_item_id);

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_pipeline_state_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_pipeline_state_check
  CHECK (pipeline_state IN (
    'new', 'new_discovery', 'scanned', 'qualified', 'outreach_ready',
    'needs_contact', 'no_contact_found', 'needs_review', 'bad_fit',
    'follow_up_scheduled', 'follow_up_due',
    'contacted', 'interested', 'customer', 'archived', 'ignore_forever'
  ));

ALTER TABLE owner_outreach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_inbox_dismissals ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS owner_follow_ups_updated ON owner_follow_ups;
CREATE TRIGGER owner_follow_ups_updated BEFORE UPDATE ON owner_follow_ups
  FOR EACH ROW EXECUTE FUNCTION owner_set_updated_at();
