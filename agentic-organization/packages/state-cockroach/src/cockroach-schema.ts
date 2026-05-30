import {
  DiscussionAnchorType,
  InitiativeStatus,
  ProjectStatus,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
  HatAssignmentAuthorityState,
  WorkItemState,
  WorkItemType,
  MemoryTier,
  MemoryPhase,
  ChangeSetPhase,
  DocType,
  DocScopeKind,
  DocLifecycleState,
  DocGraphRelation,
  GraphNodeKind,
  GraphEdgeKind,
  GraphConfidence,
} from "../../domain/src/index.ts";

export const CockroachCoreStateMigrationName = {
  CoreStateV1: "0001_agentic_org_core_state",
  OutboxClaimFenceV2: "0002_agentic_org_outbox_claim_fence",
  WorkAnchorKernelV3: "0003_agentic_org_work_anchor_kernel",
  WorkItemStateHistoryMetadataV4: "0004_agentic_org_work_item_state_history_metadata",
  DiscussionAnchorKernelV5: "0005_agentic_org_discussion_anchor_kernel",
  DecisionRecordKernelV6: "0006_agentic_org_decision_record_kernel",
  WorkScheduleBlockKernelV7: "0007_agentic_org_work_schedule_block_kernel",
  HatAssignmentAuthorityProjectionV8: "0008_agentic_org_hat_assignment_authority_projection",
  ReactionPlanExecutionLifecycleV9: "0009_agentic_org_reaction_plan_execution_lifecycle",
  QualityGateEvaluationKernelV10: "0010_agentic_org_quality_gate_evaluation_kernel",
  ControlPlaneKeepAliveV11: "0011_agentic_org_control_plane_keep_alive",
  AgentLivenessV12: "0012_agentic_org_agent_liveness",
  HindsightMemoryV13: "0013_agentic_org_hindsight_memory",
  HermesRunV14: "0014_agentic_org_hermes_run",
  OrgSystemV15: "0015_agentic_org_org_system",
  MemorySystemV16: "0016_agentic_org_memory_system",
  ChangeControlV17: "0017_agentic_org_change_control",
  DocumentIntelligenceV18: "0018_agentic_org_document_intelligence",
  KnowledgeGraphV19: "0019_agentic_org_knowledge_graph",
  TenantConfigV20: "0020_agentic_org_tenant_config",
} as const;

export type CockroachCoreStateMigrationName =
  (typeof CockroachCoreStateMigrationName)[keyof typeof CockroachCoreStateMigrationName];

export const CockroachTableName = {
  Projects: "agentic_org_projects",
  Initiatives: "agentic_org_initiatives",
  WorkItems: "agentic_org_work_items",
  WorkAnchorTargets: "agentic_org_work_anchor_targets",
  WorkItemStateHistory: "agentic_org_work_item_state_history",
  DiscussionAnchors: "agentic_org_discussion_anchors",
  DecisionRecords: "agentic_org_decision_records",
  QualityGateEvaluations: "agentic_org_quality_gate_evaluations",
  WorkScheduleBlocks: "agentic_org_work_schedule_blocks",
  HatAssignmentAuthorities: "agentic_org_hat_assignment_authorities",
  SupervisorSignals: "agentic_org_supervisor_signals",
  AuditEvents: "agentic_org_audit_events",
  InboxReceipts: "agentic_org_inbox_receipts",
  OutboxEvents: "agentic_org_outbox_events",
  ReactionPlans: "agentic_org_reaction_plans",
  IdempotencyRecords: "agentic_org_idempotency_records",
  PolicyObservations: "agentic_org_policy_observations",
  ControlPlaneHeartbeat: "agentic_org_control_plane_heartbeat",
  ControlPlaneAlerts: "agentic_org_control_plane_alerts",
  AgentHeartbeat: "agentic_org_agent_heartbeat",
  HindsightMemory: "agentic_org_hindsight_memory",
  HermesRun: "agentic_org_hermes_run",
  OrgEvents: "agentic_org_org_events",
  HatBindings: "agentic_org_hat_bindings",
  MemoryState: "agentic_org_memory_state",
  MemoryInjection: "agentic_org_memory_injection",
  ChangeSets: "agentic_org_change_sets",
  ReviewStageStatus: "agentic_org_review_stage_status",
  DocSources: "agentic_org_doc_sources",
  DocUnits: "agentic_org_doc_units",
  DocEntities: "agentic_org_doc_entities",
  DocGraphEdges: "agentic_org_doc_graph_edges",
  DocConsultLedger: "agentic_org_doc_consult_ledger",
  GraphNodes: "agentic_org_graph_nodes",
  GraphEdges: "agentic_org_graph_edges",
  TenantConfig: "agentic_org_tenant_config",
} as const;

export type CockroachTableName = (typeof CockroachTableName)[keyof typeof CockroachTableName];

export const CockroachCheckConstraintName = {
  ProjectStatus: "agentic_org_projects_status_check",
  InitiativeStatus: "agentic_org_initiatives_status_check",
  WorkItemType: "agentic_org_work_items_work_item_type_check",
  WorkItemState: "agentic_org_work_items_state_check",
  WorkItemStateHistoryFromState: "agentic_org_work_item_state_history_from_state_check",
  WorkItemStateHistorySequencePositive: "agentic_org_work_item_state_history_sequence_positive_check",
  WorkItemStateHistoryToState: "agentic_org_work_item_state_history_to_state_check",
  DiscussionAnchorType: "agentic_org_discussion_anchors_type_check",
  QualityGateKind: "agentic_org_quality_gate_evaluations_kind_check",
  QualityGateOutcome: "agentic_org_quality_gate_evaluations_outcome_check",
  ScheduleBlockType: "agentic_org_work_schedule_blocks_type_check",
  ScheduleBlockState: "agentic_org_work_schedule_blocks_state_check",
  HatAssignmentAuthorityState: "agentic_org_hat_assignment_authorities_state_check",
  MemoryStateTier: "agentic_org_memory_state_tier_check",
  MemoryStatePhase: "agentic_org_memory_state_phase_check",
  ChangeSetPhase: "agentic_org_change_sets_phase_check",
  DocUnitType: "agentic_org_doc_units_type_check",
  DocUnitScopeKind: "agentic_org_doc_units_scope_kind_check",
  DocUnitStatus: "agentic_org_doc_units_status_check",
  DocGraphEdgeRelation: "agentic_org_doc_graph_edges_relation_check",
  GraphNodeKind: "agentic_org_graph_nodes_kind_check",
  GraphNodeConfidence: "agentic_org_graph_nodes_confidence_check",
  GraphEdgeKind: "agentic_org_graph_edges_kind_check",
  GraphEdgeConfidence: "agentic_org_graph_edges_confidence_check",
} as const;

export type CockroachCheckConstraintName =
  (typeof CockroachCheckConstraintName)[keyof typeof CockroachCheckConstraintName];

export const CockroachSchemaBackfillValue = {
  WorkItemTypeTask: WorkItemType.Task,
  Version: "1",
  Trace: "migration-backfill",
} as const;

export type CockroachSchemaBackfillValue =
  (typeof CockroachSchemaBackfillValue)[keyof typeof CockroachSchemaBackfillValue];

export type CockroachSchemaMigration = {
  name: CockroachCoreStateMigrationName;
  sql: string;
};

export function createCockroachCoreStateMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.CoreStateV1,
    sql: [
      createLegacyWorkItemsTableSql(),
      createSupervisorSignalsTableSql(),
      createAuditEventsTableSql(),
      createOutboxEventsTableSql(),
      createInboxReceiptsTableSql(),
      createReactionPlansTableSql(),
      createIdempotencyRecordsTableSql(),
      createPolicyObservationsTableSql(),
    ].join("\n\n"),
  };
}

export function createCockroachOutboxClaimFenceMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.OutboxClaimFenceV2,
    sql: createOutboxClaimFenceMigrationSql(),
  };
}

export function createCockroachWorkAnchorKernelMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.WorkAnchorKernelV3,
    sql: createWorkAnchorKernelMigrationSql(),
  };
}

export function createCockroachCoreStateMigrations(): readonly CockroachSchemaMigration[] {
  return [
    createCockroachCoreStateMigration(),
    createCockroachOutboxClaimFenceMigration(),
    createCockroachWorkAnchorKernelMigration(),
    createCockroachWorkItemStateHistoryMetadataMigration(),
    createCockroachDiscussionAnchorKernelMigration(),
    createCockroachDecisionRecordKernelMigration(),
    createCockroachWorkScheduleBlockKernelMigration(),
    createCockroachHatAssignmentAuthorityProjectionMigration(),
    createCockroachReactionPlanExecutionLifecycleMigration(),
    createCockroachQualityGateEvaluationKernelMigration(),
    createCockroachControlPlaneKeepAliveMigration(),
    createCockroachAgentLivenessMigration(),
    createCockroachHindsightMemoryMigration(),
    createCockroachHermesRunMigration(),
    createCockroachOrgSystemMigration(),
    createCockroachMemorySystemMigration(),
    createCockroachChangeControlMigration(),
    createCockroachDocumentIntelligenceMigration(),
    createCockroachKnowledgeGraphMigration(),
    createCockroachTenantConfigMigration(),
  ];
}

export function createCockroachWorkItemStateHistoryMetadataMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.WorkItemStateHistoryMetadataV4,
    sql: createWorkItemStateHistoryMetadataMigrationSql(),
  };
}

export function createCockroachDiscussionAnchorKernelMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.DiscussionAnchorKernelV5,
    sql: createDiscussionAnchorsTableSql(),
  };
}

export function createCockroachDecisionRecordKernelMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.DecisionRecordKernelV6,
    sql: createDecisionRecordsTableSql(),
  };
}

export function createCockroachWorkScheduleBlockKernelMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.WorkScheduleBlockKernelV7,
    sql: createWorkScheduleBlocksTableSql(),
  };
}

export function createCockroachHatAssignmentAuthorityProjectionMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.HatAssignmentAuthorityProjectionV8,
    sql: createHatAssignmentAuthorityProjectionTableSql(),
  };
}

export function createCockroachReactionPlanExecutionLifecycleMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.ReactionPlanExecutionLifecycleV9,
    sql: createReactionPlanExecutionLifecycleMigrationSql(),
  };
}

export function createCockroachQualityGateEvaluationKernelMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.QualityGateEvaluationKernelV10,
    sql: createQualityGateEvaluationsTableSql(),
  };
}

/**
 * Control-plane keep-alive tables — the durable substrate for the operator's
 * #1 tenet ("drive the organization to stay alive"). Two tables, two change
 * rates (DV2.0 split):
 *   - heartbeat: ONE row per org, UPSERTed every keep-alive tick. last_tick_at
 *     advancing IS the org's observable proof of life ("SELECT last_tick_at").
 *   - alerts: append-only log of self-heal signals (org stall, stale-work
 *     reassignment, lease reap) the deterministic engine emitted.
 */
export function createCockroachControlPlaneKeepAliveMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.ControlPlaneKeepAliveV11,
    sql: [createControlPlaneHeartbeatTableSql(), createControlPlaneAlertsTableSql()].join("\n\n"),
  };
}

/**
 * Agent liveness — the second half of the keep-alive tenet ("drive the agents
 * to stay alive"). One row per (org, agent): an agent session UPSERTs its
 * heartbeat as it works. The keep-alive engine reads these, and a heartbeat
 * older than its deadline_ms marks the agent stale -> its work is flagged for
 * reassignment (an agent-decidable follow-up; the control plane only signals).
 */
export function createCockroachAgentLivenessMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.AgentLivenessV12,
    sql: createAgentHeartbeatTableSql(),
  };
}

/**
 * Hindsight memory — the durable substrate for "set up hermes... the memory".
 * An agent retains what it learned (attributed by hat assignment); recall is
 * SCOPED by project (Organization memory policy: scoped recall, never global);
 * attribution is STICKY (a memory keeps its original author even when recalled
 * by another hat). The Cockroach Memory adapter persists this across restarts.
 */
export function createCockroachHindsightMemoryMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.HindsightMemoryV13,
    sql: createHindsightMemoryTableSql(),
  };
}

/**
 * Hermes runs — the durable, auditable record of every agent run (the autonomous
 * data plane). One row per run: the Organization binding (work item, agent,
 * session, hat, prompt-flow run), the run state (running/completed/failed), the
 * last heartbeat, and the outcome/failure. The Cockroach Hermes runtime adapter
 * persists this across restarts so the org has a durable history of who ran on
 * what and how it ended.
 */
export function createCockroachHermesRunMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.HermesRunV14,
    sql: createHermesRunTableSql(),
  };
}

export function createCockroachOrgSystemMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.OrgSystemV15,
    sql: `${createOrgEventsTableSql()}\n${createHatBindingsTableSql()}`,
  };
}

/**
 * Memory system (MEM2) — the STATE satellite of the dynamic-memory loop. CONTENT
 * (the embedded memory text) lives in Hindsight; this table holds the immutable
 * content-addressing (tier/scope/key) plus the mutable weight/lifecycle signals
 * that drive retrieval. memory_state joins back to Hindsight by memory_id. The
 * injection ledger records every memory surfaced into a turn (citation + utility).
 */
export function createCockroachMemorySystemMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.MemorySystemV16,
    sql: `${createMemoryStateTableSql()}\n${createMemoryInjectionTableSql()}`,
  };
}

function createMemoryStateTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.MemoryState} (
  memory_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  tier STRING NOT NULL,
  scope STRING NOT NULL,
  key STRING NOT NULL,
  phase STRING NOT NULL,
  confidence FLOAT8 NOT NULL,
  weight FLOAT8 NOT NULL,
  freshness_at TIMESTAMPTZ NOT NULL,
  reinforcement_count INT8 NOT NULL,
  protected BOOL NOT NULL,
  written_by STRING NOT NULL,
  written_at TIMESTAMPTZ NOT NULL,
  context_hint STRING NULL,
  outcome JSONB NOT NULL,
  utility JSONB NOT NULL,
  cross_scope JSONB NOT NULL,
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT ${CockroachCheckConstraintName.MemoryStateTier} CHECK (tier IN (${createSqlStringList(Object.values(MemoryTier))})),
  CONSTRAINT ${CockroachCheckConstraintName.MemoryStatePhase} CHECK (phase IN (${createSqlStringList(Object.values(MemoryPhase))})),
  INDEX memory_state_by_org_scope (organization_id, scope),
  INDEX memory_state_by_org_phase (organization_id, phase),
  INDEX memory_state_by_org_weight (organization_id, weight DESC)
);`.trim();
}

function createMemoryInjectionTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.MemoryInjection} (
  injection_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  memory_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  hat_id STRING NOT NULL,
  agent_id STRING NOT NULL,
  prompt_flow_run_id STRING NOT NULL,
  weight_at_injection FLOAT8 NOT NULL,
  cited BOOL NOT NULL,
  injected_at TIMESTAMPTZ NOT NULL,
  INDEX memory_injection_by_memory (memory_id, injected_at),
  INDEX memory_injection_by_work (work_item_id, injected_at),
  INDEX memory_injection_by_run (prompt_flow_run_id, injected_at)
);`.trim();
}

/**
 * Change control (CC0) — the internal review fabric. change_sets holds the
 * canonical reviewable unit (Git-agnostic artifacts + optional external
 * projections as JSONB); review_stage_status is the per-stage audit ledger
 * keyed by (change_set, stage, revision) so a revision bounce re-runs cleanly.
 * The PR/MR/card is a projection in change_sets.projections, never the source
 * of truth.
 */
export function createCockroachChangeControlMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.ChangeControlV17,
    sql: `${createChangeSetsTableSql()}\n${createReviewStageStatusTableSql()}`,
  };
}

/**
 * Document Intelligence (D0) — the typed/scoped/bindable knowledge layer. doc_units are
 * structural semantic units (not chunks) with a lifecycle + content-addressed hash +
 * provenance (the ChangeSet that introduced them); doc_sources hold connector cursors;
 * doc_entities + doc_graph_edges are the entity/knowledge graph RAG lacks; the consult
 * ledger is the which-unit-helped-which-stage utility join. CHECK constraints derive
 * from the domain enums (no drift possible).
 */
export function createCockroachDocumentIntelligenceMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.DocumentIntelligenceV18,
    sql: [
      createDocSourcesTableSql(),
      createDocUnitsTableSql(),
      createDocEntitiesTableSql(),
      createDocGraphEdgesTableSql(),
      createDocConsultLedgerTableSql(),
    ].join("\n"),
  };
}

/**
 * Knowledge graph (G0) — the unified node/edge substrate. Every node + edge carries a
 * confidence tier (extracted/inferred/verified/canonical/retracted) + provenance JSONB, so
 * "a parser proved it" and "an agent guessed it" are distinguishable. Ids are content-addressed
 * (re-extraction updates in place). CHECK constraints derive from the domain enums.
 */
export function createCockroachKnowledgeGraphMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.KnowledgeGraphV19,
    sql: [createGraphNodesTableSql(), createGraphEdgesTableSql()].join("\n"),
  };
}

/**
 * Tenant configuration (C0) — the org as a configurable runtime. One row per org; the whole
 * config (autonomy dial, workflow pipelines, handbook bindings, enabled skills) lives in a JSONB
 * blob so a tenant reshapes behavior by editing data, not code. Versioned for optimistic writes.
 */
export function createCockroachTenantConfigMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.TenantConfigV20,
    sql: `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.TenantConfig} (
  organization_id STRING PRIMARY KEY,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL
);`.trim(),
  };
}

function createGraphNodesTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.GraphNodes} (
  node_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  kind STRING NOT NULL,
  source_key STRING NOT NULL,
  label STRING NOT NULL,
  confidence STRING NOT NULL,
  provenance JSONB NOT NULL,
  attributes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  CONSTRAINT ${CockroachCheckConstraintName.GraphNodeKind} CHECK (kind IN (${createSqlStringList(Object.values(GraphNodeKind))})),
  CONSTRAINT ${CockroachCheckConstraintName.GraphNodeConfidence} CHECK (confidence IN (${createSqlStringList(Object.values(GraphConfidence))})),
  INDEX graph_nodes_by_org_kind (organization_id, kind),
  INDEX graph_nodes_by_source (organization_id, source_key)
);`.trim();
}

function createGraphEdgesTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.GraphEdges} (
  edge_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  from_node_id STRING NOT NULL,
  to_node_id STRING NOT NULL,
  kind STRING NOT NULL,
  confidence STRING NOT NULL,
  provenance JSONB NOT NULL,
  change_set_id STRING NULL,
  retraction_reason STRING NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  CONSTRAINT ${CockroachCheckConstraintName.GraphEdgeKind} CHECK (kind IN (${createSqlStringList(Object.values(GraphEdgeKind))})),
  CONSTRAINT ${CockroachCheckConstraintName.GraphEdgeConfidence} CHECK (confidence IN (${createSqlStringList(Object.values(GraphConfidence))})),
  INDEX graph_edges_by_from (organization_id, from_node_id, kind),
  INDEX graph_edges_by_to (organization_id, to_node_id, kind),
  INDEX graph_edges_by_change_set (change_set_id)
);`.trim();
}

function createDocSourcesTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocSources} (
  doc_source_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  connector_kind STRING NOT NULL,
  label STRING NOT NULL,
  sync_cursor STRING NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  INDEX doc_sources_by_org (organization_id)
);`.trim();
}

function createDocUnitsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocUnits} (
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
  CONSTRAINT ${CockroachCheckConstraintName.DocUnitType} CHECK (type IN (${createSqlStringList(Object.values(DocType))})),
  CONSTRAINT ${CockroachCheckConstraintName.DocUnitScopeKind} CHECK (scope_kind IN (${createSqlStringList(Object.values(DocScopeKind))})),
  CONSTRAINT ${CockroachCheckConstraintName.DocUnitStatus} CHECK (status IN (${createSqlStringList(Object.values(DocLifecycleState))})),
  INDEX doc_units_by_org_scope (organization_id, scope_kind, scope_id),
  INDEX doc_units_by_org_status (organization_id, status),
  INDEX doc_units_by_content_hash (organization_id, content_hash)
);`.trim();
}

function createDocEntitiesTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocEntities} (
  doc_entity_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  canonical_name STRING NOT NULL,
  kind STRING NOT NULL,
  aliases JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  INDEX doc_entities_by_org_kind (organization_id, kind)
);`.trim();
}

function createDocGraphEdgesTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocGraphEdges} (
  doc_graph_edge_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  from_id STRING NOT NULL,
  to_id STRING NOT NULL,
  relation STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ${CockroachCheckConstraintName.DocGraphEdgeRelation} CHECK (relation IN (${createSqlStringList(Object.values(DocGraphRelation))})),
  INDEX doc_graph_edges_by_from (organization_id, from_id),
  INDEX doc_graph_edges_by_to (organization_id, to_id)
);`.trim();
}

function createDocConsultLedgerTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocConsultLedger} (
  doc_consult_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  doc_unit_id STRING NOT NULL,
  stage_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  consulted_at TIMESTAMPTZ NOT NULL,
  outcome STRING NULL,
  INDEX doc_consult_by_unit (doc_unit_id, consulted_at),
  INDEX doc_consult_by_work (work_item_id, consulted_at)
);`.trim();
}

function createChangeSetsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.ChangeSets} (
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
  CONSTRAINT ${CockroachCheckConstraintName.ChangeSetPhase} CHECK (phase IN (${createSqlStringList(Object.values(ChangeSetPhase))})),
  INDEX change_sets_by_work (work_item_id),
  INDEX change_sets_by_org_phase (organization_id, phase)
);`.trim();
}

function createReviewStageStatusTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.ReviewStageStatus} (
  change_set_id STRING NOT NULL,
  stage_id STRING NOT NULL,
  revision INT8 NOT NULL,
  outcome STRING NULL,
  decided_by STRING NULL,
  decided_at TIMESTAMPTZ NULL,
  PRIMARY KEY (change_set_id, stage_id, revision)
);`.trim();
}

function createOrgEventsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.OrgEvents} (
  org_event_id STRING PRIMARY KEY,
  kind STRING NOT NULL,
  organization_id STRING NOT NULL,
  actor_hat_id STRING NULL,
  actor_agent_id STRING NULL,
  department_id STRING NULL,
  subject_id STRING NOT NULL,
  from_state STRING NULL,
  to_state STRING NULL,
  decision STRING NOT NULL,
  supervisor_chain JSONB NOT NULL,
  evidence_refs JSONB NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  INDEX org_events_by_org_time (organization_id, occurred_at),
  INDEX org_events_by_subject (subject_id, occurred_at)
);`.trim();
}

function createHatBindingsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.HatBindings} (
  binding_id STRING PRIMARY KEY,
  hat_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  wearer_agent_id STRING NOT NULL,
  phase STRING NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL,
  warmup_ends_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  cooldown_until TIMESTAMPTZ NULL,
  reason STRING NULL,
  INDEX hat_bindings_by_org_phase (organization_id, phase),
  INDEX hat_bindings_by_hat (hat_id, phase)
);`.trim();
}

function createControlPlaneHeartbeatTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.ControlPlaneHeartbeat} (
  organization_id STRING PRIMARY KEY,
  last_tick_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL
);`.trim();
}

function createControlPlaneAlertsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.ControlPlaneAlerts} (
  control_plane_alert_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  kind STRING NOT NULL,
  detail_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);`.trim();
}

function createAgentHeartbeatTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.AgentHeartbeat} (
  organization_id STRING NOT NULL,
  agent_id STRING NOT NULL,
  hat_assignment_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  deadline_ms INT8 NOT NULL,
  version INT8 NOT NULL,
  PRIMARY KEY (organization_id, agent_id)
);`.trim();
}

function createHindsightMemoryTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.HindsightMemory} (
  memory_id STRING PRIMARY KEY,
  agent_id STRING NOT NULL,
  hat_assignment_id STRING NOT NULL,
  project_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  prompt_flow_run_id STRING NOT NULL,
  content STRING NOT NULL,
  retained_at TIMESTAMPTZ NOT NULL
);`.trim();
}

function createHermesRunTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.HermesRun} (
  run_id STRING PRIMARY KEY,
  work_item_id STRING NOT NULL,
  agent_id STRING NOT NULL,
  session_id STRING NOT NULL,
  hat_assignment_id STRING NOT NULL,
  prompt_flow_run_id STRING NOT NULL,
  state STRING NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  outcome_summary STRING,
  outcome_evidence_refs JSONB,
  failure_reason STRING
);`.trim();
}

function createProjectsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.Projects} (
  project_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  name STRING NOT NULL,
  status STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.ProjectStatus} CHECK (status IN (${createSqlStringList(Object.values(ProjectStatus))})),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);`.trim();
}

function createInitiativesTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.Initiatives} (
  initiative_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  title STRING NOT NULL,
  status STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.InitiativeStatus} CHECK (status IN (${createSqlStringList(Object.values(InitiativeStatus))})),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);`.trim();
}

function createLegacyWorkItemsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkItems} (
  work_item_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  title STRING NOT NULL,
  description STRING NOT NULL,
  state STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_agent_id STRING NOT NULL,
  created_by_hat_assignment_id STRING NOT NULL
);`.trim();
}

function createWorkAnchorTargetsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkAnchorTargets} (
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
);`.trim();
}

function createWorkItemStateHistoryTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkItemStateHistory} (
  work_state_transition_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  work_item_id STRING NOT NULL,
  sequence INT8 NOT NULL CONSTRAINT ${CockroachCheckConstraintName.WorkItemStateHistorySequencePositive} CHECK (sequence > 0),
  from_state STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.WorkItemStateHistoryFromState} CHECK (from_state IN (${createSqlStringList(Object.values(WorkItemState))})),
  to_state STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.WorkItemStateHistoryToState} CHECK (to_state IN (${createSqlStringList(Object.values(WorkItemState))})),
  evidence_artifact_ids JSONB NOT NULL,
  assigned_engineer_hat_assignment_id STRING,
  scheduled_work_block_id STRING,
  transitioned_at TIMESTAMPTZ NOT NULL,
  transitioned_by_agent_id STRING NOT NULL,
  transitioned_by_hat_assignment_id STRING NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL,
  UNIQUE (work_item_id, sequence)
);`.trim();
}

function createSupervisorSignalsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.SupervisorSignals} (
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
);`.trim();
}

function createDiscussionAnchorsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DiscussionAnchors} (
  discussion_anchor_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  work_item_id STRING NOT NULL,
  discussion_anchor_type STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.DiscussionAnchorType} CHECK (discussion_anchor_type IN (${createSqlStringList(SupportedDiscussionAnchorTypes)})),
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
);`.trim();
}

function createDecisionRecordsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.DecisionRecords} (
  decision_record_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  work_item_id STRING NOT NULL,
  discussion_anchor_id STRING NOT NULL,
  title STRING NOT NULL,
  decision STRING NOT NULL,
  rationale STRING NOT NULL,
  alternatives_considered JSONB NOT NULL,
  follow_up_work_item_ids JSONB NOT NULL,
  decided_by_agent_id STRING NOT NULL,
  decided_by_hat_assignment_id STRING NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);`.trim();
}

function createWorkScheduleBlocksTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkScheduleBlocks} (
  work_schedule_block_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  work_item_id STRING NOT NULL,
  discussion_anchor_id STRING,
  assigned_agent_id STRING NOT NULL,
  assigned_hat_assignment_id STRING NOT NULL,
  block_type STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.ScheduleBlockType} CHECK (block_type IN (${createSqlStringList(Object.values(ScheduleBlockType))})),
  state STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.ScheduleBlockState} CHECK (state IN (${createSqlStringList(Object.values(ScheduleBlockState))})),
  title STRING NOT NULL,
  purpose STRING NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  scheduled_by_agent_id STRING NOT NULL,
  scheduled_by_hat_assignment_id STRING NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);`.trim();
}

function createQualityGateEvaluationsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.QualityGateEvaluations} (
  quality_gate_evaluation_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  work_item_id STRING NOT NULL,
  discussion_anchor_id STRING NOT NULL,
  gate_kind STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.QualityGateKind} CHECK (gate_kind IN (${createSqlStringList(Object.values(QualityGateKind))})),
  outcome STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.QualityGateOutcome} CHECK (outcome IN (${createSqlStringList(Object.values(QualityGateOutcome))})),
  summary STRING NOT NULL,
  evaluated_artifact_ids JSONB NOT NULL,
  business_rule_results JSONB NOT NULL,
  evaluated_by_agent_id STRING NOT NULL,
  evaluated_by_hat_assignment_id STRING NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);`.trim();
}

function createAuditEventsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.AuditEvents} (
  audit_event_id STRING PRIMARY KEY,
  event_name STRING NOT NULL,
  aggregate_id STRING NOT NULL,
  actor_agent_id STRING NOT NULL,
  actor_hat_assignment_id STRING NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  policy_decision_id STRING,
  policy_version STRING
);`.trim();
}

function createOutboxEventsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.OutboxEvents} (
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
);`.trim();
}

function createOutboxClaimFenceMigrationSql(): string {
  return `
ALTER TABLE IF EXISTS ${CockroachTableName.OutboxEvents}
  ADD COLUMN IF NOT EXISTS claim_id STRING;`.trim();
}

function createWorkAnchorKernelMigrationSql(): string {
  return [
    createProjectsTableSql(),
    createInitiativesTableSql(),
    createWorkAnchorTargetsTableSql(),
    createWorkItemStateHistoryTableSql(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS initiative_id STRING;`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS work_item_type STRING DEFAULT '${CockroachSchemaBackfillValue.WorkItemTypeTask}';`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS version INT8 DEFAULT ${CockroachSchemaBackfillValue.Version};`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS correlation_id STRING DEFAULT '${CockroachSchemaBackfillValue.Trace}';`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS causation_id STRING DEFAULT '${CockroachSchemaBackfillValue.Trace}';`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD COLUMN IF NOT EXISTS trace_id STRING DEFAULT '${CockroachSchemaBackfillValue.Trace}';`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ALTER COLUMN work_item_type DROP DEFAULT,
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN correlation_id DROP DEFAULT,
  ALTER COLUMN causation_id DROP DEFAULT,
  ALTER COLUMN trace_id DROP DEFAULT;`.trim(),
    `
UPDATE ${CockroachTableName.WorkItems}
  SET work_item_type = COALESCE(work_item_type, '${CockroachSchemaBackfillValue.WorkItemTypeTask}'),
      updated_at = COALESCE(updated_at, created_at),
      version = COALESCE(version, ${CockroachSchemaBackfillValue.Version}),
      correlation_id = COALESCE(correlation_id, '${CockroachSchemaBackfillValue.Trace}'),
      causation_id = COALESCE(causation_id, '${CockroachSchemaBackfillValue.Trace}'),
      trace_id = COALESCE(trace_id, '${CockroachSchemaBackfillValue.Trace}');`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ALTER COLUMN work_item_type SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN version SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL,
  ALTER COLUMN causation_id SET NOT NULL,
  ALTER COLUMN trace_id SET NOT NULL;`.trim(),
    `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}
  ADD CONSTRAINT IF NOT EXISTS ${CockroachCheckConstraintName.WorkItemType} CHECK (work_item_type IN (${createSqlStringList(Object.values(WorkItemType))})),
  ADD CONSTRAINT IF NOT EXISTS ${CockroachCheckConstraintName.WorkItemState} CHECK (state IN (${createSqlStringList(Object.values(WorkItemState))}));`.trim(),
  ].join("\n\n");
}

function createWorkItemStateHistoryMetadataMigrationSql(): string {
  return `
ALTER TABLE IF EXISTS ${CockroachTableName.WorkItemStateHistory}
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS ${CockroachTableName.WorkItemStateHistory}
  ADD COLUMN IF NOT EXISTS version INT8;

UPDATE ${CockroachTableName.WorkItemStateHistory}
  SET updated_at = COALESCE(updated_at, transitioned_at),
      version = COALESCE(version, 1);

ALTER TABLE IF EXISTS ${CockroachTableName.WorkItemStateHistory}
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN version SET NOT NULL;
`.trim();
}

const SupportedDiscussionAnchorTypes = [DiscussionAnchorType.WorkItem] as const;

function createSqlStringList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

function createIdempotencyRecordsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.IdempotencyRecords} (
  idempotency_key STRING PRIMARY KEY,
  request_hash STRING NOT NULL,
  result_json JSONB NOT NULL
);`.trim();
}

function createInboxReceiptsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.InboxReceipts} (
  event_id STRING NOT NULL,
  consumer_name STRING NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  payload_hash STRING NOT NULL,
  result STRING,
  PRIMARY KEY (event_id, consumer_name)
);`.trim();
}

function createReactionPlansTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.ReactionPlans} (
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
);`.trim();
}

function createPolicyObservationsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.PolicyObservations} (
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
);`.trim();
}

function createHatAssignmentAuthorityProjectionTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS ${CockroachTableName.HatAssignmentAuthorities} (
  hat_assignment_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  project_id STRING NOT NULL,
  team_id STRING,
  assigned_agent_id STRING NOT NULL,
  state STRING NOT NULL CONSTRAINT ${CockroachCheckConstraintName.HatAssignmentAuthorityState} CHECK (state IN (${createSqlStringList(Object.values(HatAssignmentAuthorityState))})),
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL,
  correlation_id STRING NOT NULL,
  causation_id STRING NOT NULL,
  trace_id STRING NOT NULL
);`.trim();
}

function createReactionPlanExecutionLifecycleMigrationSql(): string {
  return `
ALTER TABLE IF EXISTS ${CockroachTableName.ReactionPlans}
  ADD COLUMN IF NOT EXISTS claim_id STRING,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS result_json JSONB,
  ADD COLUMN IF NOT EXISTS failure_json JSONB,
  ADD COLUMN IF NOT EXISTS attempt_count INT8 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;`.trim();
}
