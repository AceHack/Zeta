// src/Core.TypeScript/workflow-engine/bitbucket-world.ts
//
// 081KSNY2Z0008QG0R002A785QR — BitbucketWorld per-host adapter.
//
// Bitbucket (Atlassian) uses pull-request vocabulary like GitHub but with
// different state machine + Bitbucket Pipelines as CI/CD substrate.
// REST API v2.0 (no GraphQL).
//
// Composes with PR #5775 (GitWorld base) + PR #5801 (GitLabWorld first
// extension) + 081KSNY2Z0008QG0R002A785QR (per-host adapters target).

import { registerLifetimePair, type ComposedKey, type LifetimeState, type StandardVerdict } from "./world.js";
import { type GitWorld } from "./git-world.js";

export interface BitbucketPrLifetime extends LifetimeState {
  readonly kind: "open" | "declined" | "merged" | "superseded";
}

export interface BitbucketCommentLifetime extends LifetimeState {
  readonly kind: "inline" | "general" | "task-open" | "task-resolved";
}

export interface BitbucketPipelineLifetime extends LifetimeState {
  readonly kind: "pending" | "in-progress" | "successful" | "failed" | "error" | "stopped" | "expired";
}

export interface BitbucketBranchRestriction extends LifetimeState {
  readonly kind: "require-approvals" | "require-default-reviewers" | "no-restriction";
}

export interface BitbucketResourceBudget {
  readonly hourlyRemaining: number; // Bitbucket uses hourly rate limits per OAuth client
  readonly hourlyLimit: number; // typically 1000/hour for OAuth
  readonly hourlyResetAt: number;
}

export type BitbucketRateLimitTier = "normal" | "cost-aware" | "extreme-cost-aware" | "pure-git";

export function bitbucketRateLimitTier(remaining: number): BitbucketRateLimitTier {
  if (remaining > 400) return "normal";
  if (remaining > 200) return "cost-aware";
  if (remaining > 40) return "extreme-cost-aware";
  return "pure-git";
}

export interface BitbucketWorld extends GitWorld {
  readonly forgeName: "git";
  readonly forgeSpecialization: "bitbucket";
  readonly prUniverse: ReadonlyArray<BitbucketPrLifetime>;
  readonly commentUniverse: ReadonlyArray<BitbucketCommentLifetime>;
  readonly pipelineUniverse: ReadonlyArray<BitbucketPipelineLifetime>;
  readonly branchRestrictionUniverse: ReadonlyArray<BitbucketBranchRestriction>;
  readonly resourceBudget?: BitbucketResourceBudget;
}

export function buildBitbucketWorld(gitWorld: GitWorld, resourceBudget?: BitbucketResourceBudget): BitbucketWorld {
  return {
    ...gitWorld,
    forgeSpecialization: "bitbucket",
    prUniverse: [{ kind: "open" }, { kind: "declined" }, { kind: "merged" }, { kind: "superseded" }],
    commentUniverse: [{ kind: "inline" }, { kind: "general" }, { kind: "task-open" }, { kind: "task-resolved" }],
    pipelineUniverse: [
      { kind: "pending" },
      { kind: "in-progress" },
      { kind: "successful" },
      { kind: "failed" },
      { kind: "error" },
      { kind: "stopped" },
      { kind: "expired" },
    ],
    branchRestrictionUniverse: [
      { kind: "require-approvals" },
      { kind: "require-default-reviewers" },
      { kind: "no-restriction" },
    ],
    ...(resourceBudget !== undefined && { resourceBudget }),
  };
}

export type BitbucketFeedback =
  | { kind: "UnsupportedBitbucketFeature"; feature: string }
  | { kind: "ResourceBudgetExhausted"; resetAt: number }
  | { kind: "ApprovalsMissing"; required: number; actual: number }
  | { kind: "MergeBlocked"; reason: string };

export type BitbucketResult<T> = { ok: true; world: T } | { ok: false; feedback: BitbucketFeedback };

export function canAffordBitbucket(world: BitbucketWorld, hourlyCost: number): BitbucketResult<BitbucketWorld> {
  const budget = world.resourceBudget;
  if (!budget) return { ok: true, world };
  if (hourlyCost > budget.hourlyRemaining) {
    return {
      ok: false,
      feedback: { kind: "ResourceBudgetExhausted", resetAt: budget.hourlyResetAt },
    };
  }
  return { ok: true, world };
}

export function registerInBitbucket<A extends LifetimeState, B extends LifetimeState, T>(
  world: BitbucketWorld,
  pairName: string,
  matrix: ReadonlyMap<ComposedKey<A, B>, T>,
): BitbucketWorld {
  return registerLifetimePair(world, pairName, matrix);
}

export const BITBUCKET_PR_UNIVERSE: ReadonlyArray<BitbucketPrLifetime> = [
  { kind: "open" },
  { kind: "declined" },
  { kind: "merged" },
  { kind: "superseded" },
];

export const BITBUCKET_PIPELINE_UNIVERSE: ReadonlyArray<BitbucketPipelineLifetime> = [
  { kind: "pending" },
  { kind: "in-progress" },
  { kind: "successful" },
  { kind: "failed" },
  { kind: "error" },
  { kind: "stopped" },
  { kind: "expired" },
];

export const BITBUCKET_APPROVALS_MISSING_VERDICT: StandardVerdict = {
  kind: "block",
  reason: "Bitbucket branch restriction: required approvals missing",
};
