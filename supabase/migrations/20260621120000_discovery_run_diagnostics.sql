-- Extended discovery run diagnostics for zero-result transparency
ALTER TABLE owner_discovery_runs
  ADD COLUMN IF NOT EXISTS run_diagnostics jsonb;
