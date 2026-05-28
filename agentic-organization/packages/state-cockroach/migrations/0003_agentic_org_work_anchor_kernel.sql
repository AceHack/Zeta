CREATE TABLE IF NOT EXISTS agentic_org_projects (
  project_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  name STRING NOT NULL,
  status STRING NOT NULL CONSTRAINT agentic_org_projects_status_check CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_initiatives (
  initiative_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  title STRING NOT NULL,
  status STRING NOT NULL CONSTRAINT agentic_org_initiatives_status_check CHECK (status IN ('proposed', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_work_anchor_targets (
  work_anchor_target_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  initiative_id STRING,
  work_item_id STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_work_item_state_history (
  work_state_transition_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  sequence INT8 NOT NULL CONSTRAINT agentic_org_work_item_state_history_sequence_positive_check CHECK (sequence > 0),
  from_state STRING NOT NULL CONSTRAINT agentic_org_work_item_state_history_from_state_check CHECK (from_state IN ('created', 'intake', 'triage', 'ready', 'in_progress', 'blocked', 'review', 'done')),
  to_state STRING NOT NULL CONSTRAINT agentic_org_work_item_state_history_to_state_check CHECK (to_state IN ('created', 'intake', 'triage', 'ready', 'in_progress', 'blocked', 'review', 'done')),
  evidence_artifact_ids JSONB NOT NULL,
  assigned_engineer_hat_assignment_id STRING,
  scheduled_work_block_id STRING,
  transitioned_at TIMESTAMPTZ NOT NULL,
  transitioned_by_agent_id STRING NOT NULL,
  transitioned_by_hat_assignment_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL,
  UNIQUE (work_item_id, sequence)
);

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS initiative_id STRING;

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS work_item_type STRING DEFAULT 'task';

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS version INT8 DEFAULT 1;

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS correlation_id STRING DEFAULT 'migration-backfill';

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS causation_id STRING DEFAULT 'migration-backfill';

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD COLUMN IF NOT EXISTS trace_id STRING DEFAULT 'migration-backfill';

ALTER TABLE IF EXISTS agentic_org_work_items
  ALTER COLUMN work_item_type DROP DEFAULT,
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN correlation_id DROP DEFAULT,
  ALTER COLUMN causation_id DROP DEFAULT,
  ALTER COLUMN trace_id DROP DEFAULT;

UPDATE agentic_org_work_items
  SET work_item_type = COALESCE(work_item_type, 'task'),
      updated_at = COALESCE(updated_at, created_at),
      version = COALESCE(version, 1),
      correlation_id = COALESCE(correlation_id, 'migration-backfill'),
      causation_id = COALESCE(causation_id, 'migration-backfill'),
      trace_id = COALESCE(trace_id, 'migration-backfill');

ALTER TABLE IF EXISTS agentic_org_work_items
  ALTER COLUMN work_item_type SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN version SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL,
  ALTER COLUMN causation_id SET NOT NULL,
  ALTER COLUMN trace_id SET NOT NULL;

ALTER TABLE IF EXISTS agentic_org_work_items
  ADD CONSTRAINT IF NOT EXISTS agentic_org_work_items_work_item_type_check CHECK (work_item_type IN ('defect', 'task')),
  ADD CONSTRAINT IF NOT EXISTS agentic_org_work_items_state_check CHECK (state IN ('created', 'intake', 'triage', 'ready', 'in_progress', 'blocked', 'review', 'done'));
