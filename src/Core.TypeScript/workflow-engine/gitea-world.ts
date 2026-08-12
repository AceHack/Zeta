// src/Core.TypeScript/workflow-engine/gitea-world.ts
//
// 081KSNY2Z0008QG0R002A785QR — GiteaWorld per-host adapter.
//
// Gitea is GitHub-API-compatible by design (originally a Gogs fork; now
// independent). Lifetime variants closely mirror GitHub's PR/review-thread
// shape. Adds Gitea Actions (GitHub-Actions-compatible YAML) substrate.
//
// Composes with PR #5775 (GitWorld base) + PR #5801 (GitLabWorld first
// extension) + 081KSNY2Z0008QG0R002A785QR (per-host adapters target).

import { registerLifetimePair, type ComposedKey, type LifetimeState, type StandardVerdict } from "./world.js";
import { type GitWorld } from "./git-world.js";

export interface GiteaPrLifetime extends LifetimeState {
  readonly kind: "draft" | "open" | "approved" | "merged" | "closed";
}

export interface GiteaReviewLifetime extends LifetimeState {
  readonly kind: "unresolved" | "resolved";
}

export interface GiteaActionLifetime extends LifetimeState {
  readonly kind: "queued" | "running" | "success" | "failure" | "cancelled";
}

export interface GiteaResourceBudget {
  readonly restRemaining: number;
  readonly restLimit: number;
  readonly restResetAt: number;
}

export type GiteaRateLimitTier = "normal" | "cost-aware" | "extreme-cost-aware" | "pure-git";

export function giteaRateLimitTier(remaining: number): GiteaRateLimitTier {
  if (remaining > 800) return "normal";
  if (remaining > 400) return "cost-aware";
  if (remaining > 80) return "extreme-cost-aware";
  return "pure-git";
}

export interface GiteaWorld extends GitWorld {
  readonly forgeName: "git";
  readonly forgeSpecialization: "gitea";
  readonly prUniverse: ReadonlyArray<GiteaPrLifetime>;
  readonly reviewUniverse: ReadonlyArray<GiteaReviewLifetime>;
  readonly actionUniverse: ReadonlyArray<GiteaActionLifetime>;
  readonly resourceBudget?: GiteaResourceBudget;
}

export function buildGiteaWorld(gitWorld: GitWorld, resourceBudget?: GiteaResourceBudget): GiteaWorld {
  return {
    ...gitWorld,
    forgeSpecialization: "gitea",
    prUniverse: [{ kind: "draft" }, { kind: "open" }, { kind: "approved" }, { kind: "merged" }, { kind: "closed" }],
    reviewUniverse: [{ kind: "unresolved" }, { kind: "resolved" }],
    actionUniverse: [
      { kind: "queued" },
      { kind: "running" },
      { kind: "success" },
      { kind: "failure" },
      { kind: "cancelled" },
    ],
    ...(resourceBudget !== undefined && { resourceBudget }),
  };
}

export type GiteaFeedback =
  | { kind: "UnsupportedGiteaFeature"; feature: string }
  | { kind: "ResourceBudgetExhausted"; resetAt: number }
  | { kind: "MergeBlocked"; reason: string };

export type GiteaResult<T> = { ok: true; world: T } | { ok: false; feedback: GiteaFeedback };

export function canAffordGitea(world: GiteaWorld, restCost: number): GiteaResult<GiteaWorld> {
  const budget = world.resourceBudget;
  if (!budget) return { ok: true, world };
  if (restCost > budget.restRemaining) {
    return {
      ok: false,
      feedback: { kind: "ResourceBudgetExhausted", resetAt: budget.restResetAt },
    };
  }
  return { ok: true, world };
}

export function registerInGitea<A extends LifetimeState, B extends LifetimeState, T>(
  world: GiteaWorld,
  pairName: string,
  matrix: ReadonlyMap<ComposedKey<A, B>, T>,
): GiteaWorld {
  return registerLifetimePair(world, pairName, matrix);
}

export const GITEA_PR_UNIVERSE: ReadonlyArray<GiteaPrLifetime> = [
  { kind: "draft" },
  { kind: "open" },
  { kind: "approved" },
  { kind: "merged" },
  { kind: "closed" },
];

export const GITEA_REVIEW_UNIVERSE: ReadonlyArray<GiteaReviewLifetime> = [{ kind: "unresolved" }, { kind: "resolved" }];

export const GITEA_ACTION_UNIVERSE: ReadonlyArray<GiteaActionLifetime> = [
  { kind: "queued" },
  { kind: "running" },
  { kind: "success" },
  { kind: "failure" },
  { kind: "cancelled" },
];

export const GITEA_REQUIRE_RESOLVED_VERDICT: StandardVerdict = {
  kind: "block",
  reason: "Gitea require_resolved_reviews: unresolved reviews block merge",
};
