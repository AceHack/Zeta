namespace Zeta.Core

open System.Collections.Generic

// ═══════════════════════════════════════════════════════════════════
//  TropicalPaths — incremental shortest paths over a tropical Z-set.
//
//  THE NOVELMATH PAYOFF, CASHED (Aaron 2026-07-02: "wow yeah this is a
//  long term accidental payoff"). NovelMath.fs promised it: "swapping
//  from (ℤ,+,×) to (ℤ∪{∞},min,+) gives you incremental shortest-paths /
//  Viterbi over evolving edge sets for free. Most DBSP implementations
//  hard-code the integer ring and miss this generalisation entirely."
//  The base-atom unification (081KWFXTHJY) made ZSetW carry any lawful
//  semiring at zero overhead, and the IRing split (081KWG9JQ9H) made
//  tropical LAWFUL at its own tier — so this module is now just algebra:
//
//   • A GRAPH is `ZSetW<'V * 'V, TropicalWeight>` — and the atom's own
//     semantics do the graph bookkeeping: duplicate edges CONSOLIDATE
//     via `Add = min` (parallel edges keep the cheapest), and
//     `Zero = +∞` entries DROP (an unreachable edge is no edge).
//   • DISTANCES are `ZSetW<'V, TropicalWeight>`; relaxation is min-plus
//     matrix-vector product; SSSP is Bellman–Ford as a semi-naive
//     fixpoint of Z-set sums (the same `MergeKernel` fold as all data).
//
//  THE SEMIRING TRUTH, OPERATIONAL: tropical provably has no additive
//  inverse (idempotent ⇒ zerosumfree — Vandiver 1934, Golan 1999; the
//  081KWG9JQ9H theorem). Consequences the API states instead of hiding:
//   • INSERTS / cost DECREASES are incremental for free — min is
//     monotone, so re-relaxing from the delta frontier converges to the
//     exact answer (work ∝ affected region, not graph size).
//   • DELETES / cost INCREASES cannot be retracted algebraically (there
//     is no −edge in min-plus). The honest operation is a REFOLD of the
//     surviving edge log — which the event-sourced substrate already
//     keeps. The ring plane retracts; the tropical plane refolds.
//
//  Anchors: Lehmann 1977 (the algebraic path problem); Mohri 2002
//  (semiring shortest-distance frameworks); Gondran & Minoux 2008
//  (dioids — already NovelMath's anchor); Bellman 1958 / Ford 1956;
//  DBSP/Budiu (incremental view maintenance the fold rides on).
// ═══════════════════════════════════════════════════════════════════

/// Incremental single-source shortest paths over an evolving tropical
/// edge Z-set. See the module header for the insert/delete asymmetry —
/// it is the zerosumfree theorem made operational, not a limitation to
/// apologise for.
[<RequireQualifiedAccess>]
module TropicalPaths =

    let private ring = TropicalSemiring.Instance

    /// Build the edge Z-set from an edge list `(src, dst, cost)`.
    /// Parallel edges consolidate to the MINIMUM cost (ring.Add = min);
    /// +∞ edges drop (ring.Zero). Self-loops are legal (and useless:
    /// they can never improve a shortest path unless negative).
    [<CompiledName "OfEdges">]
    let ofEdges (edges: seq<'V * 'V * int64>) : ZSetW<'V * 'V, TropicalWeight> =
        ZSetW.ofSeq ring (edges |> Seq.map (fun (u, v, c) -> (u, v), TropicalWeight c))

    /// One relaxation round: for every known distance `(u, d)` and edge
    /// `((u, v), w)`, propose `v` at `d ⊗ w` (tropical ⊗ = +), then
    /// min-merge the proposals into the current distances (Z-set sum —
    /// the shared kernel). Returns the merged distances.
    let private relax (edges: ZSetW<'V * 'V, TropicalWeight>) (dist: ZSetW<'V, TropicalWeight>) =
        // index edges by source once per call
        let bySrc = Dictionary<'V, ResizeArray<'V * TropicalWeight>>(HashIdentity.Structural)
        for e in edges do
            let (u, v) = e.Key
            match bySrc.TryGetValue u with
            | true, l -> l.Add(v, e.Weight)
            | false, _ ->
                let l = ResizeArray()
                l.Add(v, e.Weight)
                bySrc.[u] <- l
        let proposals =
            seq {
                for d in dist do
                    match bySrc.TryGetValue d.Key with
                    | true, outs ->
                        for (v, w) in outs do
                            yield v, ring.Mul(d.Weight, w)   // tropical ⊗ = saturating +
                    | false, _ -> ()
            }
        ZSetW.sum ring dist (ZSetW.ofSeq ring proposals)

    /// Single-source shortest distances by semi-naive fixpoint (algebraic
    /// Bellman–Ford). Iterates relaxation until the distance Z-set stops
    /// changing, bounded by `maxRounds` (pass vertex-count for classic
    /// Bellman–Ford semantics). Returns `Error` if the bound is hit while
    /// still improving — with non-negative costs that cannot happen; with
    /// negative costs it is the negative-cycle witness.
    [<CompiledName "SingleSource">]
    let singleSource
        (maxRounds: int)
        (source: 'V)
        (edges: ZSetW<'V * 'V, TropicalWeight>)
        : Result<ZSetW<'V, TropicalWeight>, string> =
        let mutable dist = ZSetW.singleton ring source TropicalWeight.One   // One = 0 cost
        let mutable rounds = 0
        let mutable converged = false
        while not converged && rounds < maxRounds do
            let next = relax edges dist
            if next = dist then converged <- true else dist <- next
            rounds <- rounds + 1
        if converged then Ok dist
        else Error(sprintf "no fixpoint after %d rounds — negative cycle reachable from the source" maxRounds)

    /// INCREMENTAL edge insertion / cost decrease: min is monotone, so the
    /// exact new answer is the fixpoint of re-relaxation seeded from the
    /// CURRENT distances over the UPDATED edge set — no from-scratch run.
    /// Work is proportional to the affected region. (This is the free
    /// half the semiring gives; see `refold` for the other half.)
    [<CompiledName "InsertEdges">]
    let insertEdges
        (maxRounds: int)
        (newEdges: seq<'V * 'V * int64>)
        (edges: ZSetW<'V * 'V, TropicalWeight>)
        (dist: ZSetW<'V, TropicalWeight>)
        : Result<ZSetW<'V * 'V, TropicalWeight> * ZSetW<'V, TropicalWeight>, string> =
        let edges' = ZSetW.sum ring edges (ofEdges newEdges)   // min-consolidating union
        let mutable d = dist
        let mutable rounds = 0
        let mutable converged = false
        while not converged && rounds < maxRounds do
            let next = relax edges' d
            if next = d then converged <- true else d <- next
            rounds <- rounds + 1
        if converged then Ok(edges', d)
        else Error(sprintf "no fixpoint after %d rounds — negative cycle reachable from the source" maxRounds)

    /// Edge DELETION / cost increase: tropical min-plus has NO additive
    /// inverse (idempotent ⇒ zerosumfree — the 081KWG9JQ9H theorem), so a
    /// removed edge cannot be subtracted out of the distances. The honest
    /// operation is a REFOLD: rebuild from the surviving edge log. The
    /// event-sourced substrate keeps that log anyway — deletion is a new
    /// fold, never an un-fold. (Compare `ZSet` over ℤ, where retraction
    /// is one `negate` away: the ring plane retracts; this plane refolds.)
    [<CompiledName "Refold">]
    let refold
        (maxRounds: int)
        (source: 'V)
        (survivingEdges: seq<'V * 'V * int64>)
        : Result<ZSetW<'V * 'V, TropicalWeight> * ZSetW<'V, TropicalWeight>, string> =
        let edges = ofEdges survivingEdges
        singleSource maxRounds source edges |> Result.map (fun d -> edges, d)

    /// Distance lookup: `+∞` (= `ring.Zero`) means unreachable — absence
    /// and unreachability coincide, by the algebra, not by convention.
    [<CompiledName "DistanceTo">]
    let distanceTo (v: 'V) (dist: ZSetW<'V, TropicalWeight>) : TropicalWeight =
        ZSetW.lookup ring v dist

    // ── All-pairs via the KLEENE MATRIX STAR (IKleeneAlgebra) ───────────
    //  Floyd–Warshall IS the tropical matrix star (Lehmann 1977; Kleene):
    //  the reflexive-transitive closure of the weighted adjacency matrix
    //  over the (min,+) Kleene algebra. The diagonal starts at the scalar
    //  Star (One = 0 — the reflexive part); a diagonal that drops below
    //  One after closure is a NEGATIVE CYCLE (the scalar Star's −∞ marker).

    /// All-pairs shortest distances over the tropical Kleene algebra —
    /// the matrix star of the edge Z-set. Result maps `(u, v)` to the
    /// shortest u→v distance; pairs at `+∞` (unreachable) are absent.
    /// `Error` names the vertex on a reachable negative cycle.
    [<CompiledName "AllPairs">]
    let allPairs (edges: ZSetW<'V * 'V, TropicalWeight>) : Result<ZSetW<'V * 'V, TropicalWeight>, string> =
        let kleene = TropicalSemiring.Kleene
        // vertex set
        let vs = HashSet<'V>(HashIdentity.Structural)
        for e in edges do
            let (u, v) = e.Key
            vs.Add u |> ignore
            vs.Add v |> ignore
        let verts = List.ofSeq vs
        // dense working matrix in a dictionary; missing = +∞ (ring.Zero)
        let d = Dictionary<'V * 'V, TropicalWeight>(HashIdentity.Structural)
        let get i j = match d.TryGetValue((i, j)) with | true, w -> w | _ -> ring.Zero
        for e in edges do d.[e.Key] <- e.Weight            // (min-consolidated already)
        for i in verts do d.[(i, i)] <- ring.One                 // reflexive closure: Star seed = 0
        // the closure (k-i-j)
        for k in verts do
            for i in verts do
                let dik = get i k
                if dik <> ring.Zero then                    // skip +∞ rows fast
                    for j in verts do
                        let cand = ring.Mul(dik, get k j)    // dik ⊗ dkj  (= +)
                        let cur = get i j
                        let better = ring.Add(cur, cand)     // min
                        if better <> cur then d.[(i, j)] <- better
        // negative-cycle check via the KLEENE STAR: a vertex sits on a negative
        // cycle iff the closure drove its diagonal below 0, i.e. Star(dᵢᵢ) diverges
        // to the −∞ marker (Int64.MinValue) instead of clamping to One.
        let diverged (w: TropicalWeight) = (kleene.Star w).Value = System.Int64.MinValue
        let neg = verts |> List.tryFind (fun i -> diverged (get i i))
        match neg with
        | Some v -> Error(sprintf "negative cycle through a vertex (%A) — no shortest all-pairs distances" v)
        | None ->
            // materialise finite pairs (drop +∞ = unreachable)
            let pairs =
                seq { for kv in d do if kv.Value <> ring.Zero then yield kv.Key, kv.Value }
            Ok(ZSetW.ofSeq ring pairs)

    /// All-pairs distance lookup for one `(u, v)`; `+∞` = unreachable.
    [<CompiledName "AllPairsDistance">]
    let allPairsDistance (u: 'V) (v: 'V) (aps: ZSetW<'V * 'V, TropicalWeight>) : TropicalWeight =
        ZSetW.lookup ring (u, v) aps
