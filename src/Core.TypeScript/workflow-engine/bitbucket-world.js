// src/Core.TypeScript/workflow-engine/bitbucket-world.ts
//
// B-0867.15 — BitbucketWorld per-host adapter.
//
// Bitbucket (Atlassian) uses pull-request vocabulary like GitHub but with
// different state machine + Bitbucket Pipelines as CI/CD substrate.
// REST API v2.0 (no GraphQL).
//
// Composes with PR #5775 (GitWorld base) + PR #5801 (GitLabWorld first
// extension) + B-0867.15 (per-host adapters target).
import { registerLifetimePair } from "./world.js";
import {} from "./git-world.js";
export function bitbucketRateLimitTier(remaining) {
    if (remaining > 400)
        return "normal";
    if (remaining > 200)
        return "cost-aware";
    if (remaining > 40)
        return "extreme-cost-aware";
    return "pure-git";
}
export function buildBitbucketWorld(gitWorld, resourceBudget) {
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
export function canAffordBitbucket(world, hourlyCost) {
    const budget = world.resourceBudget;
    if (!budget)
        return { ok: true, world };
    if (hourlyCost > budget.hourlyRemaining) {
        return {
            ok: false,
            feedback: { kind: "ResourceBudgetExhausted", resetAt: budget.hourlyResetAt },
        };
    }
    return { ok: true, world };
}
export function registerInBitbucket(world, pairName, matrix) {
    return registerLifetimePair(world, pairName, matrix);
}
export const BITBUCKET_PR_UNIVERSE = [
    { kind: "open" },
    { kind: "declined" },
    { kind: "merged" },
    { kind: "superseded" },
];
export const BITBUCKET_PIPELINE_UNIVERSE = [
    { kind: "pending" },
    { kind: "in-progress" },
    { kind: "successful" },
    { kind: "failed" },
    { kind: "error" },
    { kind: "stopped" },
    { kind: "expired" },
];
export const BITBUCKET_APPROVALS_MISSING_VERDICT = {
    kind: "block",
    reason: "Bitbucket branch restriction: required approvals missing",
};
