import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  createAgenticEventEnvelope,
} from "../../domain/src/index.ts";
import type { ClaimedOutboxEvent, OutboxEventSource } from "../../state/src/index.ts";
import {
  AgenticMessagingDomain,
  OutboxPublishOutcomeStatus,
  createOutboxPublisher,
  resolveAgenticMessagingDomain,
  type EventPublication,
  type EventPublisher,
} from "../src/outbox-publisher.ts";

describe("outbox publisher", () => {
  test("resolves event domains through typed mappings", () => {
    deepEqual(
      resolveAgenticMessagingDomain(AgenticEventType.SupervisorSignalSent),
      AgenticMessagingDomain.SupervisorSignal,
    );
    deepEqual(resolveAgenticMessagingDomain(AgenticEventType.WorkItemChanged), AgenticMessagingDomain.WorkItem);
    deepEqual(resolveAgenticMessagingDomain(AgenticEventType.WorkItemStateChanged), AgenticMessagingDomain.WorkItem);
  });

  test("publishes unpublished outbox events and marks them published", async () => {
    const supervisorSignalOutboxEvent = createSupervisorSignalOutboxEvent();
    const workItemOutboxEvent = createWorkItemOutboxEvent();
    const outboxSource = createRecordingOutboxSource([supervisorSignalOutboxEvent, workItemOutboxEvent]);
    const eventPublisher = createRecordingEventPublisher();
    const publisher = createOutboxPublisher({
      outboxSource,
      eventPublisher,
      environment: "local",
      resolveDomain: resolveAgenticMessagingDomain,
      createId: () => "outbox-claim-001",
      now: () => "2026-05-25T21:00:00.000Z",
    });

    const result = await publisher.publishNextBatch({
      batchSize: 10,
    });

    deepEqual(result, {
      status: OutboxPublishOutcomeStatus.Published,
      attemptedCount: 2,
      publishedOutboxEventIds: ["outbox-001", "outbox-002"],
    });
    deepEqual(outboxSource.claims, [
      {
        batchSize: 10,
        claimId: "outbox-claim-001",
      },
    ]);
    deepEqual(outboxSource.markedPublished, [
      {
        claimId: "outbox-claim-001",
        outboxEventId: "outbox-001",
        publishedAt: "2026-05-25T21:00:00.000Z",
      },
      {
        claimId: "outbox-claim-001",
        outboxEventId: "outbox-002",
        publishedAt: "2026-05-25T21:00:00.000Z",
      },
    ]);
    deepEqual(eventPublisher.publications, [
      {
        subject: "agentic-org.local.org-lfg.supervisor_signal.sent",
        outboxEvent: supervisorSignalOutboxEvent,
      },
      {
        subject: "agentic-org.local.org-lfg.work_item.changed",
        outboxEvent: workItemOutboxEvent,
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
      createId: () => "outbox-claim-001",
      now: () => "2026-05-25T21:00:00.000Z",
    });

    const result = await publisher.publishNextBatch({
      batchSize: 10,
    });

    equal(result.status, OutboxPublishOutcomeStatus.Empty);
    equal(eventPublisher.publications.length, 0);
    deepEqual(outboxSource.claims, [
      {
        batchSize: 10,
        claimId: "outbox-claim-001",
      },
    ]);
    equal(outboxSource.markedPublished.length, 0);
  });
});

function createRecordingOutboxSource(outboxEvents: ClaimedOutboxEvent[]): OutboxEventSource & {
  claims: { batchSize: number; claimId: string }[];
  markedPublished: { claimId: string; outboxEventId: string; publishedAt: string }[];
} {
  const claims: { batchSize: number; claimId: string }[] = [];
  const markedPublished: { claimId: string; outboxEventId: string; publishedAt: string }[] = [];

  return {
    claims,
    markedPublished,
    claimUnpublishedOutboxEvents: async (input) => {
      claims.push(input);
      return outboxEvents;
    },
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

function createSupervisorSignalOutboxEvent(): ClaimedOutboxEvent {
  return {
    claimId: "outbox-claim-001",
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

function createWorkItemOutboxEvent(): ClaimedOutboxEvent {
  return {
    claimId: "outbox-claim-001",
    outboxEventId: "outbox-002",
    envelope: createAgenticEventEnvelope({
      eventId: "evt-002",
      eventType: AgenticEventType.WorkItemChanged,
      occurredAt: "2026-05-25T20:01:00.000Z",
      actor: {
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-outbox-002",
      },
      aggregate: {
        aggregateId: "work-outbox-002",
        aggregateType: AgenticAggregateType.WorkItem,
        aggregateVersion: 1,
      },
      trace: {
        commandId: "cmd-002",
        correlationId: "corr-002",
        causationId: "cause-002",
        traceId: "trace-002",
        idempotencyKey: "idem-002",
      },
      payload: {
        title: "Route work-item events through the work-item domain",
      },
    }),
  };
}
