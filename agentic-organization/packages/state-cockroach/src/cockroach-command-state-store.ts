import {
  CommandOutcomePersistenceStatus,
  type CommandStateStore,
  type CommandStateStoreFactory,
} from "../../application/src/ports.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachCommandStateStoreStatement = {
  FindIdempotencyRecord: "find_idempotency_record",
  ClaimIdempotencyRecord: "claim_idempotency_record",
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

export type CockroachSqlTransactionExecutor = {
  execute: <Row = Record<string, unknown>>(statement: CockroachSqlStatement) => Promise<CockroachSqlResult<Row>>;
};

export type CockroachSqlExecutor = {
  execute: <Row = Record<string, unknown>>(statement: CockroachSqlStatement) => Promise<CockroachSqlResult<Row>>;
  executeTransaction: <Result>(
    operation: (executor: CockroachSqlTransactionExecutor) => Promise<Result>,
  ) => Promise<Result>;
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
    recordCommandOutcome: async (outcome) => {
      return await executor.executeTransaction(async (transaction) => {
        const claimResult = await transaction.execute<CockroachIdempotencyClaimRow<Result>>({
          name: CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
          sql: CockroachCommandStateStoreSql.ClaimIdempotencyRecord,
          parameters: [
            outcome.idempotencyRecord.idempotencyKey,
            outcome.idempotencyRecord.requestHash,
            outcome.idempotencyRecord.result,
          ],
        });
        const claim = claimResult.rows[0];
        const claimStatus = claim?.persistence_status ?? CommandOutcomePersistenceStatus.IdempotencyConflict;

        if (claimStatus === CommandOutcomePersistenceStatus.Replayed) {
          return {
            status: CommandOutcomePersistenceStatus.Replayed,
            result: claim?.result_json as Result,
          };
        }

        if (claimStatus === CommandOutcomePersistenceStatus.IdempotencyConflict) {
          if (claim?.request_hash === undefined || claim.request_hash === null) {
            return {
              status: CommandOutcomePersistenceStatus.IdempotencyConflict,
            };
          }

          return {
            status: CommandOutcomePersistenceStatus.IdempotencyConflict,
            existingRequestHash: claim.request_hash,
          };
        }

        for (const supervisorSignal of outcome.effects.supervisorSignals) {
          await transaction.execute(createInsertSupervisorSignalStatement(supervisorSignal));
        }

        for (const auditEvent of outcome.effects.auditEvents) {
          await transaction.execute(createInsertAuditEventStatement(auditEvent));
        }

        for (const outboxEvent of outcome.effects.outboxEvents) {
          await transaction.execute(createInsertOutboxEventStatement(outboxEvent));
        }

        return {
          status: CommandOutcomePersistenceStatus.Committed,
          result: outcome.idempotencyRecord.result,
        };
      });
    },
  };
}

type CommandStateStoreResult<Result> = Parameters<CommandStateStore<Result>["recordCommandOutcome"]>[0];

function createInsertSupervisorSignalStatement(
  supervisorSignal: CommandStateStoreResult<unknown>["effects"]["supervisorSignals"][number],
): CockroachSqlStatement {
  return {
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
  };
}

function createInsertAuditEventStatement(
  auditEvent: CommandStateStoreResult<unknown>["effects"]["auditEvents"][number],
): CockroachSqlStatement {
  return {
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
  };
}

function createInsertOutboxEventStatement(
  outboxEvent: CommandStateStoreResult<unknown>["effects"]["outboxEvents"][number],
): CockroachSqlStatement {
  return {
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
  };
}

type IdempotencyRecordRow = {
  idempotency_key: string;
  request_hash: string;
  result_json: unknown;
};

type CockroachIdempotencyClaimRow<Result> = {
  persistence_status: CommandOutcomePersistenceStatus;
  request_hash?: string | null;
  result_json?: Result | null;
};

const CockroachCommandStateStoreSql = {
  FindIdempotencyRecord: `
    SELECT idempotency_key, request_hash, result_json
    FROM ${CockroachTableName.IdempotencyRecords}
    WHERE idempotency_key = $1
  `,
  ClaimIdempotencyRecord: `
    WITH claimed_record AS (
      INSERT INTO ${CockroachTableName.IdempotencyRecords} (
        idempotency_key,
        request_hash,
        result_json
      ) VALUES ($1, $2, $3)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING request_hash, result_json
    ),
    existing_record AS (
      SELECT request_hash, result_json
      FROM ${CockroachTableName.IdempotencyRecords}
      WHERE idempotency_key = $1
    )
    SELECT
      CASE
        WHEN EXISTS (SELECT 1 FROM claimed_record) THEN '${CommandOutcomePersistenceStatus.Committed}'
        WHEN EXISTS (SELECT 1 FROM existing_record WHERE request_hash = $2) THEN '${CommandOutcomePersistenceStatus.Replayed}'
        ELSE '${CommandOutcomePersistenceStatus.IdempotencyConflict}'
      END AS persistence_status,
      (SELECT request_hash FROM existing_record) AS request_hash,
      (SELECT result_json FROM existing_record) AS result_json
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
