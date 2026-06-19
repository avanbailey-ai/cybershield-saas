-- Prospect Quality Brain: pipeline gates, contact confidence, rejection tracking
ALTER TABLE owner_prospects
  ADD COLUMN IF NOT EXISTS contact_confidence text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS quality_label text,
  ADD COLUMN IF NOT EXISTS quality_stage text,
  ADD COLUMN IF NOT EXISTS buying_trigger text,
  ADD COLUMN IF NOT EXISTS why_now text;

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_quality_label_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_quality_label_check
  CHECK (quality_label IS NULL OR quality_label IN ('HOT', 'WARM', 'LOW', 'REJECTED', 'NEEDS REVIEW'));

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_quality_stage_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_quality_stage_check
  CHECK (
    quality_stage IS NULL OR quality_stage IN (
      'discovered', 'verified_business', 'qualified_fit', 'contact_verified', 'outreach_ready'
    )
  );

ALTER TABLE owner_prospects DROP CONSTRAINT IF EXISTS owner_prospects_contact_confidence_check;
ALTER TABLE owner_prospects ADD CONSTRAINT owner_prospects_contact_confidence_check
  CHECK (
    contact_confidence IS NULL OR contact_confidence IN (
      'verified_public_email',
      'likely_business_email',
      'generic_public_inbox',
      'personal_public_contact',
      'unverified_guess',
      'no_contact'
    )
  );

CREATE INDEX IF NOT EXISTS idx_owner_prospects_quality_label
  ON owner_prospects (quality_label)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_owner_prospects_rejection_reason
  ON owner_prospects (rejection_reason)
  WHERE rejection_reason IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE owner_discovery_runs
  ADD COLUMN IF NOT EXISTS discovery_breakdown jsonb;
