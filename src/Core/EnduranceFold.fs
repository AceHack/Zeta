namespace Zeta.Core

/// **`EnduranceFold` — `SymmetricEndurance` read through the two-timescale fold.**
///
/// This is `TwoTimescaleFold`'s first live caller, and the wiring is a **correspondence** rather than
/// a repair, because the live module already had the right shape.
///
/// ## What the correspondence establishes
///
/// `SymmetricEndurance.Frame` holds `Judges : Set<int * int>` — perspective-relative
/// `(observer, observed)` pairs. Being a **Set** rather than a count means judgment accumulation is
/// **idempotent by construction**: casting the same judgment twice is a no-op, and `netRate` is a
/// function of the set rather than of the delivery sequence.
///
/// That is exactly the shared-layer property `TwoTimescaleFold` was built to supply, and
/// `SymmetricEndurance` arrived at it independently — where `BeliefConvergence.observe` (pointwise
/// multiplication, a commutative monoid that is *not* idempotent) did not. Two independent
/// constructions agreeing is the strongest evidence available that the abstraction is real rather
/// than imposed, so the correspondence is worth recording in code and not just in prose.
///
/// **The consequence is a property about live code that was not previously stated or tested:
/// `SymmetricEndurance` is delay-free.** Judgments may arrive reordered, batched, or redelivered over
/// a store-and-forward transport and every frame reaches the same `netRate`, because the natural key
/// `(observer, observed)` dedups them. That is discipline #6 satisfied by construction.
///
/// ## What this module deliberately does NOT do
///
/// It changes no `SymmetricEndurance` behaviour. It is a projection into the shared layer plus the
/// laws that projection must satisfy; the endurance semantics stay where they are. A bridge that
/// silently altered the thing it was bridging would be worse than no bridge.
///
/// See `docs/research/2026-08-10-delay-is-the-decoupling-operator-*` §2 for why idempotence (not
/// commutativity) is the property that makes delay free, and the one-line theorem — an idempotent
/// group is trivial — that forces the join and the retraction log to be two structures.
[<RequireQualifiedAccess>]
module EnduranceFold =

    open System

    /// The **natural dedup key** for a judgment: the perspective-relative pair itself.
    ///
    /// Note what is NOT in it — no wall-clock, no receive-order, no per-node sequence. Two nodes that
    /// receive the same judgment key it identically, which is what keeps the shared merge idempotent
    /// across replicas (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
    let judgmentKey (observer: int) (observed: int) : string =
        String.Format(Globalization.CultureInfo.InvariantCulture, "judge:{0}->{1}", observer, observed)

    /// One judgment as shared-layer evidence. The likelihood is the **retraction** the judgment casts:
    /// a `-1` against the observed party, expressed positionally over `dim` parties.
    ///
    /// This is the projection, not a new judgment — `SymmetricEndurance` decides *whether* a judgment
    /// exists; this only says how an existing one crosses into the shared fold.
    let judgmentEvidence (dim: int) (observer: int) (observed: int) : TwoTimescaleFold.SharedEvidence =
        let weights = Array.create dim 1L

        if observed >= 0 && observed < dim then
            weights.[observed] <- 0L // this observer withholds endurance from the observed party

        { Id = judgmentKey observer observed
          Likelihood = weights }

    /// Project a whole frame's judgment set into shared evidence.
    ///
    /// `Set` iteration is ordered by F#'s structural comparison, so this is deterministic (DST §7) —
    /// but nothing downstream may depend on that order, and the tests assert it does not.
    let projectFrame (dim: int) (frame: SymmetricEndurance.Frame) : TwoTimescaleFold.SharedEvidence list =
        frame.Judges
        |> Set.toList
        |> List.map (fun (observer, observed) -> judgmentEvidence dim observer observed)

    /// Fold a frame's judgments through the shared layer.
    ///
    /// **The load-bearing claim:** the resulting `Applied` key set is in bijection with `frame.Judges`,
    /// so the fold's join-semilattice *is* the frame's judgment set under another name. Pinned in
    /// `EnduranceFold.Tests.fs`.
    let sharedOf (dim: int) (frame: SymmetricEndurance.Frame) : TwoTimescaleFold.SharedBelief =
        TwoTimescaleFold.applyAll (projectFrame dim frame) (TwoTimescaleFold.emptyShared dim)

    /// Merge two frames' judgments — set union, which is the join.
    ///
    /// Two observers who saw different subsets of the world reconcile to the union of what they saw,
    /// with no dependence on who spoke first and no double-counting of what both saw. `Parties` is
    /// taken from `a`; merging frames over different party sets is out of scope and callers should not
    /// assume it is meaningful.
    let mergeFrames (a: SymmetricEndurance.Frame) (b: SymmetricEndurance.Frame) : SymmetricEndurance.Frame =
        { a with Judges = Set.union a.Judges b.Judges }

    /// A judgment as a **group** element — the retraction half of the forced pair.
    ///
    /// The join above cannot un-cast a judgment (`a + a = a ⇒ a = e` forbids inverses in an idempotent
    /// structure), so retraction lives here instead: a signed delta that `TwoTimescaleFold.invert`
    /// undoes exactly. This is the Z-set `-1` that `SymmetricEndurance`'s own docstring describes,
    /// given a structure that can actually take it back.
    let judgmentDelta (dim: int) (observer: int) (observed: int) : TwoTimescaleFold.Delta =
        let change = Array.zeroCreate<int64> dim

        if observed >= 0 && observed < dim then
            change.[observed] <- -1L

        { Of = judgmentKey observer observed
          Change = change }
