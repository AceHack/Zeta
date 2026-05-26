import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandOutcomePersistenceStatus,
  CommandResultStatus,
  type CommandResult,
  type RecordCommandOutcomeInput,
} from "../../application/src/index.ts";
import {
  AgenticAggregateType,
  AgenticEventType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "../../domain/src/index.ts";
import {
  CockroachCommandStateStoreStatement,
  createCockroachCommandStateStoreFactory,
  type CockroachSqlExecutor,
} from "../src/cockroach-command-state-store.ts";

describe("cockroach command state store", () => {
  test("records command outcome in one transaction batch", async () => {
    const executor = createRecordingExecutor();
    const factory = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    });
    const store = factory.createCommandStateStore();

    equal(await store.findIdempotencyRecord("idem-001"), undefined);

    const result = await store.recordCommandOutcome(createCommandOutcome());

    equal(result.status, CommandOutcomePersistenceStatus.Committed);
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.FindIdempotencyRecord,
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertAuditEvent,
        CockroachCommandStateStoreStatement.InsertOutboxEvent,
      ],
    );
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertAuditEvent,
        CockroachCommandStateStoreStatement.InsertOutboxEvent,
      ],
    );
    equal(executor.transactionStatements[0]?.sql.includes("INSERT INTO"), true);
    equal(executor.transactionStatements[0]?.sql.includes("UPSERT"), false);
  });

  test("does not insert effects when idempotency claim replays or conflicts", async () => {
    const replayExecutor = createRecordingExecutor({
      claimStatus: CommandOutcomePersistenceStatus.Replayed,
    });
    const replayStore = createCockroachCommandStateStoreFactory<CommandResult>({
      executor: replayExecutor,
    }).createCommandStateStore();

    const replayResult = await replayStore.recordCommandOutcome(createCommandOutcome());

    equal(replayResult.status, CommandOutcomePersistenceStatus.Replayed);
    deepEqual(
      replayExecutor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );

    const conflictExecutor = createRecordingExecutor({
      claimStatus: CommandOutcomePersistenceStatus.IdempotencyConflict,
    });
    const conflictStore = createCockroachCommandStateStoreFactory<CommandResult>({
      executor: conflictExecutor,
    }).createCommandStateStore();

    const conflictResult = await conflictStore.recordCommandOutcome(createCommandOutcome());

    equal(conflictResult.status, CommandOutcomePersistenceStatus.IdempotencyConflict);
    deepEqual(
      conflictExecutor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );
  });
});

type RecordingCockroachSqlExecutor = CockroachSqlExecutor & {
  statements: { name: CockroachCommandStateStoreStatement; sql: string; parameters: readonly unknown[] }[];
  transactionStatements: { name: CockroachCommandStateStoreStatement; sql: string; parameters: readonly unknown[] }[];
};

function createRecordingExecutor(
  input: { claimStatus?: CommandOutcomePersistenceStatus } = {},
): RecordingCockroachSqlExecutor {
  const statements: { name: CockroachCommandStateStoreStatement; sql: string; parameters: readonly unknown[] }[] = [];
  const transactionStatements: {
    name: CockroachCommandStateStoreStatement;
    sql: string;
    parameters: readonly unknown[];
  }[] = [];

  return {
    statements,
    transactionStatements,
    execute: async (statement) => {
      statements.push(statement);
      return {
        rows: [],
      };
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: {
          name: CockroachCommandStateStoreStatement;
          sql: string;
          parameters: readonly unknown[];
        }) => {
          transactionStatements.push(statement);
          statements.push(statement);

          if (statement.name === CockroachCommandStateStoreStatement.ClaimIdempotencyRecord) {
            return {
              rows: [
                {
                  persistence_status: input.claimStatus ?? CommandOutcomePersistenceStatus.Committed,
                  request_hash: "hash-001",
                  result_json: {
                    status: CommandResultStatus.Accepted,
                    idempotency: {
                      replayed: false,
                    },
                  },
                },
              ] as readonly unknown[] as readonly Row[],
            };
          }

          return {
            rows: [],
          };
        },
      }),
  };
}

function createCommandOutcome(): RecordCommandOutcomeInput<CommandResult> {
  return {
    idempotencyRecord: {
      idempotencyKey: "idem-001",
      requestHash: "hash-001",
      result: {
        status: CommandResultStatus.Accepted,
        idempotency: {
          replayed: false,
        },
      },
    },
    effects: {
      supervisorSignals: [
        {
          supervisorSignalId: "supervisor-signal-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          sourceLevel: SupervisorChainLevel.TeamMember,
          targetLevel: SupervisorChainLevel.Manager,
          targetHatAssignmentId: "hat-assignment-em-001",
          sender: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          toolType: SupervisorSignalToolType.ReportBlocker,
          status: SupervisorSignalStatus.Sent,
          title: "Blocked on scoped NATS publisher",
          message: "Need a scoped publisher decision.",
          relatedWorkItemId: "work-outbox-001",
          createdAt: "2026-05-25T20:00:00.000Z",
        },
      ],
      auditEvents: [
        {
          auditEventId: "audit-001",
          eventName: AgenticEventType.SupervisorSignalSent,
          aggregateId: "supervisor-signal-001",
          actor: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          occurredAt: "2026-05-25T20:00:00.000Z",
        },
      ],
      outboxEvents: [
        {
          outboxEventId: "outbox-001",
          envelope: {
            eventId: "evt-001",
            eventType: AgenticEventType.SupervisorSignalSent,
            schemaVersion: "agentic.org.event.v1",
            occurredAt: "2026-05-25T20:00:00.000Z",
            actor: {
              agentId: "agent-developer-001",
              hatAssignmentId: "hat-assignment-dev-001",
            },
            scope: {
              organizationId: "org-lfg",
              projectId: "project-agentic-org",
              teamId: "team-runtime",
              workItemId: "work-outbox-001",
            },
            aggregate: {
              aggregateId: "supervisor-signal-001",
              aggregateType: AgenticAggregateType.SupervisorSignal,
              aggregateVersion: 1,
            },
            trace: {
              commandId: "cmd-001",
              correlationId: "corr-001",
              causationId: "cause-001",
              traceId: "trace-001",
              idempotencyKey: "idem-001",
            },
            replay: {
              isReplay: false,
            },
            payload: {
              title: "Blocked on scoped NATS publisher",
            },
          },
        },
      ],
    },
  };
}
