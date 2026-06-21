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
 * Inherits all GiteaWorld substrate fields EXCEPT forgeSpecialization,
 * which is narrowed from "gitea" to "codeberg" literal. Uses Omit to
 * avoid TS2430 interface-incompatible-extends error (literal types are
 * invariant).
 *
 * Adds Codeberg-specific properties:
 * - `hostingPolicy: "non-commercial-eu-sovereign"` — EU-data-sovereignty
 *   marker (GDPR-compliant; German non-profit; Codeberg e.V.)
 * - `communityGoverned: true` — community-moderation substrate (CoC +
 *   community-governed terms-of-service; not commercial vendor policy)
 *
 * Conservative rate-limit defaults appropriate for a shared community
 * instance are inherited via GiteaResourceBudget (constructed by
 * buildCodebergWorld below).
 */
export interface CodebergWorld extends Omit<GiteaWorld, "forgeSpecialization"> {
  readonly forgeSpecialization: "codeberg"; // narrower than gitea
  readonly hostingPolicy: "non-commercial-eu-sovereign";
  readonly communityGoverned: true;
}

/**
 * Build CodebergWorld from base GitWorld; inherits Gitea substrate via
 * intermediate buildGiteaWorld.
 */
export function buildCodebergWorld(gitWorld: GitWorld, resourceBudget?: GiteaResourceBudget): CodebergWorld {
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
  restLimit: 500, // conservative; tighter than commercial Gitea instances
  restResetAt: 0, // caller updates to actual reset timestamp
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
