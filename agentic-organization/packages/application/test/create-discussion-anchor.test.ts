import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import { CommandErrorCode, CommandResultArtifactType, CommandResultStatus, type CommandResult } from "../src/index.ts";
import {
  createDiscussionAnchor,
  type CreateDiscussionAnchorCommand,
} from "../src/handlers/create-discussion-anchor.ts";
import type { CommandWorkAnchorWorkItem, WorkAnchorStateReaderPort } from "../src/ports.ts";

const command: CreateDiscussionAnchorCommand = {
  commandId: "cmd-discussion-anchor-001",
  type: CommandType.CreateDiscussionAnchor,
  idempotencyKey: "idem-discussion-anchor-001",
  requestHash: "hash-discussion-anchor-001",
  correlationId: "corr-discussion-anchor-001",
  causationId: "cause-discussion-anchor-001",
  traceId: "trace-discussion-anchor-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  actor: {
    agentId: "agent-em-001",
    hatAssignmentId: "hat-assignment-em-001",
  },
  teamId: "team-runtime",
  workItemId: "work-runtime-001",
  discussionAnchorType: DiscussionAnchorType.WorkItem,
  title: "Clarify review gate readiness",
  purpose: "Determine whether the implementation has enough evidence to enter review.",
  expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
};

describe("create discussion anchor handler", () => {
  test("creates a durable work-anchored discussion anchor with audit and outbox effects", async () => {
    const outcome = await createDiscussionAnchor(command, {
      now: () => "2026-05-28T22:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    ok(result.discussionAnchor);
    deepEqual(result.artifacts, [
      {
        artifactType: CommandResultArtifactType.DiscussionAnchor,
        artifactId: "discussion-anchor-001",
        label: command.title,
      },
    ]);
    deepEqual(result.emittedEvents, [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.DiscussionAnchorCreated,
        aggregateId: "discussion-anchor-001",
        aggregateType: AgenticAggregateType.DiscussionAnchor,
      },
    ]);
    deepEqual(result.auditEventIds, ["audit-001"]);
    deepEqual(outcome.effects.discussionAnchors, [
      {
        discussionAnchorId: "discussion-anchor-001",
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.teamId,
        workItemId: command.workItemId,
        discussionAnchorType: DiscussionAnchorType.WorkItem,
        title: command.title,
        purpose: command.purpose,
        expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
        createdAt: "2026-05-28T22:00:00.000Z",
        createdBy: command.actor,
        metadata: {
          updatedAt: "2026-05-28T22:00:00.000Z",
          version: 1,
          correlationId: command.correlationId,
          causationId: command.causationId,
          traceId: command.traceId,
        },
      },
    ]);
    deepEqual(outcome.effects.auditEvents, [
      {
        auditEventId: "audit-001",
        eventName: AgenticEventType.DiscussionAnchorCreated,
        aggregateId: "discussion-anchor-001",
        actor: command.actor,
        occurredAt: "2026-05-28T22:00:00.000Z",
      },
    ]);
    equal(outcome.effects.outboxEvents[0]?.envelope.eventType, AgenticEventType.DiscussionAnchorCreated);
    deepEqual(outcome.effects.outboxEvents[0]?.envelope.scope, {
      organizationId: command.organizationId,
      projectId: command.projectId,
      teamId: command.teamId,
      workItemId: command.workItemId,
    });
  });

  test("rejects blank anchor purposes before emitting effects", async () => {
    const outcome = await createDiscussionAnchor(
      {
        ...command,
        purpose: " ",
      },
      {
        now: () => "2026-05-28T22:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    ok(result.error?.message.includes("purpose"));
    deepEqual(outcome.effects, {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      workScheduleBlocks: [],
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

  test("rejects anchors without expected outputs before emitting effects", async () => {
    const outcome = await createDiscussionAnchor(
      {
        ...command,
        expectedOutputs: [],
      },
      {
        now: () => "2026-05-28T22:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    ok(result.error?.message.includes("expected output"));
    equal(outcome.effects.discussionAnchors.length, 0);
    equal(outcome.effects.auditEvents.length, 0);
    equal(outcome.effects.outboxEvents.length, 0);
  });

  test("rejects malformed expected outputs from JSON command inputs before emitting effects", async () => {
    const outcome = await createDiscussionAnchor(
      {
        ...command,
        expectedOutputs: "decision",
      } as unknown as CreateDiscussionAnchorCommand,
      {
        now: () => "2026-05-28T22:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "discussion anchor expected output is invalid");
    equal(outcome.effects.discussionAnchors.length, 0);
  });

  test("rejects malformed scalar strings from JSON command inputs before emitting effects", async () => {
    const outcome = await createDiscussionAnchor(
      {
        ...command,
        title: 42,
      } as unknown as CreateDiscussionAnchorCommand,
      {
        now: () => "2026-05-28T22:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "discussion anchor title is required");
    equal(outcome.effects.discussionAnchors.length, 0);
  });

  test("rejects non-work-item anchor types until the event scope supports wider targets", async () => {
    const outcome = await createDiscussionAnchor(
      {
        ...command,
        discussionAnchorType: DiscussionAnchorType.Project,
      } as unknown as CreateDiscussionAnchorCommand,
      {
        now: () => "2026-05-28T22:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "discussion anchor V0 only supports work_item anchors");
    equal(outcome.effects.discussionAnchors.length, 0);
  });

  test("rejects invalid expected output values from JSON command inputs", async () => {
    const outcome = await createDiscussionAnchor(
      {
        ...command,
        expectedOutputs: ["decide-ish"],
      } as unknown as CreateDiscussionAnchorCommand,
      {
        now: () => "2026-05-28T22:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        workAnchorStateReader: createWorkAnchorStateReader(createWorkItem()),
      },
    );
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(result.error?.message, "discussion anchor expected output is invalid");
    equal(outcome.effects.discussionAnchors.length, 0);
  });

  test("rejects discussion anchors when the work anchor cannot be validated", async () => {
    const outcome = await createDiscussionAnchor(command, {
      now: () => "2026-05-28T22:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "discussion anchor requires work anchor validation");
    equal(outcome.effects.discussionAnchors.length, 0);
    equal(outcome.effects.auditEvents.length, 0);
    equal(outcome.effects.outboxEvents.length, 0);
  });

  test("rejects discussion anchors when the referenced work item is missing", async () => {
    const outcome = await createDiscussionAnchor(command, {
      now: () => "2026-05-28T22:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: createWorkAnchorStateReader(undefined),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "discussion anchor requires an existing related work item");
    equal(outcome.effects.discussionAnchors.length, 0);
  });

  test("rejects discussion anchors when the work item scope does not match the command", async () => {
    const outcome = await createDiscussionAnchor(command, {
      now: () => "2026-05-28T22:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: createWorkAnchorStateReader({
        ...createWorkItem(),
        projectId: "project-other",
      }),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(result.error?.message, "discussion anchor work item scope does not match the command scope");
    equal(outcome.effects.discussionAnchors.length, 0);
  });
});

function createWorkAnchorStateReader(workItem: CommandWorkAnchorWorkItem | undefined): WorkAnchorStateReaderPort {
  return {
    findProject: async () => undefined,
    findInitiative: async () => undefined,
    findWorkItem: async () => workItem,
  };
}

function createWorkItem(): CommandWorkAnchorWorkItem {
  return {
    workItemId: command.workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    workItemType: WorkItemType.Task,
    title: "Runtime coordination",
    description: "Work anchor used by discussion anchor tests.",
    state: WorkItemState.InProgress,
    createdAt: "2026-05-28T21:00:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-28T21:00:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}
