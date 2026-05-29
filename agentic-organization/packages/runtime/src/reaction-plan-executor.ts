import {
  ReactionPlanClaimStatus,
  ReactionPlanCompletionStatus,
  type ClaimedReactionPlanRecord,
  type ReactionPlanExecutionFailureRecord,
  type ReactionPlanExecutionRecord,
  type ReactionPlanWorkQueue,
} from "../../state/src/index.ts";
import type { ReactionPlanAction } from "./reaction-plan.ts";

export const ReactionPlanExecutorIdPrefix = {
  Claim: "reaction-claim",
} as const;

export type ReactionPlanExecutorIdPrefix =
  (typeof ReactionPlanExecutorIdPrefix)[keyof typeof ReactionPlanExecutorIdPrefix];

export const ReactionPlanExecutionStatus = {
  ClaimLost: "claim_lost",
  Failed: "failed",
  Idle: "idle",
  Succeeded: "succeeded",
} as const;

export type ReactionPlanExecutionStatus =
  (typeof ReactionPlanExecutionStatus)[keyof typeof ReactionPlanExecutionStatus];

export const ReactionPlanExecutorFailureMessage = {
  ActionExecutorThrew: "reaction action executor threw",
} as const;

export type ReactionPlanExecutorFailureMessage =
  (typeof ReactionPlanExecutorFailureMessage)[keyof typeof ReactionPlanExecutorFailureMessage];

export type ReactionPlanActionExecutionContext = {
  reactionPlanId: string;
  claimId: string;
  actionIdempotencyKey: string;
  claimExpiresAt: string;
};

export type ReactionPlanActionExecutionResult =
  | {
      status: typeof ReactionPlanExecutionStatus.Succeeded;
      result: ReactionPlanExecutionRecord;
    }
  | {
      status: typeof ReactionPlanExecutionStatus.Failed;
      failure: ReactionPlanExecutionFailureRecord;
    };

export type ReactionPlanActionExecutorPort = {
  executeReactionPlanAction: (
    action: ReactionPlanAction,
    context: ReactionPlanActionExecutionContext,
  ) => Promise<ReactionPlanActionExecutionResult>;
};

export const DefaultReactionPlanRetryPolicy = {
  MaxAttempts: 5,
  RetryDelayMs: 60_000,
} as const;

export type ReactionPlanRetryPolicy = {
  maxAttempts: number;
  retryDelayMs: number;
};

export type CreateReactionPlanExecutorInput = {
  queue: ReactionPlanWorkQueue;
  actionExecutor: ReactionPlanActionExecutorPort;
  batchSize: number;
  leaseDurationMs: number;
  retryPolicy?: ReactionPlanRetryPolicy | undefined;
  now: () => string;
  createId: (prefix: ReactionPlanExecutorIdPrefix) => string;
};

export type ExecuteReactionPlansResult = {
  status: ReactionPlanExecutionStatus;
  claimedCount: number;
  succeededCount: number;
  failedCount: number;
  claimLostCount: number;
};

export type ReactionPlanExecutor = {
  executeNextBatch: () => Promise<ExecuteReactionPlansResult>;
};

export function createReactionPlanExecutor(input: CreateReactionPlanExecutorInput): ReactionPlanExecutor {
  return {
    executeNextBatch: async () => {
      const claimId = input.createId(ReactionPlanExecutorIdPrefix.Claim);
      const claimedAt = input.now();
      const claim = await input.queue.claimPlannedReactionPlans({
        claimId,
        limit: input.batchSize,
        claimedAt,
        claimExpiresAt: new Date(Date.parse(claimedAt) + input.leaseDurationMs).toISOString(),
        leaseDurationMs: input.leaseDurationMs,
      });

      if (claim.status === ReactionPlanClaimStatus.Empty) {
        return createExecutionSummary(ReactionPlanExecutionStatus.Idle);
      }

      const summary = createExecutionSummary(ReactionPlanExecutionStatus.Succeeded, claim.reactionPlans.length);

      for (const reactionPlan of claim.reactionPlans) {
        await executeClaimedReactionPlan(input, reactionPlan, summary);
      }

      return {
        ...summary,
        status: createBatchStatus(summary),
      };
    },
  };
}

async function executeClaimedReactionPlan(
  input: CreateReactionPlanExecutorInput,
  reactionPlan: ClaimedReactionPlanRecord,
  summary: MutableExecuteReactionPlansResult,
): Promise<void> {
  if (!hasActionTimeRemaining(reactionPlan, input.now())) {
    summary.claimLostCount += 1;
    return;
  }

  const executionResult = await executeReactionPlanAction(input, reactionPlan);

  if (executionResult.status === ReactionPlanExecutionStatus.Failed) {
    const failureResult = await input.queue.failReactionPlan({
      reactionPlanId: reactionPlan.reactionPlanId,
      claimId: reactionPlan.claimId,
      failedAt: input.now(),
      failure: executionResult.failure,
      ...createRetryPolicy(input),
    });
    applyCompletionStatus(summary, failureResult.status, ReactionPlanExecutionStatus.Failed);
    return;
  }

  const completionResult = await input.queue.completeReactionPlan({
    reactionPlanId: reactionPlan.reactionPlanId,
    claimId: reactionPlan.claimId,
    completedAt: input.now(),
    result: executionResult.result,
  });
  applyCompletionStatus(summary, completionResult.status, ReactionPlanExecutionStatus.Succeeded);
}

function createRetryPolicy(input: CreateReactionPlanExecutorInput): ReactionPlanRetryPolicy {
  return {
    maxAttempts: input.retryPolicy?.maxAttempts ?? DefaultReactionPlanRetryPolicy.MaxAttempts,
    retryDelayMs: input.retryPolicy?.retryDelayMs ?? DefaultReactionPlanRetryPolicy.RetryDelayMs,
  };
}

async function executeReactionPlanAction(
  input: CreateReactionPlanExecutorInput,
  reactionPlan: ClaimedReactionPlanRecord,
): Promise<ReactionPlanActionExecutionResult> {
  try {
    return await input.actionExecutor.executeReactionPlanAction(reactionPlan.action, {
      reactionPlanId: reactionPlan.reactionPlanId,
      claimId: reactionPlan.claimId,
      actionIdempotencyKey: createActionIdempotencyKey(reactionPlan),
      claimExpiresAt: reactionPlan.claimExpiresAt,
    });
  } catch (error) {
    return {
      status: ReactionPlanExecutionStatus.Failed,
      failure: {
        message: `${ReactionPlanExecutorFailureMessage.ActionExecutorThrew}: ${getErrorMessage(error)}`,
        retryable: true,
      },
    };
  }
}

function hasActionTimeRemaining(reactionPlan: ClaimedReactionPlanRecord, now: string): boolean {
  return reactionPlan.claimExpiresAt > now;
}

function createActionIdempotencyKey(reactionPlan: ClaimedReactionPlanRecord): string {
  return `${reactionPlan.reactionPlanId}:${reactionPlan.action.actionType}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function applyCompletionStatus(
  summary: MutableExecuteReactionPlansResult,
  completionStatus: ReactionPlanCompletionStatus,
  completedStatus: typeof ReactionPlanExecutionStatus.Failed | typeof ReactionPlanExecutionStatus.Succeeded,
): void {
  if (completionStatus === ReactionPlanCompletionStatus.ClaimLost) {
    summary.claimLostCount += 1;
    return;
  }

  if (completedStatus === ReactionPlanExecutionStatus.Failed) {
    summary.failedCount += 1;
    return;
  }

  summary.succeededCount += 1;
}

function createBatchStatus(summary: ExecuteReactionPlansResult): ReactionPlanExecutionStatus {
  if (summary.failedCount > 0) {
    return ReactionPlanExecutionStatus.Failed;
  }

  if (summary.claimLostCount > 0) {
    return ReactionPlanExecutionStatus.ClaimLost;
  }

  return ReactionPlanExecutionStatus.Succeeded;
}

type MutableExecuteReactionPlansResult = {
  -readonly [Key in keyof ExecuteReactionPlansResult]: ExecuteReactionPlansResult[Key];
};

function createExecutionSummary(
  status: ReactionPlanExecutionStatus,
  claimedCount = 0,
): MutableExecuteReactionPlansResult {
  return {
    status,
    claimedCount,
    succeededCount: 0,
    failedCount: 0,
    claimLostCount: 0,
  };
}
