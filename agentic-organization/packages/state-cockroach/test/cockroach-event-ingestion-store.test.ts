import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { ReactionPlanActionType, ReactionPlanReason, ReactionPlanStatus, RequiredHat } from "../../domain/src/index.ts";
import {
  EventIngestionOutcomeStatus,
  InboundEventConsumerName,
  type ReactionPlanRecord,
} from "../../state/src/index.ts";
import {
  CockroachEventIngestionStoreStatement,
  createCockroachEventIngestionStore,
  type CockroachEventIngestionSqlExecutor,
  type CockroachEventIngestionSqlStatement,
} from "../src/cockroach-event-ingestion-store.ts";

describe("cockroach event ingestion store", () => {
  test("implements inbox receipt and reaction plan persistence behind a SQL executor", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachEventIngestionStore({
      executor,
    });

    equal(
      await store.findInboxReceipt({
        eventId: "evt-supervisor-signal-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
      }),
      undefined,
    );
    const result = await store.recordEventProcessingOutcome({
      receipt: {
        eventId: "evt-supervisor-signal-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        firstSeenAt: "2026-05-25T22:00:00.000Z",
        payloadHash: "hash-evt-supervisor-signal-001",
      },
      reactionPlans: [createReactionPlanRecord()],
      processedAt: "2026-05-25T22:00:00.000Z",
      result: EventIngestionOutcomeStatus.Processed,
    });

    equal(result.status, EventIngestionOutcomeStatus.Processed);
    equal(result.reactionPlans.length, 1);
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachEventIngestionStoreStatement.FindInboxReceipt,
        CockroachEventIngestionStoreStatement.ClaimPendingInboxReceipt,
        CockroachEventIngestionStoreStatement.InsertReactionPlan,
        CockroachEventIngestionStoreStatement.MarkInboxReceiptProcessed,
      ],
    );
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachEventIngestionStoreStatement.ClaimPendingInboxReceipt,
        CockroachEventIngestionStoreStatement.InsertReactionPlan,
        CockroachEventIngestionStoreStatement.MarkInboxReceiptProcessed,
      ],
    );
    equal(executor.transactionStatements[0]?.sql.includes("ON CONFLICT"), true);
    equal(executor.transactionStatements[0]?.sql.includes("processed_at IS NULL"), true);
  });

  test("does not insert reaction plans when the inbox receipt claim loses the race", async () => {
    const executor = createRecordingExecutor({
      claimStatus: EventIngestionOutcomeStatus.Duplicate,
    });
    const store = createCockroachEventIngestionStore({
      executor,
    });

    const result = await store.recordEventProcessingOutcome({
      receipt: {
        eventId: "evt-supervisor-signal-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        firstSeenAt: "2026-05-25T22:00:00.000Z",
        payloadHash: "hash-evt-supervisor-signal-001",
      },
      reactionPlans: [createReactionPlanRecord()],
      processedAt: "2026-05-25T22:00:00.000Z",
      result: EventIngestionOutcomeStatus.Processed,
    });

    equal(result.status, EventIngestionOutcomeStatus.Duplicate);
    deepEqual(result.reactionPlans, []);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [CockroachEventIngestionStoreStatement.ClaimPendingInboxReceipt],
    );
  });

  test("returns duplicate when the processed receipt mark loses the race", async () => {
    const executor = createRecordingExecutor({
      markProcessedRowCount: 0,
    });
    const store = createCockroachEventIngestionStore({
      executor,
    });

    const result = await store.recordEventProcessingOutcome({
      receipt: {
        eventId: "evt-supervisor-signal-001",
        consumerName: InboundEventConsumerName.V0AutomationPlanner,
        firstSeenAt: "2026-05-25T22:00:00.000Z",
        payloadHash: "hash-evt-supervisor-signal-001",
      },
      reactionPlans: [createReactionPlanRecord()],
      processedAt: "2026-05-25T22:00:00.000Z",
      result: EventIngestionOutcomeStatus.Processed,
    });

    equal(result.status, EventIngestionOutcomeStatus.Duplicate);
    deepEqual(result.reactionPlans, []);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachEventIngestionStoreStatement.ClaimPendingInboxReceipt,
        CockroachEventIngestionStoreStatement.InsertReactionPlan,
        CockroachEventIngestionStoreStatement.MarkInboxReceiptProcessed,
      ],
    );
    equal(executor.rolledBackTransactionCount, 1);
  });

  test("normalizes SQL null receipt completion fields to pending receipt fields", async () => {
    const executor = createRecordingExecutor({
      rows: [
        {
          event_id: "evt-supervisor-signal-001",
          consumer_name: InboundEventConsumerName.V0AutomationPlanner,
          first_seen_at: "2026-05-25T21:59:00.000Z",
          processed_at: null,
          payload_hash: "hash-evt-supervisor-signal-001",
          result: null,
        },
      ],
    });
    const store = createCockroachEventIngestionStore({
      executor,
    });

    const receipt = await store.findInboxReceipt({
      eventId: "evt-supervisor-signal-001",
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
    });

    deepEqual(receipt, {
      eventId: "evt-supervisor-signal-001",
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      firstSeenAt: "2026-05-25T21:59:00.000Z",
      payloadHash: "hash-evt-supervisor-signal-001",
    });
  });
});

type RecordingCockroachEventIngestionSqlExecutor = CockroachEventIngestionSqlExecutor & {
  statements: CockroachEventIngestionSqlStatement[];
  transactionStatements: CockroachEventIngestionSqlStatement[];
  rolledBackTransactionCount: number;
};

function createRecordingExecutor(
  input: {
    rows?: readonly unknown[];
    claimStatus?: EventIngestionOutcomeStatus;
    markProcessedRowCount?: number;
  } = {},
): RecordingCockroachEventIngestionSqlExecutor {
  const statements: CockroachEventIngestionSqlStatement[] = [];
  const transactionStatements: CockroachEventIngestionSqlStatement[] = [];
  let rolledBackTransactionCount = 0;

  return {
    statements,
    transactionStatements,
    get rolledBackTransactionCount() {
      return rolledBackTransactionCount;
    },
    execute: async <Row = Record<string, unknown>>(statement: CockroachEventIngestionSqlStatement) => {
      statements.push(statement);

      return {
        rows: (input.rows ?? []) as readonly Row[],
      };
    },
    executeTransaction: async (operation) => {
      try {
        return await operation({
          execute: async <Row = Record<string, unknown>>(statement: CockroachEventIngestionSqlStatement) => {
            transactionStatements.push(statement);
            statements.push(statement);

            if (statement.name === CockroachEventIngestionStoreStatement.ClaimPendingInboxReceipt) {
              return {
                rows: [
                  {
                    claim_status: input.claimStatus ?? EventIngestionOutcomeStatus.Processed,
                  },
                ] as readonly unknown[] as readonly Row[],
              };
            }

            if (statement.name === CockroachEventIngestionStoreStatement.MarkInboxReceiptProcessed) {
              const rowCount = input.markProcessedRowCount ?? 1;

              return {
                rows: Array.from({ length: rowCount }, () => ({
                  event_id: "evt-supervisor-signal-001",
                })) as readonly unknown[] as readonly Row[],
              };
            }

            return {
              rows: [],
            };
          },
        });
      } catch (error) {
        rolledBackTransactionCount += 1;
        throw error;
      }
    },
  };
}

function createReactionPlanRecord(): ReactionPlanRecord {
  return {
    reactionPlanId: "reaction-plan-001",
    consumerName: InboundEventConsumerName.V0AutomationPlanner,
    createdAt: "2026-05-25T22:00:00.000Z",
    status: ReactionPlanStatus.Planned,
    action: {
      actionType: ReactionPlanActionType.CreateSupervisorTriage,
      triggerEventId: "evt-supervisor-signal-001",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-outbox-001",
      supervisorSignalId: "supervisor-signal-001",
      requiredHat: RequiredHat.EngineeringManager,
      reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    },
  };
}
