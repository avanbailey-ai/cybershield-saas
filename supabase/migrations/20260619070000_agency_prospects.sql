-- Agency Prospect System (Founder OS)
-- Additive, nullable columns on owner_prospects so SMB discovery/outreach is
-- completely unaffected (defaults keep every existing row classified as 'smb').
-- These power the owner-only "Agency Client Discovery & Outreach Generator":
-- finding web design / marketing / SEO / WordPress / Shopify / ecommerce
-- agencies, MSPs, and dev shops that manage client websites.

ALTER TABLE owner_prospects
  ADD COLUMN IF NOT EXISTS prospect_kind text NOT NULL DEFAULT 'smb',
  ADD COLUMN IF NOT EXISTS agency_type text,
  ADD COLUMN IF NOT EXISTS agency_opportunity_score integer,
  ADD COLUMN IF NOT EXISTS agency_label text,
  ADD COLUMN IF NOT EXISTS detected_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_site_count integer,
  ADD COLUMN IF NOT EXISTS manages_client_sites boolean,
  ADD COLUMN IF NOT EXISTS agency_why_selected text;

-- Constrain prospect_kind to known values (smb | agency).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'owner_prospects_prospect_kind_check'
  ) THEN
    ALTER TABLE owner_prospects
      ADD CONSTRAINT owner_prospects_prospect_kind_check
      CHECK (prospect_kind IN ('smb', 'agency'));
  END IF;
END $$;

-- Fast filtering of the agency pipeline without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_owner_prospects_prospect_kind
  ON owner_prospects (prospect_kind)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_owner_prospects_agency_label
  ON owner_prospects (agency_label)
  WHERE prospect_kind = 'agency' AND deleted_at IS NULL;

COMMENT ON COLUMN owner_prospects.prospect_kind IS 'smb | agency — segments Founder OS prospect pipelines';
COMMENT ON COLUMN owner_prospects.agency_type IS 'web_design | marketing | seo | wordpress | shopify | ecommerce | branding | creative_studio | msp | dev_shop | unknown';
COMMENT ON COLUMN owner_prospects.agency_opportunity_score IS 'Agency-specific opportunity score (0-100), separate from SMB opportunity_score';
COMMENT ON COLUMN owner_prospects.agency_label IS 'AGENCY HOT | AGENCY WARM | AGENCY LOW | NOT AGENCY FIT';
COMMENT ON COLUMN owner_prospects.detected_services IS 'Public services/platforms detected on the agency site (WordPress, Shopify, care plans, hosting, SEO, …)';
COMMENT ON COLUMN owner_prospects.estimated_site_count IS 'Best-effort estimate of client sites the agency manages (null when unknown)';
COMMENT ON COLUMN owner_prospects.manages_client_sites IS 'Evidence the business manages/maintains websites for clients (null when unknown)';
COMMENT ON COLUMN owner_prospects.agency_why_selected IS 'Human-readable reason this agency was selected/prioritized';
