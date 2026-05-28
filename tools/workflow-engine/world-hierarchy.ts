// World hierarchy — substrate-naming substrate (per the human maintainer,
// 2026-05-28).
//
// Per the human maintainer (2026-05-28): "Git inherits from restricted
// clifford, or maybe it's fully isomorphic but it's basically DBSP and so
// we have DBSP and Clifford worlds with one be connonical i'm voting for
// clifford once we have it"
//
// Inheritance hierarchy (operator-vote: Clifford canonical once shipped):
//
//   CliffordWorld (canonical; geometric-algebra substrate; operator-voted)
//      ↓ restricted to incremental-dataflow + retraction substrate
//   DBSPWorld (Budiu et al VLDB 2023; differential-dataflow + stream substrate)
//      ↓ restricted to tree-state + commit-graph + ref substrate
//   GitWorld (operational substrate; tools/workflow-engine/git-world.ts)
//      ↓ specialized by forge
//   GitHubWorld / GitLabWorld / GiteaWorld / BitbucketWorld / ...
//
// Substrate-engineering open question flagged by the human maintainer
// (preserve per default-to-both):
//   (A) Git ⊂ DBSP ⊂ Clifford (strict subset chain; each restricts upward substrate)
//   (B) DBSP ↔ Clifford fully isomorphic (both algebraic substrates supporting
//       increments + retractions); Git ⊂ both equivalently
//
// Both readings hold until the algebraic-substrate work resolves it.
// Composes with B-0635 wave-particle duality + B-0666 English-as-projection
// + multiple Kestrel ferries naming Clifford as canonical substrate-engineering
// substrate.
//
// This file ships the NAMING substrate. CliffordWorld + DBSPWorld
// implementations are substrate-engineering substrate-engineering targets
// (B-NNNN follow-up rows). GitWorld + GitHubWorld already shipped (see
// tools/workflow-engine/git-world.ts).

import type { World } from "./world.js";

// ───────────────────────────────────────────────────────────────────────
// Substrate-naming substrate — inheritance hierarchy markers
// ───────────────────────────────────────────────────────────────────────

/**
 * Substrate-algebra identifier — names which algebraic substrate a World
 * inherits from. Worlds at any level of the hierarchy carry this marker
 * so downstream substrate can verify composition compatibility.
 *
 * The vote per the human maintainer (2026-05-28): "clifford" canonical
 * once shipped.
 */
export type SubstrateAlgebra =
  | "clifford"       // Canonical (operator-vote; once shipped)
  | "dbsp"           // Restricted-or-isomorphic to Clifford (open question)
  | "git"            // Restricted to tree/commit/ref substrate
  | "git-forge";     // Forge-specialization (GitHub/GitLab/etc.)

/**
 * Hierarchy depth — substrate-engineering substrate marker for which
 * abstraction layer a World substrate operates at.
 *
 * 0 = Clifford (most general; canonical-vote)
 * 1 = DBSP (restricted-or-isomorphic to Clifford)
 * 2 = Git (restricted to tree/commit/ref)
 * 3 = Forge-specialization (GitHub/GitLab/etc.)
 */
export type HierarchyDepth = 0 | 1 | 2 | 3;

/**
 * Substrate-naming substrate that any World carrying this marker advertises
 * its position in the Clifford → DBSP → Git → GitHubWorld hierarchy.
 *
 * Downstream substrate uses this to:
 *   - Verify composition compatibility (compose only with equal-or-more-general substrate)
 *   - Route operations to the most-restricted substrate that can handle them
 *   - Detect when substrate-engineering substrate is missing an intermediate layer
 */
export interface HierarchicalWorld extends World {
  readonly substrateAlgebra: SubstrateAlgebra;
  readonly hierarchyDepth: HierarchyDepth;
  /**
   * If this world is a specialization, names the parent substrate-algebra.
   * GitHubWorld.parentAlgebra = "git"; GitWorld.parentAlgebra = "dbsp";
   * DBSPWorld.parentAlgebra = "clifford"; CliffordWorld.parentAlgebra = null.
   */
  readonly parentAlgebra: SubstrateAlgebra | null;
}

/**
 * The open substrate-engineering question the human maintainer flagged
 * (2026-05-28): is DBSP a strict restriction of Clifford, or are they
 * fully isomorphic?
 *
 * Preserved as substrate (not collapsed) until the algebraic work resolves
 * it. Per default-to-both: both readings hold; the resolution will be
 * substrate-engineering output of the canonical-algebra implementation work.
 */
export type DBSPCliffordRelationship =
  | { kind: "strict-restriction"; rationale: string }
  | { kind: "fully-isomorphic"; rationale: string }
  | { kind: "open-question"; preservedReadings: ReadonlyArray<string> };

export const OPEN_QUESTION_DBSP_CLIFFORD: DBSPCliffordRelationship = {
  kind: "open-question",
  preservedReadings: [
    "(A) Git ⊂ DBSP ⊂ Clifford strict-subset chain; each restricts upward substrate",
    "(B) DBSP ↔ Clifford fully isomorphic; both algebraic substrates supporting increments + retractions; Git ⊂ both equivalently",
  ],
};

// ───────────────────────────────────────────────────────────────────────
// Inheritance verification — substrate-engineering composition guard
// ───────────────────────────────────────────────────────────────────────

/**
 * Substrate-engineering feedback (asymmetric-authorship per
 * .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md).
 */
/**
 * Hierarchy-validation feedback per asymmetric-authorship + monad-propagation.
 *
 * `MissingIntermediateLayer.expectedParent` is `SubstrateAlgebra | null`
 * — `null` means "this substrate is at the root of the hierarchy and
 * MUST have null parentAlgebra" (a malformed CliffordWorld carrying a
 * non-null parentAlgebra produces this feedback with `expectedParent: null`).
 * Coalescing `null` to a sentinel like `"clifford"` would mis-represent
 * the actual expectation (root-has-no-parent) as "root parents itself."
 */
export type HierarchyFeedback =
  | { kind: "IncompatibleSubstrate"; required: SubstrateAlgebra; actual: SubstrateAlgebra }
  | { kind: "MissingIntermediateLayer"; expectedParent: SubstrateAlgebra | null; actualParent: SubstrateAlgebra | null }
  | { kind: "DepthMismatch"; expected: HierarchyDepth; actual: HierarchyDepth };

export type HierarchyResult<T> =
  | { ok: true; value: T }
  | { ok: false; feedback: HierarchyFeedback };

/**
 * Parent algebra for any substrate (substrate-engineering inheritance chain).
 * Returns null at the root (Clifford).
 */
export function parentOf(algebra: SubstrateAlgebra): SubstrateAlgebra | null {
  switch (algebra) {
    case "clifford": return null;
    case "dbsp": return "clifford";
    case "git": return "dbsp";
    case "git-forge": return "git";
  }
}

/**
 * Depth for any substrate-algebra (compile-time-stable mapping).
 */
export function depthOf(algebra: SubstrateAlgebra): HierarchyDepth {
  switch (algebra) {
    case "clifford": return 0;
    case "dbsp": return 1;
    case "git": return 2;
    case "git-forge": return 3;
  }
}

/**
 * Check whether `candidate` is a descendant of (or equal to) `ancestor`.
 * GitHubWorld (git-forge) IS-A GitWorld (git) IS-A DBSPWorld (dbsp) IS-A
 * CliffordWorld (clifford). The IS-A relation is reflexive (anything is a
 * descendant of itself).
 */
export function inheritsFrom(candidate: SubstrateAlgebra, ancestor: SubstrateAlgebra): boolean {
  let cur: SubstrateAlgebra | null = candidate;
  while (cur !== null) {
    if (cur === ancestor) return true;
    cur = parentOf(cur);
  }
  return false;
}

/**
 * Verify a HierarchicalWorld's substrate-engineering metadata is internally
 * consistent (algebra matches depth + parent matches expected chain).
 */
export function verifyHierarchy(world: HierarchicalWorld): HierarchyResult<HierarchicalWorld> {
  const expectedDepth = depthOf(world.substrateAlgebra);
  if (world.hierarchyDepth !== expectedDepth) {
    return { ok: false, feedback: { kind: "DepthMismatch", expected: expectedDepth, actual: world.hierarchyDepth } };
  }
  const expectedParent = parentOf(world.substrateAlgebra);
  if (world.parentAlgebra !== expectedParent) {
    return { ok: false, feedback: { kind: "MissingIntermediateLayer", expectedParent, actualParent: world.parentAlgebra } };
  }
  return { ok: true, value: world };
}

/**
 * Annotate any World with hierarchy substrate. Use at construction time
 * for GitWorld / GitHubWorld / future DBSPWorld + CliffordWorld substrates.
 */
export function annotateHierarchy<W extends World>(world: W, algebra: SubstrateAlgebra): W & HierarchicalWorld {
  return {
    ...world,
    substrateAlgebra: algebra,
    hierarchyDepth: depthOf(algebra),
    parentAlgebra: parentOf(algebra),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Future substrate-engineering targets (placeholders preserving naming)
// ───────────────────────────────────────────────────────────────────────

/**
 * CliffordWorld — canonical substrate per the human maintainer
 * (2026-05-28) vote.
 *
 * NOT YET IMPLEMENTED. Substrate-engineering substrate-engineering target.
 * Composes with B-0635 wave-particle duality (Clifford multivector substrate)
 * + B-0666 English-as-projection + multiple Kestrel ferry preservations.
 *
 * When shipped: geometric-algebra substrate (multivector + grade-projection
 * + geometric-product) IS the canonical world substrate; DBSPWorld is a
 * restriction-or-isomorphic-view; GitWorld is a deeper restriction.
 *
 * Marker interface only — actual substrate-engineering follow-up row.
 */
export interface CliffordWorldPlaceholder extends HierarchicalWorld {
  readonly substrateAlgebra: "clifford";
  readonly hierarchyDepth: 0;
  readonly parentAlgebra: null;
}

/**
 * DBSPWorld — Database Stream Processing substrate (Budiu et al VLDB 2023;
 * canonical README expansion). Restriction-or-isomorphic-view of
 * CliffordWorld (open question per OPEN_QUESTION_DBSP_CLIFFORD).
 *
 * NOT YET IMPLEMENTED. Substrate-engineering substrate-engineering target.
 * Composes with framework's incremental-view-maintenance + retraction-native
 * substrate (Result<T, TFeedback> + monad-propagation pattern).
 *
 * When shipped: differential-dataflow substrate (Z-set + circuit + delta-
 * incremental computation) IS the formal substrate; GitWorld is a deeper
 * restriction (tree-state + commit-graph + ref operations).
 *
 * Marker interface only — actual substrate-engineering follow-up row.
 */
export interface DBSPWorldPlaceholder extends HierarchicalWorld {
  readonly substrateAlgebra: "dbsp";
  readonly hierarchyDepth: 1;
  readonly parentAlgebra: "clifford";
}
