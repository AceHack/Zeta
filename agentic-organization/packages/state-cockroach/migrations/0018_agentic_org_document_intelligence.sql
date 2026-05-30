CREATE TABLE IF NOT EXISTS agentic_org_doc_sources (
  doc_source_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  connector_kind STRING NOT NULL,
  label STRING NOT NULL,
  sync_cursor STRING NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  INDEX doc_sources_by_org (organization_id)
);
CREATE TABLE IF NOT EXISTS agentic_org_doc_units (
  doc_unit_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  source_id STRING NOT NULL,
  type STRING NOT NULL,
  scope_kind STRING NOT NULL,
  scope_id STRING NOT NULL,
  title STRING NOT NULL,
  summary STRING NOT NULL,
  content_ref STRING NOT NULL,
  content_hash STRING NOT NULL,
  status STRING NOT NULL,
  freshness_at TIMESTAMPTZ NOT NULL,
  bound_hat_ids JSONB NOT NULL,
  bound_stage_ids JSONB NOT NULL,
  supersedes_id STRING NULL,
  provenance_change_set_id STRING NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  CONSTRAINT agentic_org_doc_units_type_check CHECK (type IN ('handbook', 'policy', 'architecture', 'adr', 'runbook', 'brd', 'spec', 'reference', 'meeting_note', 'decision_record')),
  CONSTRAINT agentic_org_doc_units_scope_kind_check CHECK (scope_kind IN ('organization', 'department', 'project', 'service', 'team')),
  CONSTRAINT agentic_org_doc_units_status_check CHECK (status IN ('draft', 'in_review', 'active', 'stale', 'superseded', 'archived')),
  INDEX doc_units_by_org_scope (organization_id, scope_kind, scope_id),
  INDEX doc_units_by_org_status (organization_id, status),
  INDEX doc_units_by_content_hash (organization_id, content_hash)
);
CREATE TABLE IF NOT EXISTS agentic_org_doc_entities (
  doc_entity_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  canonical_name STRING NOT NULL,
  kind STRING NOT NULL,
  aliases JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  INDEX doc_entities_by_org_kind (organization_id, kind)
);
CREATE TABLE IF NOT EXISTS agentic_org_doc_graph_edges (
  doc_graph_edge_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  from_id STRING NOT NULL,
  to_id STRING NOT NULL,
  relation STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT agentic_org_doc_graph_edges_relation_check CHECK (relation IN ('owned_by', 'consulted_at', 'supersedes', 'references', 'governs')),
  INDEX doc_graph_edges_by_from (organization_id, from_id),
  INDEX doc_graph_edges_by_to (organization_id, to_id)
);
CREATE TABLE IF NOT EXISTS agentic_org_doc_consult_ledger (
  doc_consult_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  doc_unit_id STRING NOT NULL,
  stage_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  consulted_at TIMESTAMPTZ NOT NULL,
  outcome STRING NULL,
  INDEX doc_consult_by_unit (doc_unit_id, consulted_at),
  INDEX doc_consult_by_work (work_item_id, consulted_at)
);
