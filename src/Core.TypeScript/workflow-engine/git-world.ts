/**
 * src/Core.TypeScript/workflow-engine/git-world.ts
 *
 * Git world substrate + forge-specialization hierarchy.
 *
 * Per the human maintainer (2026-05-28): 'we have a git world and a
 * github specilazation of it for REST/graphql enhancements/optimizations/
 * resource allocations/etc...'
 *
 * Substrate-engineering substrate-naming substrate (operator-explicit):
 * - GitWorld = base substrate where git lifetimes interact (commit,
 *   branch, merge, rebase via git protocol)
 * - GitHubWorld / GitLabWorld / GiteaWorld / etc. = specializations that
 *   add forge-specific substrate (REST API, GraphQL, webhooks, PR
 *   substrate, resource allocations, optimizations)
 *
 * Each specialization INHERITS GitWorld substrate + adds its own
 * forge-specific lifetimes + dispatch matrices + resource-allocation
 * substrate. Same dispatch substrate (per composed-lifetime.ts +
 * world.ts) works for all; specialization is data not code.
 *
 * Composes with:
 *   - src/Core.TypeScript/workflow-engine/world.ts (PR #5774) — base World substrate
 *   - src/Core.TypeScript/workflow-engine/composed-lifetime.ts (PR #5771) — dispatch
 *   - 081KSNY2Z0008QG0R002A785QR per-host adapters (github/gitlab/gitea/bitbucket
 *     isomorphic cross-host substrate)
 *   - 081KSNY2Z0008QG0R001JQABB4 GitHub-as-free-event-store (specific GitHub optimization)
 *   - 081KSNY2Z0008QG0R0002BEZMR cross-vendor benchmark (cross-vendor scoring; same
 *     shape applies cross-forge)
 *   - .claude/rules/monad-propagation-pattern
 *   - .claude/rules/asymmetric-authorship
 *   - .claude/rules/additive-not-zero-sum (specialization is additive
 *     extension; doesn't subtract from base GitWorld substrate)
 */

import {
  EMPTY_WORLD,
  registerLifetimePair,
  type ComposedKey,
  type LifetimeState,
  type StandardVerdict,
  type World,
} from "./world";

// Re-export ComposedKey so downstream substrate (e.g., git-world.test.ts)
// can import it from this module without reaching into ./world directly.
export type { ComposedKey };

/**
 * Branch lifetime — canonical git lifetime; every GitWorld has it.
 *
 * Edit-able substrate per the human maintainer's lifetime discipline;
 * variants can be extended as forge-specific substrate emerges (e.g.,
 * GitHub adds 'protected' branch state; GitLab adds 'wip' draft state).
 */
export interface BranchLifetime extends LifetimeState {
  readonly kind: "fresh" | "active" | "merged" | "deleted";
}

/**
 * Commit lifetime — canonical git lifetime; every GitWorld has it.
 */
export interface CommitLifetime extends LifetimeState {
  readonly kind: "pending" | "signed" | "pushed" | "merged" | "reverted";
}

/**
 * GitWorld — base substrate where git lifetimes interact.
 *
 * Per the human maintainer (2026-05-28): the WORLD is the shared
 * git-flow substrate; GitWorld is the BASE substrate that
 * forge-specializations inherit.
 *
 * Base substrate operations: commit, branch, merge, rebase, push, pull,
 * cherry-pick, revert. All operate on BranchLifetime + CommitLifetime
 * + ref-lifetime + working-tree-lifetime.
 */
export interface GitWorld extends World {
  readonly forgeName: "git"; // base substrate (no forge specialization)
  readonly branchUniverse: ReadonlyArray<BranchLifetime>;
  readonly commitUniverse: ReadonlyArray<CommitLifetime>;
}

/**
 * Build the base GitWorld substrate — every GitWorld starts here.
 */
export function buildGitWorld(): GitWorld {
  return {
    ...EMPTY_WORLD,
    forgeName: "git",
    branchUniverse: [{ kind: "fresh" }, { kind: "active" }, { kind: "merged" }, { kind: "deleted" }],
    commitUniverse: [
      { kind: "pending" },
      { kind: "signed" },
      { kind: "pushed" },
      { kind: "merged" },
      { kind: "reverted" },
    ],
  };
}

/**
 * PR lifetime (GitHub specialization).
 *
 * Per the human maintainer (2026-05-28): GitHub adds PR substrate as
 * forge-specific specialization. Lifetime variants per GitHub PR
 * state machine.
 */
export interface PrLifetime extends LifetimeState {
  readonly kind: "draft" | "open" | "review-requested" | "approved" | "merged" | "closed";
}

/**
 * Review-thread lifetime (GitHub specialization).
 */
export interface ReviewThreadLifetime extends LifetimeState {
  readonly kind: "unresolved" | "outdated" | "resolved";
}

/**
 * GitHub resource-allocation substrate (forge-specific).
 *
 * Per the human maintainer (2026-05-28) 'REST/graphql enhancements/
 * optimizations/resource allocations'. GitHub has 2 distinct rate-limit
 * budgets per token: REST (resources.core) + GraphQL (resources.graphql).
 * Both 5000/hour for authenticated requests.
 */
export interface GitHubResourceBudget {
  readonly restCoreRemaining: number;
  readonly restCoreLimit: number; // typically 5000
  readonly restCoreResetAt: number; // unix timestamp
  readonly graphqlRemaining: number;
  readonly graphqlLimit: number; // typically 5000
  readonly graphqlResetAt: number;
}

/**
 * Operational tier per the framework's rate-limit-tier substrate (per
 * .claude/rules/refresh-world-model-poll-pr-gate.md).
 */
export type RateLimitTier =
  | "normal" // > 2000 remaining
  | "cost-aware" // 1000-2000
  | "extreme-cost-aware" // 200-1000
  | "pure-git"; // 0-200

/**
 * Compute rate-limit tier from current GitHub resource budget.
 *
 * Per framework's tier table; substrate-engineering substrate-honest
 * naming preserved.
 */
export function rateLimitTier(remaining: number): RateLimitTier {
  if (remaining > 2000) return "normal";
  if (remaining > 1000) return "cost-aware";
  if (remaining > 200) return "extreme-cost-aware";
  return "pure-git";
}

/**
 * GitHubWorld — specialization of GitWorld for GitHub forge.
 *
 * Inherits all GitWorld substrate + adds:
 * - PR substrate (PrLifetime)
 * - Review-thread substrate (ReviewThreadLifetime)
 * - Resource-allocation substrate (REST/GraphQL budgets + tier)
 * - GitHub-specific optimizations (auto-merge, merge-queue, etc.)
 */
export interface GitHubWorld extends GitWorld {
  readonly forgeName: "git"; // inherits GitWorld base
  readonly forgeSpecialization: "github";
  readonly prUniverse: ReadonlyArray<PrLifetime>;
  readonly reviewThreadUniverse: ReadonlyArray<ReviewThreadLifetime>;
  readonly resourceBudget?: GitHubResourceBudget; // optional; populated by caller
}

/**
 * Build the GitHubWorld substrate from a base GitWorld.
 *
 * Adds PR + review-thread universes + optional resource-budget. Caller
 * registers any lifetime-pair matrices needed for the substrate-
 * engineering work.
 */
export function buildGitHubWorld(gitWorld: GitWorld, resourceBudget?: GitHubResourceBudget): GitHubWorld {
  return {
    ...gitWorld,
    forgeSpecialization: "github",
    prUniverse: [
      { kind: "draft" },
      { kind: "open" },
      { kind: "review-requested" },
      { kind: "approved" },
      { kind: "merged" },
      { kind: "closed" },
    ],
    reviewThreadUniverse: [{ kind: "unresolved" }, { kind: "outdated" }, { kind: "resolved" }],
    ...(resourceBudget !== undefined && { resourceBudget }),
  };
}

/**
 * Forge-specialization feedback per asymmetric-authorship rule.
 */
export type ForgeSpecializationFeedback =
  | { kind: "UnsupportedForge"; forge: string }
  | { kind: "ResourceBudgetExhausted"; budget: "rest-core" | "graphql"; resetAt: number };

export type ForgeResult<T> = { ok: true; world: T } | { ok: false; feedback: ForgeSpecializationFeedback };

/**
 * Check if a GitHub operation is within budget.
 *
 * Per framework's rate-limit tier substrate: pure-git tier means GraphQL
 * is exhausted; substrate should defer GraphQL operations + use pure-git
 * substrate (commit/push/local) until reset.
 */
export interface OperationCost {
  readonly restCoreCost?: number; // default 0
  readonly graphqlCost?: number; // default 0
}

export function canAfford(world: GitHubWorld, cost: OperationCost): ForgeResult<GitHubWorld> {
  const budget = world.resourceBudget;
  if (!budget) {
    // No budget loaded; assume operation can proceed (caller loads budget
    // explicitly when discipline matters)
    return { ok: true, world };
  }
  const restCost = cost.restCoreCost ?? 0;
  const graphqlCost = cost.graphqlCost ?? 0;
  if (restCost > budget.restCoreRemaining) {
    return {
      ok: false,
      feedback: {
        kind: "ResourceBudgetExhausted",
        budget: "rest-core",
        resetAt: budget.restCoreResetAt,
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
 * Convenience: register a lifetime pair in the GitHubWorld (inherits
 * registerLifetimePair from base World).
 *
 * Returns NEW GitHubWorld with the pair registered (immutable substrate).
 *
 * Since registerLifetimePair is now generic over the World subtype
 * (it returns the input world's type with subclass fields preserved),
 * this helper simply delegates and lets the generic propagate
 * GitHubWorld through.
 */
export function registerInGitHub<A extends LifetimeState, B extends LifetimeState, T>(
  world: GitHubWorld,
  pairName: string,
  matrix: ReadonlyMap<ComposedKey<A, B>, T>,
): GitHubWorld {
  return registerLifetimePair(world, pairName, matrix);
}

/**
 * Reusable PR lifetime universe export (for caller composition).
 */
export const GITHUB_PR_UNIVERSE: ReadonlyArray<PrLifetime> = [
  { kind: "draft" },
  { kind: "open" },
  { kind: "review-requested" },
  { kind: "approved" },
  { kind: "merged" },
  { kind: "closed" },
];

/**
 * Reusable review-thread universe.
 */
export const GITHUB_REVIEW_THREAD_UNIVERSE: ReadonlyArray<ReviewThreadLifetime> = [
  { kind: "unresolved" },
  { kind: "outdated" },
  { kind: "resolved" },
];

/**
 * Reusable verdict for "must resolve threads before merge" pattern.
 * Used in GitHub's required_conversation_resolution branch protection.
 */
export const REQUIRE_RESOLVED_VERDICT: StandardVerdict = {
  kind: "block",
  reason: "GitHub required_conversation_resolution: unresolved threads block merge",
};
