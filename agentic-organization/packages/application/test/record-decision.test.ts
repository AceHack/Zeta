import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  type DiscussionAnchor,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import { CommandErrorCode, CommandResultArtifactType, CommandResultStatus, type CommandResult } from "../src/index.ts";
import { recordDecision, type RecordDecisionCommand } from "../src/handlers/record-decision.ts";
import type {
  CommandWorkAnchorWorkItem,
  DiscussionAnchorStateReaderPort,
  WorkAnchorStateReaderPort,
} from "../src/ports.ts";

const command: RecordDecisionCommand = {
  commandId: "cmd-decision-001",
  type: CommandType.RecordDecision,
  idempotencyKey: "idem-decision-001",
  requestHash: "hash-decision-001",
  correlationId: "corr-decision-001",
  causationId: "cause-decision-001",
  traceId: "trace-decision-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  actor: {
    agentId: "agent-reviewer-001",
    hatAssignmentId: "hat-assignment-reviewer-001",
  },
  teamId: "team-runtime",
  workItemId: "work-runtime-001",
  discussionAnchorId: "discussion-anchor-001",
  title: "Review gate decision",
  decision: "Implementation can move to sign-off review once the outbox evidence is attached.",
  rationale: "The code path is deterministic, covered by tests, and tied to a durable discussion anchor.",
  alternativesConsidered: ["Defer review until live NATS is available"],
  followUpWorkItemIds: ["work-evidence-001"],
};

describe("record decision handler", () => {
  test("records a durable decision against an existing discussion anchor", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      workAnchorStateReader: createWorkAnchorStateReader([createFollowUpWorkItem("work-evidence-001")]),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    ok(result.decisionRecord);
    deepEqual(result.artifacts, [
      {
        artifactType: CommandResultArtifactType.DecisionRecord,
        artifactId: "decision-record-001",
        label: command.title,
      },
    ]);
    deepEqual(result.emittedEvents, [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.DecisionRecorded,
        aggregateId: "decision-record-001",
        aggregateType: AgenticAggregateType.DecisionRecord,
      },
    ]);
    deepEqual(outcome.effects.decisionRecords, [
      {
        decisionRecordId: "decision-record-001",
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.teamId,
        workItemId: command.workItemId,
        discussionAnchorId: command.discussionAnchorId,
        title: command.title,
        decision: command.decision,
        rationale: command.rationale,
        alternativesConsidered: command.alternativesConsidered,
        followUpWorkItemIds: command.followUpWorkItemIds,
        decidedAt: "2026-05-29T01:00:00.000Z",
        decidedBy: command.actor,
        metadata: {
          updatedAt: "2026-05-29T01:00:00.000Z",
          version: 1,
          correlationId: command.correlationId,
          causationId: command.causationId,
          traceId: command.traceId,
        },
      },
    ]);
    deepEqual(outcome.effects.outboxEvents[0]?.envelope.scope, {
      organizationId: command.organizationId,
      projectId: command.projectId,
      teamId: command.teamId,
      workItemId: command.workItemId,
    });
    deepEqual(outcome.effects.outboxEvents[0]?.envelope.payload, {
      discussionAnchorId: command.discussionAnchorId,
      title: command.title,
      decision: command.decision,
      rationale: command.rationale,
      alternativesConsidered: command.alternativesConsidered,
      followUpWorkItemIds: command.followUpWorkItemIds,
    });
  });

  test("rejects decisions without an existing discussion anchor reader", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision requires discussion anchor validation");
    equal(outcome.effects.decisionRecords.length, 0);
    equal(outcome.effects.outboxEvents.length, 0);
  });

  test("rejects malformed alternatives from JSON command inputs", async () => {
    const outcome = await recordDecision(
      {
        ...command,
        alternativesConsidered: "abc",
      } as unknown as RecordDecisionCommand,
      {
        now: () => "2026-05-29T01:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
        workAnchorStateReader: createWorkAnchorStateReader([createFollowUpWorkItem("work-evidence-001")]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "decision alternatives must be string arrays");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects malformed follow-up work IDs from JSON command inputs", async () => {
    const outcome = await recordDecision(
      {
        ...command,
        followUpWorkItemIds: "work-evidence-001",
      } as unknown as RecordDecisionCommand,
      {
        now: () => "2026-05-29T01:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
        workAnchorStateReader: createWorkAnchorStateReader([createFollowUpWorkItem("work-evidence-001")]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "decision follow-up work item IDs must be string arrays");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects malformed scalar strings from JSON command inputs", async () => {
    const outcome = await recordDecision(
      {
        ...command,
        rationale: 42,
      } as unknown as RecordDecisionCommand,
      {
        now: () => "2026-05-29T01:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
        workAnchorStateReader: createWorkAnchorStateReader([createFollowUpWorkItem("work-evidence-001")]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "decision rationale is required");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects decisions when follow-up work cannot be validated", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision follow-up work requires work anchor validation");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects decisions when follow-up work is missing", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      workAnchorStateReader: createWorkAnchorStateReader([]),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision follow-up work item is missing");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects decisions when follow-up work scope does not match", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      workAnchorStateReader: createWorkAnchorStateReader([
        {
          ...createFollowUpWorkItem("work-evidence-001"),
          projectId: "project-other",
        },
      ]),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision follow-up work item scope does not match the command scope");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects decisions when the discussion anchor is missing", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(undefined),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision requires an existing discussion anchor");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects decisions when the anchor was not opened for a decision output", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader({
        ...createDiscussionAnchor(),
        expectedOutputs: [DiscussionExpectedOutput.Status],
      }),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision requires a discussion anchor expecting a decision output");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects decisions when the discussion anchor scope does not match the command", async () => {
    const outcome = await recordDecision(command, {
      now: () => "2026-05-29T01:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader({
        ...createDiscussionAnchor(),
        workItemId: "work-other-001",
      }),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "decision discussion anchor scope does not match the command scope");
    equal(outcome.effects.decisionRecords.length, 0);
  });

  test("rejects blank decision content before emitting effects", async () => {
    const outcome = await recordDecision(
      {
        ...command,
        decision: " ",
      },
      {
        now: () => "2026-05-29T01:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
        workAnchorStateReader: createWorkAnchorStateReader([createFollowUpWorkItem("work-evidence-001")]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "decision content is required");
    equal(outcome.effects.decisionRecords.length, 0);
  });
});

function createDiscussionAnchorStateReader(
  discussionAnchor: DiscussionAnchor | undefined,
): DiscussionAnchorStateReaderPort {
  return {
    findDiscussionAnchor: async () => discussionAnchor,
  };
}

function createWorkAnchorStateReader(workItems: readonly CommandWorkAnchorWorkItem[]): WorkAnchorStateReaderPort {
  return {
    findProject: async () => undefined,
    findInitiative: async () => undefined,
    findWorkItem: async (workItemId) => workItems.find((workItem) => workItem.workItemId === workItemId),
  };
}

function createFollowUpWorkItem(workItemId: string): CommandWorkAnchorWorkItem {
  return {
    workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    workItemType: WorkItemType.Task,
    title: "Attach review evidence",
    description: "Follow-up work item used by decision tests.",
    state: WorkItemState.Created,
    createdAt: "2026-05-29T00:45:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T00:45:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createDiscussionAnchor(): DiscussionAnchor {
  return {
    discussionAnchorId: command.discussionAnchorId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...(command.teamId === undefined ? {} : { teamId: command.teamId }),
    workItemId: command.workItemId,
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: "Review gate anchor",
    purpose: "Decide whether the work can enter review.",
    expectedOutputs: [DiscussionExpectedOutput.Decision],
    createdAt: "2026-05-29T00:30:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T00:30:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}
