ALTER TABLE IF EXISTS agentic_org_outbox_events
  ADD COLUMN IF NOT EXISTS claim_id STRING;
