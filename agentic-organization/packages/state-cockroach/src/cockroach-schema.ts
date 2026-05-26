export const CockroachCoreStateMigrationName = {
  CoreStateV1: "0001_agentic_org_core_state",
} as const;

export type CockroachCoreStateMigrationName =
  (typeof CockroachCoreStateMigrationName)[keyof typeof CockroachCoreStateMigrationName];

export const CockroachTableName = {
  WorkItems: "agentic_org_work_items",
  SupervisorSignals: "agentic_org_supervisor_signals",
  AuditEvents: "agentic_org_audit_events",
  InboxReceipts: "agentic_org_inbox_receipts",
  OutboxEvents: "agentic_org_outbox_events",
  ReactionPlans: "agentic_org_reaction_plans",
  IdempotencyRecords: "agentic_org_idempotency_records",
} as const;

export type CockroachTableName = (typeof CockroachTableName)[keyof typeof CockroachTableName];

export type CockroachSchemaMigration = {
  name: CockroachCoreStateMigrationName;
  sql: string;
};

export function createCockroachCoreStateMigration(): CockroachSchemaMigration {
  return {
    name: CockroachCoreStateMigrationName.CoreStateV1,
    sql: [
      createWorkItemsTableSql(),
      createSupervisorSignalsTableSql(),
      createAuditEventsTableSql(),
      createOutboxEventsTableSql(),
      createInboxReceiptsTableSql(),
      createReactionPlansTableSql(),
      createIdempotencyRecordsTableSql(),
    ].join("\n\n"),
  };
}

function createWorkItemsTableSql(): string {
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
  occurred_at TIMESTAMPTZ NOT NULL
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
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);`.trim();
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
