export const WorkShardState = {
  Ready: "ready",
  Claimed: "claimed",
  Completed: "completed",
  Merged: "merged",
  Blocked: "blocked",
} as const;

export type WorkShardState = (typeof WorkShardState)[keyof typeof WorkShardState];

export const WorkClaimState = {
  Active: "active",
  Completed: "completed",
  Released: "released",
  Expired: "expired",
} as const;

export type WorkClaimState = (typeof WorkClaimState)[keyof typeof WorkClaimState];

export const RuntimeLeaseState = {
  Reserved: "reserved",
  Active: "active",
  Renewed: "renewed",
  Completed: "completed",
  Expired: "expired",
  Revoked: "revoked",
  HandedOff: "handed_off",
} as const;

export type RuntimeLeaseState = (typeof RuntimeLeaseState)[keyof typeof RuntimeLeaseState];

export const WorkMarketClaimOutcome = {
  Claimed: "claimed",
  Empty: "empty",
  Rejected: "rejected",
} as const;

export type WorkMarketClaimOutcome = (typeof WorkMarketClaimOutcome)[keyof typeof WorkMarketClaimOutcome];

export const WorkMarketCompleteOutcome = {
  Completed: "completed",
  Rejected: "rejected",
} as const;

export type WorkMarketCompleteOutcome = (typeof WorkMarketCompleteOutcome)[keyof typeof WorkMarketCompleteOutcome];

export const WorkMarketQuorumOutcome = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

export type WorkMarketQuorumOutcome = (typeof WorkMarketQuorumOutcome)[keyof typeof WorkMarketQuorumOutcome];

export const WorkMarketMergeOutcome = {
  Merged: "merged",
  Rejected: "rejected",
} as const;

export type WorkMarketMergeOutcome = (typeof WorkMarketMergeOutcome)[keyof typeof WorkMarketMergeOutcome];

export type WorkMarketScope = {
  readonly kind: "organization" | "department" | "project" | "initiative" | "work_batch" | "work_item";
  readonly id: string;
};

export type WorkShardMergePolicy = "independent" | "aggregate_before_merge";

export type WorkShard = {
  readonly shardId: string;
  readonly workItemId: string;
  readonly title: string;
  readonly priority: number;
  readonly state: WorkShardState;
  readonly dependencyShardIds: readonly string[];
  readonly mergePolicy: WorkShardMergePolicy;
  readonly claimedByClaimId?: string;
  readonly completedAt?: string;
  readonly mergedAt?: string;
  readonly evidenceRefs?: readonly string[];
};

export type WorkClaim = {
  readonly claimId: string;
  readonly shardId: string;
  readonly ownerAgentId: string;
  readonly hatAssignmentId: string;
  readonly fencingToken: string;
  readonly leaseExpiresAt: string;
  readonly heartbeatAt: string;
  readonly scheduleBlockId: string;
  readonly runtimeSessionId: string;
  readonly workspaceRef: string;
  readonly credentialScope: string;
  readonly compensatingAction: string;
  readonly state: WorkClaimState;
  readonly claimedAt: string;
  readonly completedAt?: string;
  readonly releasedAt?: string;
  readonly releaseReason?: string;
  readonly evidenceRefs?: readonly string[];
};

export type RuntimeLease = {
  readonly leaseId: string;
  readonly claimId: string;
  readonly organizationId: string;
  readonly queueId: string;
  readonly hatId: string;
  readonly scope: WorkMarketScope;
  readonly workItemId: string;
  readonly shardId: string;
  readonly hatAssignmentId: string;
  readonly agentId: string;
  readonly scheduleBlockId: string;
  readonly runtimeSessionId: string;
  readonly workspaceRef: string;
  readonly credentialScopeRefs: readonly string[];
  readonly fencingToken: string;
  readonly heartbeatAt: string;
  readonly heartbeatDeadlineAt: string;
  readonly leaseExpiresAt: string;
  readonly compensatingActionRef: string;
  readonly state: RuntimeLeaseState;
  readonly activatedAt: string;
  readonly completedAt?: string;
  readonly expiredAt?: string;
  readonly revokedAt?: string;
};

export type WorkShardReviewQuorum = {
  readonly requiredApprovals: number;
  readonly reviewerHatIds: readonly string[];
  readonly allowProducerApproval?: boolean;
};

export type WorkShardReviewApproval = {
  readonly reviewerAgentId: string;
  readonly reviewerHatId: string;
  readonly approved: boolean;
  readonly evidenceRef: string;
  readonly reviewedAt: string;
};

export type WorkShardReview = {
  readonly shardId: string;
  readonly producerAgentId: string;
  readonly outcome: WorkMarketQuorumOutcome;
  readonly approvalCount: number;
  readonly acceptedEvidenceRefs: readonly string[];
  readonly reviewedAt: string;
  readonly reason?: WorkShardReviewRejectReason;
};

export type HatWorkQueue = {
  readonly queueId: string;
  readonly organizationId: string;
  readonly hatId: string;
  readonly revision?: number;
  readonly scope: WorkMarketScope;
  readonly priorityClass?: string;
  readonly slaDeadlineAt?: string;
  readonly shardability: "none" | "by_file" | "by_component" | "by_test_suite" | "manual";
  readonly requiredSkills: readonly string[];
  readonly reviewQuorum: WorkShardReviewQuorum;
  readonly shards: readonly WorkShard[];
  readonly claims: readonly WorkClaim[];
  readonly runtimeLeases?: readonly RuntimeLease[];
  readonly reviews?: readonly WorkShardReview[];
};

export type ClaimNextWorkShardInput = {
  readonly ownerAgentId: string;
  readonly hatAssignmentId: string;
  readonly claimId: string;
  readonly fencingToken: string;
  readonly now: string;
  readonly leaseExpiresAt: string;
  readonly runtimeLeaseId?: string;
  readonly heartbeatDeadlineAt?: string;
  readonly scheduleBlockId: string;
  readonly runtimeSessionId: string;
  readonly workspaceRef: string;
  readonly credentialScope: string;
  readonly compensatingAction: string;
  readonly expectedQueueRevision?: number;
};

export type WorkMarketClaimResult =
  | {
      readonly outcome: typeof WorkMarketClaimOutcome.Claimed;
      readonly queue: HatWorkQueue;
      readonly claim: WorkClaim;
      readonly runtimeLease: RuntimeLease;
      readonly shard: WorkShard;
    }
  | {
      readonly outcome: typeof WorkMarketClaimOutcome.Empty;
      readonly queue: HatWorkQueue;
      readonly reason: "no_ready_shards";
    }
  | {
      readonly outcome: typeof WorkMarketClaimOutcome.Rejected;
      readonly queue: HatWorkQueue;
      readonly reason: "stale_queue_revision" | "duplicate_claim_id" | "duplicate_runtime_lease_id" | "invalid_lease_window";
    };

export type ReapStaleWorkClaimsInput = {
  readonly now: string;
  readonly reason: string;
};

export type ReapStaleWorkClaimsResult = {
  readonly queue: HatWorkQueue;
  readonly reapedClaims: readonly WorkClaim[];
};

export type CompleteWorkClaimInput = {
  readonly claimId: string;
  readonly fencingToken: string;
  readonly now?: string;
  readonly completedAt: string;
  readonly evidenceRefs: readonly string[];
};

export type CompleteWorkClaimRejectReason =
  | "claim_not_active"
  | "stale_fencing_token"
  | "lease_expired"
  | "invalid_timestamp"
  | "shard_not_owned_by_claim"
  | "runtime_lease_missing"
  | "runtime_lease_not_active"
  | "runtime_lease_fence_mismatch"
  | "runtime_lease_authority_mismatch"
  | "runtime_lease_expired";

export type CompleteWorkClaimResult =
  | {
      readonly outcome: typeof WorkMarketCompleteOutcome.Completed;
      readonly queue: HatWorkQueue;
      readonly claim: WorkClaim;
      readonly shard: WorkShard;
    }
  | {
      readonly outcome: typeof WorkMarketCompleteOutcome.Rejected;
      readonly queue: HatWorkQueue;
      readonly reason: CompleteWorkClaimRejectReason;
    };

export type EvaluateWorkShardReviewQuorumInput = {
  readonly shardId: string;
  readonly producerAgentId?: string;
  readonly approvals: readonly WorkShardReviewApproval[];
};

export type WorkShardReviewRejectReason =
  | "self_only_review"
  | "insufficient_quorum"
  | "no_such_shard"
  | "producer_claim_missing"
  | "reviewer_hat_not_allowed";

export type EvaluateWorkShardReviewQuorumResult =
  | {
      readonly outcome: typeof WorkMarketQuorumOutcome.Accepted;
      readonly queue: HatWorkQueue;
      readonly review: WorkShardReview;
      readonly acceptedEvidenceRefs: readonly string[];
    }
  | {
      readonly outcome: typeof WorkMarketQuorumOutcome.Rejected;
      readonly review: WorkShardReview;
      readonly reason: WorkShardReviewRejectReason;
    };

export type MergeReviewedWorkShardsInput = {
  readonly shardIds: readonly string[];
  readonly reviews?: readonly WorkShardReview[];
  readonly mergedAt: string;
};

export type WorkMarketMergeRejectReason =
  | "no_shards_requested"
  | "shard_not_completed"
  | "review_quorum_missing";

export type MergeReviewedWorkShardsResult =
  | {
      readonly outcome: typeof WorkMarketMergeOutcome.Merged;
      readonly queue: HatWorkQueue;
      readonly shardIds: readonly string[];
      readonly evidenceRefs: readonly string[];
    }
  | {
      readonly outcome: typeof WorkMarketMergeOutcome.Rejected;
      readonly queue: HatWorkQueue;
      readonly reason: WorkMarketMergeRejectReason;
    };

export type WorkMarketReadoutInput = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly visibleHatIds?: readonly string[];
  readonly now: string;
};

export type WorkMarketQueueReadout = {
  readonly queueId: string;
  readonly scope: WorkMarketScope;
  readonly priorityClass?: string;
  readonly slaDeadlineAt?: string;
  readonly readyShardCount: number;
  readonly claimedShardCount: number;
  readonly completedShardCount: number;
  readonly mergedShardCount: number;
  readonly staleClaimCount: number;
  readonly activeClaims: readonly WorkClaim[];
  readonly shards: readonly WorkShard[];
};

export type WorkMarketPressure = "none" | "normal" | "elevated" | "critical";

export type WorkMarketReadout = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly queues: readonly WorkMarketQueueReadout[];
  readonly totalReadyShards: number;
  readonly totalClaimedShards: number;
  readonly totalCompletedShards: number;
  readonly totalMergedShards: number;
  readonly totalStaleClaims: number;
  readonly queuePressure: WorkMarketPressure;
};

export type WorkMarketAgentCandidate = {
  readonly agentId: string;
  readonly hatAssignmentId: string;
  readonly reputation?: number;
  readonly currentLoad?: number;
  readonly recentSameHatClaims?: number;
  readonly skillIds?: readonly string[];
};

export type PlanWorkMarketClaimsInput = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly now: string;
  readonly queues: readonly HatWorkQueue[];
  readonly agents: readonly WorkMarketAgentCandidate[];
  readonly maxAssignments?: number;
  readonly priorityClassWeights?: Readonly<Record<string, number>>;
};

export type PlannedWorkMarketClaim = {
  readonly agentId: string;
  readonly hatAssignmentId: string;
  readonly queueId: string;
  readonly shardId: string;
  readonly workItemId: string;
  readonly score: number;
  readonly reasonCodes: readonly string[];
};

export type WorkMarketClaimPlan = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly assignments: readonly PlannedWorkMarketClaim[];
  readonly unassignedShardIds: readonly string[];
};

export function claimNextWorkShard(queue: HatWorkQueue, input: ClaimNextWorkShardInput): WorkMarketClaimResult {
  const currentRevision = queue.revision ?? 0;
  if (input.expectedQueueRevision !== undefined && input.expectedQueueRevision !== currentRevision) {
    return { outcome: WorkMarketClaimOutcome.Rejected, queue, reason: "stale_queue_revision" };
  }
  if (queue.claims.some((claim) => claim.claimId === input.claimId)) {
    return { outcome: WorkMarketClaimOutcome.Rejected, queue, reason: "duplicate_claim_id" };
  }
  const runtimeLeaseId = input.runtimeLeaseId ?? `${input.claimId}:runtime-lease`;
  if ((queue.runtimeLeases ?? []).some((lease) => lease.leaseId === runtimeLeaseId)) {
    return { outcome: WorkMarketClaimOutcome.Rejected, queue, reason: "duplicate_runtime_lease_id" };
  }
  const heartbeatDeadlineAt = input.heartbeatDeadlineAt ?? input.leaseExpiresAt;
  if (
    !isValidIso(input.now) ||
    !isValidIso(input.leaseExpiresAt) ||
    !isValidIso(heartbeatDeadlineAt) ||
    isIsoAtOrBefore(input.leaseExpiresAt, input.now) ||
    isIsoAtOrBefore(heartbeatDeadlineAt, input.now)
  ) {
    return { outcome: WorkMarketClaimOutcome.Rejected, queue, reason: "invalid_lease_window" };
  }
  const candidate = readyClaimableShards(queue)[0];
  if (candidate === undefined) {
    return { outcome: WorkMarketClaimOutcome.Empty, queue, reason: "no_ready_shards" };
  }

  const claim: WorkClaim = {
    claimId: input.claimId,
    shardId: candidate.shardId,
    ownerAgentId: input.ownerAgentId,
    hatAssignmentId: input.hatAssignmentId,
    fencingToken: input.fencingToken,
    leaseExpiresAt: input.leaseExpiresAt,
    heartbeatAt: input.now,
    scheduleBlockId: input.scheduleBlockId,
    runtimeSessionId: input.runtimeSessionId,
    workspaceRef: input.workspaceRef,
    credentialScope: input.credentialScope,
    compensatingAction: input.compensatingAction,
    state: WorkClaimState.Active,
    claimedAt: input.now,
    evidenceRefs: [],
  };
  const claimedShard: WorkShard = {
    ...candidate,
    state: WorkShardState.Claimed,
    claimedByClaimId: claim.claimId,
  };
  const runtimeLease: RuntimeLease = {
    leaseId: runtimeLeaseId,
    claimId: claim.claimId,
    organizationId: queue.organizationId,
    queueId: queue.queueId,
    hatId: queue.hatId,
    scope: queue.scope,
    workItemId: candidate.workItemId,
    shardId: candidate.shardId,
    hatAssignmentId: input.hatAssignmentId,
    agentId: input.ownerAgentId,
    scheduleBlockId: input.scheduleBlockId,
    runtimeSessionId: input.runtimeSessionId,
    workspaceRef: input.workspaceRef,
    credentialScopeRefs: [input.credentialScope],
    fencingToken: input.fencingToken,
    heartbeatAt: input.now,
    heartbeatDeadlineAt,
    leaseExpiresAt: input.leaseExpiresAt,
    compensatingActionRef: input.compensatingAction,
    state: RuntimeLeaseState.Active,
    activatedAt: input.now,
  };
  const updated = bumpQueueRevision(replaceShard(queue, claimedShard));
  return {
    outcome: WorkMarketClaimOutcome.Claimed,
    queue: { ...updated, claims: [...updated.claims, claim], runtimeLeases: [...(updated.runtimeLeases ?? []), runtimeLease] },
    claim,
    runtimeLease,
    shard: claimedShard,
  };
}

export function planWorkMarketClaims(input: PlanWorkMarketClaimsInput): WorkMarketClaimPlan {
  const scopedQueues = input.queues.filter((queue) =>
    queue.organizationId === input.organizationId &&
    queue.hatId === input.hatId);
  const bids = scopedQueues.flatMap((queue) => {
    const claimableShards = readyClaimableShards(queue);
    return claimableShards.flatMap((shard) =>
      input.agents
        .filter((agent) => agentCanClaimQueue(agent, queue))
        .map((agent) => marketBid(input, queue, shard, agent)),
    );
  });
  const sortedBids = bids.sort((left, right) =>
    right.score - left.score ||
    left.queueId.localeCompare(right.queueId) ||
    left.shardId.localeCompare(right.shardId) ||
    left.agentId.localeCompare(right.agentId));
  const maxAssignments = Math.max(0, Math.min(input.maxAssignments ?? input.agents.length, input.agents.length));
  const assignedAgents = new Set<string>();
  const assignedShards = new Set<string>();
  const assignments: PlannedWorkMarketClaim[] = [];
  for (const bid of sortedBids) {
    if (assignments.length >= maxAssignments) break;
    if (assignedAgents.has(bid.agentId) || assignedShards.has(bid.shardId)) continue;
    assignedAgents.add(bid.agentId);
    assignedShards.add(bid.shardId);
    assignments.push(bid);
  }

  const unassignedShardIds = scopedQueues
    .flatMap((queue) => queue.shards)
    .filter((shard) => shard.state === WorkShardState.Ready)
    .filter((shard) => !assignedShards.has(shard.shardId))
    .map((shard) => shard.shardId)
    .sort();

  return {
    organizationId: input.organizationId,
    hatId: input.hatId,
    assignments,
    unassignedShardIds,
  };
}

export function reapStaleWorkClaims(queue: HatWorkQueue, input: ReapStaleWorkClaimsInput): ReapStaleWorkClaimsResult {
  if (!isValidIso(input.now)) return { queue, reapedClaims: [] };
  const reapedIds = new Set(
    queue.claims
      .filter((claim) => claim.state === WorkClaimState.Active && claimIsStale(queue, claim, input.now))
      .map((claim) => claim.claimId),
  );
  if (reapedIds.size === 0) return { queue, reapedClaims: [] };

  const claims = queue.claims.map((claim): WorkClaim => {
    if (!reapedIds.has(claim.claimId)) return claim;
    return {
      ...claim,
      state: WorkClaimState.Expired,
      releasedAt: input.now,
      releaseReason: input.reason,
    };
  });
  const shards = queue.shards.map((shard): WorkShard => {
    if (shard.claimedByClaimId === undefined || !reapedIds.has(shard.claimedByClaimId)) return shard;
    const { claimedByClaimId: _claimedByClaimId, ...unclaimedShard } = shard;
    return {
      ...unclaimedShard,
      state: WorkShardState.Ready,
    };
  });
  const runtimeLeases = (queue.runtimeLeases ?? []).map((lease): RuntimeLease => {
    if (!reapedIds.has(lease.claimId)) return lease;
    if (lease.state !== RuntimeLeaseState.Active && lease.state !== RuntimeLeaseState.Renewed) return lease;
    return {
      ...lease,
      state: RuntimeLeaseState.Expired,
      expiredAt: input.now,
    };
  });

  return {
    queue: bumpQueueRevision({ ...queue, claims, shards, runtimeLeases }),
    reapedClaims: claims.filter((claim) => reapedIds.has(claim.claimId)),
  };
}

export function completeWorkClaim(queue: HatWorkQueue, input: CompleteWorkClaimInput): CompleteWorkClaimResult {
  if (input.now === undefined || !isValidIso(input.now) || !isValidIso(input.completedAt)) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "invalid_timestamp" };
  }
  const trustedNow = input.now;
  const claim = queue.claims.find((candidate) => candidate.claimId === input.claimId);
  if (claim === undefined || claim.state !== WorkClaimState.Active) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "claim_not_active" };
  }
  if (claim.fencingToken !== input.fencingToken) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "stale_fencing_token" };
  }
  const runtimeLease = queue.runtimeLeases?.find((lease) => lease.claimId === claim.claimId);
  if (runtimeLease === undefined) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "runtime_lease_missing" };
  }
  if (runtimeLease.state !== RuntimeLeaseState.Active && runtimeLease.state !== RuntimeLeaseState.Renewed) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "runtime_lease_not_active" };
  }
  if (runtimeLease.fencingToken !== input.fencingToken) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "runtime_lease_fence_mismatch" };
  }
  const shard = queue.shards.find((candidate) => candidate.shardId === claim.shardId);
  if (shard === undefined || shard.state !== WorkShardState.Claimed || shard.claimedByClaimId !== claim.claimId) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "shard_not_owned_by_claim" };
  }
  if (!runtimeLeaseMatchesClaim(queue, claim, shard, runtimeLease)) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "runtime_lease_authority_mismatch" };
  }
  if (!isValidIso(claim.leaseExpiresAt) || isIsoAtOrBefore(claim.leaseExpiresAt, trustedNow)) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "lease_expired" };
  }
  if (
    !isValidIso(runtimeLease.leaseExpiresAt) ||
    !isValidIso(runtimeLease.heartbeatDeadlineAt) ||
    isIsoAtOrBefore(runtimeLease.leaseExpiresAt, trustedNow) ||
    isIsoAtOrBefore(runtimeLease.heartbeatDeadlineAt, trustedNow)
  ) {
    return { outcome: WorkMarketCompleteOutcome.Rejected, queue, reason: "runtime_lease_expired" };
  }
  const completedClaim: WorkClaim = {
    ...claim,
    state: WorkClaimState.Completed,
    completedAt: input.completedAt,
    evidenceRefs: input.evidenceRefs,
  };
  const completedShard: WorkShard = {
    ...shard,
    state: WorkShardState.Completed,
    completedAt: input.completedAt,
    evidenceRefs: [...(shard.evidenceRefs ?? []), ...input.evidenceRefs],
  };

  const updated = bumpQueueRevision(replaceShard(queue, completedShard));
  return {
    outcome: WorkMarketCompleteOutcome.Completed,
    queue: {
      ...updated,
      claims: updated.claims.map((candidate) => candidate.claimId === completedClaim.claimId ? completedClaim : candidate),
      runtimeLeases: (updated.runtimeLeases ?? []).map((lease) =>
        lease.leaseId === runtimeLease.leaseId
          ? { ...lease, state: RuntimeLeaseState.Completed, completedAt: input.completedAt }
          : lease),
    },
    claim: completedClaim,
    shard: completedShard,
  };
}

export function evaluateWorkShardReviewQuorum(
  queue: HatWorkQueue,
  input: EvaluateWorkShardReviewQuorumInput,
): EvaluateWorkShardReviewQuorumResult {
  const shard = queue.shards.find((candidate) => candidate.shardId === input.shardId);
  const reviewedAt = input.approvals[0]?.reviewedAt ?? new Date(0).toISOString();
  if (shard === undefined) {
    const review = rejectedReview({ ...input, producerAgentId: input.producerAgentId ?? "" }, "no_such_shard", reviewedAt);
    return { outcome: WorkMarketQuorumOutcome.Rejected, review, reason: "no_such_shard" };
  }

  const producerAgentId = completedProducerAgentId(queue, input.shardId);
  if (producerAgentId === undefined) {
    const review = rejectedReview({ ...input, producerAgentId: input.producerAgentId ?? "" }, "producer_claim_missing", reviewedAt);
    return { outcome: WorkMarketQuorumOutcome.Rejected, review, reason: "producer_claim_missing" };
  }

  const approved = input.approvals.filter((approval) => approval.approved);
  const nonProducerApprovals = queue.reviewQuorum.allowProducerApproval
    ? approved
    : approved.filter((approval) => approval.reviewerAgentId !== producerAgentId);
  const allowedApprovals = nonProducerApprovals.filter((approval) =>
    queue.reviewQuorum.reviewerHatIds.includes(approval.reviewerHatId),
  );
  const distinctReviewerEvidence = distinctBy(allowedApprovals, (approval) => approval.reviewerAgentId);

  if (approved.length > 0 && nonProducerApprovals.length === 0) {
    const review = rejectedReview({ ...input, producerAgentId }, "self_only_review", reviewedAt);
    return { outcome: WorkMarketQuorumOutcome.Rejected, review, reason: "self_only_review" };
  }
  if (nonProducerApprovals.length > 0 && allowedApprovals.length === 0) {
    const review = rejectedReview({ ...input, producerAgentId }, "reviewer_hat_not_allowed", reviewedAt);
    return { outcome: WorkMarketQuorumOutcome.Rejected, review, reason: "reviewer_hat_not_allowed" };
  }
  if (distinctReviewerEvidence.length < queue.reviewQuorum.requiredApprovals) {
    const review = rejectedReview({ ...input, producerAgentId }, "insufficient_quorum", reviewedAt);
    return { outcome: WorkMarketQuorumOutcome.Rejected, review, reason: "insufficient_quorum" };
  }

  const acceptedEvidenceRefs = distinctReviewerEvidence.map((approval) => approval.evidenceRef);
  const review: WorkShardReview = {
    shardId: input.shardId,
    producerAgentId,
    outcome: WorkMarketQuorumOutcome.Accepted,
    approvalCount: distinctReviewerEvidence.length,
    acceptedEvidenceRefs,
    reviewedAt,
  };
  return {
    outcome: WorkMarketQuorumOutcome.Accepted,
    queue: bumpQueueRevision({ ...queue, reviews: [...(queue.reviews ?? []), review] }),
    review,
    acceptedEvidenceRefs,
  };
}

export function mergeReviewedWorkShards(queue: HatWorkQueue, input: MergeReviewedWorkShardsInput): MergeReviewedWorkShardsResult {
  if (input.shardIds.length === 0) {
    return { outcome: WorkMarketMergeOutcome.Rejected, queue, reason: "no_shards_requested" };
  }
  const completed = input.shardIds.every((shardId) =>
    queue.shards.some((shard) => shard.shardId === shardId && shard.state === WorkShardState.Completed),
  );
  if (!completed) {
    return { outcome: WorkMarketMergeOutcome.Rejected, queue, reason: "shard_not_completed" };
  }
  const suppliedReviewIds = new Set((input.reviews ?? []).map(reviewIdentity));
  const reviewByShard = new Map(
    (queue.reviews ?? [])
      .filter((review) => review.outcome === WorkMarketQuorumOutcome.Accepted)
      .filter((review) => suppliedReviewIds.size === 0 || suppliedReviewIds.has(reviewIdentity(review)))
      .map((review) => [review.shardId, review]),
  );
  const allReviewed = input.shardIds.every((shardId) => reviewByShard.has(shardId));
  if (!allReviewed) {
    return { outcome: WorkMarketMergeOutcome.Rejected, queue, reason: "review_quorum_missing" };
  }

  const evidenceRefs = input.shardIds.flatMap((shardId) => reviewByShard.get(shardId)?.acceptedEvidenceRefs ?? []);
  const shards = queue.shards.map((shard): WorkShard => {
    if (!input.shardIds.includes(shard.shardId)) return shard;
    return {
      ...shard,
      state: WorkShardState.Merged,
      mergedAt: input.mergedAt,
      evidenceRefs: [...(shard.evidenceRefs ?? []), ...evidenceRefs],
    };
  });
  return {
    outcome: WorkMarketMergeOutcome.Merged,
    queue: bumpQueueRevision({ ...queue, shards }),
    shardIds: input.shardIds,
    evidenceRefs,
  };
}

export function workMarketReadoutForHat(queues: readonly HatWorkQueue[], input: WorkMarketReadoutInput): WorkMarketReadout {
  const visibleHatIds = new Set(input.visibleHatIds ?? [input.hatId]);
  const scoped = queues.filter((queue) => queue.organizationId === input.organizationId && visibleHatIds.has(queue.hatId));
  const readouts = scoped.map((queue): WorkMarketQueueReadout => {
    const activeClaims = queue.claims.filter((claim) => claim.state === WorkClaimState.Active);
    return {
      queueId: queue.queueId,
      scope: queue.scope,
      ...(queue.priorityClass !== undefined ? { priorityClass: queue.priorityClass } : {}),
      ...(queue.slaDeadlineAt !== undefined ? { slaDeadlineAt: queue.slaDeadlineAt } : {}),
      readyShardCount: countShards(queue, WorkShardState.Ready),
      claimedShardCount: countShards(queue, WorkShardState.Claimed),
      completedShardCount: countShards(queue, WorkShardState.Completed),
      mergedShardCount: countShards(queue, WorkShardState.Merged),
      staleClaimCount: activeClaims.filter((claim) => claimIsStale(queue, claim, input.now)).length,
      activeClaims,
      shards: queue.shards,
    };
  });
  const totalReadyShards = sum(readouts.map((readout) => readout.readyShardCount));
  const totalClaimedShards = sum(readouts.map((readout) => readout.claimedShardCount));
  const totalCompletedShards = sum(readouts.map((readout) => readout.completedShardCount));
  const totalMergedShards = sum(readouts.map((readout) => readout.mergedShardCount));
  const totalStaleClaims = sum(readouts.map((readout) => readout.staleClaimCount));

  return {
    organizationId: input.organizationId,
    hatId: input.hatId,
    queues: readouts,
    totalReadyShards,
    totalClaimedShards,
    totalCompletedShards,
    totalMergedShards,
    totalStaleClaims,
    queuePressure: pressureFor({ totalReadyShards, totalClaimedShards, totalStaleClaims }),
  };
}

function readyClaimableShards(queue: HatWorkQueue): readonly WorkShard[] {
  const activeClaimedShardIds = new Set(
    queue.claims
      .filter((claim) => claim.state === WorkClaimState.Active)
      .map((claim) => claim.shardId),
  );
  const stateByShardId = new Map(queue.shards.map((shard) => [shard.shardId, shard.state]));
  return queue.shards
    .filter((shard) => shard.state === WorkShardState.Ready)
    .filter((shard) => !activeClaimedShardIds.has(shard.shardId))
    .filter((shard) => shard.dependencyShardIds.every((dependency) => {
      const state = stateByShardId.get(dependency);
      return state === WorkShardState.Completed || state === WorkShardState.Merged;
    }))
    .slice()
    .sort((left: WorkShard, right: WorkShard) => right.priority - left.priority || left.shardId.localeCompare(right.shardId));
}

function marketBid(
  input: PlanWorkMarketClaimsInput,
  queue: HatWorkQueue,
  shard: WorkShard,
  agent: WorkMarketAgentCandidate,
): PlannedWorkMarketClaim {
  const priorityWeight = priorityClassWeight(queue.priorityClass, input.priorityClassWeights);
  const slaUrgency = slaUrgencyScore(queue.slaDeadlineAt, input.now);
  const reputation = clamp01(agent.reputation ?? 0.5);
  const currentLoad = Math.max(0, agent.currentLoad ?? 0);
  const recentSameHatClaims = Math.max(0, agent.recentSameHatClaims ?? 0);
  const score = rounded(
    priorityWeight * 20 +
    slaUrgency * 10 +
    shard.priority / 10 +
    reputation * 10 -
    currentLoad * 4 -
    recentSameHatClaims * 2,
  );
  const reasonCodes = [
    ...(priorityWeight > 1 ? ["priority_class"] : []),
    ...(slaUrgency > 0 ? ["sla_pressure"] : []),
    ...(reputation > 0.5 ? ["agent_reputation"] : []),
    ...(isFairnessRotation(input.agents, agent) ? ["fairness_rotation"] : []),
    ...(queue.requiredSkills.length > 0 ? ["skill_match"] : []),
  ];
  return {
    agentId: agent.agentId,
    hatAssignmentId: agent.hatAssignmentId,
    queueId: queue.queueId,
    shardId: shard.shardId,
    workItemId: shard.workItemId,
    score,
    reasonCodes,
  };
}

function agentCanClaimQueue(agent: WorkMarketAgentCandidate, queue: HatWorkQueue): boolean {
  if (queue.requiredSkills.length === 0) return true;
  const skillIds = new Set(agent.skillIds ?? []);
  return queue.requiredSkills.every((skill) => skillIds.has(skill));
}

function priorityClassWeight(
  priorityClass: string | undefined,
  override: Readonly<Record<string, number>> | undefined,
): number {
  if (priorityClass !== undefined && override?.[priorityClass] !== undefined) {
    return Math.max(0, override[priorityClass]);
  }
  switch (priorityClass) {
    case "p0":
    case "critical":
      return 5;
    case "p1":
    case "high":
      return 4;
    case "p2":
    case "normal":
      return 3;
    case "p3":
    case "low":
      return 2;
    default:
      return 1;
  }
}

function slaUrgencyScore(deadlineAt: string | undefined, now: string): number {
  if (deadlineAt === undefined || !isValidIso(deadlineAt) || !isValidIso(now)) return 0;
  const remainingMs = Date.parse(deadlineAt) - Date.parse(now);
  if (remainingMs <= 0) return 5;
  const remainingMinutes = remainingMs / 60_000;
  if (remainingMinutes <= 15) return 4;
  if (remainingMinutes <= 60) return 3;
  if (remainingMinutes <= 24 * 60) return 1.5;
  return 0;
}

function isFairnessRotation(
  agents: readonly WorkMarketAgentCandidate[],
  agent: WorkMarketAgentCandidate,
): boolean {
  const load = Math.max(0, agent.currentLoad ?? 0) + Math.max(0, agent.recentSameHatClaims ?? 0);
  if (load > 0) return false;
  return agents.some((candidate) =>
    candidate.agentId !== agent.agentId &&
    (candidate.reputation ?? 0) > (agent.reputation ?? 0) &&
    (Math.max(0, candidate.currentLoad ?? 0) + Math.max(0, candidate.recentSameHatClaims ?? 0)) > 0);
}

function claimIsStale(queue: HatWorkQueue, claim: WorkClaim, now: string): boolean {
  if (!isValidIso(claim.leaseExpiresAt) || isIsoAtOrBefore(claim.leaseExpiresAt, now)) {
    return true;
  }
  return !claimHasActiveRuntimeLease(queue, claim, now);
}

function claimHasActiveRuntimeLease(queue: HatWorkQueue, claim: WorkClaim, now: string): boolean {
  const lease = queue.runtimeLeases?.find((candidate) => candidate.claimId === claim.claimId);
  if (lease === undefined) return false;
  if (lease.state !== RuntimeLeaseState.Active && lease.state !== RuntimeLeaseState.Renewed) return false;
  if (lease.fencingToken !== claim.fencingToken) return false;
  const shard = queue.shards.find((candidate) => candidate.shardId === claim.shardId);
  if (shard === undefined || !runtimeLeaseMatchesClaim(queue, claim, shard, lease)) return false;
  if (!isValidIso(lease.leaseExpiresAt) || !isValidIso(lease.heartbeatDeadlineAt)) return false;
  if (isIsoAtOrBefore(lease.leaseExpiresAt, now) || isIsoAtOrBefore(lease.heartbeatDeadlineAt, now)) return false;
  return true;
}

function runtimeLeaseMatchesClaim(
  queue: HatWorkQueue,
  claim: WorkClaim,
  shard: WorkShard,
  lease: RuntimeLease,
): boolean {
  return (
    lease.organizationId === queue.organizationId &&
    lease.queueId === queue.queueId &&
    lease.hatId === queue.hatId &&
    lease.scope.kind === queue.scope.kind &&
    lease.scope.id === queue.scope.id &&
    lease.workItemId === shard.workItemId &&
    lease.shardId === shard.shardId &&
    lease.claimId === claim.claimId &&
    lease.hatAssignmentId === claim.hatAssignmentId &&
    lease.agentId === claim.ownerAgentId &&
    lease.scheduleBlockId === claim.scheduleBlockId &&
    lease.runtimeSessionId === claim.runtimeSessionId &&
    lease.workspaceRef === claim.workspaceRef &&
    lease.compensatingActionRef === claim.compensatingAction &&
    lease.credentialScopeRefs.length === 1 &&
    lease.credentialScopeRefs[0] === claim.credentialScope
  );
}

function replaceShard(queue: HatWorkQueue, shard: WorkShard): HatWorkQueue {
  return {
    ...queue,
    shards: queue.shards.map((candidate) => candidate.shardId === shard.shardId ? shard : candidate),
  };
}

function rejectedReview(
  input: EvaluateWorkShardReviewQuorumInput & { readonly producerAgentId: string },
  reason: WorkShardReviewRejectReason,
  reviewedAt: string,
): WorkShardReview {
  return {
    shardId: input.shardId,
    producerAgentId: input.producerAgentId,
    outcome: WorkMarketQuorumOutcome.Rejected,
    approvalCount: 0,
    acceptedEvidenceRefs: [],
    reviewedAt,
    reason,
  };
}

function completedProducerAgentId(queue: HatWorkQueue, shardId: string): string | undefined {
  return queue.claims.find((claim) => claim.shardId === shardId && claim.state === WorkClaimState.Completed)?.ownerAgentId;
}

function reviewIdentity(review: WorkShardReview): string {
  return `${review.shardId}:${review.producerAgentId}:${review.reviewedAt}:${review.acceptedEvidenceRefs.join(",")}`;
}

function bumpQueueRevision(queue: HatWorkQueue): HatWorkQueue {
  return { ...queue, revision: (queue.revision ?? 0) + 1 };
}

function countShards(queue: HatWorkQueue, state: WorkShardState): number {
  return queue.shards.filter((shard) => shard.state === state).length;
}

function isIsoAtOrBefore(left: string, right: string): boolean {
  return Date.parse(left) <= Date.parse(right);
}

function isValidIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function distinctBy<T>(items: readonly T[], key: (item: T) => string): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function pressureFor(input: {
  readonly totalReadyShards: number;
  readonly totalClaimedShards: number;
  readonly totalStaleClaims: number;
}): WorkMarketPressure {
  if (input.totalStaleClaims > 0) return "elevated";
  if (input.totalReadyShards + input.totalClaimedShards === 0) return "none";
  if (input.totalReadyShards >= 5 || input.totalClaimedShards >= 10) return "critical";
  if (input.totalReadyShards >= 2 || input.totalClaimedShards >= 4) return "elevated";
  return "normal";
}
