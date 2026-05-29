import { ReactionPlanStatus, type ReactionPlanAction } from "../../domain/src/index.ts";
import type { ReactionPlanRecord } from "./event-ingestion-store.ts";

export const ReactionPlanClaimStatus = {
  Claimed: "claimed",
  Empty: "empty",
} as const;

export type ReactionPlanClaimStatus = (typeof ReactionPlanClaimStatus)[keyof typeof ReactionPlanClaimStatus];

export const ReactionPlanCompletionStatus = {
  Completed: "completed",
  ClaimLost: "claim_lost",
} as const;

export type ReactionPlanCompletionStatus =
  (typeof ReactionPlanCompletionStatus)[keyof typeof ReactionPlanCompletionStatus];

export type ClaimedReactionPlanRecord = ReactionPlanRecord & {
  claimId: string;
  claimedAt: string;
  claimExpiresAt: string;
};

export type ClaimReactionPlansInput = {
  claimId: string;
  limit: number;
  claimedAt: string;
  claimExpiresAt: string;
  leaseDurationMs: number;
};

export type ClaimReactionPlansResult =
  | {
      status: typeof ReactionPlanClaimStatus.Claimed;
      reactionPlans: readonly ClaimedReactionPlanRecord[];
    }
  | {
      status: typeof ReactionPlanClaimStatus.Empty;
      reactionPlans: readonly [];
    };

export type CompleteReactionPlanInput = {
  reactionPlanId: string;
  claimId: string;
  completedAt: string;
  result: ReactionPlanExecutionRecord;
};

export type FailReactionPlanInput = {
  reactionPlanId: string;
  claimId: string;
  failedAt: string;
  failure: ReactionPlanExecutionFailureRecord;
  maxAttempts: number;
  retryDelayMs: number;
};

export type CompleteReactionPlanResult = {
  status: ReactionPlanCompletionStatus;
};

export type ReactionPlanExecutionRecord = {
  message: string;
  createdWorkItemIds: readonly string[];
  createdDiscussionAnchorIds: readonly string[];
};

export type ReactionPlanExecutionFailureRecord = {
  message: string;
  retryable: boolean;
};

export type ReactionPlanWorkQueue = {
  claimPlannedReactionPlans: (input: ClaimReactionPlansInput) => Promise<ClaimReactionPlansResult>;
  completeReactionPlan: (input: CompleteReactionPlanInput) => Promise<CompleteReactionPlanResult>;
  failReactionPlan: (input: FailReactionPlanInput) => Promise<CompleteReactionPlanResult>;
};

export type InMemoryReactionPlanWorkQueue = ReactionPlanWorkQueue & {
  readonly snapshot: readonly ReactionPlanRecord[];
};

export function createInMemoryReactionPlanWorkQueue(
  records: readonly ReactionPlanRecord[],
): InMemoryReactionPlanWorkQueue {
  const reactionPlans = records.map(cloneReactionPlanRecord);

  return {
    get snapshot() {
      return reactionPlans.map(cloneReactionPlanRecord);
    },
    claimPlannedReactionPlans: async (input) => {
      const claimedReactionPlans: ClaimedReactionPlanRecord[] = [];

      for (const reactionPlan of reactionPlans) {
        if (claimedReactionPlans.length >= input.limit) {
          break;
        }

        if (!isClaimable(reactionPlan, input.claimedAt)) {
          continue;
        }

        Object.assign(reactionPlan, {
          status: ReactionPlanStatus.Claimed,
          claimId: input.claimId,
          claimedAt: input.claimedAt,
          claimExpiresAt: input.claimExpiresAt,
        });
        claimedReactionPlans.push(cloneClaimedReactionPlanRecord(reactionPlan as ClaimedReactionPlanRecord));
      }

      if (claimedReactionPlans.length === 0) {
        return {
          status: ReactionPlanClaimStatus.Empty,
          reactionPlans: [],
        };
      }

      return {
        status: ReactionPlanClaimStatus.Claimed,
        reactionPlans: claimedReactionPlans,
      };
    },
    completeReactionPlan: async (input) => {
      const reactionPlan = reactionPlans.find((candidate) => candidate.reactionPlanId === input.reactionPlanId);

      if (!hasActiveClaim(reactionPlan, input.claimId, input.completedAt)) {
        return {
          status: ReactionPlanCompletionStatus.ClaimLost,
        };
      }

      Object.assign(reactionPlan, {
        status: ReactionPlanStatus.Completed,
        completedAt: input.completedAt,
        result: input.result,
      });

      return {
        status: ReactionPlanCompletionStatus.Completed,
      };
    },
    failReactionPlan: async (input) => {
      const reactionPlan = reactionPlans.find((candidate) => candidate.reactionPlanId === input.reactionPlanId);

      if (!hasActiveClaim(reactionPlan, input.claimId, input.failedAt)) {
        return {
          status: ReactionPlanCompletionStatus.ClaimLost,
        };
      }

      const attemptCount = getAttemptCount(reactionPlan) + 1;
      const retryable = input.failure.retryable && attemptCount < input.maxAttempts;

      Object.assign(reactionPlan, {
        status: retryable ? ReactionPlanStatus.Planned : ReactionPlanStatus.Failed,
        claimId: undefined,
        claimedAt: undefined,
        claimExpiresAt: undefined,
        attemptCount,
        nextAttemptAt: retryable ? createRetryAttemptTime(input.failedAt, input.retryDelayMs) : undefined,
        failedAt: input.failedAt,
        failure: input.failure,
      });

      return {
        status: ReactionPlanCompletionStatus.Completed,
      };
    },
  };
}

function isClaimable(record: ReactionPlanRecord, now: string): boolean {
  if (record.status === ReactionPlanStatus.Planned) {
    return record.nextAttemptAt === undefined || record.nextAttemptAt <= now;
  }

  const claimExpiresAt = (record as Partial<ClaimedReactionPlanRecord>).claimExpiresAt;

  return record.status === ReactionPlanStatus.Claimed && typeof claimExpiresAt === "string" && claimExpiresAt <= now;
}

function hasActiveClaim(
  record: ReactionPlanRecord | undefined,
  claimId: string,
  now: string,
): record is ClaimedReactionPlanRecord {
  return (
    record !== undefined &&
    record.status === ReactionPlanStatus.Claimed &&
    (record as Partial<ClaimedReactionPlanRecord>).claimId === claimId &&
    typeof (record as Partial<ClaimedReactionPlanRecord>).claimExpiresAt === "string" &&
    (record as Partial<ClaimedReactionPlanRecord>).claimExpiresAt! > now
  );
}

function cloneClaimedReactionPlanRecord(record: ClaimedReactionPlanRecord): ClaimedReactionPlanRecord {
  return {
    ...cloneReactionPlanRecord(record),
    claimId: record.claimId,
    claimedAt: record.claimedAt,
    claimExpiresAt: record.claimExpiresAt,
  };
}

function cloneReactionPlanRecord(record: ReactionPlanRecord): ReactionPlanRecord {
  return {
    ...record,
    action: cloneReactionPlanAction(record.action),
  };
}

function getAttemptCount(record: ReactionPlanRecord): number {
  return typeof record.attemptCount === "number" && Number.isInteger(record.attemptCount) ? record.attemptCount : 0;
}

function createRetryAttemptTime(failedAt: string, retryDelayMs: number): string {
  return new Date(Date.parse(failedAt) + retryDelayMs).toISOString();
}

function cloneReactionPlanAction(action: ReactionPlanAction): ReactionPlanAction {
  return {
    ...action,
  };
}
