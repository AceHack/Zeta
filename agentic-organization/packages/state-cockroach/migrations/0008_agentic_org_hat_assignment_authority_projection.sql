CREATE TABLE IF NOT EXISTS agentic_org_hat_assignment_authorities (
  hat_assignment_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  assigned_agent_id STRING NOT NULL,
  state STRING NOT NULL CONSTRAINT agentic_org_hat_assignment_authorities_state_check CHECK (state IN ('active', 'expired', 'released', 'revoked', 'suspended')),
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);
