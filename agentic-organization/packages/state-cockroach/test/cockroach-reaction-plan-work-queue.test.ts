import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  ReactionPlanStatus,
  RequiredHat,
  SupervisorChainLevel,
} from "../../domain/src/index.ts";
import {
  InboundEventConsumerName,
  ReactionPlanClaimStatus,
  ReactionPlanCompletionStatus,
} from "../../state/src/index.ts";
import {
  CockroachReactionPlanWorkQueueStatement,
  createCockroachReactionPlanWorkQueue,
  type CockroachReactionPlanWorkQueueSqlExecutor,
  type CockroachReactionPlanWorkQueueSqlStatement,
} from "../src/cockroach-reaction-plan-work-queue.ts";

const ReactionPlanTestId = {
  Claim: "reaction-claim-001",
  Plan: "reaction-plan-001",
  WorkItem: "work-runtime-001",
} as const;

const ReactionPlanTestTimestamp = {
  ClaimedAt: "2026-05-29T16:00:00.000Z",
  ClaimExpiresAt: "2026-05-29T16:05:00.000Z",
  CompletedAt: "2026-05-29T16:01:00.000Z",
  FailedAt: "2026-05-29T16:02:00.000Z",
} as const;

describe("cockroach reaction plan work queue", () => {
  test("claims planned reaction plans through a durable lease query", async () => {
    const executor = createRecordingExecutor({
      rows: [createClaimedReactionPlanRow()],
    });
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const claim = await queue.claimPlannedReactionPlans({
      claimId: ReactionPlanTestId.Claim,
      limit: 5,
      claimedAt: ReactionPlanTestTimestamp.ClaimedAt,
      claimExpiresAt: ReactionPlanTestTimestamp.ClaimExpiresAt,
      leaseDurationMs: 300_000,
    });

    equal(claim.status, ReactionPlanClaimStatus.Claimed);
    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachReactionPlanWorkQueueStatement.ClaimPlannedReactionPlans,
    ]);
    deepEqual(executor.statements[0]?.parameters, [
      5,
      ReactionPlanTestId.Claim,
      300_000,
    ]);
    equal(executor.statements[0]?.sql.includes("FOR UPDATE SKIP LOCKED"), true);
    equal(executor.statements[0]?.sql.includes("claim_expires_at <= now()"), true);
    equal(executor.statements[0]?.sql.includes("claim_expires_at = now() + ($3::INT8 * INTERVAL '1 millisecond')"), true);
    equal(executor.statements[0]?.sql.includes("$4"), false);
    equal(executor.statements[0]?.sql.includes("next_attempt_at IS NULL OR next_attempt_at <= now()"), true);
    deepEqual(claim.reactionPlans[0], {
      reactionPlanId: ReactionPlanTestId.Plan,
      consumerName: InboundEventConsumerName.V0AutomationPlanner,
      createdAt: "2026-05-29T15:59:00.000Z",
      status: ReactionPlanStatus.Claimed,
      action: createReactionPlanAction(),
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      claimId: ReactionPlanTestId.Claim,
      claimedAt: ReactionPlanTestTimestamp.ClaimedAt,
      claimExpiresAt: ReactionPlanTestTimestamp.ClaimExpiresAt,
      attemptCount: 0,
    });
  });

  test("returns empty when no reaction plans can be claimed", async () => {
    const executor = createRecordingExecutor();
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const claim = await queue.claimPlannedReactionPlans({
      claimId: ReactionPlanTestId.Claim,
      limit: 5,
      claimedAt: ReactionPlanTestTimestamp.ClaimedAt,
      claimExpiresAt: ReactionPlanTestTimestamp.ClaimExpiresAt,
      leaseDurationMs: 300_000,
    });

    deepEqual(claim, {
      status: ReactionPlanClaimStatus.Empty,
      reactionPlans: [],
    });
  });

  test("marks completion only when the active durable claim still owns the plan", async () => {
    const executor = createRecordingExecutor({
      rows: [{ reaction_plan_id: ReactionPlanTestId.Plan }],
    });
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const completion = await queue.completeReactionPlan({
      reactionPlanId: ReactionPlanTestId.Plan,
      claimId: ReactionPlanTestId.Claim,
      completedAt: ReactionPlanTestTimestamp.CompletedAt,
      result: {
        message: "triage work item created",
        createdWorkItemIds: ["work-triage-001"],
        createdDiscussionAnchorIds: [],
      },
    });

    equal(completion.status, ReactionPlanCompletionStatus.Completed);
    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachReactionPlanWorkQueueStatement.CompleteReactionPlan,
    ]);
    equal(executor.statements[0]?.sql.includes("AND claim_id = $2"), true);
    equal(executor.statements[0]?.sql.includes(`status = '${ReactionPlanStatus.Claimed}'`), true);
    equal(executor.statements[0]?.sql.includes("claim_expires_at > now()"), true);
    deepEqual(executor.statements[0]?.parameters, [
      ReactionPlanTestId.Plan,
      ReactionPlanTestId.Claim,
      {
        message: "triage work item created",
        createdWorkItemIds: ["work-triage-001"],
        createdDiscussionAnchorIds: [],
      },
    ]);
  });

  test("reports claim lost when completion or failure updates no rows", async () => {
    const executor = createRecordingExecutor();
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const completion = await queue.completeReactionPlan({
      reactionPlanId: ReactionPlanTestId.Plan,
      claimId: ReactionPlanTestId.Claim,
      completedAt: ReactionPlanTestTimestamp.CompletedAt,
      result: {
        message: "stale completion",
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    });
    const failure = await queue.failReactionPlan({
      reactionPlanId: ReactionPlanTestId.Plan,
      claimId: ReactionPlanTestId.Claim,
      failedAt: ReactionPlanTestTimestamp.FailedAt,
      failure: {
        message: "stale failure",
        retryable: true,
      },
      maxAttempts: 5,
      retryDelayMs: 60_000,
    });

    equal(completion.status, ReactionPlanCompletionStatus.ClaimLost);
    equal(failure.status, ReactionPlanCompletionStatus.ClaimLost);
  });

  test("uses durable backoff and max-attempt fencing for retryable failures", async () => {
    const executor = createRecordingExecutor({
      rows: [{ reaction_plan_id: ReactionPlanTestId.Plan }],
    });
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const failure = await queue.failReactionPlan({
      reactionPlanId: ReactionPlanTestId.Plan,
      claimId: ReactionPlanTestId.Claim,
      failedAt: ReactionPlanTestTimestamp.FailedAt,
      failure: {
        message: "temporary manager schedule saturation",
        retryable: true,
      },
      maxAttempts: 5,
      retryDelayMs: 60_000,
    });

    equal(failure.status, ReactionPlanCompletionStatus.Completed);
    deepEqual(executor.statements[0]?.parameters, [
      ReactionPlanTestId.Plan,
      ReactionPlanTestId.Claim,
      {
        message: "temporary manager schedule saturation",
        retryable: true,
      },
      60_000,
      5,
    ]);
    equal(executor.statements[0]?.sql.includes("attempt_count = attempt_count + 1"), true);
    equal(executor.statements[0]?.sql.includes("attempt_count + 1 < $5"), true);
    equal(executor.statements[0]?.sql.includes("next_attempt_at"), true);
  });

  test("terminally fails malformed durable action JSON before it can poison the claim loop", async () => {
    const executor = createRecordingExecutor({
      rows: [
        {
          ...createClaimedReactionPlanRow(),
          action_json: {
            actionType: ReactionPlanActionType.CreateSupervisorTriage,
            triggerEventId: "evt-supervisor-signal-001",
            organizationId: "org-lfg",
            projectId: "project-agentic-org",
            teamId: "team-runtime",
            workItemId: ReactionPlanTestId.WorkItem,
            supervisorSignalId: "supervisor-signal-001",
            requiredHat: "not-a-real-hat",
            reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
          },
        },
      ],
    });
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const result = await queue.claimPlannedReactionPlans({
      claimId: ReactionPlanTestId.Claim,
      limit: 5,
      claimedAt: ReactionPlanTestTimestamp.ClaimedAt,
      claimExpiresAt: ReactionPlanTestTimestamp.ClaimExpiresAt,
      leaseDurationMs: 300_000,
    });

    deepEqual(result, {
      status: ReactionPlanClaimStatus.Empty,
      reactionPlans: [],
    });
    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachReactionPlanWorkQueueStatement.ClaimPlannedReactionPlans,
      CockroachReactionPlanWorkQueueStatement.FailMalformedReactionPlan,
    ]);
    deepEqual(executor.statements[1]?.parameters, [
      ReactionPlanTestId.Plan,
      ReactionPlanTestId.Claim,
      {
        message: "invalid durable reaction plan action",
        retryable: false,
      },
    ]);
  });

  test("terminally fails supervisor triage actions without supervisor signal context", async () => {
    const executor = createRecordingExecutor({
      rows: [
        {
          ...createClaimedReactionPlanRow(),
          action_json: {
            ...createReactionPlanAction(),
            supervisorSignalId: undefined,
          },
        },
      ],
    });
    const queue = createCockroachReactionPlanWorkQueue({ executor });

    const result = await queue.claimPlannedReactionPlans({
      claimId: ReactionPlanTestId.Claim,
      limit: 5,
      claimedAt: ReactionPlanTestTimestamp.ClaimedAt,
      claimExpiresAt: ReactionPlanTestTimestamp.ClaimExpiresAt,
      leaseDurationMs: 300_000,
    });

    deepEqual(result, {
      status: ReactionPlanClaimStatus.Empty,
      reactionPlans: [],
    });
    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachReactionPlanWorkQueueStatement.ClaimPlannedReactionPlans,
      CockroachReactionPlanWorkQueueStatement.FailMalformedReactionPlan,
    ]);
  });
});

function createRecordingExecutor(
  input: { rows?: readonly unknown[] } = {},
): CockroachReactionPlanWorkQueueSqlExecutor & {
  statements: CockroachReactionPlanWorkQueueSqlStatement[];
} {
  const statements: CockroachReactionPlanWorkQueueSqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachReactionPlanWorkQueueSqlStatement) => {
      statements.push(statement);

      return {
        rows: (input.rows ?? []) as readonly Row[],
      };
    },
  };
}

function createClaimedReactionPlanRow(): Record<string, unknown> {
  return {
    reaction_plan_id: ReactionPlanTestId.Plan,
    consumer_name: InboundEventConsumerName.V0AutomationPlanner,
    created_at: new Date("2026-05-29T15:59:00.000Z"),
    action_json: createReactionPlanAction(),
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    claim_id: ReactionPlanTestId.Claim,
    claimed_at: new Date(ReactionPlanTestTimestamp.ClaimedAt),
    claim_expires_at: new Date(ReactionPlanTestTimestamp.ClaimExpiresAt),
    attempt_count: 0,
    next_attempt_at: null,
  };
}

function createReactionPlanAction() {
  return {
    actionType: ReactionPlanActionType.CreateSupervisorTriage,
    triggerEventId: "evt-supervisor-signal-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: ReactionPlanTestId.WorkItem,
    supervisorSignalId: "supervisor-signal-001",
    targetLevel: SupervisorChainLevel.Manager,
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
  };
}
