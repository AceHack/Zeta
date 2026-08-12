// src/Core.TypeScript/workflow-engine/gitlab-world.ts
//
// 081KSNY2Z0008QG0R002A785QR — GitLabWorld per-host adapter PoC.
//
// Aaron 2026-05-28 lane-status framing: workflow-engine substrate Lane 2
// (GitHub accelerator/workflow). 081KSNY2Z0008QG0R002A785QR names per-host adapters
// extending PR #5775's GitWorld → GitHubWorld specialization hierarchy
// to GitLab + Gitea + Bitbucket + Codeberg + Sourcehut.
//
// This file ships the GitLabWorld instantiation — first per-host adapter
// extending the base. Pattern: same as GitHubWorld but with forge-
// specific lifetime variants + GitLab-native substrate (merge requests
// instead of pull requests; discussions instead of review threads;
// pipelines as first-class CI/CD substrate).
//
// Composes with:
// - PR #5775 git-world.ts (GitWorld base + GitHubWorld first specialization)
// - PR #5776 world-hierarchy.ts (Clifford → DBSP → Git → forge-specific)
// - 081KSNY2Z0008QG0R002A785QR backlog row (per-host adapters target)
// - .claude/rules/asymmetric-authorship (per-forge feedback variants substrate-entity-authored)
// - .claude/rules/monad-propagation (Result<T, GitLabFeedback> shape)

import { registerLifetimePair, type ComposedKey, type LifetimeState, type StandardVerdict } from "./world.js";
import { type GitWorld } from "./git-world.js";

// ─────────────────────────────────────────────────────────────────────
// GitLab forge-specific lifetime types
// ─────────────────────────────────────────────────────────────────────

/**
 * Merge Request lifetime (GitLab's analog of GitHub's PR).
 *
 * GitLab MR state machine variants per GitLab REST API v4 spec:
 * https://docs.gitlab.com/ee/api/merge_requests.html
 */
export interface MrLifetime extends LifetimeState {
  readonly kind: "draft" | "opened" | "reviewer-assigned" | "approved" | "merged" | "closed";
}

/**
 * Discussion lifetime (GitLab's analog of GitHub's review thread).
 *
 * GitLab discussions can be resolvable or non-resolvable; this DU covers
 * the resolvable shape used by code review.
 */
export interface DiscussionLifetime extends LifetimeState {
  readonly kind: "unresolved" | "resolved";
}

/**
 * Pipeline lifetime (GitLab-native; first-class CI/CD substrate).
 *
 * GitLab makes CI/CD pipelines first-class in the API model. Pipeline
 * state-machine variants per GitLab REST API v4 spec.
 */
export interface PipelineLifetime extends LifetimeState {
  readonly kind: "created" | "pending" | "running" | "success" | "failed" | "canceled" | "skipped" | "manual";
}

// ─────────────────────────────────────────────────────────────────────
// GitLab resource-allocation substrate
// ─────────────────────────────────────────────────────────────────────

/**
 * GitLab resource budget (forge-specific).
 *
 * GitLab uses per-minute rate limits (RateLimit-Remaining + RateLimit-
 * Reset headers). Tier varies by plan; free tier defaults are typically
 * 2000/min authenticated for REST. Self-hosted instances can configure
 * limits per project / per user.
 *
 * Distinct from GitHub's per-hour 5000 budget; this models the per-minute
 * rolling window GitLab uses.
 */
export interface GitLabResourceBudget {
  readonly restRemaining: number;
  readonly restLimit: number; // per-minute window; tier-dependent
  readonly restResetAt: number; // unix timestamp
  readonly graphqlRemaining: number;
  readonly graphqlLimit: number; // GitLab GraphQL has its own budget
  readonly graphqlResetAt: number;
}

/**
 * GitLab-specific rate-limit tier per framework's rate-limit substrate.
 *
 * Tiers shifted from GitHub's 5000/hour to GitLab's typical 2000/minute
 * authenticated. Thresholds preserve the same operational substrate
 * (normal / cost-aware / extreme-cost-aware / pure-git) at scaled
 * boundaries.
 */
export type GitLabRateLimitTier =
  | "normal" // > 800 remaining (40% of typical 2000/min)
  | "cost-aware" // 400-800
  | "extreme-cost-aware" // 80-400
  | "pure-git"; // 0-80

export function gitLabRateLimitTier(remaining: number): GitLabRateLimitTier {
  if (remaining > 800) return "normal";
  if (remaining > 400) return "cost-aware";
  if (remaining > 80) return "extreme-cost-aware";
  return "pure-git";
}

// ─────────────────────────────────────────────────────────────────────
// GitLabWorld specialization
// ─────────────────────────────────────────────────────────────────────

/**
 * GitLabWorld — specialization of GitWorld for GitLab forge.
 *
 * Per Aaron 2026-05-28 lane-status framing (Lane 2 GitHub accelerator):
 * 081KSNY2Z0008QG0R002A785QR names per-host adapters as extension target. GitLabWorld is
 * the first concrete adapter beyond GitHubWorld; demonstrates the
 * pattern that GiteaWorld + BitbucketWorld + CodebergWorld + SourcehutWorld
 * follow.
 *
 * Inherits all GitWorld substrate + adds:
 * - MR substrate (MrLifetime; analog of GitHub PR)
 * - Discussion substrate (DiscussionLifetime; analog of GitHub review thread)
 * - Pipeline substrate (PipelineLifetime; GitLab-native first-class CI/CD)
 * - Resource-allocation substrate (REST + GraphQL per-minute budgets)
 * - GitLab-specific optimizations (merge-train, approval rules, suggestion patches)
 */
export interface GitLabWorld extends GitWorld {
  readonly forgeName: "git"; // inherits GitWorld base
  readonly forgeSpecialization: "gitlab";
  readonly mrUniverse: ReadonlyArray<MrLifetime>;
  readonly discussionUniverse: ReadonlyArray<DiscussionLifetime>;
  readonly pipelineUniverse: ReadonlyArray<PipelineLifetime>;
  readonly resourceBudget?: GitLabResourceBudget;
}

/**
 * Build the GitLabWorld substrate from a base GitWorld.
 */
export function buildGitLabWorld(gitWorld: GitWorld, resourceBudget?: GitLabResourceBudget): GitLabWorld {
  return {
    ...gitWorld,
    forgeSpecialization: "gitlab",
    mrUniverse: [
      { kind: "draft" },
      { kind: "opened" },
      { kind: "reviewer-assigned" },
      { kind: "approved" },
      { kind: "merged" },
      { kind: "closed" },
    ],
    discussionUniverse: [{ kind: "unresolved" }, { kind: "resolved" }],
    pipelineUniverse: [
      { kind: "created" },
      { kind: "pending" },
      { kind: "running" },
      { kind: "success" },
      { kind: "failed" },
      { kind: "canceled" },
      { kind: "skipped" },
      { kind: "manual" },
    ],
    ...(resourceBudget !== undefined && { resourceBudget }),
  };
}

// ─────────────────────────────────────────────────────────────────────
// GitLab-specific feedback substrate
// ─────────────────────────────────────────────────────────────────────

export type GitLabFeedback =
  | { kind: "UnsupportedGitLabFeature"; feature: string }
  | { kind: "ResourceBudgetExhausted"; budget: "rest" | "graphql"; resetAt: number }
  | { kind: "ApprovalRulesNotMet"; required: number; actual: number }
  | { kind: "MergeBlocked"; reason: string };

export type GitLabResult<T> = { ok: true; world: T } | { ok: false; feedback: GitLabFeedback };

/**
 * Check if a GitLab operation is within budget.
 *
 * Same shape as GitHubWorld's canAfford; per-minute window vs per-hour.
 */
export interface GitLabOperationCost {
  readonly restCost?: number;
  readonly graphqlCost?: number;
}

export function canAffordGitLab(world: GitLabWorld, cost: GitLabOperationCost): GitLabResult<GitLabWorld> {
  const budget = world.resourceBudget;
  if (!budget) {
    return { ok: true, world };
  }
  const restCost = cost.restCost ?? 0;
  const graphqlCost = cost.graphqlCost ?? 0;
  if (restCost > budget.restRemaining) {
    return {
      ok: false,
      feedback: {
        kind: "ResourceBudgetExhausted",
        budget: "rest",
        resetAt: budget.restResetAt,
      },
    };
  }
  if (graphqlCost > budget.graphqlRemaining) {
    return {
      ok: false,
      feedback: {
        kind: "ResourceBudgetExhausted",
        budget: "graphql",
        resetAt: budget.graphqlResetAt,
      },
    };
  }
  return { ok: true, world };
}

/**
 * Convenience: register a lifetime pair in the GitLabWorld.
 */
export function registerInGitLab<A extends LifetimeState, B extends LifetimeState, T>(
  world: GitLabWorld,
  pairName: string,
  matrix: ReadonlyMap<ComposedKey<A, B>, T>,
): GitLabWorld {
  return registerLifetimePair(world, pairName, matrix);
}

// ─────────────────────────────────────────────────────────────────────
// Reusable substrate exports
// ─────────────────────────────────────────────────────────────────────

export const GITLAB_MR_UNIVERSE: ReadonlyArray<MrLifetime> = [
  { kind: "draft" },
  { kind: "opened" },
  { kind: "reviewer-assigned" },
  { kind: "approved" },
  { kind: "merged" },
  { kind: "closed" },
];

export const GITLAB_DISCUSSION_UNIVERSE: ReadonlyArray<DiscussionLifetime> = [
  { kind: "unresolved" },
  { kind: "resolved" },
];

export const GITLAB_PIPELINE_UNIVERSE: ReadonlyArray<PipelineLifetime> = [
  { kind: "created" },
  { kind: "pending" },
  { kind: "running" },
  { kind: "success" },
  { kind: "failed" },
  { kind: "canceled" },
  { kind: "skipped" },
  { kind: "manual" },
];

/**
 * Reusable verdict for GitLab's "must resolve all discussions before
 * merge" branch protection pattern (settings/general/merge_request).
 *
 * Same shape as GITHUB's REQUIRE_RESOLVED_VERDICT but named with
 * GitLab vocabulary.
 */
export const GITLAB_REQUIRE_RESOLVED_VERDICT: StandardVerdict = {
  kind: "block",
  reason: "GitLab require_all_discussions_resolved: unresolved discussions block merge",
};

/**
 * Reusable verdict for GitLab's "approval rules not met" pattern.
 *
 * GitLab MRs can have approval rules requiring N approvals from specific
 * groups; this verdict captures the blocked state.
 */
export const GITLAB_APPROVAL_NOT_MET_VERDICT: StandardVerdict = {
  kind: "block",
  reason: "GitLab approval rules not met: required approvals missing",
};
