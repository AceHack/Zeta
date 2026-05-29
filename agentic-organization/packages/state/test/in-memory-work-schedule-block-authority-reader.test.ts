import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { ScheduleBlockState, ScheduleBlockType, type WorkScheduleBlock } from "../../domain/src/index.ts";
import { createInMemoryWorkScheduleBlockAuthorityReader } from "../src/in-memory-work-schedule-block-authority-reader.ts";

describe("in-memory work schedule block authority reader", () => {
  test("returns active or scheduled blocks for the assigned actor hat inside the evaluated time window", async () => {
    const reader = createInMemoryWorkScheduleBlockAuthorityReader({
      getWorkScheduleBlocks: () => [
        createScheduleBlock(),
        createScheduleBlock({
          workScheduleBlockId: "work-schedule-block-future",
          startsAt: "2026-05-29T16:30:00.000Z",
          endsAt: "2026-05-29T17:00:00.000Z",
        }),
        createScheduleBlock({
          workScheduleBlockId: "work-schedule-block-other-hat",
          assignedHatAssignmentId: "hat-other-001",
        }),
        createScheduleBlock({
          workScheduleBlockId: "work-schedule-block-scheduled",
          state: ScheduleBlockState.Scheduled,
        }),
        createScheduleBlock({
          workScheduleBlockId: "work-schedule-block-completed",
          state: ScheduleBlockState.Completed,
        }),
      ],
    });

    const blocks = await reader.findAuthorizingScheduleBlocks({
      agentId: "agent-manager-001",
      hatAssignmentId: "hat-manager-001",
      evaluatedAt: "2026-05-29T16:00:00.000Z",
    });

    deepEqual(blocks.map((block) => block.workScheduleBlockId), [
      "work-schedule-block-001",
      "work-schedule-block-scheduled",
    ]);
  });

  test("returns cloned blocks so callers cannot mutate stored schedule state", async () => {
    const sourceBlock = createScheduleBlock();
    const reader = createInMemoryWorkScheduleBlockAuthorityReader({
      getWorkScheduleBlocks: () => [sourceBlock],
    });

    const blocks = await reader.findAuthorizingScheduleBlocks({
      agentId: "agent-manager-001",
      hatAssignmentId: "hat-manager-001",
      evaluatedAt: "2026-05-29T16:00:00.000Z",
    });

    blocks[0]!.metadata.version = 99;

    equal(sourceBlock.metadata.version, 1);
  });
});

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
