// src/Core.TypeScript/workflow-engine/codeberg-world.ts
//
// 081KSNY2Z0008QG0R002A785QR — CodebergWorld per-host adapter.
//
// Codeberg.org is community-hosted Gitea instance (German non-profit:
// "Codeberg e.V."). Substrate-wise IDENTICAL to GiteaWorld at the API
// surface; differs in (a) hosting policy (no commercial use; EU servers),
// (b) community moderation, (c) typical resource budget (more conservative
// rate limits for shared community instance).
//
// Per `.claude/rules/honor-those-that-came-before.md`: Codeberg honors
// the Gitea substrate it derives from + adds its own substrate-engineering
// substrate (community governance + EU-data-sovereignty). Substrate-naming
// substrate-engineering keeps the inheritance explicit.
import { buildGiteaWorld, } from "./gitea-world.js";
import {} from "./git-world.js";
/**
 * Build CodebergWorld from base GitWorld; inherits Gitea substrate via
 * intermediate buildGiteaWorld.
 */
export function buildCodebergWorld(gitWorld, resourceBudget) {
    const giteaBase = buildGiteaWorld(gitWorld, resourceBudget);
    return {
        ...giteaBase,
        forgeSpecialization: "codeberg",
        hostingPolicy: "non-commercial-eu-sovereign",
        communityGoverned: true,
    };
}
/**
 * Default conservative budget for Codeberg's shared community instance.
 * Substrate-honest: community resource; treat with care.
 */
export const CODEBERG_CONSERVATIVE_BUDGET = {
    restRemaining: 300,
    restLimit: 500, // conservative; tighter than commercial Gitea instances
    restResetAt: 0, // caller updates to actual reset timestamp
};
