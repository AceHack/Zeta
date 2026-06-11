namespace Zeta.Core

// ============================================================================
// RecursiveSigned — gap-monotone signed-delta semi-naïve LFP — SHIPPED
// ============================================================================
//
// GRADUATED 2026-06-13. The round-35 skeleton's gate was: land the real TLA+
// step relation, TLC-check S1-S3, then promote. Done, in order:
//
//   1. tools/tla/specs/RecursiveSignedSemiNaive.tla carries the REAL Step
//      (successor-chain body satisfying P1-P3); TLC verified Safety (S1
//      termination, S2 fixpoint total = seed + body(total), S3/S3'
//      gap-monotone + single-signed) at ALL FOUR seed weights (+1, -1, +2, -2).
//   2. The combinator shipped as `Circuit.RecursiveSignedDelta` in
//      src/Core/Recursive.fs (the planned home) — the feedback cell carries
//      the SIGNED DELTA, never the total; seed deltas join at their own tick.
//   3. Graduation tests (RecursiveCounting.MultiSeed.Tests.fs §SIGNED-DELTA):
//      one-shot LFP exact; MULTI-TICK seed correct (the case that REFUTED
//      RecursiveCounting — fixed by construction); retraction converges to
//      zero everywhere (dip-and-recover, no tombstones).
//
// This file remains as the pinned pointer (not in Core.fsproj). Preconditions
// P1-P3 and the Distinct-at-the-boundary discipline are documented on the
// shipped member. Design: docs/research/retraction-safe-semi-naive.md §7.
// ============================================================================

module RecursiveSignedShipped =
    /// See `Circuit.RecursiveSignedDelta` (src/Core/Recursive.fs).
    let shippedAt = "src/Core/Recursive.fs — Circuit.RecursiveSignedDelta (2026-06-13)"
