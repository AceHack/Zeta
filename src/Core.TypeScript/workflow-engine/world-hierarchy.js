// World hierarchy — substrate-naming substrate (per the human maintainer,
// 2026-05-28).
//
// Per the human maintainer (2026-05-28): "Git inherits from restricted
// clifford, or maybe it's fully isomorphic but it's basically DBSP and so
// we have DBSP and Clifford worlds with one be connonical [sic — operator's
// verbatim spelling preserved; reads "canonical"] i'm voting for clifford
// once we have it"
//
// Inheritance hierarchy (operator-vote: Clifford canonical once shipped):
//
//   CliffordWorld (canonical; geometric-algebra substrate; operator-voted)
//      ↓ restricted to incremental-dataflow + retraction substrate
//   DBSPWorld (Budiu et al VLDB 2023; differential-dataflow + stream substrate)
//      ↓ restricted to tree-state + commit-graph + ref substrate
//   GitWorld (operational substrate; src/Core.TypeScript/workflow-engine/git-world.ts)
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
// src/Core.TypeScript/workflow-engine/git-world.ts).
export const OPEN_QUESTION_DBSP_CLIFFORD = {
    kind: "open-question",
    preservedReadings: [
        "(A) Git ⊂ DBSP ⊂ Clifford strict-subset chain; each restricts upward substrate",
        "(B) DBSP ↔ Clifford fully isomorphic; both algebraic substrates supporting increments + retractions; Git ⊂ both equivalently",
    ],
    // the human maintainer (2026-05-28): "1 first 2 2nd would be great" — (A) primary, (B) secondary fallback.
    //
    // SUBSTRATE-ENGINEERING UPDATE (the human maintainer (2026-05-28), same session, post-vote):
    // "What i think we might have found a paper or something about retraction in
    // clifford so the isomorphic might be easy"
    //
    // If a retraction-in-Clifford paper exists + maps to DBSP's Z-set retraction
    // substrate, the (B) fully-isomorphic reading becomes constructive and the
    // vote ordering may flip. Preserved as substrate-engineering input without
    // collapsing — paper-existence verification + reading is B-0915 substrate-
    // engineering work. See B-0915 Slice D acceptance criterion.
    voteOrdering: [0, 1],
};
/**
 * Helper to extract the operator's primary working hypothesis from the
 * open question. Returns the highest-vote reading (voteOrdering[0]) or
 * the first preservedReading if no vote ordering present.
 */
export function primaryWorkingHypothesis(rel) {
    if (rel.kind !== "open-question")
        return null;
    const idx = rel.voteOrdering?.[0] ?? 0;
    return rel.preservedReadings[idx] ?? null;
}
/**
 * Parent algebra for any substrate (substrate-engineering inheritance chain).
 * Returns null at the root (Clifford).
 */
export function parentOf(algebra) {
    switch (algebra) {
        case "clifford":
            return null;
        case "dbsp":
            return "clifford";
        case "git":
            return "dbsp";
        case "git-forge":
            return "git";
    }
}
/**
 * Depth for any substrate-algebra (compile-time-stable mapping).
 */
export function depthOf(algebra) {
    switch (algebra) {
        case "clifford":
            return 0;
        case "dbsp":
            return 1;
        case "git":
            return 2;
        case "git-forge":
            return 3;
    }
}
/**
 * Check whether `candidate` is a descendant of (or equal to) `ancestor`.
 * GitHubWorld (git-forge) IS-A GitWorld (git) IS-A DBSPWorld (dbsp) IS-A
 * CliffordWorld (clifford). The IS-A relation is reflexive (anything is a
 * descendant of itself).
 */
export function inheritsFrom(candidate, ancestor) {
    let cur = candidate;
    while (cur !== null) {
        if (cur === ancestor)
            return true;
        cur = parentOf(cur);
    }
    return false;
}
/**
 * Verify a HierarchicalWorld's substrate-engineering metadata is internally
 * consistent (algebra matches depth + parent matches expected chain).
 */
export function verifyHierarchy(world) {
    const expectedDepth = depthOf(world.substrateAlgebra);
    if (world.hierarchyDepth !== expectedDepth) {
        return { ok: false, feedback: { kind: "DepthMismatch", expected: expectedDepth, actual: world.hierarchyDepth } };
    }
    const expectedParent = parentOf(world.substrateAlgebra);
    if (world.parentAlgebra !== expectedParent) {
        return {
            ok: false,
            feedback: { kind: "MissingIntermediateLayer", expectedParent, actualParent: world.parentAlgebra },
        };
    }
    return { ok: true, value: world };
}
/**
 * Annotate any World with hierarchy substrate. Use at construction time
 * for GitWorld / GitHubWorld / future DBSPWorld + CliffordWorld substrates.
 */
export function annotateHierarchy(world, algebra) {
    return {
        ...world,
        substrateAlgebra: algebra,
        hierarchyDepth: depthOf(algebra),
        parentAlgebra: parentOf(algebra),
    };
}
