namespace Zeta.Core

/// **Reconcile — the relative-observer reconciliation: a 3-way merge of two diverged beliefs over their
/// Merkle shared-ancestor (LCA). The last open rung of 081KTAH8Q0008QG0R001YHSSA0 and the engine arc (Aaron, 2026-06-05).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge.)
///
/// When one traveler bifurcates into two (the banana split), the forks share a common ancestor — found
/// as the Merkle lowest-common-ancestor via the parent-hash links (the proven `Merkle` floor). Each fork
/// then diverges by observing its own (non-coercive) evidence. **Reconciliation** merges the two forks
/// back into one frame:
///
///   reconciled(i) = a(i)·b(i) / ancestor(i) = ancestor(i) · deltaA(i) · deltaB(i)
///
/// where `deltaX = branchX / ancestor` is the evidence that took the ancestor to that branch. Because
/// pointwise multiplication commutes (the proven NCI boundary — `BeliefConvergence` /
/// `ProbabilitySemiring`), the merge is **commutative and order-independent**: all relative observers
/// reach ONE common frame regardless of the order they reconcile in, and neither fork's delta coerces /
/// overrides the other (both contribute symmetrically — NCI-respecting). Requires positive ancestor
/// weights (a proper prior with full support).
[<RequireQualifiedAccess>]
module Reconcile =

    module PS = ProbabilitySemiring

    /// The evidence-delta that took the ancestor to a branch: `deltaX(i) = branch(i) / ancestor(i)`.
    let delta (ancestor: PS.Rational[]) (branch: PS.Rational[]) : PS.Rational[] =
        Array.init ancestor.Length (fun i -> PS.div branch.[i] ancestor.[i])

    /// 3-way merge of two diverged beliefs `a`, `b` over their common ancestor (the Merkle LCA).
    /// Commutative + order-independent (the NCI boundary). Requires positive ancestor weights.
    let merge3 (ancestor: PS.Rational[]) (a: PS.Rational[]) (b: PS.Rational[]) : PS.Rational[] =
        Array.init ancestor.Length (fun i -> PS.div (PS.mul a.[i] b.[i]) ancestor.[i])

    /// Reconcile many diverged branches over one ancestor (fold `merge3` from the ancestor). The result
    /// is `ancestor · Π deltas`, independent of the order branches are merged (all relative observers
    /// reach one common frame). `reconcileAll ancestor [] = ancestor`.
    let reconcileAll (ancestor: PS.Rational[]) (branches: PS.Rational[] list) : PS.Rational[] =
        List.fold (fun acc br -> merge3 ancestor acc br) ancestor branches
