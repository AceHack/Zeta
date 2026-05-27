import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import { AgenticAggregateType, AgenticEventType, type AgenticEventEnvelope } from "../../domain/src/index.ts";
import {
  CockroachOutboxEventPublishMarkError,
  CockroachOutboxEventPublishMarkErrorCode,
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
      claimId: "outbox-claim-001",
    });
    await outboxSource.markOutboxEventPublished({
      claimId: "outbox-claim-001",
      outboxEventId: "outbox-001",
      publishedAt: "2026-05-25T21:00:00.000Z",
    });

    deepEqual(outboxEvents, [
      {
        outboxEventId: "outbox-001",
        envelope: createEnvelope(),
        claimId: "outbox-claim-001",
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
    deepEqual(executor.statements[0]?.parameters, [10, "outbox-claim-001"]);
    ok(/AND published_at IS NULL/.test(executor.statements[1]?.sql ?? ""));
    ok(/AND claim_id = \$2/.test(executor.statements[1]?.sql ?? ""));
    deepEqual(executor.statements[1]?.parameters, [
      "outbox-001",
      "outbox-claim-001",
      "2026-05-25T21:00:00.000Z",
    ]);
  });

  test("rejects stale, unfenced, or duplicate publish marks", async () => {
    const executor = createRecordingExecutor({
      markRows: [],
    });
    const outboxSource = createCockroachOutboxEventSource({
      executor,
    });

    try {
      await outboxSource.markOutboxEventPublished({
        claimId: "outbox-claim-stale",
        outboxEventId: "outbox-001",
        publishedAt: "2026-05-25T21:00:00.000Z",
      });
      throw new Error("expected duplicate publish mark to reject");
    } catch (error) {
      ok(error instanceof CockroachOutboxEventPublishMarkError);
      equal(error.code, CockroachOutboxEventPublishMarkErrorCode.StaleClaimOrMissing);
      equal(error.outboxEventId, "outbox-001");
      equal(error.claimId, "outbox-claim-stale");
      equal(error.commandId, "cmd-001");
      equal(error.eventId, "evt-001");
      equal(error.traceId, "trace-001");
      equal(error.currentClaimId, "outbox-claim-001");
      equal(error.publishedAt, "2026-05-25T20:59:00.000Z");
      ok(error.message.includes("claimId=outbox-claim-stale"));
      ok(error.message.includes("currentClaimId=outbox-claim-001"));
      ok(error.message.includes("publishedAt=2026-05-25T20:59:00.000Z"));
    }
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachOutboxEventSourceStatement.MarkOutboxEventPublished,
        CockroachOutboxEventSourceStatement.FindOutboxEventPublishMarkFailureEvidence,
      ],
    );
  });

  test("preserves typed publish-mark failure evidence when diagnostic lookup fails", async () => {
    const executor = createRecordingExecutor({
      evidenceError: new Error("evidence lookup unavailable"),
      markRows: [],
    });
    const outboxSource = createCockroachOutboxEventSource({
      executor,
    });

    try {
      await outboxSource.markOutboxEventPublished({
        claimId: "outbox-claim-stale",
        outboxEventId: "outbox-001",
        publishedAt: "2026-05-25T21:00:00.000Z",
      });
      throw new Error("expected duplicate publish mark to reject");
    } catch (error) {
      ok(error instanceof CockroachOutboxEventPublishMarkError);
      equal(error.code, CockroachOutboxEventPublishMarkErrorCode.StaleClaimOrMissing);
      equal(error.outboxEventId, "outbox-001");
      equal(error.claimId, "outbox-claim-stale");
      equal(error.currentClaimId, undefined);
      equal(error.publishedAt, undefined);
      ok(error.message.includes("claimId=outbox-claim-stale"));
      ok(error.message.includes("currentClaimId=unknown"));
    }
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachOutboxEventSourceStatement.MarkOutboxEventPublished,
        CockroachOutboxEventSourceStatement.FindOutboxEventPublishMarkFailureEvidence,
      ],
    );
  });
});

type RecordingCockroachOutboxSqlExecutor = CockroachOutboxSqlExecutor & {
  statements: { name: CockroachOutboxEventSourceStatement; sql: string; parameters: readonly unknown[] }[];
};

type CreateRecordingExecutorInput = {
  evidenceError?: Error;
  markRows?: { outbox_event_id: string }[];
  evidenceRows?: {
    outbox_event_id: string;
    event_id: string;
    envelope_json: AgenticEventEnvelope;
    trace_id: string;
    claim_id: string | null;
    published_at: string | null;
  }[];
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
              claim_id: "outbox-claim-001",
            },
          ] as Row[],
        };
      }

      if (statement.name === CockroachOutboxEventSourceStatement.FindOutboxEventPublishMarkFailureEvidence) {
        if (input.evidenceError !== undefined) {
          throw input.evidenceError;
        }

        return {
          rows: (input.evidenceRows ?? [
            {
              outbox_event_id: "outbox-001",
              event_id: "evt-001",
              envelope_json: createEnvelope(),
              trace_id: "trace-001",
              claim_id: "outbox-claim-001",
              published_at: "2026-05-25T20:59:00.000Z",
            },
          ]) as Row[],
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
