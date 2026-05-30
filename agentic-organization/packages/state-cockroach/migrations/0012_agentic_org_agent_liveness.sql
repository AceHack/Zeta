CREATE TABLE IF NOT EXISTS agentic_org_agent_heartbeat (
  organization_id STRING NOT NULL,
  agent_id STRING NOT NULL,
  hat_assignment_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  deadline_ms INT8 NOT NULL,
  version INT8 NOT NULL,
  PRIMARY KEY (organization_id, agent_id)
);
