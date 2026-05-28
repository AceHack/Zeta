import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import { CommandErrorCode, CommandResultArtifactType, CommandResultStatus } from "../src/index.ts";
import { createWorkItem, type CreateWorkItemCommand } from "../src/handlers/create-work-item.ts";

const command: CreateWorkItemCommand = {
  commandId: "cmd-create-work-item-001",
  type: CommandType.CreateWorkItem,
  idempotencyKey: "idem-create-work-item-001",
  requestHash: "hash-create-work-item-001",
  correlationId: "corr-create-work-item-001",
  causationId: "cause-create-work-item-001",
  traceId: "trace-create-work-item-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  actor: {
    agentId: "agent-tpm-001",
    hatAssignmentId: "hat-assignment-tpm-001",
  },
  workItemType: WorkItemType.Task,
  title: "Create the first generic work item command",
  description: "The organization needs the first concrete work-anchor command.",
};

describe("create work item handler", () => {
  test("returns work-anchor, audit, and outbox effects for a new work item", async () => {
    const outcome = await createWorkItem(command, {
      now: () => "2026-05-28T21:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    equal(outcome.result.status, CommandResultStatus.Accepted);
    deepEqual(outcome.result.artifacts, [
      {
        artifactType: CommandResultArtifactType.WorkItem,
        artifactId: "work-item-001",
        label: command.title,
      },
    ]);
    deepEqual(outcome.result.emittedEvents, [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.WorkItemChanged,
        aggregateId: "work-item-001",
        aggregateType: AgenticAggregateType.WorkItem,
      },
    ]);
    equal(outcome.effects.workAnchors?.workItems.length, 1);
    deepEqual(outcome.effects.workAnchors?.workItems[0], {
      workItemId: "work-item-001",
      organizationId: command.organizationId,
      projectId: command.projectId,
      workItemType: WorkItemType.Task,
      title: command.title,
      description: command.description,
      state: WorkItemState.Created,
      createdAt: "2026-05-28T21:00:00.000Z",
      createdBy: command.actor,
      metadata: {
        updatedAt: "2026-05-28T21:00:00.000Z",
        version: 1,
        correlationId: command.correlationId,
        causationId: command.causationId,
        traceId: command.traceId,
      },
    });
    deepEqual(outcome.effects.auditEvents, [
      {
        auditEventId: "audit-001",
        eventName: AgenticEventType.WorkItemChanged,
        aggregateId: "work-item-001",
        actor: command.actor,
        occurredAt: "2026-05-28T21:00:00.000Z",
      },
    ]);
    equal(outcome.effects.outboxEvents[0]?.outboxEventId, "outbox-001");
    equal(outcome.effects.outboxEvents[0]?.envelope.aggregate.aggregateVersion, 1);
  });

  test("rejects blank work item titles before emitting effects", async () => {
    const outcome = await createWorkItem(
      {
        ...command,
        title: " ",
      },
      {
        now: () => "2026-05-28T21:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    ok(outcome.result.error?.message.includes("title"));
    deepEqual(outcome.effects, {
      supervisorSignals: [],
      auditEvents: [],
      outboxEvents: [],
      workAnchors: {
        projects: [],
        initiatives: [],
        workItems: [],
        workAnchorTargets: [],
        workItemTransitions: [],
      },
    });
  });
});
