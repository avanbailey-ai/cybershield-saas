-- Agency Prospect System — defensive range check (Founder OS)
-- Additive, idempotent CHECK constraint guaranteeing agency_opportunity_score
-- stays within 0-100. The scorer already clamps to this range; this enforces it
-- at the database level so a bad write can never produce an out-of-range score.
-- NULLs are intentionally allowed (CHECK passes for NULL) so existing
-- un-classified rows are unaffected.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'owner_prospects_agency_opportunity_score_check'
  ) THEN
    ALTER TABLE owner_prospects
      ADD CONSTRAINT owner_prospects_agency_opportunity_score_check
      CHECK (agency_opportunity_score IS NULL OR (agency_opportunity_score >= 0 AND agency_opportunity_score <= 100));
  END IF;
END $$;
