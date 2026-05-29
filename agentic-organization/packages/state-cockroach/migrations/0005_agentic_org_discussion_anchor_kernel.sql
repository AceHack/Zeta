CREATE TABLE IF NOT EXISTS agentic_org_discussion_anchors (
  discussion_anchor_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  work_item_id STRING NOT NULL,
  discussion_anchor_type STRING NOT NULL CONSTRAINT agentic_org_discussion_anchors_type_check CHECK (discussion_anchor_type IN ('work_item')),
  title STRING NOT NULL,
  purpose STRING NOT NULL,
  expected_outputs JSONB NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);
