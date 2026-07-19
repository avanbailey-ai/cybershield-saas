-- Provider-level diagnostics for discovery runs

ALTER TABLE owner_discovery_runs
  ADD COLUMN IF NOT EXISTS provider_diagnostics jsonb;
