CREATE TABLE IF NOT EXISTS agentic_org_hindsight_memory (
  memory_id STRING PRIMARY KEY,
  agent_id STRING NOT NULL,
  hat_assignment_id STRING NOT NULL,
  project_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  prompt_flow_run_id STRING NOT NULL,
  content STRING NOT NULL,
  retained_at TIMESTAMPTZ NOT NULL
);
