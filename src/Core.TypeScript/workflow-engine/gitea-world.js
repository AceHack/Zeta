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
import { registerLifetimePair } from "./world.js";
import {} from "./git-world.js";
export function giteaRateLimitTier(remaining) {
    if (remaining > 800)
        return "normal";
    if (remaining > 400)
        return "cost-aware";
    if (remaining > 80)
        return "extreme-cost-aware";
    return "pure-git";
}
export function buildGiteaWorld(gitWorld, resourceBudget) {
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
export function canAffordGitea(world, restCost) {
    const budget = world.resourceBudget;
    if (!budget)
        return { ok: true, world };
    if (restCost > budget.restRemaining) {
        return {
            ok: false,
            feedback: { kind: "ResourceBudgetExhausted", resetAt: budget.restResetAt },
        };
    }
    return { ok: true, world };
}
export function registerInGitea(world, pairName, matrix) {
    return registerLifetimePair(world, pairName, matrix);
}
export const GITEA_PR_UNIVERSE = [
    { kind: "draft" },
    { kind: "open" },
    { kind: "approved" },
    { kind: "merged" },
    { kind: "closed" },
];
export const GITEA_REVIEW_UNIVERSE = [{ kind: "unresolved" }, { kind: "resolved" }];
export const GITEA_ACTION_UNIVERSE = [
    { kind: "queued" },
    { kind: "running" },
    { kind: "success" },
    { kind: "failure" },
    { kind: "cancelled" },
];
export const GITEA_REQUIRE_RESOLVED_VERDICT = {
    kind: "block",
    reason: "Gitea require_resolved_reviews: unresolved reviews block merge",
};
