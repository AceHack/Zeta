import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  InboundEventConsumerName,
  createInMemoryReactionPlanWorkQueue,
  type ReactionPlanExecutionFailureRecord,
  type ReactionPlanExecutionRecord,
  type ReactionPlanRecord,
} from "../../state/src/index.ts";
import {
  ReactionPlanActionType,
  ReactionPlanReason,
  ReactionPlanStatus,
  RequiredHat,
  SupervisorChainLevel,
} from "../../domain/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  createReactionPlanExecutor,
  type ReactionPlanActionExecutionResult,
} from "../src/reaction-plan-executor.ts";

describe("reaction plan executor", () => {
  test("claims planned reaction work and completes it through a generic action executor port", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);
    const executions: string[] = [];
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:01:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async (action, context) => {
          executions.push(`${context.claimId}:${action.actionType}`);
          return createSucceededExecutionResult();
        },
      },
    });

    const result = await executor.executeNextBatch();

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Succeeded,
      claimedCount: 1,
      succeededCount: 1,
      failedCount: 0,
      claimLostCount: 0,
    });
    deepEqual(executions, [`reaction-claim-001:${ReactionPlanActionType.CreateSupervisorTriage}`]);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Completed]);
  });

  test("returns idle without invoking action executors when no reaction work is claimable", async () => {
    const executor = createReactionPlanExecutor({
      queue: createInMemoryReactionPlanWorkQueue([]),
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: () => "2026-05-29T16:00:00.000Z",
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async () => {
          throw new Error("action executor should not be called");
        },
      },
    });

    const result = await executor.executeNextBatch();

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Idle,
      claimedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      claimLostCount: 0,
    });
  });

  test("marks nonretryable reaction executions failed through the same leased queue", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:01:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async () => createFailedExecutionResult(false),
      },
    });

    const result = await executor.executeNextBatch();

    equal(result.status, ReactionPlanExecutionStatus.Failed);
    equal(result.failedCount, 1);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Failed]);
  });

  test("turns thrown action failures into durable retryable reaction failure evidence", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:01:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async () => {
          throw new Error("manager command adapter unavailable");
        },
      },
    });

    const result = await executor.executeNextBatch();

    equal(result.status, ReactionPlanExecutionStatus.Failed);
    equal(result.failedCount, 1);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Planned]);
  });

  test("does not execute a claimed reaction plan when the lease expired before the action starts", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:06:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async () => {
          throw new Error("expired lease must not reach the action executor");
        },
      },
    });

    const result = await executor.executeNextBatch();

    equal(result.status, ReactionPlanExecutionStatus.ClaimLost);
    equal(result.claimLostCount, 1);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Claimed]);
  });

  test("passes a stable reaction-plan idempotency key to action executors", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);
    const actionIdempotencyKeys: string[] = [];
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:01:00.000Z", "2026-05-29T16:02:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async (_action, context) => {
          actionIdempotencyKeys.push(context.actionIdempotencyKey);
          return createSucceededExecutionResult();
        },
      },
    });

    await executor.executeNextBatch();

    deepEqual(actionIdempotencyKeys, ["reaction-plan-001:create_supervisor_triage"]);
  });

  test("passes the persisted traceparent to action executors so delayed work continues the ingress trace", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([
      {
        ...createReactionPlanRecord(),
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      },
    ]);
    const traceparents: Array<string | undefined> = [];
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:01:00.000Z", "2026-05-29T16:02:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async (_action, context) => {
          traceparents.push(context.traceparent);
          return createSucceededExecutionResult();
        },
      },
    });

    await executor.executeNextBatch();

    deepEqual(traceparents, ["00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"]);
  });

  test("returns retryable reaction failures to planned work instead of making automation terminal", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);
    const executor = createReactionPlanExecutor({
      queue,
      batchSize: 1,
      leaseDurationMs: 300_000,
      now: createClock(["2026-05-29T16:00:00.000Z", "2026-05-29T16:01:00.000Z"]),
      createId: () => "reaction-claim-001",
      actionExecutor: {
        executeReactionPlanAction: async () => createFailedExecutionResult(),
      },
    });

    const result = await executor.executeNextBatch();

    equal(result.status, ReactionPlanExecutionStatus.Failed);
    equal(result.failedCount, 1);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Planned]);
  });
});

function createSucceededExecutionResult(): ReactionPlanActionExecutionResult {
  const result: ReactionPlanExecutionRecord = {
    message: "triage work item created",
    createdWorkItemIds: ["work-triage-001"],
    createdDiscussionAnchorIds: [],
  };

  return {
    status: ReactionPlanExecutionStatus.Succeeded,
    result,
  };
}

function createFailedExecutionResult(retryable = true): ReactionPlanActionExecutionResult {
  const failure: ReactionPlanExecutionFailureRecord = {
    message: "manager schedule saturated",
    retryable,
  };

  return {
    status: ReactionPlanExecutionStatus.Failed,
    failure,
  };
}

function createClock(values: readonly string[]): () => string {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)]!;
}

function createReactionPlanRecord(): ReactionPlanRecord {
  return {
    reactionPlanId: "reaction-plan-001",
    consumerName: InboundEventConsumerName.V0AutomationPlanner,
    createdAt: "2026-05-29T15:59:00.000Z",
    status: ReactionPlanStatus.Planned,
    action: {
      actionType: ReactionPlanActionType.CreateSupervisorTriage,
      triggerEventId: "evt-supervisor-signal-001",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-runtime-001",
      supervisorSignalId: "supervisor-signal-001",
      targetLevel: SupervisorChainLevel.Manager,
      requiredHat: RequiredHat.EngineeringManager,
      reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    },
  };
}
