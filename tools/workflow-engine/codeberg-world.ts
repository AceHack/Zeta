// tools/workflow-engine/codeberg-world.ts
//
// B-0867.15 — CodebergWorld per-host adapter.
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

import {
  type LifetimeState,
} from "./world.js";
import {
  buildGiteaWorld,
  type GiteaPrLifetime,
  type GiteaReviewLifetime,
  type GiteaActionLifetime,
  type GiteaResourceBudget,
  type GiteaWorld,
} from "./gitea-world.js";
import { type GitWorld } from "./git-world.js";

/**
 * CodebergWorld — Codeberg-specific specialization of GiteaWorld.
 *
 * Inherits all GiteaWorld substrate + adds Codeberg-specific properties:
 * - Community-moderation substrate (codeOfConduct, terms-of-service)
 * - EU-data-sovereignty marker (GDPR-compliant; German non-profit)
 * - Conservative rate-limit defaults (shared community instance)
 */
export interface CodebergWorld extends GiteaWorld {
  readonly forgeName: "git";
  readonly forgeSpecialization: "codeberg";  // narrower than gitea
  readonly hostingPolicy: "non-commercial-eu-sovereign";
  readonly communityGoverned: true;
}

/**
 * Build CodebergWorld from base GitWorld; inherits Gitea substrate via
 * intermediate buildGiteaWorld.
 */
export function buildCodebergWorld(
  gitWorld: GitWorld,
  resourceBudget?: GiteaResourceBudget,
): CodebergWorld {
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
export const CODEBERG_CONSERVATIVE_BUDGET: GiteaResourceBudget = {
  restRemaining: 300,
  restLimit: 500,        // conservative; tighter than commercial Gitea instances
  restResetAt: 0,        // caller updates to actual reset timestamp
};

// Re-export Gitea types for CodebergWorld consumers (alias-pattern at
// type-namespace scope, per
// memory/feedback_alias_pattern_greek_primary_english_secondary_for_substrate_named_primitives_aaron_ratification_2026_05_28.md
// applied here at forge-derivative scope).
export type {
  GiteaPrLifetime as CodebergPrLifetime,
  GiteaReviewLifetime as CodebergReviewLifetime,
  GiteaActionLifetime as CodebergActionLifetime,
};
