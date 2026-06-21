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
import { registerLifetimePair } from "./world.js";
import {} from "./git-world.js";
export function gitLabRateLimitTier(remaining) {
    if (remaining > 800)
        return "normal";
    if (remaining > 400)
        return "cost-aware";
    if (remaining > 80)
        return "extreme-cost-aware";
    return "pure-git";
}
/**
 * Build the GitLabWorld substrate from a base GitWorld.
 */
export function buildGitLabWorld(gitWorld, resourceBudget) {
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
export function canAffordGitLab(world, cost) {
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
export function registerInGitLab(world, pairName, matrix) {
    return registerLifetimePair(world, pairName, matrix);
}
// ─────────────────────────────────────────────────────────────────────
// Reusable substrate exports
// ─────────────────────────────────────────────────────────────────────
export const GITLAB_MR_UNIVERSE = [
    { kind: "draft" },
    { kind: "opened" },
    { kind: "reviewer-assigned" },
    { kind: "approved" },
    { kind: "merged" },
    { kind: "closed" },
];
export const GITLAB_DISCUSSION_UNIVERSE = [
    { kind: "unresolved" },
    { kind: "resolved" },
];
export const GITLAB_PIPELINE_UNIVERSE = [
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
export const GITLAB_REQUIRE_RESOLVED_VERDICT = {
    kind: "block",
    reason: "GitLab require_all_discussions_resolved: unresolved discussions block merge",
};
/**
 * Reusable verdict for GitLab's "approval rules not met" pattern.
 *
 * GitLab MRs can have approval rules requiring N approvals from specific
 * groups; this verdict captures the blocked state.
 */
export const GITLAB_APPROVAL_NOT_MET_VERDICT = {
    kind: "block",
    reason: "GitLab approval rules not met: required approvals missing",
};
