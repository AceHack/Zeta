// src/Core.TypeScript/workflow-engine/sourcehut-world.ts
//
// B-0867.15 — SourcehutWorld per-host adapter.
//
// SubstantIVELY DIFFERENT shape from GitHub/GitLab/Gitea/Bitbucket/
// Codeberg. Sourcehut (sr.ht) uses EMAIL-PATCHES + MAILING LISTS for
// code review (lists.sr.ht), git.sr.ht for hosting, builds.sr.ht for
// CI, todo.sr.ht for tickets. NO web-PR equivalent.
//
// This adapter substrate-engineering substrate-naming substrate
// demonstrates the per-host-adapter pattern can extend to QUALITATIVELY
// DIFFERENT forge models, not just PR/MR variations.
//
// Composes with PR #5775 (GitWorld base) + PR #5801 (GitLabWorld) +
// B-0867.15 (per-host adapters target).
import { registerLifetimePair } from "./world.js";
import {} from "./git-world.js";
export function srhtRateLimitTier(buildJobsRemaining) {
    return buildJobsRemaining > 0 ? "normal" : "constrained";
}
export function buildSourcehutWorld(gitWorld, resourceBudget) {
    return {
        ...gitWorld,
        forgeSpecialization: "sourcehut",
        patchUniverse: [
            { kind: "sent" },
            { kind: "under-review" },
            { kind: "needs-revision" },
            { kind: "applied" },
            { kind: "merged" },
            { kind: "rejected" },
            { kind: "abandoned" },
        ],
        listThreadUniverse: [
            { kind: "discussion" },
            { kind: "rfc" },
            { kind: "patch-series" },
            { kind: "announcement" },
            { kind: "closed" },
        ],
        buildUniverse: [
            { kind: "pending" },
            { kind: "queued" },
            { kind: "running" },
            { kind: "success" },
            { kind: "failed" },
            { kind: "timeout" },
            { kind: "cancelled" },
        ],
        ticketUniverse: [
            { kind: "open" },
            { kind: "resolved-fixed" },
            { kind: "resolved-wontfix" },
            { kind: "resolved-duplicate" },
            { kind: "resolved-not-our-bug" },
        ],
        ...(resourceBudget !== undefined && { resourceBudget }),
    };
}
export function canAffordSrhtBuild(world, jobsNeeded) {
    const budget = world.resourceBudget;
    if (!budget)
        return { ok: true, world };
    if (jobsNeeded > budget.buildJobsRemaining) {
        return {
            ok: false,
            feedback: {
                kind: "BuildSlotsExhausted",
                required: jobsNeeded,
                available: budget.buildJobsRemaining,
            },
        };
    }
    return { ok: true, world };
}
export function registerInSourcehut(world, pairName, matrix) {
    return registerLifetimePair(world, pairName, matrix);
}
export const SRHT_PATCH_UNIVERSE = [
    { kind: "sent" },
    { kind: "under-review" },
    { kind: "needs-revision" },
    { kind: "applied" },
    { kind: "merged" },
    { kind: "rejected" },
    { kind: "abandoned" },
];
export const SRHT_BUILD_UNIVERSE = [
    { kind: "pending" },
    { kind: "queued" },
    { kind: "running" },
    { kind: "success" },
    { kind: "failed" },
    { kind: "timeout" },
    { kind: "cancelled" },
];
/**
 * Email-patches verdict: Sourcehut workflow expects patches to land via
 * maintainer-applied (not auto-merge). This verdict captures the manual-
 * apply discipline.
 */
export const SRHT_MANUAL_APPLY_VERDICT = {
    kind: "block",
    reason: "Sourcehut: email-patches require manual maintainer apply, not auto-merge",
};
