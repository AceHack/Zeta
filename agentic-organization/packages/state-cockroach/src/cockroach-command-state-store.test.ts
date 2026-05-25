import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandResultStatus, type CommandResult } from "../../application/src/index.ts";
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
} from "./cockroach-command-state-store.ts";

describe("cockroach command state store", () => {
  test("implements command-state-store operations behind a SQL executor", async () => {
    const executor = createRecordingExecutor();
    const factory = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    });
    const store = factory.createCommandStateStore();

    equal(await store.findIdempotencyRecord("idem-001"), undefined);

    await store.appendSupervisorSignal({
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
    });

    await store.appendAuditEvent({
      auditEventId: "audit-001",
      eventName: AgenticEventType.SupervisorSignalSent,
      aggregateId: "supervisor-signal-001",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
      occurredAt: "2026-05-25T20:00:00.000Z",
    });

    await store.appendOutboxEvent({
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
    });

    await store.saveIdempotencyRecord({
      idempotencyKey: "idem-001",
      requestHash: "hash-001",
      result: {
        status: CommandResultStatus.Accepted,
        idempotency: {
          replayed: false,
        },
      },
    });

    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.FindIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertAuditEvent,
        CockroachCommandStateStoreStatement.InsertOutboxEvent,
        CockroachCommandStateStoreStatement.UpsertIdempotencyRecord,
      ],
    );
  });
});

type RecordingCockroachSqlExecutor = CockroachSqlExecutor & {
  statements: { name: CockroachCommandStateStoreStatement; parameters: readonly unknown[] }[];
};

function createRecordingExecutor(): RecordingCockroachSqlExecutor {
  const statements: { name: CockroachCommandStateStoreStatement; parameters: readonly unknown[] }[] = [];

  return {
    statements,
    execute: async (statement) => {
      statements.push(statement);
      return {
        rows: [],
      };
    },
  };
}
