import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  createAgenticEventEnvelope,
  type OutboxEvent,
} from "../../domain/src/index.ts";
import type { OutboxEventSource } from "../../state/src/index.ts";
import {
  AgenticMessagingDomain,
  OutboxPublishOutcomeStatus,
  createOutboxPublisher,
  resolveAgenticMessagingDomain,
  type EventPublication,
  type EventPublisher,
} from "./outbox-publisher.ts";

describe("outbox publisher", () => {
  test("resolves event domains through typed mappings", () => {
    deepEqual(
      resolveAgenticMessagingDomain(AgenticEventType.SupervisorSignalSent),
      AgenticMessagingDomain.Work,
    );
  });

  test("publishes unpublished outbox events and marks them published", async () => {
    const outboxEvent = createOutboxEvent();
    const outboxSource = createRecordingOutboxSource([outboxEvent]);
    const eventPublisher = createRecordingEventPublisher();
    const publisher = createOutboxPublisher({
      outboxSource,
      eventPublisher,
      environment: "local",
      resolveDomain: resolveAgenticMessagingDomain,
      now: () => "2026-05-25T21:00:00.000Z",
    });

    const result = await publisher.publishNextBatch({
      batchSize: 10,
    });

    deepEqual(result, {
      status: OutboxPublishOutcomeStatus.Published,
      attemptedCount: 1,
      publishedOutboxEventIds: ["outbox-001"],
    });
    deepEqual(outboxSource.markedPublished, [
      {
        outboxEventId: "outbox-001",
        publishedAt: "2026-05-25T21:00:00.000Z",
      },
    ]);
    deepEqual(eventPublisher.publications, [
      {
        subject: "agentic-org.local.org-lfg.work.supervisor_signal.sent",
        outboxEvent,
      },
    ]);
  });

  test("returns empty when there is no work to publish", async () => {
    const outboxSource = createRecordingOutboxSource([]);
    const eventPublisher = createRecordingEventPublisher();
    const publisher = createOutboxPublisher({
      outboxSource,
      eventPublisher,
      environment: "local",
      resolveDomain: resolveAgenticMessagingDomain,
      now: () => "2026-05-25T21:00:00.000Z",
    });

    const result = await publisher.publishNextBatch({
      batchSize: 10,
    });

    equal(result.status, OutboxPublishOutcomeStatus.Empty);
    equal(eventPublisher.publications.length, 0);
    equal(outboxSource.markedPublished.length, 0);
  });
});

function createRecordingOutboxSource(outboxEvents: OutboxEvent[]): OutboxEventSource & {
  markedPublished: { outboxEventId: string; publishedAt: string }[];
} {
  const markedPublished: { outboxEventId: string; publishedAt: string }[] = [];

  return {
    markedPublished,
    claimUnpublishedOutboxEvents: async () => outboxEvents,
    markOutboxEventPublished: async (input) => {
      markedPublished.push(input);
    },
  };
}

function createRecordingEventPublisher(): EventPublisher & {
  publications: EventPublication[];
} {
  const publications: EventPublication[] = [];

  return {
    publications,
    publish: async (publication) => {
      publications.push(publication);
    },
  };
}

function createOutboxEvent(): OutboxEvent {
  return {
    outboxEventId: "outbox-001",
    envelope: createAgenticEventEnvelope({
      eventId: "evt-001",
      eventType: AgenticEventType.SupervisorSignalSent,
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
      payload: {
        title: "Blocked on scoped NATS publisher",
      },
    }),
  };
}
