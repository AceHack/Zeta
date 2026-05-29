CREATE TABLE IF NOT EXISTS agentic_org_work_items (
  work_item_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  title STRING NOT NULL,
  description STRING NOT NULL,
  state STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_supervisor_signals (
  supervisor_signal_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING NOT NULL,
  source_level STRING NOT NULL,
  target_level STRING NOT NULL,
  target_hat_assignment_id STRING NOT NULL,
  sender_agent_id STRING NOT NULL,
  sender_hat_assignment_id STRING NOT NULL,
  tool_type STRING NOT NULL,
  status STRING NOT NULL,
  title STRING NOT NULL,
  message STRING NOT NULL,
  related_work_item_id STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_audit_events (
  audit_event_id STRING PRIMARY KEY,
  event_name STRING NOT NULL,
  aggregate_id STRING NOT NULL,
  actor_agent_id STRING NOT NULL,
  actor_hat_assignment_id STRING NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  policy_decision_id STRING,
  policy_version STRING
);

CREATE TABLE IF NOT EXISTS agentic_org_outbox_events (
  outbox_event_id STRING PRIMARY KEY,
  event_id STRING NOT NULL UNIQUE,
  event_type STRING NOT NULL,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  trace_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  envelope_json JSONB NOT NULL,
  claim_id STRING,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agentic_org_inbox_receipts (
  event_id STRING NOT NULL,
  consumer_name STRING NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  payload_hash STRING NOT NULL,
  result STRING,
  PRIMARY KEY (event_id, consumer_name)
);

CREATE TABLE IF NOT EXISTS agentic_org_reaction_plans (
  reaction_plan_id STRING PRIMARY KEY,
  consumer_name STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status STRING NOT NULL,
  trigger_event_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  action_json JSONB NOT NULL,
  attempt_count INT8 NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agentic_org_idempotency_records (
  idempotency_key STRING PRIMARY KEY,
  request_hash STRING NOT NULL,
  result_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_policy_observations (
  policy_decision_id STRING PRIMARY KEY,
  policy_version STRING NOT NULL,
  decision_status STRING NOT NULL,
  denial_reason STRING,
  command_id STRING NOT NULL,
  command_type STRING NOT NULL,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  work_item_id STRING,
  actor_agent_id STRING NOT NULL,
  actor_hat_assignment_id STRING NOT NULL,
  tool_type STRING,
  source_level STRING,
  target_level STRING,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL,
  idempotency_key STRING NOT NULL,
  observation_hash STRING NOT NULL,
  observation_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL
);
