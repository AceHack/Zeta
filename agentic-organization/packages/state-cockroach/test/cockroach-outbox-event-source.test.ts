import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import { AgenticAggregateType, AgenticEventType, type AgenticEventEnvelope } from "../../domain/src/index.ts";
import {
  CockroachOutboxEventSourceStatement,
  createCockroachOutboxEventSource,
  type CockroachOutboxSqlExecutor,
  type CockroachOutboxSqlStatement,
} from "../src/cockroach-outbox-event-source.ts";

describe("cockroach outbox event source", () => {
  test("claims unpublished outbox events and marks them published", async () => {
    const executor = createRecordingExecutor();
    const outboxSource = createCockroachOutboxEventSource({
      executor,
    });

    const outboxEvents = await outboxSource.claimUnpublishedOutboxEvents({
      batchSize: 10,
    });
    await outboxSource.markOutboxEventPublished({
      outboxEventId: "outbox-001",
      publishedAt: "2026-05-25T21:00:00.000Z",
    });

    deepEqual(outboxEvents, [
      {
        outboxEventId: "outbox-001",
        envelope: createEnvelope(),
      },
    ]);
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachOutboxEventSourceStatement.ClaimUnpublishedOutboxEvents,
        CockroachOutboxEventSourceStatement.MarkOutboxEventPublished,
      ],
    );
    ok(/UPDATE agentic_org_outbox_events/.test(executor.statements[0]?.sql ?? ""));
    ok(/FOR UPDATE SKIP LOCKED/.test(executor.statements[0]?.sql ?? ""));
    ok(/AND published_at IS NULL/.test(executor.statements[1]?.sql ?? ""));
  });

  test("rejects stale or duplicate publish marks", async () => {
    const executor = createRecordingExecutor({
      markRows: [],
    });
    const outboxSource = createCockroachOutboxEventSource({
      executor,
    });

    try {
      await outboxSource.markOutboxEventPublished({
        outboxEventId: "outbox-001",
        publishedAt: "2026-05-25T21:00:00.000Z",
      });
      throw new Error("expected duplicate publish mark to reject");
    } catch (error) {
      equal((error as Error).message, "outbox event was already published or missing: outbox-001");
    }
  });
});

type RecordingCockroachOutboxSqlExecutor = CockroachOutboxSqlExecutor & {
  statements: { name: CockroachOutboxEventSourceStatement; sql: string; parameters: readonly unknown[] }[];
};

type CreateRecordingExecutorInput = {
  markRows?: { outbox_event_id: string }[];
};

function createRecordingExecutor(input: CreateRecordingExecutorInput = {}): RecordingCockroachOutboxSqlExecutor {
  const statements: { name: CockroachOutboxEventSourceStatement; sql: string; parameters: readonly unknown[] }[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachOutboxSqlStatement) => {
      statements.push(statement);

      if (statement.name === CockroachOutboxEventSourceStatement.ClaimUnpublishedOutboxEvents) {
        return {
          rows: [
            {
              outbox_event_id: "outbox-001",
              envelope_json: createEnvelope(),
            },
          ] as Row[],
        };
      }

      return {
        rows: (input.markRows ?? [{ outbox_event_id: "outbox-001" }]) as Row[],
      };
    },
  };
}

function createEnvelope(): AgenticEventEnvelope {
  return {
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
  };
}
