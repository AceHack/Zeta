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
import { EMPTY_WORLD, registerLifetimePair, } from "./world";
/**
 * Build the base GitWorld substrate — every GitWorld starts here.
 */
export function buildGitWorld() {
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
 * Compute rate-limit tier from current GitHub resource budget.
 *
 * Per framework's tier table; substrate-engineering substrate-honest
 * naming preserved.
 */
export function rateLimitTier(remaining) {
    if (remaining > 2000)
        return "normal";
    if (remaining > 1000)
        return "cost-aware";
    if (remaining > 200)
        return "extreme-cost-aware";
    return "pure-git";
}
/**
 * Build the GitHubWorld substrate from a base GitWorld.
 *
 * Adds PR + review-thread universes + optional resource-budget. Caller
 * registers any lifetime-pair matrices needed for the substrate-
 * engineering work.
 */
export function buildGitHubWorld(gitWorld, resourceBudget) {
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
export function canAfford(world, cost) {
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
export function registerInGitHub(world, pairName, matrix) {
    return registerLifetimePair(world, pairName, matrix);
}
/**
 * Reusable PR lifetime universe export (for caller composition).
 */
export const GITHUB_PR_UNIVERSE = [
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
export const GITHUB_REVIEW_THREAD_UNIVERSE = [
    { kind: "unresolved" },
    { kind: "outdated" },
    { kind: "resolved" },
];
/**
 * Reusable verdict for "must resolve threads before merge" pattern.
 * Used in GitHub's required_conversation_resolution branch protection.
 */
export const REQUIRE_RESOLVED_VERDICT = {
    kind: "block",
    reason: "GitHub required_conversation_resolution: unresolved threads block merge",
};
