CREATE TABLE IF NOT EXISTS agentic_org_change_sets (
  change_set_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  proposer_hat_id STRING NOT NULL,
  title STRING NOT NULL,
  target_ref STRING NOT NULL,
  phase STRING NOT NULL,
  pipeline_id STRING NOT NULL,
  current_stage_index INT8 NOT NULL,
  artifacts JSONB NOT NULL,
  projections JSONB NOT NULL,
  revision INT8 NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT agentic_org_change_sets_phase_check CHECK (phase IN ('drafted', 'in_review', 'changes_requested', 'approved', 'applied', 'rejected', 'withdrawn')),
  INDEX change_sets_by_work (work_item_id),
  INDEX change_sets_by_org_phase (organization_id, phase)
);
CREATE TABLE IF NOT EXISTS agentic_org_review_stage_status (
  change_set_id STRING NOT NULL,
  stage_id STRING NOT NULL,
  revision INT8 NOT NULL,
  outcome STRING NULL,
  decided_by STRING NULL,
  decided_at TIMESTAMPTZ NULL,
  PRIMARY KEY (change_set_id, stage_id, revision)
);
