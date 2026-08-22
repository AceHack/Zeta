namespace Zeta.Core

/// **`QuorumAlgebra` — two operations, named apart, because they are two algebras (Aaron 2026-08-14).**
///
/// > *"we can support join and interference both operations and name them differently, more rx
/// > operations are fine."*
///
/// `AmplitudeEmu.merge` **sums**. A sum is not a join, and nothing said so — so a single name was
/// carrying two incompatible algebras and the caller could not tell which one they had invoked. This
/// module is that split, and **no arithmetic changes**: `interfere` computes exactly what `merge`
/// always computed. What changes is that the *other* operation now exists and has its own name.
///
/// **`join`** — idempotent, commutative, associative, unit `empty`: a bounded join-semilattice over a
/// source-keyed set. Meaning: *independent evidence*, so the same source twice counts once.
///
/// **`interfere`** — a commutative monoid with inverses over the free C-module `C[F]`, and
/// **NOT idempotent** (`interfere a a = 2a`). Meaning: *distinct paths to one outcome*, so
/// opposite-phase contributions annihilate.
///
/// **The two compose in one direction, and that direction is the design.** A quorum `join`s first —
/// deduplicating by source, which is the only thing that stops six agents on one data stream folding to
/// six times the confidence (bug B3, `precision = 66.0` on a mean wrong by 5.66) — and then `interfere`s
/// the *distinct* sources' amplitudes, which is the only operation in which a quorum can disagree with
/// itself to zero. Join is where evidence is counted; interference is where it is *combined*, and
/// `AmplitudeEmu.bornProb` is the one-way exit to probabilities. Three named layers, two named boundaries.
///
/// **Rx is the right vocabulary here and it is native** (Meijer's `IEnumerable` / `IObservable` duality
/// is already a root anchor in this repo). Rx does not have one `combine`; it has `merge`, `concat`,
/// `zip`, `combineLatest`, `amb`, `scan` — *because "combine two streams" is not one operation*.
/// Compress to the smallest number of **meanings**, not the smallest API.
///
/// ## Honest scope (peel)
///
///   - **`join` is exact; `interfere` is not.** The join key is an **ordinal** string (F# structural
///     comparison on `string` is `String.CompareOrdinal`), so the join byte-locks and DST-replays. The
///     interference sum is IEEE-754 with `AmplitudeEmu`'s `EPS = 1e-12` drop, and that drop breaks
///     associativity **structurally** (measured: two groupings differ by `1.6e-6`, one measuring `None`
///     and the other `Some`) and breaks scale-covariance (`support(a) = 2` but `support(0.5*a) = 1`).
///     So **the interference half cannot be byte-locked today.** The exit is a cyclotomic carrier
///     `Z[zeta_N]`; see the research doc for the scoping and the cost.
///   - **`join`'s conflict detection needs an exact equality it does not have.** Two float vectors
///     denoting the same state can compare unequal, so a source can be reported `Conflicted` for a
///     rounding difference. `canonical` removes the *representational* variation (key order, duplicate
///     keys); it cannot remove the float one. This is the second, independent reason the exact carrier
///     matters — not merely byte-lock.
///   - **Conflicts are reported, never resolved** (`universal/evidence` membership rule 4): a source
///     arriving with two different vectors is *named and excluded*, because picking a winner is an
///     arbitrary choice wearing a merge.
///   - **`interferenceExcess` is a measurement, not a verdict.** It reports the neutral fact — the
///     coherent total minus the incoherent one — and leaves *honest disagreement / adversarial phase
///     injection / miscalibrated agent* to caller policy (`dual-use-detection-is-neutral-oracle-decides`).
///
/// Pointers: `universal/interference.md` (this shape) · `universal/evidence.md` (the join family it is
/// explicitly outside of) · `src/Core.TLA/specs/QuorumPhaseCancellation.tla` (Soraya's reachability
/// model, restricted to 4th roots of unity for exactness — the same move as the cyclotomic exit) ·
/// `docs/research/2026-08-13-what-does-253ms-mean-without-a-wall-clock-and-where-amplitudes-live.md`
/// Parts 2-3 (where Aaron placed the Born boundary, and why cancellation is the instrument).
[<RequireQualifiedAccess>]
module QuorumAlgebra =

    /// One member's contribution: a finite formal C-combination of outcomes. Same shape as
    /// `AmplitudeEmu.Amp`, generic in the outcome key.
    type Contribution<'F> = ('F * Complex) list

    // -- the INTERFERENCE half: free C-module, sum, NOT idempotent ------------------------------

    /// **Interference — the SUM.** Exactly `AmplitudeEmu.merge` on the concatenation: identical paths
    /// reinforce, opposite-phase paths annihilate. **Not idempotent by design** (`interfere a a = 2a`),
    /// so this is deliberately *not* an evidence join; use `join` when the question is "how many
    /// independent sources said this".
    ///
    /// Commutativity and associativity hold **on the abstract carrier** `C[F]` and fail **in this
    /// implementation** — the `EPS` drop deletes any branch summing below `|z| = 1e-6`, which makes the
    /// grouping observable. Fold through a `Quorum` (see `interfereQuorum`) when the summation order
    /// must be the same on every node.
    let interfere (a: Contribution<'F>) (b: Contribution<'F>) : Contribution<'F> =
        AmplitudeEmu.mergeOf (a @ b)

    /// n-ary interference. The identity is `[]` (the empty superposition), so this is the monoid fold.
    let interfereAll (xs: Contribution<'F> list) : Contribution<'F> =
        xs |> List.concat |> AmplitudeEmu.mergeOf

    // -- the JOIN half: source-keyed, idempotent, a bounded join-semilattice --------------------

    /// Canonical form of a contribution: one entry per outcome, ordered by the outcome key. This is the
    /// form a byte-lock would hash, and the form `join` compares on. It removes *representational*
    /// variation only — float rounding survives it (see the module peel).
    let canonical (a: Contribution<'F>) : Contribution<'F> when 'F: comparison =
        AmplitudeEmu.mergeOf a |> List.sortBy fst

    /// source id, mapped to that source's canonical contribution.
    type ContributionMap<'F> = Map<string, Contribution<'F> >


    /// **A quorum in the JOIN family**: at most one contribution per source, plus the set of sources
    /// that arrived with conflicting contributions (the absorbing top of the flat lattice - reported,
    /// never resolved). The map key is an ordinal string, so the whole structure is culture-invariant
    /// and order-independent.
    type Quorum<'F when 'F: comparison> =
        { /// source id, mapped to its canonical contribution; never holds a `Conflicted` source.
          Contributions: ContributionMap<'F>
          /// sources that said two different things: named and excluded (`universal/evidence` rule 4).
          Conflicted: Set<string> }

    /// The unit of `join` - the empty quorum.
    let empty<'F when 'F: comparison> : Quorum<'F> =
        { Contributions = Map.empty; Conflicted = Set.empty }

    /// One source's contribution as a quorum.
    let single (source: string) (a: Contribution<'F>) : Quorum<'F> =
        { Contributions = Map.ofList [ source, canonical a ]; Conflicted = Set.empty }

    /// **Join - the idempotent, commutative, associative union.** The same source contributing twice
    /// counts **once** (`join q q = q`), which is precisely what interference cannot do and precisely
    /// what evidence requires. A source present on both sides with *different* contributions is moved
    /// to `Conflicted` and dropped from `Contributions`; conflict is absorbing, so it survives every
    /// later join. Bounded join-semilattice: the pointwise join of a flat lattice over an ordinal map.
    let join (a: Quorum<'F>) (b: Quorum<'F>) : Quorum<'F> =
        let disagreeing =
            a.Contributions
            |> Map.toSeq
            |> Seq.choose (fun (k, va) ->
                match Map.tryFind k b.Contributions with
                | Some vb when vb <> va -> Some k
                | _ -> None)
            |> Set.ofSeq

        let conflicted = Set.unionMany [ a.Conflicted; b.Conflicted; disagreeing ]

        let merged =
            Map.fold (fun acc k v -> Map.add k v acc) a.Contributions b.Contributions
            |> Map.filter (fun k _ -> not (Set.contains k conflicted))

        { Contributions = merged; Conflicted = conflicted }

    /// n-ary join. `empty` is the unit, so this is the semilattice fold.
    let joinAll (qs: Quorum<'F> list) : Quorum<'F> = qs |> List.fold join empty

    /// The sources whose contribution is being counted (excludes `Conflicted`).
    let sources (q: Quorum<'F>) : string list = q.Contributions |> Map.toList |> List.map fst

    // -- the boundary between them -------------------------------------------------------------

    /// **The join-to-interference crossing, named.** Sum the *distinct* sources' contributions. This is
    /// where the algebra changes and where a quorum becomes able to cancel - the counterpart of
    /// `AmplitudeEmu.bornProb`, which is the crossing out of amplitudes into probabilities.
    ///
    /// The summation order is the ordinal order of the source keys, so **every node folds in the same
    /// order** and the float non-associativity of the raw `interfere` cannot make two nodes disagree.
    /// (That does not make the arithmetic exact - it makes it *reproducible*.)
    let interfereQuorum (q: Quorum<'F>) : Contribution<'F> =
        q.Contributions |> Map.toList |> List.collect snd |> AmplitudeEmu.mergeOf

    /// **The neutral fact a cancelling quorum reports** (open item 3 of the 253 ms research doc).
    /// `Excess = Coherent - Incoherent`: **negative means destructive interference occurred, at that
    /// magnitude**; positive means constructive; zero means the contributions did not interfere. The
    /// *reading* - honest disagreement, adversarial phase injection, a miscalibrated member - is caller
    /// policy, never this type's business (`dual-use-detection-is-neutral-oracle-decides`).
    type InterferenceReading =
        { /// Sum over sources of sum over outcomes of |z|^2 - the incoherent total, what a
          /// precision-summing Bayesian fold would see. Evidence can only add, so this only grows.
          Incoherent: float
          /// Sum over outcomes of |sum over sources of z|^2 - the coherent total, after phases spoke.
          Coherent: float
          /// `Coherent - Incoherent`. Negative = destructive, positive = constructive, 0 = none.
          Excess: float
          /// Distinct sources counted (post-join, so redundancy is already removed).
          SourceCount: int
          /// Sources named and excluded for contributing two different things.
          ConflictedCount: int }

    /// Measure the interference in a quorum without collapsing it. Pure measurement, no verdict.
    let interferenceExcess (q: Quorum<'F>) : InterferenceReading =
        let magSq (z: Complex) = z.Real * z.Real + z.Imag * z.Imag
        let incoherent =
            q.Contributions
            |> Map.toList
            |> List.sumBy (fun (_, v) -> v |> List.sumBy (fun (_, z) -> magSq z))
        let coherent = interfereQuorum q |> List.sumBy (fun (_, z) -> magSq z)
        { Incoherent = incoherent
          Coherent = coherent
          Excess = coherent - incoherent
          SourceCount = q.Contributions.Count
          ConflictedCount = q.Conflicted.Count }
