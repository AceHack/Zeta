ALTER TABLE IF EXISTS agentic_org_doc_consult_ledger
  ALTER COLUMN work_item_id DROP NOT NULL;

ALTER TABLE IF EXISTS agentic_org_doc_consult_ledger
  ADD COLUMN IF NOT EXISTS context_pack_id STRING,
  ADD COLUMN IF NOT EXISTS run_id STRING,
  ADD COLUMN IF NOT EXISTS scope STRING,
  ADD COLUMN IF NOT EXISTS hat_id STRING,
  ADD COLUMN IF NOT EXISTS hat_assignment_id STRING,
  ADD COLUMN IF NOT EXISTS agent_id STRING,
  ADD COLUMN IF NOT EXISTS project_id STRING,
  ADD COLUMN IF NOT EXISTS team_id STRING,
  ADD COLUMN IF NOT EXISTS context_item_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS source_refs JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS required BOOL NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freshness STRING,
  ADD COLUMN IF NOT EXISTS reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS doc_type STRING,
  ADD COLUMN IF NOT EXISTS doc_scope_kind STRING,
  ADD COLUMN IF NOT EXISTS doc_scope_id STRING,
  ADD COLUMN IF NOT EXISTS content_ref STRING,
  ADD COLUMN IF NOT EXISTS content_hash STRING,
  ADD COLUMN IF NOT EXISTS source_id STRING,
  ADD COLUMN IF NOT EXISTS doc_version INT8,
  ADD COLUMN IF NOT EXISTS trace_id STRING,
  ADD COLUMN IF NOT EXISTS correlation_id STRING,
  ADD COLUMN IF NOT EXISTS causation_id STRING;

CREATE INDEX IF NOT EXISTS doc_consult_by_context_pack
  ON agentic_org_doc_consult_ledger (organization_id, context_pack_id, consulted_at);
CREATE INDEX IF NOT EXISTS doc_consult_by_hat
  ON agentic_org_doc_consult_ledger (organization_id, hat_assignment_id, consulted_at);
CREATE INDEX IF NOT EXISTS doc_consult_by_outcome
  ON agentic_org_doc_consult_ledger (organization_id, outcome, consulted_at);
