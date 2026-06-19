-- Prevent duplicate follow-up scheduling for the same prospect/draft/stage.
--
-- A prospect should have at most ONE active (scheduled or due) follow-up per
-- follow-up step per outreach draft. This partial unique index enforces that at
-- the database level, complementing the idempotency guard in scheduleFollowUps.
-- Sent/cancelled rows are excluded so historical follow-ups never block new ones.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_owner_follow_ups_active_stage
  ON owner_follow_ups (prospect_id, draft_id, follow_up_number)
  WHERE status IN ('scheduled', 'due');
