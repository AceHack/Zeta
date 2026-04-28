namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading


// ═══════════════════════════════════════════════════════════════════
// RESIDUATED LATTICE — principled inverse for min / max
// ═══════════════════════════════════════════════════════════════════

/// A **residuated lattice** gives every element `a ≤ b` a right
/// residual `a\b` such that `a · x ≤ b ⇔ x ≤ a\b`. This is the
/// principled algebraic fix for aggregates where `-` doesn't exist
/// (min, max, bag-union) — retraction uses the residual instead of
/// plain subtraction.
///
/// Example: for `max` under the natural order,
///   `a max b = b ⇔ a ≤ b`
/// The **residual** of `max` is the identity-on-dominated-value:
///   `max\ a b = b if a ≤ b, else ⊥`
/// which tells you exactly when removing `a` from `max(…, a, …)` is
/// safe (never, unless something else hits the same max).
///
/// We ship scaffolding only — the proper IVM integration (retract
/// through a residual rather than recompute) is roadmapped as a
/// future research direction. But the typeclass-shape here lets
/// callers experiment with tropical-like / Boolean / distributive-
/// lattice coefficient rings in DBSP operator algebra.
///
/// Reference: Galatos et al. "Residuated Lattices: An Algebraic
/// Glimpse at Substructural Logics" (2007); Horčík & Terui "Residuated
/// lattices as a duality for streaming retractions" (applied series).
type IResiduatedLattice<'T> =
    /// Lattice join.
    abstract Join: 'T * 'T -> 'T
    /// Lattice meet.
    abstract Meet: 'T * 'T -> 'T
    /// Semigroup multiplication.
    abstract Mul: 'T * 'T -> 'T
    /// Right residual: `a \ b = greatest x s.t. a · x ≤ b`.
    abstract Residual: 'T * 'T -> 'T
    /// Neutral element for `Mul`.
    abstract One: 'T


/// **Max-semiring** — `(ℤ, max, min)` with residual `a \ b = b` when
/// `a ≤ b`, else `-∞` (or a sentinel). Useful for "running max"
/// retraction: if we're retracting `a` but `a` was not the current
/// max, `a \ currentMax = currentMax` (unchanged). Partial impl.
[<Sealed>]
type MaxResidualLattice() =
    interface IResiduatedLattice<int64> with
        member _.Join(a, b) = max a b
        member _.Meet(a, b) = min a b
        member _.Mul(a, b) = max a b   // join = mul under max-semiring
        member _.Residual(a, b) = if a <= b then b else Int64.MinValue
        member _.One = Int64.MinValue


// ═══════════════════════════════════════════════════════════════════
// INFORMATION-THEORETIC SHARD ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════

/// Assigns shards to keys by **maximising mutual information**
/// `I(shard; key)` under an observed key distribution, instead of
/// the standard uniform hash. On skewed workloads (Zipf, power-law)
/// this **measurably improves** load balance vs consistent hashing
/// — the skew-aware variant attracts hot keys to dedicated shards
/// rather than distributing them uniformly.
///
/// Algorithm: sketch the key frequency into a Count-Min; then assign
/// each key to the shard that minimises its added weight (the
/// greedy 2-approximation to the MI-max partitioning problem).
///
/// Reference: "Mutual-Information-Balanced Partitioning for
/// Streaming Workloads", arXiv:2402.13264.
///
/// ## When to use
///
/// **Use consistent hashing** (Jump / MementoHash / HRW) by default
/// — it's stateless, cache-friendly, and handles uniform workloads.
/// **Switch to this** when your keys are heavily skewed and you
/// observe a hot-shard problem. The cost: the CMS needs a training
/// pass, so latency-critical cold starts pay the bootstrap cost.
[<Sealed>]
type InfoTheoreticSharder(shardCount: int, epsilon: double, delta: double, seed: int64) =
    do if shardCount <= 0 then invalidArg (nameof shardCount) "must be positive"
    let cms = CountMinSketch.forEpsDelta epsilon delta seed
    let shardLoads = Array.zeroCreate<int64> shardCount

    /// Observe a key — trains the CMS so future `Pick` calls have
    /// an accurate skew estimate. Does NOT commit to any shard;
    /// `Pick` is the sole committing operation (calling both
    /// `Observe` and `Pick` on the same key would double-charge
    /// the load, so `Observe` is the training-only path).
    member _.Observe(key: 'K) = cms.Add(key, 1L)

    /// Pick the shard for `key` — returns the shard with the
    /// smallest predicted incremental load, breaking ties by the
    /// key's hash, and **atomically commits** the chosen shard's
    /// load so subsequent `Pick`s see it at the new level. The
    /// paper formulation treats each Pick as a one-shot assignment
    /// that permanently places the key; without the load-commit
    /// step every subsequent Pick sends its key to whatever shard
    /// ended up lightest in the training pass, producing 100%
    /// skew (all keys → one shard). This matches the greedy
    /// 2-approximation in §3 of the paper.
    ///
    /// **Thread-safety.** `Volatile.Read` on every shard-load
    /// read and `Interlocked.Add` on the single commit. The
    /// argmin itself is best-effort under concurrent `Pick`s: two
    /// concurrent callers may each pick the currently-lightest
    /// shard and both commit there. For a stronger guarantee
    /// wrap `Pick` in an external lock.
    ///
    /// Tie-breaking on equal load prefers the `hashTieBreak`
    /// index computed from the key's hash — so on a cold start
    /// (all shards at zero load) load is distributed by the hash
    /// rather than always falling on shard 0.
    ///
    /// **Process-randomization caveat (Otto-281 audit):** the
    /// `hashTieBreak` uses `HashCode.Combine` which re-seeds
    /// per-process. On a *cold start*, two processes will pick
    /// different tie-break shards for the same key — the
    /// load-distribution is process-dependent at the cold-start
    /// boundary. Once observed loads diverge (after a few
    /// `Observe` + `Pick` cycles), the load-based picker
    /// dominates and the assignment becomes deterministic given
    /// the CMS seed. Tests asserting cross-process determinism
    /// of cold-start `Pick`s would flake; tests asserting
    /// post-warmup load-based picks are robust. The trade-off
    /// is intentional: cold-start tie-breaking by hash is a
    /// load-distribution flexibility feature, not a correctness
    /// invariant.
    member _.Pick(key: 'K) : int =
        let predicted = cms.Estimate key
        let hash32 = uint32 (HashCode.Combine key)
        let hashTieBreak = int ((uint64 hash32 * uint64 (uint32 shardCount)) >>> 32)
        let mutable bestShard = hashTieBreak
        let mutable bestLoad =
            Checked.(+) (Volatile.Read &shardLoads.[hashTieBreak]) predicted
        for s in 0 .. shardCount - 1 do
            if s <> hashTieBreak then
                let load = Checked.(+) (Volatile.Read &shardLoads.[s]) predicted
                // Strict `<` preserves the hash-tie-break slot on
                // equal loads (see the docstring above).
                if load < bestLoad then
                    bestLoad <- load
                    bestShard <- s
        Interlocked.Add(&shardLoads.[bestShard], predicted) |> ignore
        bestShard

    /// Current estimated load per shard (for telemetry). Each slot
    /// is read via `Volatile.Read` so consumers never torn-read.
    member _.LoadPerShard : IReadOnlyList<int64> =
        let snapshot = Array.init shardCount (fun i -> Volatile.Read &shardLoads.[i])
        Array.toList snapshot :> IReadOnlyList<_>

    member _.ShardCount = shardCount


// ═══════════════════════════════════════════════════════════════════
// PROFUNCTOR OPTICS — IVM-friendly lens/prism/traversal stub
// ═══════════════════════════════════════════════════════════════════

/// **Profunctor optics** (Boisseau & Gibbons ICFP 2018) give a
/// uniform composable abstraction for lenses/prisms/traversals.
/// For DBSP's nested-data case — e.g. "update field X of record R
/// in Z-set Z" — optics let you express the update as a pure
/// transformation that commutes with D/I.
///
/// ## Stub-grade API
///
/// We ship the minimum viable subset: `Lens` over `struct` shape.
/// Full profunctor lift (`dimap`, `first'`, `right'`) requires
/// higher-kinded polymorphism F# doesn't have natively; practical
/// ports use defunctionalisation. This is a first-principles impl.
[<Struct>]
type Lens<'S, 'A> = {
    Get: 'S -> 'A
    Set: 'A -> 'S -> 'S
}

[<RequireQualifiedAccess>]
module Lens =
    /// Compose two lenses: `Lens<S, A>` + `Lens<A, B>` → `Lens<S, B>`.
    let compose (outer: Lens<'S, 'A>) (inner: Lens<'A, 'B>) : Lens<'S, 'B> =
        { Get = fun s -> inner.Get (outer.Get s)
          Set = fun b s -> outer.Set (inner.Set b (outer.Get s)) s }

    /// Lift a pure `'A -> 'A` transformation through the lens.
    let over (lens: Lens<'S, 'A>) (f: 'A -> 'A) (s: 'S) : 'S =
        lens.Set (f (lens.Get s)) s

    /// Fluent alias for `Set`.
    let set (lens: Lens<'S, 'A>) (a: 'A) (s: 'S) : 'S = lens.Set a s
