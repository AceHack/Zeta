import { equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CockroachCoreStateMigrationName,
  CockroachTableName,
  createCockroachCoreStateMigration,
} from "./cockroach-schema.ts";

describe("cockroach core state schema", () => {
  test("declares the first authoritative state, audit, outbox, and idempotency tables", () => {
    const migration = createCockroachCoreStateMigration();

    equal(migration.name, CockroachCoreStateMigrationName.CoreStateV1);
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.WorkItems}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.SupervisorSignals}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.AuditEvents}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.OutboxEvents}`));
    ok(migration.sql.includes(`CREATE TABLE IF NOT EXISTS ${CockroachTableName.IdempotencyRecords}`));
    ok(migration.sql.includes("trace_id STRING NOT NULL"));
    ok(migration.sql.includes("correlation_id STRING NOT NULL"));
    ok(migration.sql.includes("envelope_json JSONB NOT NULL"));
    ok(migration.sql.includes("claimed_at TIMESTAMPTZ"));
    ok(migration.sql.includes("claim_expires_at TIMESTAMPTZ"));
    ok(migration.sql.includes("result_json JSONB NOT NULL"));
  });
});
