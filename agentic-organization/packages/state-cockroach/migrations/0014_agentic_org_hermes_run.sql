CREATE TABLE IF NOT EXISTS agentic_org_hermes_run (
  run_id STRING PRIMARY KEY,
  work_item_id STRING NOT NULL,
  agent_id STRING NOT NULL,
  session_id STRING NOT NULL,
  hat_assignment_id STRING NOT NULL,
  prompt_flow_run_id STRING NOT NULL,
  state STRING NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  outcome_summary STRING,
  outcome_evidence_refs JSONB,
  failure_reason STRING
);
