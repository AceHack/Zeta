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
  ReactionPlanClaimStatus,
  ReactionPlanCompletionStatus,
  InboundEventConsumerName,
  createInMemoryReactionPlanWorkQueue,
  type ReactionPlanRecord,
} from "../src/index.ts";

describe("in-memory reaction plan work queue", () => {
  test("claims planned reaction plans with a lease and marks completion by claim", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    const claim = await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-001",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    equal(claim.status, ReactionPlanClaimStatus.Claimed);
    equal(claim.reactionPlans.length, 1);
    equal(claim.reactionPlans[0]?.claimId, "reaction-claim-001");

    const completion = await queue.completeReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-001",
      completedAt: "2026-05-29T16:01:00.000Z",
      result: {
        message: "triage work item created",
        createdWorkItemIds: ["work-triage-001"],
        createdDiscussionAnchorIds: [],
      },
    });

    equal(completion.status, ReactionPlanCompletionStatus.Completed);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Completed]);
  });

  test("preserves the originating traceparent across durable claim and retry transitions", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([
      {
        ...createReactionPlanRecord(),
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      },
    ]);

    const claim = await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    equal(claim.reactionPlans[0]?.traceparent, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

    await queue.failReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-owner",
      failedAt: "2026-05-29T16:01:00.000Z",
      failure: {
        message: "temporary manager schedule saturation",
        retryable: true,
      },
      maxAttempts: 5,
      retryDelayMs: 60_000,
    });

    equal(queue.snapshot[0]?.traceparent, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
  });

  test("rejects stale completion attempts for plans claimed by another worker", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    const completion = await queue.completeReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-stale",
      completedAt: "2026-05-29T16:01:00.000Z",
      result: {
        message: "stale completion",
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    });

    equal(completion.status, ReactionPlanCompletionStatus.ClaimLost);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Claimed]);
  });

  test("rejects completion attempts after the active lease expires", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    const completion = await queue.completeReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-owner",
      completedAt: "2026-05-29T16:05:00.000Z",
      result: {
        message: "expired completion",
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    });

    equal(completion.status, ReactionPlanCompletionStatus.ClaimLost);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Claimed]);
  });

  test("rejects failure attempts after the active lease expires", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    const failure = await queue.failReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-owner",
      failedAt: "2026-05-29T16:05:00.000Z",
      failure: {
        message: "expired failure",
        retryable: true,
      },
      maxAttempts: 5,
      retryDelayMs: 60_000,
    });

    equal(failure.status, ReactionPlanCompletionStatus.ClaimLost);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Claimed]);
  });

  test("reclaims expired reaction plan leases", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-first",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    const claim = await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-second",
      limit: 1,
      claimedAt: "2026-05-29T16:06:00.000Z",
      claimExpiresAt: "2026-05-29T16:11:00.000Z",
      leaseDurationMs: 300_000,
    });

    equal(claim.status, ReactionPlanClaimStatus.Claimed);
    equal(claim.reactionPlans[0]?.claimId, "reaction-claim-second");
  });

  test("reclaims a reaction plan at the exact lease boundary", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-first",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    const claim = await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-second",
      limit: 1,
      claimedAt: "2026-05-29T16:05:00.000Z",
      claimExpiresAt: "2026-05-29T16:10:00.000Z",
      leaseDurationMs: 300_000,
    });

    equal(claim.status, ReactionPlanClaimStatus.Claimed);
    equal(claim.reactionPlans[0]?.claimId, "reaction-claim-second");
  });

  test("returns retryable failures to planned state for later autonomous recovery", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });

    const failure = await queue.failReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-owner",
      failedAt: "2026-05-29T16:01:00.000Z",
      failure: {
        message: "temporary manager schedule saturation",
        retryable: true,
      },
      maxAttempts: 5,
      retryDelayMs: 60_000,
    });

    equal(failure.status, ReactionPlanCompletionStatus.Completed);
    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Planned]);
    equal(queue.snapshot[0]?.attemptCount, 1);
    equal(queue.snapshot[0]?.nextAttemptAt, "2026-05-29T16:02:00.000Z");
  });

  test("does not immediately reclaim retryable failures before their next attempt window", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([createReactionPlanRecord()]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });
    await queue.failReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-owner",
      failedAt: "2026-05-29T16:01:00.000Z",
      failure: {
        message: "temporary manager schedule saturation",
        retryable: true,
      },
      maxAttempts: 5,
      retryDelayMs: 60_000,
    });

    const immediateClaim = await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-too-soon",
      limit: 1,
      claimedAt: "2026-05-29T16:01:30.000Z",
      claimExpiresAt: "2026-05-29T16:06:30.000Z",
      leaseDurationMs: 300_000,
    });
    const delayedClaim = await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-after-backoff",
      limit: 1,
      claimedAt: "2026-05-29T16:02:00.000Z",
      claimExpiresAt: "2026-05-29T16:07:00.000Z",
      leaseDurationMs: 300_000,
    });

    equal(immediateClaim.status, ReactionPlanClaimStatus.Empty);
    equal(delayedClaim.status, ReactionPlanClaimStatus.Claimed);
  });

  test("marks retryable failures terminal when max attempts is exhausted", async () => {
    const queue = createInMemoryReactionPlanWorkQueue([
      {
        ...createReactionPlanRecord(),
        attemptCount: 2,
      },
    ]);

    await queue.claimPlannedReactionPlans({
      claimId: "reaction-claim-owner",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });
    await queue.failReactionPlan({
      reactionPlanId: "reaction-plan-001",
      claimId: "reaction-claim-owner",
      failedAt: "2026-05-29T16:01:00.000Z",
      failure: {
        message: "temporary manager schedule saturation",
        retryable: true,
      },
      maxAttempts: 3,
      retryDelayMs: 60_000,
    });

    deepEqual(queue.snapshot.map((reactionPlan) => reactionPlan.status), [ReactionPlanStatus.Failed]);
    equal(queue.snapshot[0]?.attemptCount, 3);
    equal(queue.snapshot[0]?.nextAttemptAt, undefined);
  });
});

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
