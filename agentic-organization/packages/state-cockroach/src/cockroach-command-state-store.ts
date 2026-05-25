import type { CommandStateStore, CommandStateStoreFactory } from "../../application/src/ports.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachCommandStateStoreStatement = {
  FindIdempotencyRecord: "find_idempotency_record",
  UpsertIdempotencyRecord: "upsert_idempotency_record",
  InsertSupervisorSignal: "insert_supervisor_signal",
  InsertAuditEvent: "insert_audit_event",
  InsertOutboxEvent: "insert_outbox_event",
} as const;

export type CockroachCommandStateStoreStatement =
  (typeof CockroachCommandStateStoreStatement)[keyof typeof CockroachCommandStateStoreStatement];

export type CockroachSqlStatement = {
  name: CockroachCommandStateStoreStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachSqlExecutor = {
  execute: <Row = Record<string, unknown>>(statement: CockroachSqlStatement) => Promise<CockroachSqlResult<Row>>;
};

export type CreateCockroachCommandStateStoreFactoryInput = {
  executor: CockroachSqlExecutor;
};

export function createCockroachCommandStateStoreFactory<Result>(
  input: CreateCockroachCommandStateStoreFactoryInput,
): CommandStateStoreFactory<Result> {
  return {
    createCommandStateStore: () => createCockroachCommandStateStore(input.executor),
  };
}

function createCockroachCommandStateStore<Result>(executor: CockroachSqlExecutor): CommandStateStore<Result> {
  return {
    findIdempotencyRecord: async (idempotencyKey) => {
      const result = await executor.execute<IdempotencyRecordRow>({
        name: CockroachCommandStateStoreStatement.FindIdempotencyRecord,
        sql: CockroachCommandStateStoreSql.FindIdempotencyRecord,
        parameters: [idempotencyKey],
      });
      const row = result.rows[0];

      if (row === undefined) {
        return undefined;
      }

      return {
        idempotencyKey: row.idempotency_key,
        requestHash: row.request_hash,
        result: row.result_json as Result,
      };
    },
    saveIdempotencyRecord: async (record) => {
      await executor.execute({
        name: CockroachCommandStateStoreStatement.UpsertIdempotencyRecord,
        sql: CockroachCommandStateStoreSql.UpsertIdempotencyRecord,
        parameters: [record.idempotencyKey, record.requestHash, record.result],
      });
    },
    appendSupervisorSignal: async (supervisorSignal) => {
      await executor.execute({
        name: CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        sql: CockroachCommandStateStoreSql.InsertSupervisorSignal,
        parameters: [
          supervisorSignal.supervisorSignalId,
          supervisorSignal.organizationId,
          supervisorSignal.projectId,
          supervisorSignal.teamId,
          supervisorSignal.sourceLevel,
          supervisorSignal.targetLevel,
          supervisorSignal.targetHatAssignmentId,
          supervisorSignal.sender.agentId,
          supervisorSignal.sender.hatAssignmentId,
          supervisorSignal.toolType,
          supervisorSignal.status,
          supervisorSignal.title,
          supervisorSignal.message,
          supervisorSignal.relatedWorkItemId,
          supervisorSignal.createdAt,
        ],
      });
    },
    appendAuditEvent: async (auditEvent) => {
      await executor.execute({
        name: CockroachCommandStateStoreStatement.InsertAuditEvent,
        sql: CockroachCommandStateStoreSql.InsertAuditEvent,
        parameters: [
          auditEvent.auditEventId,
          auditEvent.eventName,
          auditEvent.aggregateId,
          auditEvent.actor.agentId,
          auditEvent.actor.hatAssignmentId,
          auditEvent.occurredAt,
        ],
      });
    },
    appendOutboxEvent: async (outboxEvent) => {
      await executor.execute({
        name: CockroachCommandStateStoreStatement.InsertOutboxEvent,
        sql: CockroachCommandStateStoreSql.InsertOutboxEvent,
        parameters: [
          outboxEvent.outboxEventId,
          outboxEvent.envelope.eventId,
          outboxEvent.envelope.eventType,
          outboxEvent.envelope.scope.organizationId,
          outboxEvent.envelope.scope.projectId,
          outboxEvent.envelope.scope.workItemId,
          outboxEvent.envelope.trace.traceId,
          outboxEvent.envelope.trace.correlationId,
          outboxEvent.envelope,
        ],
      });
    },
  };
}

type IdempotencyRecordRow = {
  idempotency_key: string;
  request_hash: string;
  result_json: unknown;
};

const CockroachCommandStateStoreSql = {
  FindIdempotencyRecord: `
    SELECT idempotency_key, request_hash, result_json
    FROM ${CockroachTableName.IdempotencyRecords}
    WHERE idempotency_key = $1
  `,
  UpsertIdempotencyRecord: `
    UPSERT INTO ${CockroachTableName.IdempotencyRecords} (
      idempotency_key,
      request_hash,
      result_json
    ) VALUES ($1, $2, $3)
  `,
  InsertSupervisorSignal: `
    INSERT INTO ${CockroachTableName.SupervisorSignals} (
      supervisor_signal_id,
      organization_id,
      project_id,
      team_id,
      source_level,
      target_level,
      target_hat_assignment_id,
      sender_agent_id,
      sender_hat_assignment_id,
      tool_type,
      status,
      title,
      message,
      related_work_item_id,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `,
  InsertAuditEvent: `
    INSERT INTO ${CockroachTableName.AuditEvents} (
      audit_event_id,
      event_name,
      aggregate_id,
      actor_agent_id,
      actor_hat_assignment_id,
      occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `,
  InsertOutboxEvent: `
    INSERT INTO ${CockroachTableName.OutboxEvents} (
      outbox_event_id,
      event_id,
      event_type,
      organization_id,
      project_id,
      work_item_id,
      trace_id,
      correlation_id,
      envelope_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `,
} as const;
