import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import { ScheduleBlockState, ScheduleBlockType } from "../../domain/src/index.ts";
import {
  CockroachWorkScheduleBlockAuthorityReaderStatement,
  createCockroachWorkScheduleBlockAuthorityReader,
  type CockroachWorkScheduleBlockAuthoritySqlExecutor,
  type CockroachWorkScheduleBlockAuthoritySqlStatement,
} from "../src/index.ts";

describe("cockroach work schedule block authority reader", () => {
  test("reads current scheduled and active blocks behind the generic schedule authority port", async () => {
    const executor = createRecordingExecutor();
    const reader = createCockroachWorkScheduleBlockAuthorityReader({ executor });

    const blocks = await reader.findAuthorizingScheduleBlocks({
      agentId: "agent-dev-001",
      hatAssignmentId: "hat-assignment-dev-001",
      evaluatedAt: "2026-05-29T16:00:00.000Z",
    });

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachWorkScheduleBlockAuthorityReaderStatement.FindAuthorizingScheduleBlocks,
    ]);
    deepEqual(executor.statements[0]?.parameters, [
      "agent-dev-001",
      "hat-assignment-dev-001",
      "2026-05-29T16:00:00.000Z",
      ScheduleBlockState.Active,
      ScheduleBlockState.Scheduled,
    ]);
    deepEqual(blocks, [
      {
        workScheduleBlockId: "work-schedule-block-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-runtime-001",
        discussionAnchorId: "discussion-anchor-001",
        assignedAgentId: "agent-dev-001",
        assignedHatAssignmentId: "hat-assignment-dev-001",
        blockType: ScheduleBlockType.PrioritizedWork,
        state: ScheduleBlockState.Scheduled,
        title: "Implement runtime telemetry",
        purpose: "Build the runtime telemetry proof.",
        startsAt: "2026-05-29T15:45:00.000Z",
        endsAt: "2026-05-29T16:45:00.000Z",
        scheduledAt: "2026-05-29T15:00:00.000Z",
        scheduledBy: {
          agentId: "agent-manager-001",
          hatAssignmentId: "hat-manager-001",
        },
        metadata: {
          updatedAt: "2026-05-29T15:00:00.000Z",
          version: 1,
          correlationId: "corr-schedule-001",
          causationId: "cause-schedule-001",
          traceId: "trace-schedule-001",
        },
      },
    ]);
  });

  test("drops malformed durable rows instead of granting schedule authority", async () => {
    const executor = createRecordingExecutor({
      blockType: "nap",
      state: "drifting",
    });
    const reader = createCockroachWorkScheduleBlockAuthorityReader({ executor });

    deepEqual(
      await reader.findAuthorizingScheduleBlocks({
        agentId: "agent-dev-001",
        hatAssignmentId: "hat-assignment-dev-001",
        evaluatedAt: "2026-05-29T16:00:00.000Z",
      }),
      [],
    );
  });
});

function createRecordingExecutor(
  input: {
    blockType?: unknown;
    state?: unknown;
  } = {},
): CockroachWorkScheduleBlockAuthoritySqlExecutor & {
  statements: CockroachWorkScheduleBlockAuthoritySqlStatement[];
} {
  const statements: CockroachWorkScheduleBlockAuthoritySqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachWorkScheduleBlockAuthoritySqlStatement) => {
      statements.push(statement);

      return {
        rows: [
          {
            work_schedule_block_id: "work-schedule-block-001",
            organization_id: "org-lfg",
            project_id: "project-agentic-org",
            team_id: "team-runtime",
            work_item_id: "work-runtime-001",
            discussion_anchor_id: "discussion-anchor-001",
            assigned_agent_id: "agent-dev-001",
            assigned_hat_assignment_id: "hat-assignment-dev-001",
            block_type: input.blockType ?? ScheduleBlockType.PrioritizedWork,
            state: input.state ?? ScheduleBlockState.Scheduled,
            title: "Implement runtime telemetry",
            purpose: "Build the runtime telemetry proof.",
            starts_at: new Date("2026-05-29T15:45:00.000Z"),
            ends_at: new Date("2026-05-29T16:45:00.000Z"),
            scheduled_by_agent_id: "agent-manager-001",
            scheduled_by_hat_assignment_id: "hat-manager-001",
            scheduled_at: new Date("2026-05-29T15:00:00.000Z"),
            updated_at: new Date("2026-05-29T15:00:00.000Z"),
            version: "1",
            correlation_id: "corr-schedule-001",
            causation_id: "cause-schedule-001",
            trace_id: "trace-schedule-001",
          },
        ] as readonly unknown[] as readonly Row[],
      };
    },
  };
}
