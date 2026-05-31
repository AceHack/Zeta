import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandType,
  ScheduleBlockState,
  ScheduleBlockType,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import {
  CommandScheduleAuthorityDecisionStatus,
  CommandScheduleAuthorityDenialReason,
  type WorkScheduleBlockAuthorityReaderPort,
} from "../src/ports.ts";
import {
  ScheduleAuthorityMessage,
  createScheduleBlockCommandAuthority,
} from "../src/schedule-authority.ts";
import { ObserveCommandType } from "../src/observe.ts";

describe("schedule block command authority", () => {
  test("does not require a schedule block for discussion anchor routing metadata", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.CreateDiscussionAnchor));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.NotRequired,
    });
  });

  test("allows runtime commands when an active matching schedule block permits the command type", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([createScheduleBlock()]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.RecordDecision));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Allowed,
      scheduleBlockId: "work-schedule-block-001",
    });
  });

  test("does not require a schedule block for scheduling commands", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.ScheduleWorkBlock));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.NotRequired,
    });
  });

  test("denies runtime commands when no current schedule block is available", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.RecordDecision));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockRequired,
      message: ScheduleAuthorityMessage.BlockRequired,
    });
  });

  test("requires current schedule authority for supervisor signal triage", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.TriageSupervisorSignal));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockRequired,
      message: ScheduleAuthorityMessage.BlockRequired,
    });
  });

  test("requires current schedule authority for quality gate evaluations", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([]),
    });

    const decision = await authority.authorizeCommandSchedule(
      createScheduleRequest(CommandType.RecordQualityGateEvaluation),
    );

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockRequired,
      message: ScheduleAuthorityMessage.BlockRequired,
    });
  });

  test("requires current schedule authority for observe lifecycle transitions", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([]),
    });

    const decision = await authority.authorizeCommandSchedule(
      createScheduleRequest(ObserveCommandType.LifecycleTransition),
    );

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockRequired,
      message: ScheduleAuthorityMessage.BlockRequired,
    });
  });

  test("allows observe lifecycle transitions during prioritized work blocks", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([
        createScheduleBlock({
          blockType: ScheduleBlockType.PrioritizedWork,
        }),
      ]),
    });

    const decision = await authority.authorizeCommandSchedule(
      createScheduleRequest(ObserveCommandType.LifecycleTransition),
    );

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Allowed,
      scheduleBlockId: "work-schedule-block-001",
    });
  });

  test("denies observe lifecycle transitions during scheduled-but-not-active work blocks", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([
        createScheduleBlock({
          blockType: ScheduleBlockType.PrioritizedWork,
          state: ScheduleBlockState.Scheduled,
        }),
      ]),
    });

    const decision = await authority.authorizeCommandSchedule(
      createScheduleRequest(ObserveCommandType.LifecycleTransition),
    );

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockTypeDenied,
      message: ScheduleAuthorityMessage.TypeDenied,
      scheduleBlockId: "work-schedule-block-001",
    });
  });

  test("allows quality gate evaluations during review schedule blocks", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([
        createScheduleBlock({
          blockType: ScheduleBlockType.Review,
        }),
      ]),
    });

    const decision = await authority.authorizeCommandSchedule(
      createScheduleRequest(CommandType.RecordQualityGateEvaluation),
    );

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Allowed,
      scheduleBlockId: "work-schedule-block-001",
    });
  });

  test("denies runtime commands when active schedule scope does not match the command", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([
        createScheduleBlock({
          workItemId: "work-other-001",
        }),
      ]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.RecordDecision));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockScopeMismatch,
      message: ScheduleAuthorityMessage.ScopeMismatch,
      scheduleBlockId: "work-schedule-block-001",
    });
  });

  test("denies runtime commands when current schedule block type does not allow the command", async () => {
    const authority = createScheduleBlockCommandAuthority({
      scheduleBlockReader: createScheduleBlockReader([
        createScheduleBlock({
          blockType: ScheduleBlockType.MemoryMaintenance,
        }),
      ]),
    });

    const decision = await authority.authorizeCommandSchedule(createScheduleRequest(CommandType.RecordDecision));

    deepEqual(decision, {
      status: CommandScheduleAuthorityDecisionStatus.Denied,
      reason: CommandScheduleAuthorityDenialReason.ScheduleBlockTypeDenied,
      message: ScheduleAuthorityMessage.TypeDenied,
      scheduleBlockId: "work-schedule-block-001",
    });
  });
});

function createScheduleBlockReader(blocks: readonly WorkScheduleBlock[]): WorkScheduleBlockAuthorityReaderPort {
  return {
    findAuthorizingScheduleBlocks: async () => blocks,
  };
}

function createScheduleRequest(commandType: CommandType | string) {
  return {
    commandId: "cmd-001",
    commandType,
    actor: {
      agentId: "agent-manager-001",
      hatAssignmentId: "hat-manager-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-runtime-001",
    },
    evaluatedAt: "2026-05-29T16:00:00.000Z",
  };
}

function createScheduleBlock(input: Partial<WorkScheduleBlock> = {}): WorkScheduleBlock {
  return {
    workScheduleBlockId: "work-schedule-block-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    assignedAgentId: "agent-manager-001",
    assignedHatAssignmentId: "hat-manager-001",
    blockType: ScheduleBlockType.Meeting,
    state: ScheduleBlockState.Active,
    title: "Supervisor triage",
    purpose: "Triage supervisor signal",
    startsAt: "2026-05-29T15:55:00.000Z",
    endsAt: "2026-05-29T16:25:00.000Z",
    scheduledAt: "2026-05-29T15:00:00.000Z",
    scheduledBy: {
      agentId: "agent-director-001",
      hatAssignmentId: "hat-director-001",
    },
    metadata: {
      updatedAt: "2026-05-29T15:00:00.000Z",
      version: 1,
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
    },
    ...input,
  };
}
