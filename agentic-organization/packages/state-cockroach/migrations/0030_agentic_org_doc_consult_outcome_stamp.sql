ALTER TABLE IF EXISTS agentic_org_doc_consult_ledger
  ADD COLUMN IF NOT EXISTS outcome_ref STRING,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS doc_consult_by_outcome_ref
  ON agentic_org_doc_consult_ledger (organization_id, outcome_ref, outcome_recorded_at);

CREATE TABLE IF NOT EXISTS agentic_org_doc_consult_outcomes (
  doc_consult_id STRING NOT NULL,
  outcome_ref STRING NOT NULL,
  organization_id STRING NOT NULL,
  doc_unit_id STRING NOT NULL,
  outcome STRING NOT NULL,
  outcome_recorded_at TIMESTAMPTZ NOT NULL,
  context_pack_id STRING NULL,
  run_id STRING NULL,
  stage_id STRING NULL,
  hat_id STRING NULL,
  hat_assignment_id STRING NULL,
  agent_id STRING NULL,
  project_id STRING NULL,
  team_id STRING NULL,
  work_item_id STRING NULL,
  trace_id STRING NULL,
  correlation_id STRING NULL,
  causation_id STRING NULL,
  PRIMARY KEY (doc_consult_id, outcome_ref),
  INDEX doc_consult_outcomes_by_scope (organization_id, hat_id, stage_id, project_id, team_id, outcome_recorded_at),
  INDEX doc_consult_outcomes_by_work (organization_id, project_id, work_item_id, outcome_recorded_at),
  INDEX doc_consult_outcomes_by_outcome_ref (organization_id, outcome_ref, outcome_recorded_at)
);
