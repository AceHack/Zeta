import { equal, ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { InitiativeStatus, ProjectStatus, WorkItemState, WorkItemType } from "../../domain/src/index.ts";
import {
  CockroachCoreStateMigrationName,
  CockroachSchemaBackfillValue,
  CockroachTableName,
  createCockroachCoreStateMigrations,
  createCockroachCoreStateMigration,
  createCockroachOutboxClaimFenceMigration,
  createCockroachWorkAnchorKernelMigration,
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
