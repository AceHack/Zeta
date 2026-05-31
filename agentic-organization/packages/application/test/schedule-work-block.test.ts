import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  HatAssignmentAuthorityState,
  ScheduleBlockState,
  ScheduleBlockType,
  type DiscussionAnchor,
  type HatAssignmentAuthoritySnapshot,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import { CommandErrorCode, CommandResultArtifactType, CommandResultStatus } from "../src/index.ts";
import { scheduleWorkBlock, type ScheduleWorkBlockCommand } from "../src/handlers/schedule-work-block.ts";
import type {
  CommandWorkAnchorWorkItem,
  DiscussionAnchorStateReaderPort,
  HatAssignmentAuthorityReaderPort,
  WorkAnchorStateReaderPort,
} from "../src/ports.ts";

const command: ScheduleWorkBlockCommand = {
  commandId: "cmd-schedule-001",
  type: CommandType.ScheduleWorkBlock,
  idempotencyKey: "idem-schedule-001",
  requestHash: "hash-schedule-001",
  correlationId: "corr-schedule-001",
  causationId: "cause-schedule-001",
  traceId: "trace-schedule-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  actor: {
    agentId: "agent-em-001",
    hatAssignmentId: "hat-assignment-em-001",
  },
  teamId: "team-runtime",
  workItemId: "work-runtime-001",
  discussionAnchorId: "discussion-anchor-001",
  assignedAgentId: "agent-developer-001",
  assignedHatAssignmentId: "hat-assignment-dev-001",
  blockType: ScheduleBlockType.PrioritizedWork,
  title: "Implement durable schedule block V0",
  purpose: "Allocate focused implementation time for the assigned hat.",
  startsAt: "2026-05-29T14:00:00.000Z",
  endsAt: "2026-05-29T15:30:00.000Z",
};

describe("schedule work block handler", () => {
  test("schedules a work-item-scoped block with durable traceability", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Accepted);
    ok(outcome.result.workScheduleBlock);
    deepEqual(outcome.result.artifacts, [
      {
        artifactType: CommandResultArtifactType.WorkScheduleBlock,
        artifactId: "work-schedule-block-001",
        label: command.title,
      },
    ]);
    deepEqual(outcome.result.emittedEvents, [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.WorkScheduleBlockScheduled,
        aggregateId: "work-schedule-block-001",
        aggregateType: AgenticAggregateType.WorkScheduleBlock,
      },
    ]);
    deepEqual(outcome.effects.workScheduleBlocks, [
      {
        workScheduleBlockId: "work-schedule-block-001",
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.teamId,
        workItemId: command.workItemId,
        discussionAnchorId: command.discussionAnchorId,
        assignedAgentId: command.assignedAgentId,
        assignedHatAssignmentId: command.assignedHatAssignmentId,
        blockType: command.blockType,
        state: ScheduleBlockState.Scheduled,
        title: command.title,
        purpose: command.purpose,
        startsAt: command.startsAt,
        endsAt: command.endsAt,
        scheduledAt: "2026-05-29T13:45:00.000Z",
        scheduledBy: command.actor,
        metadata: {
          updatedAt: "2026-05-29T13:45:00.000Z",
          version: 1,
          correlationId: command.correlationId,
          causationId: command.causationId,
          traceId: command.traceId,
        },
      },
    ]);
    deepEqual(outcome.effects.outboxEvents[0]?.envelope.payload, {
      workScheduleBlockId: "work-schedule-block-001",
      assignedAgentId: command.assignedAgentId,
      assignedHatAssignmentId: command.assignedHatAssignmentId,
      blockType: command.blockType,
      state: ScheduleBlockState.Scheduled,
      title: command.title,
      purpose: command.purpose,
      startsAt: command.startsAt,
      endsAt: command.endsAt,
      discussionAnchorId: command.discussionAnchorId,
    });
  });

  test("rejects scheduling without a work item state reader", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block requires work item validation");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects scheduling against a missing work item", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
      workAnchorStateReader: createWorkAnchorStateReader([]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block work item is missing");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects malformed block type from JSON command inputs", async () => {
    const outcome = await scheduleWorkBlock(
      {
        ...command,
        blockType: "coffee_break",
      } as unknown as ScheduleWorkBlockCommand,
      {
        now: () => "2026-05-29T13:45:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
        workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "schedule block type is invalid");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects malformed scalar strings from JSON command inputs", async () => {
    const outcome = await scheduleWorkBlock(
      {
        ...command,
        assignedAgentId: 42,
      } as unknown as ScheduleWorkBlockCommand,
      {
        now: () => "2026-05-29T13:45:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
        workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "schedule block assigned agent is required");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects a non-advancing schedule window", async () => {
    const outcome = await scheduleWorkBlock(
      {
        ...command,
        endsAt: command.startsAt,
      },
      {
        now: () => "2026-05-29T13:45:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
        workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "schedule block end time must be after start time");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects date-only schedule windows before emitting effects", async () => {
    const outcome = await scheduleWorkBlock(
      {
        ...command,
        startsAt: "2026-05-29",
      },
      {
        now: () => "2026-05-29T13:45:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
        workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "schedule block start time is invalid");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects discussion anchors outside the command scope", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader(createHatAssignmentAuthority()),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader({
        ...createDiscussionAnchor(),
        workItemId: "work-other-001",
      }),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block discussion anchor scope does not match the command scope");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects scheduling without hat assignment authority validation", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block requires hat assignment authority validation");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects scheduling against inactive hat assignment authority", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader({
        ...createHatAssignmentAuthority(),
        state: HatAssignmentAuthorityState.Revoked,
      }),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block assigned hat assignment is not active");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects scheduling when the agent does not hold the hat assignment", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader({
        ...createHatAssignmentAuthority(),
        assignedAgentId: "agent-other-001",
      }),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block assigned agent does not match hat assignment");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });

  test("rejects scheduling when the hat assignment authority scope differs from the work", async () => {
    const outcome = await scheduleWorkBlock(command, {
      now: () => "2026-05-29T13:45:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      hatAssignmentAuthorityReader: createHatAssignmentAuthorityReader({
        ...createHatAssignmentAuthority(),
        teamId: "team-other",
      }),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem()]),
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "schedule block assigned hat assignment scope does not match the command scope");
    equal(outcome.effects.workScheduleBlocks.length, 0);
  });
});

function createWorkAnchorStateReader(workItems: readonly CommandWorkAnchorWorkItem[]): WorkAnchorStateReaderPort {
  return {
    findProject: async () => undefined,
    findInitiative: async () => undefined,
    findWorkItem: async (workItemId) => workItems.find((workItem) => workItem.workItemId === workItemId),
  };
}

function createDiscussionAnchorStateReader(
  discussionAnchor: DiscussionAnchor | undefined,
): DiscussionAnchorStateReaderPort {
  return {
    findDiscussionAnchor: async () => discussionAnchor,
  };
}

function createHatAssignmentAuthorityReader(
  authority: HatAssignmentAuthoritySnapshot | undefined,
): HatAssignmentAuthorityReaderPort {
  return {
    findHatAssignmentAuthority: async () => authority,
  };
}

function createHatAssignmentAuthority(): HatAssignmentAuthoritySnapshot {
  return {
    hatAssignmentId: command.assignedHatAssignmentId,
    hatId: "backend_implementer",
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...(command.teamId === undefined ? {} : { teamId: command.teamId }),
    assignedAgentId: command.assignedAgentId,
    state: HatAssignmentAuthorityState.Active,
  };
}

function createWorkItem(): CommandWorkAnchorWorkItem {
  return {
    workItemId: command.workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    workItemType: WorkItemType.Task,
    title: "Implement durable schedule block V0",
    description: "Create the first schedulable work allocation primitive.",
    state: WorkItemState.Ready,
    createdAt: "2026-05-29T12:00:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T12:00:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createDiscussionAnchor(): DiscussionAnchor {
  return {
    discussionAnchorId: command.discussionAnchorId!,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...(command.teamId === undefined ? {} : { teamId: command.teamId }),
    workItemId: command.workItemId,
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: "Schedule implementation block",
    purpose: "Coordinate the block of focused work.",
    expectedOutputs: [DiscussionExpectedOutput.Status],
    createdAt: "2026-05-29T13:30:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T13:30:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}
