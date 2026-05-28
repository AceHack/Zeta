import { InitiativeStatus, ProjectStatus, WorkItemState, WorkItemType } from "../../domain/src/index.ts";

export const CockroachCoreStateMigrationName = {
  CoreStateV1: "0001_agentic_org_core_state",
  OutboxClaimFenceV2: "0002_agentic_org_outbox_claim_fence",
  WorkAnchorKernelV3: "0003_agentic_org_work_anchor_kernel",
} as const;

export type CockroachCoreStateMigrationName =
  (typeof CockroachCoreStateMigrationName)[keyof typeof CockroachCoreStateMigrationName];

export const CockroachTableName = {
  Projects: "agentic_org_projects",
  Initiatives: "agentic_org_initiatives",
  WorkItems: "agentic_org_work_items",
  WorkAnchorTargets: "agentic_org_work_anchor_targets",
  WorkItemStateHistory: "agentic_org_work_item_state_history",
  SupervisorSignals: "agentic_org_supervisor_signals",
  AuditEvents: "agentic_org_audit_events",
  InboxReceipts: "agentic_org_inbox_receipts",
  OutboxEvents: "agentic_org_outbox_events",
  ReactionPlans: "agentic_org_reaction_plans",
  IdempotencyRecords: "agentic_org_idempotency_records",
  PolicyObservations: "agentic_org_policy_observations",
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
  ];
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
  action_json JSONB NOT NULL
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
