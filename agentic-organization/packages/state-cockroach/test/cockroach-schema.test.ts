import { equal, ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  InitiativeStatus,
  ProjectStatus,
  HatAssignmentAuthorityState,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
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
import {
  CockroachCoreStateMigrationName,
  CockroachSchemaBackfillValue,
  CockroachTableName,
  createCockroachCoreStateMigrations,
  createCockroachCoreStateMigration,
  createCockroachAgentLivenessMigration,
  createCockroachControlPlaneKeepAliveMigration,
  createCockroachHindsightMemoryMigration,
  createCockroachHermesRunMigration,
  createCockroachDecisionRecordKernelMigration,
  createCockroachDiscussionAnchorKernelMigration,
  createCockroachHatAssignmentAuthorityProjectionMigration,
  createCockroachOutboxClaimFenceMigration,
  createCockroachReactionPlanExecutionLifecycleMigration,
  createCockroachQualityGateEvaluationKernelMigration,
  createCockroachWorkScheduleBlockKernelMigration,
  createCockroachWorkAnchorKernelMigration,
  createCockroachWorkItemStateHistoryMetadataMigration,
  createCockroachMemorySystemMigration,
  createCockroachChangeControlMigration,
  createCockroachDocumentIntelligenceMigration,
  createCockroachKnowledgeGraphMigration,
  createCockroachTenantConfigMigration,
  createCockroachReactionPlanTraceparentMigration,
  createCockroachOrgEventTransitionContextMigration,
  createCockroachControlPlaneFlagsMigration,
  createCockroachControlPlaneRateLimitsMigration,
} from "../src/cockroach-schema.ts";

describe("cockroach core state schema", () => {
  test("declares the first authoritative state, audit, outbox, and idempotency tables", () => {
    const migration = createCockroachCoreStateMigration();

    equal(migration.name, CockroachCoreStateMigrationName.CoreStateV1);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkItems}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.SupervisorSignals}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.AuditEvents}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.OutboxEvents}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.InboxReceipts}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ReactionPlans}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.IdempotencyRecords}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.PolicyObservations}`));
    ok(migration.sql.includes("decision_status STRING NOT NULL"));
    ok(migration.sql.includes("denial_reason STRING"));
    ok(migration.sql.includes("observation_json JSONB NOT NULL"));
    ok(migration.sql.includes("observation_hash STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
    ok(migration.sql.includes("idempotency_key STRING NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("policy_decision_id STRING"));
    ok(migration.sql.includes("policy_version STRING"));
    ok(migration.sql.includes("envelope_json JSONB NOT NULL"));
    ok(migration.sql.includes("claimed_at TIMESTAMPTZ"));
    ok(migration.sql.includes("claim_expires_at TIMESTAMPTZ"));
    ok(migration.sql.includes("PRIMARY KEY (event_id, consumer_name)"));
    ok(migration.sql.includes("status STRING NOT NULL"));
    ok(migration.sql.includes("action_json JSONB NOT NULL"));
    ok(migration.sql.includes("traceparent STRING"));
    ok(migration.sql.includes("attempt_count INT8 NOT NULL DEFAULT 0"));
    ok(migration.sql.includes("next_attempt_at TIMESTAMPTZ"));
    ok(migration.sql.includes("result_json JSONB NOT NULL"));
  });

  test("declares an additive outbox claim fence migration for existing databases", () => {
    const migration = createCockroachOutboxClaimFenceMigration();

    equal(migration.name, CockroachCoreStateMigrationName.OutboxClaimFenceV2);
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.OutboxEvents}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS claim_id STRING"));
  });

  test("orders core migrations so existing databases receive additive fixes", () => {
    const migrations = createCockroachCoreStateMigrations();

    equal(migrations[0]?.name, CockroachCoreStateMigrationName.CoreStateV1);
    equal(migrations[1]?.name, CockroachCoreStateMigrationName.OutboxClaimFenceV2);
    equal(migrations[2]?.name, CockroachCoreStateMigrationName.WorkAnchorKernelV3);
    equal(migrations[3]?.name, CockroachCoreStateMigrationName.WorkItemStateHistoryMetadataV4);
    equal(migrations[4]?.name, CockroachCoreStateMigrationName.DiscussionAnchorKernelV5);
    equal(migrations[5]?.name, CockroachCoreStateMigrationName.DecisionRecordKernelV6);
    equal(migrations[6]?.name, CockroachCoreStateMigrationName.WorkScheduleBlockKernelV7);
    equal(migrations[7]?.name, CockroachCoreStateMigrationName.HatAssignmentAuthorityProjectionV8);
    equal(migrations[8]?.name, CockroachCoreStateMigrationName.ReactionPlanExecutionLifecycleV9);
    equal(migrations[9]?.name, CockroachCoreStateMigrationName.QualityGateEvaluationKernelV10);
    equal(migrations[10]?.name, CockroachCoreStateMigrationName.ControlPlaneKeepAliveV11);
    equal(migrations[11]?.name, CockroachCoreStateMigrationName.AgentLivenessV12);
    equal(migrations[12]?.name, CockroachCoreStateMigrationName.HindsightMemoryV13);
    equal(migrations[13]?.name, CockroachCoreStateMigrationName.HermesRunV14);
    equal(migrations[20]?.name, CockroachCoreStateMigrationName.ReactionPlanTraceparentV21);
    equal(migrations[21]?.name, CockroachCoreStateMigrationName.OrgEventTransitionContextV22);
    equal(migrations[22]?.name, CockroachCoreStateMigrationName.ControlPlaneFlagsV23);
    equal(migrations[23]?.name, CockroachCoreStateMigrationName.ControlPlaneRateLimitsV24);
  });

  test("declares the hermes run table (durable agent-run history)", () => {
    const migration = createCockroachHermesRunMigration();

    equal(migration.name, CockroachCoreStateMigrationName.HermesRunV14);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.HermesRun}`));
    ok(migration.sql.includes("run_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("state STRING NOT NULL"));
    ok(migration.sql.includes("last_heartbeat_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("outcome_evidence_refs JSONB"));
  });

  test("declares the hindsight memory table (durable Hindsight)", () => {
    const migration = createCockroachHindsightMemoryMigration();

    equal(migration.name, CockroachCoreStateMigrationName.HindsightMemoryV13);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.HindsightMemory}`));
    ok(migration.sql.includes("memory_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("project_id STRING NOT NULL"));
    ok(migration.sql.includes("content STRING NOT NULL"));
    ok(migration.sql.includes("retained_at TIMESTAMPTZ NOT NULL"));
  });

  test("declares the control-plane keep-alive tables (org proof-of-life + alert log)", () => {
    const migration = createCockroachControlPlaneKeepAliveMigration();

    equal(migration.name, CockroachCoreStateMigrationName.ControlPlaneKeepAliveV11);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ControlPlaneHeartbeat}`));
    ok(migration.sql.includes("organization_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("last_tick_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ControlPlaneAlerts}`));
    ok(migration.sql.includes("control_plane_alert_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("detail_json JSONB NOT NULL"));
  });

  test("declares the agent-liveness heartbeat table (one row per org+agent)", () => {
    const migration = createCockroachAgentLivenessMigration();

    equal(migration.name, CockroachCoreStateMigrationName.AgentLivenessV12);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.AgentHeartbeat}`));
    ok(migration.sql.includes("agent_id STRING NOT NULL"));
    ok(migration.sql.includes("hat_assignment_id STRING NOT NULL"));
    ok(migration.sql.includes("work_item_id STRING NOT NULL"));
    ok(migration.sql.includes("last_heartbeat_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("deadline_ms INT8 NOT NULL"));
    ok(migration.sql.includes("PRIMARY KEY (organization_id, agent_id)"));
  });

  test("declares an additive work-anchor kernel migration for existing databases", () => {
    const migration = createCockroachWorkAnchorKernelMigration();

    equal(migration.name, CockroachCoreStateMigrationName.WorkAnchorKernelV3);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.Projects}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.Initiatives}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkAnchorTargets}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkItemStateHistory}`));
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.WorkItems}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS initiative_id STRING"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS work_item_type STRING DEFAULT"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS version INT8 DEFAULT"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS correlation_id STRING DEFAULT"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS causation_id STRING DEFAULT"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS trace_id STRING DEFAULT"));
    ok(migration.sql.includes("ALTER COLUMN work_item_type DROP DEFAULT"));
    ok(!migration.sql.includes("ALTER COLUMN updated_at DROP DEFAULT"));
    ok(migration.sql.includes("ALTER COLUMN version DROP DEFAULT"));
    ok(migration.sql.includes("ALTER COLUMN correlation_id DROP DEFAULT"));
    ok(migration.sql.includes("ALTER COLUMN causation_id DROP DEFAULT"));
    ok(migration.sql.includes("ALTER COLUMN trace_id DROP DEFAULT"));
    ok(migration.sql.includes("UPDATE"));
    ok(migration.sql.includes("SET work_item_type = COALESCE"));
    ok(migration.sql.includes(`'${CockroachSchemaBackfillValue.WorkItemTypeTask}'`));
    ok(migration.sql.includes("ALTER COLUMN work_item_type SET NOT NULL"));
    ok(migration.sql.includes("ALTER COLUMN updated_at SET NOT NULL"));
    ok(migration.sql.includes("ALTER COLUMN version SET NOT NULL"));
    ok(migration.sql.includes("ALTER COLUMN correlation_id SET NOT NULL"));
    ok(migration.sql.includes("ALTER COLUMN causation_id SET NOT NULL"));
    ok(migration.sql.includes("ALTER COLUMN trace_id SET NOT NULL"));
    ok(migration.sql.includes("ADD CONSTRAINT IF NOT EXISTS"));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(WorkItemState))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(WorkItemType))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(ProjectStatus))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(InitiativeStatus))));
    ok(migration.sql.includes("CONSTRAINT agentic_org_work_item_state_history_sequence_positive_check CHECK (sequence > 0)"));
    ok(migration.sql.includes("UNIQUE (work_item_id, sequence)"));
    equal(CockroachSchemaBackfillValue.WorkItemTypeTask, WorkItemType.Task);
    ok(migration.sql.includes("updated_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("version INT8 NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("causation_id STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
    ok(migration.sql.includes("sequence INT8 NOT NULL"));
    ok(migration.sql.includes("evidence_artifact_ids JSONB NOT NULL"));
    ok(migration.sql.includes("assigned_engineer_hat_assignment_id STRING"));
    ok(migration.sql.includes("scheduled_work_block_id STRING"));
  });

  test("declares an additive work item state history metadata migration for existing databases", () => {
    const migration = createCockroachWorkItemStateHistoryMetadataMigration();

    equal(migration.name, CockroachCoreStateMigrationName.WorkItemStateHistoryMetadataV4);
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.WorkItemStateHistory}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS version INT8"));
    ok(migration.sql.includes("SET updated_at = COALESCE(updated_at, transitioned_at)"));
    ok(migration.sql.includes("version = COALESCE(version, 1)"));
    ok(migration.sql.includes("ALTER COLUMN updated_at SET NOT NULL"));
    ok(migration.sql.includes("ALTER COLUMN version SET NOT NULL"));
  });

  test("declares an additive discussion anchor kernel migration for existing databases", () => {
    const migration = createCockroachDiscussionAnchorKernelMigration();

    equal(migration.name, CockroachCoreStateMigrationName.DiscussionAnchorKernelV5);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DiscussionAnchors}`));
    ok(migration.sql.includes("discussion_anchor_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("team_id STRING"));
    ok(migration.sql.includes("work_item_id STRING NOT NULL"));
    ok(migration.sql.includes("discussion_anchor_type STRING NOT NULL"));
    ok(migration.sql.includes("CHECK (discussion_anchor_type IN ('work_item'))"));
    ok(migration.sql.includes("expected_outputs JSONB NOT NULL"));
    ok(migration.sql.includes("created_by_agent_id STRING NOT NULL"));
    ok(migration.sql.includes("created_by_hat_assignment_id STRING NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("causation_id STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
  });

  test("declares an additive decision record kernel migration for existing databases", () => {
    const migration = createCockroachDecisionRecordKernelMigration();

    equal(migration.name, CockroachCoreStateMigrationName.DecisionRecordKernelV6);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DecisionRecords}`));
    ok(migration.sql.includes("decision_record_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("discussion_anchor_id STRING NOT NULL"));
    ok(migration.sql.includes("work_item_id STRING NOT NULL"));
    ok(migration.sql.includes("decision STRING NOT NULL"));
    ok(migration.sql.includes("rationale STRING NOT NULL"));
    ok(migration.sql.includes("alternatives_considered JSONB NOT NULL"));
    ok(migration.sql.includes("follow_up_work_item_ids JSONB NOT NULL"));
    ok(migration.sql.includes("decided_by_agent_id STRING NOT NULL"));
    ok(migration.sql.includes("decided_by_hat_assignment_id STRING NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("causation_id STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
  });

  test("declares an additive work schedule block kernel migration for existing databases", () => {
    const migration = createCockroachWorkScheduleBlockKernelMigration();

    equal(migration.name, CockroachCoreStateMigrationName.WorkScheduleBlockKernelV7);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkScheduleBlocks}`));
    ok(migration.sql.includes("work_schedule_block_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("work_item_id STRING NOT NULL"));
    ok(migration.sql.includes("discussion_anchor_id STRING"));
    ok(migration.sql.includes("assigned_agent_id STRING NOT NULL"));
    ok(migration.sql.includes("assigned_hat_assignment_id STRING NOT NULL"));
    ok(migration.sql.includes("block_type STRING NOT NULL"));
    ok(migration.sql.includes("state STRING NOT NULL"));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(ScheduleBlockType))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(ScheduleBlockState))));
    ok(migration.sql.includes("starts_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("ends_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("scheduled_by_agent_id STRING NOT NULL"));
    ok(migration.sql.includes("scheduled_by_hat_assignment_id STRING NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("causation_id STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
  });

  test("declares an additive hat assignment authority projection migration for existing databases", () => {
    const migration = createCockroachHatAssignmentAuthorityProjectionMigration();

    equal(migration.name, CockroachCoreStateMigrationName.HatAssignmentAuthorityProjectionV8);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.HatAssignmentAuthorities}`));
    ok(migration.sql.includes("hat_assignment_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("hat_id STRING NOT NULL"));
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.HatAssignmentAuthorities}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS hat_id STRING NOT NULL"));
    ok(migration.sql.includes("organization_id STRING NOT NULL"));
    ok(migration.sql.includes("project_id STRING NOT NULL"));
    ok(migration.sql.includes("team_id STRING"));
    ok(migration.sql.includes("assigned_agent_id STRING NOT NULL"));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(HatAssignmentAuthorityState))));
    ok(migration.sql.includes("updated_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("version INT8 NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("causation_id STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
  });

  test("declares an additive reaction plan execution lifecycle migration for existing databases", () => {
    const migration = createCockroachReactionPlanExecutionLifecycleMigration();

    equal(migration.name, CockroachCoreStateMigrationName.ReactionPlanExecutionLifecycleV9);
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.ReactionPlans}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS claim_id STRING"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS result_json JSONB"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS failure_json JSONB"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS attempt_count INT8 NOT NULL DEFAULT 0"));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ"));
  });

  test("declares an additive reaction plan traceparent migration for existing databases", () => {
    const migration = createCockroachReactionPlanTraceparentMigration();

    equal(migration.name, CockroachCoreStateMigrationName.ReactionPlanTraceparentV21);
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.ReactionPlans}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS traceparent STRING"));
  });

  test("declares an additive quality gate evaluation kernel migration for existing databases", () => {
    const migration = createCockroachQualityGateEvaluationKernelMigration();

    equal(migration.name, CockroachCoreStateMigrationName.QualityGateEvaluationKernelV10);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.QualityGateEvaluations}`));
    ok(migration.sql.includes("quality_gate_evaluation_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("discussion_anchor_id STRING NOT NULL"));
    ok(migration.sql.includes("gate_kind STRING NOT NULL"));
    ok(migration.sql.includes("outcome STRING NOT NULL"));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(QualityGateKind))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(QualityGateOutcome))));
    ok(migration.sql.includes("evaluated_artifact_ids JSONB NOT NULL"));
    ok(migration.sql.includes("business_rule_results JSONB NOT NULL"));
    ok(migration.sql.includes("evaluated_by_agent_id STRING NOT NULL"));
    ok(migration.sql.includes("evaluated_by_hat_assignment_id STRING NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("causation_id STRING NOT NULL"));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
  });

  test("declares the memory system kernel (state + injection) with tier/phase checks", () => {
    const migration = createCockroachMemorySystemMigration();

    equal(migration.name, CockroachCoreStateMigrationName.MemorySystemV16);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.MemoryState}`));
    ok(migration.sql.includes("memory_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("weight FLOAT8 NOT NULL"));
    ok(migration.sql.includes("outcome JSONB NOT NULL"));
    ok(migration.sql.includes("utility JSONB NOT NULL"));
    ok(migration.sql.includes("cross_scope JSONB NOT NULL"));
    // CHECK constraints derive from the domain enums (no drift possible).
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(MemoryTier))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(MemoryPhase))));
    ok(migration.sql.includes("INDEX memory_state_by_org_weight (organization_id, weight DESC)"));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.MemoryInjection}`));
    ok(migration.sql.includes("injection_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("cited BOOL NOT NULL"));
    ok(migration.sql.includes("weight_at_injection FLOAT8 NOT NULL"));
  });

  test("registers the memory system migration as V16 in the ordered migration set", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 9]!.name, CockroachCoreStateMigrationName.MemorySystemV16);
  });

  test("declares the change control kernel (change_sets + review_stage_status) with phase check", () => {
    const migration = createCockroachChangeControlMigration();

    equal(migration.name, CockroachCoreStateMigrationName.ChangeControlV17);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ChangeSets}`));
    ok(migration.sql.includes("change_set_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("artifacts JSONB NOT NULL"));
    ok(migration.sql.includes("projections JSONB NOT NULL"));
    ok(migration.sql.includes("current_stage_index INT8 NOT NULL"));
    // CHECK derives from the domain enum (no drift).
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(ChangeSetPhase))));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ReviewStageStatus}`));
    ok(migration.sql.includes("PRIMARY KEY (change_set_id, stage_id, revision)"));
  });

  test("registers the change control migration as V17 in the ordered migration set", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 8]!.name, CockroachCoreStateMigrationName.ChangeControlV17);
  });

  test("declares the document intelligence kernel (doc units/sources/entities/graph/consult) with lifecycle + type checks", () => {
    const migration = createCockroachDocumentIntelligenceMigration();

    equal(migration.name, CockroachCoreStateMigrationName.DocumentIntelligenceV18);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocSources}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocUnits}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocEntities}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocGraphEdges}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.DocConsultLedger}`));
    ok(migration.sql.includes("doc_unit_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("content_hash STRING NOT NULL"));
    ok(migration.sql.includes("provenance_change_set_id STRING NULL"));
    ok(migration.sql.includes("bound_hat_ids JSONB NOT NULL"));
    ok(migration.sql.includes("bound_stage_ids JSONB NOT NULL"));
    // CHECK constraints derive from the domain enums (no drift possible).
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(DocType))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(DocScopeKind))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(DocLifecycleState))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(DocGraphRelation))));
    ok(migration.sql.includes("INDEX doc_units_by_content_hash (organization_id, content_hash)"));
  });

  test("registers the document intelligence migration as V18 in the ordered migration set", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 7]!.name, CockroachCoreStateMigrationName.DocumentIntelligenceV18);
  });

  test("declares the knowledge graph kernel (graph_nodes + graph_edges) with confidence + kind checks", () => {
    const migration = createCockroachKnowledgeGraphMigration();

    equal(migration.name, CockroachCoreStateMigrationName.KnowledgeGraphV19);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.GraphNodes}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.GraphEdges}`));
    ok(migration.sql.includes("node_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("edge_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("provenance JSONB NOT NULL"));
    ok(migration.sql.includes("change_set_id STRING NULL"));
    ok(migration.sql.includes("retraction_reason STRING NULL"));
    // CHECK constraints derive from the domain enums (no drift possible).
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(GraphNodeKind))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(GraphEdgeKind))));
    ok(migration.sql.includes(createCheckConstraintValues(Object.values(GraphConfidence))));
    ok(migration.sql.includes("INDEX graph_edges_by_change_set (change_set_id)"));
  });

  test("registers the knowledge graph migration as V19 in the ordered migration set", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 6]!.name, CockroachCoreStateMigrationName.KnowledgeGraphV19);
  });

  test("declares the tenant config table (the org as a configurable runtime)", () => {
    const migration = createCockroachTenantConfigMigration();

    equal(migration.name, CockroachCoreStateMigrationName.TenantConfigV20);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.TenantConfig}`));
    ok(migration.sql.includes("organization_id STRING PRIMARY KEY"));
    ok(migration.sql.includes("config JSONB NOT NULL"));
    ok(migration.sql.includes("version INT8 NOT NULL"));
  });

  test("registers the tenant config migration as V20 before traceparent in the ordered migration set", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 5]!.name, CockroachCoreStateMigrationName.TenantConfigV20);
  });

  test("registers the reaction plan traceparent migration as V21 before org-event transition context", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 4]!.name, CockroachCoreStateMigrationName.ReactionPlanTraceparentV21);
  });

  test("registers the org-event transition-context migration as V22 before control-plane flags", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 3]!.name, CockroachCoreStateMigrationName.OrgEventTransitionContextV22);
  });

  test("declares an additive org-event transition-context migration for existing databases", () => {
    const migration = createCockroachOrgEventTransitionContextMigration();

    equal(migration.name, CockroachCoreStateMigrationName.OrgEventTransitionContextV22);
    ok(migration.sql.includes(`ALTER TABLE IF EXISTS ${CockroachTableName.OrgEvents}`));
    ok(migration.sql.includes("ADD COLUMN IF NOT EXISTS transition_context JSONB"));
  });

  test("registers control-plane rate limits as V24 after control-plane flags", () => {
    const all = createCockroachCoreStateMigrations();
    equal(all[all.length - 2]!.name, CockroachCoreStateMigrationName.ControlPlaneFlagsV23);
    equal(all[all.length - 1]!.name, CockroachCoreStateMigrationName.ControlPlaneRateLimitsV24);
  });

  test("declares the control-plane flags table for ESTOP, freezes, budgets, providers, and simulator mode", () => {
    const migration = createCockroachControlPlaneFlagsMigration();

    equal(migration.name, CockroachCoreStateMigrationName.ControlPlaneFlagsV23);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ControlPlaneFlags}`));
    ok(migration.sql.includes("control_plane_flag_id STRING NOT NULL"));
    ok(migration.sql.includes("PRIMARY KEY (organization_id, control_plane_flag_id)"));
    ok(migration.sql.includes("scope_kind STRING NOT NULL"));
    ok(migration.sql.includes("scope_id STRING NULL"));
    ok(migration.sql.includes("flag STRING NOT NULL"));
    ok(migration.sql.includes("set_by_hat_id STRING NOT NULL"));
    ok(migration.sql.includes("expires_at TIMESTAMPTZ NULL"));
    ok(migration.sql.includes("agentic_org_control_plane_flags_scope_kind_check"));
    ok(migration.sql.includes("agentic_org_control_plane_flags_flag_check"));
    ok(migration.sql.includes("control_plane_flags_by_org_flag"));
    ok(migration.sql.includes("control_plane_flags_by_org_scope"));
  });

  test("declares the control-plane rate limits table for tenant-scoped production throttles", () => {
    const migration = createCockroachControlPlaneRateLimitsMigration();

    equal(migration.name, CockroachCoreStateMigrationName.ControlPlaneRateLimitsV24);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.ControlPlaneRateLimits}`));
    ok(migration.sql.includes("control_plane_rate_limit_id STRING NOT NULL"));
    ok(migration.sql.includes("PRIMARY KEY (organization_id, control_plane_rate_limit_id)"));
    ok(migration.sql.includes("scope_kind STRING NOT NULL"));
    ok(migration.sql.includes("scope_id STRING NULL"));
    ok(migration.sql.includes("kind STRING NOT NULL"));
    ok(migration.sql.includes("window_started_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("window_ends_at TIMESTAMPTZ NOT NULL"));
    ok(migration.sql.includes("limit_count INT8 NOT NULL"));
    ok(migration.sql.includes("used_count INT8 NOT NULL"));
    ok(migration.sql.includes("agentic_org_control_plane_rate_limits_scope_kind_check"));
    ok(migration.sql.includes("agentic_org_control_plane_rate_limits_kind_check"));
    ok(migration.sql.includes("agentic_org_control_plane_rate_limits_scope_shape_check"));
    ok(migration.sql.includes("agentic_org_control_plane_rate_limits_window_order_check"));
    ok(migration.sql.includes("agentic_org_control_plane_rate_limits_counts_check"));
    ok(migration.sql.includes("control_plane_rate_limits_by_org_window"));
    ok(migration.sql.includes("control_plane_rate_limits_by_org_scope"));
  });

  test("keeps generated migrations synchronized with checked-in SQL files", async () => {
    for (const migration of createCockroachCoreStateMigrations()) {
      equal(normalizeSql(migration.sql), normalizeSql(await readMigrationSqlFile(migration.name)));
    }
  });
});

function createCheckConstraintValues(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

async function readMigrationSqlFile(migrationName: CockroachCoreStateMigrationName): Promise<string> {
  return readFile(fileURLToPath(new URL(`../migrations/${migrationName}.sql`, import.meta.url)), "utf8");
}

function normalizeSql(sql: string): string {
  return sql.replace(/\r\n/g, "\n").trim();
}
