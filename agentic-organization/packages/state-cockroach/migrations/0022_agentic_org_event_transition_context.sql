ALTER TABLE IF EXISTS agentic_org_org_events
ADD COLUMN IF NOT EXISTS transition_context JSONB NULL;
