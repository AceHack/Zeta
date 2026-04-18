namespace Zeta.Core

open System
open System.Runtime.CompilerServices


/// Incremental closure-table hierarchy over a Z-set edge stream.
///
/// Research agent ranked 5 hierarchical storage patterns (materialised
/// path / closure table / nested set / adjacency list + recursive CTE /
/// ltree-hierarchyid) against DBSP's Z-set algebra. **Closure table
/// wins by a wide margin** because:
///   - It's retraction-native: Z-weight subtraction gives exact
///     delete-subtree semantics for free.
///   - It reuses our existing `RecursiveSemiNaive` LFP machinery —
///     `C = E ∪ (C ⋈ E)` is a one-liner semi-naïve body.
///   - Ancestor / descendant queries are `IndexedJoin` lookups —
///     O(log K + matches).
///   - Insert Δ-cost is provably `O((depth_u + subtreeSize_v) · log K)`.
///
/// Materialised-path and nested-set patterns have O(|subtree|) insert
/// cost in the worst case — incompatible with DBSP's "delta-cost
/// bounded by edit size" invariant. They're strictly weaker here.
///
/// ## References
///   - DBSP, Budiu et al., arXiv:2203.16684 + VLDB Journal 2025.
///   - "Circuits and Formulas for Datalog over Semirings",
///     arXiv:2504.08914 (2025) — closure as tropical LFP.
///   - Feldera Universal IVM blog — same algorithm in production Rust.
///
/// ## API sketch
///
/// ```fsharp
/// let c = Circuit.create ()
/// let edges = c.ZSetInput<struct (int * int)>()
/// let closure = c.ClosureTable edges.Stream
/// let descendants = c.DescendantsOf(closure, rootNode = 7)
/// ```


/// A single transitive-closure row — `(Ancestor, Descendant, Depth)`.
/// Depth supports "nodes exactly N levels below X" queries in O(1).
[<Struct; IsReadOnly; CustomEquality; CustomComparison>]
type ClosurePair<'N when 'N : comparison> =
    val Ancestor: 'N
    val Descendant: 'N
    val Depth: int
    new(ancestor: 'N, descendant: 'N, depth: int) =
        { Ancestor = ancestor; Descendant = descendant; Depth = depth }

    override this.Equals(other) =
        // Harsh-critic round #17: `Equals` must agree with `GetHashCode`.
        // The prior version used `Comparer<'N>.Compare = 0` (ordered
        // equivalence) for Equals but `HashCode.Combine(this.Ancestor, ...)`
        // (native equality / object.GetHashCode) for the hash. For any 'N
        // whose IComparable.CompareTo disagrees with Object.Equals (NaN,
        // custom types with distinct equality and comparison semantics)
        // that combo violates the Equals↔GetHashCode contract and produces
        // hash-collision-dependent silent bugs in ZSet / Dictionary.
        // Fix: use `EqualityComparer<'N>.Default` symmetrically on both
        // sides so Equals and GetHashCode are consistent by construction.
        match other with
        | :? ClosurePair<'N> as p ->
            let eq = System.Collections.Generic.EqualityComparer<'N>.Default
            eq.Equals(this.Ancestor, p.Ancestor)
            && eq.Equals(this.Descendant, p.Descendant)
            && this.Depth = p.Depth
        | _ -> false

    override this.GetHashCode() =
        // Match Equals: use EqualityComparer<'N>.Default.GetHashCode so
        // two values that compare equal under EqualityComparer also hash
        // to the same bucket.
        let eq = System.Collections.Generic.EqualityComparer<'N>.Default
        HashCode.Combine(
            eq.GetHashCode this.Ancestor,
            eq.GetHashCode this.Descendant,
            this.Depth)

    interface IComparable with
        member this.CompareTo(other) =
            match other with
            | :? ClosurePair<'N> as p ->
                let cmp = System.Collections.Generic.Comparer<'N>.Default
                let c = cmp.Compare(this.Ancestor, p.Ancestor)
                if c <> 0 then c
                else
                    let c2 = cmp.Compare(this.Descendant, p.Descendant)
                    if c2 <> 0 then c2
                    else compare this.Depth p.Depth
            | _ -> invalidArg "other" "not a ClosurePair"


[<Extension>]
type HierarchyExtensions =

    /// Materialise the transitive closure of an edge stream.
    ///
    /// Input: `Stream<ZSet<struct (parent, child)>>` — edges with
    ///        Z-weights (positive = insert, negative = retract).
    /// Output: `Stream<ZSet<ClosurePair<'N>>>` — the reflexive-
    ///         transitive closure. Retractions of edges propagate to
    ///         retractions of closure rows automatically via Z-set
    ///         subtraction — no tombstone pass.
    ///
    /// Complexity: insert of one edge `(u, v)` adds `(1 + |ancestors(u)|)
    /// × (1 + |descendants(v)|)` closure rows; O((d + s) · log K) work.
    ///
    /// Implementation: closure `C = E ⊎ (C ⨝ E)` where `E` is the
    /// input edge stream and the join is on `C.Descendant = E.Parent`
    /// with `Depth' = C.Depth + 1`.
    ///
    /// **Correctness note.** `ClosureTable` uses the plain `Recursive`
    /// combinator — which re-evaluates the body over the full
    /// `Distinct`-clamped set per iteration — rather than
    /// `RecursiveSemiNaive`. The semi-naïve combinator is monotonic-only
    /// (it tracks a `total` relation that only grows via delta-fb `+=`
    /// each iteration) and therefore leaks retracted closure rows under
    /// edge retractions, answering subtree-queries with ghost ancestors.
    /// With plain `Recursive`, the retraction reaches zero weight,
    /// `Distinct` drops it, and the body no longer generates depth-k+1
    /// rows rooted in the retracted edge. The cost is O(|integrated
    /// closure|) per iteration rather than O(|Δ|); for workloads with
    /// many retractions this is the correct trade. A retraction-safe
    /// semi-naïve ("differential semi-naïve") combinator is listed in
    /// `docs/TECH-RADAR.md` as an Assess item.
    [<Extension>]
    static member ClosureTable<'N when 'N : comparison and 'N : not null>
        (this: Circuit,
         edges: Stream<ZSet<struct ('N * 'N)>>) : Stream<ZSet<ClosurePair<'N>>> =
        // Seed: every edge (p, c) becomes a depth-1 closure row.
        let seed =
            this.Map(
                edges,
                Func<_, _>(fun (pair: struct ('N * 'N)) ->
                    let struct (p, c) = pair
                    ClosurePair<'N>(p, c, 1)))
        // Body: extend known closure by one more edge hop.
        let bodyFn =
            Func<Stream<ZSet<ClosurePair<'N>>>, Stream<ZSet<ClosurePair<'N>>>>(
                fun current ->
                    // C.Desc ⋈ E.Parent → new row (C.Anc, E.Child, C.Depth + 1)
                    this.Join(
                        current, edges,
                        Func<_, _>(fun (c: ClosurePair<'N>) -> c.Descendant),
                        Func<_, _>(fun (e: struct ('N * 'N)) -> let struct (p, _) = e in p),
                        Func<_, _, _>(fun (c: ClosurePair<'N>) (e: struct ('N * 'N)) ->
                            let struct (_, child) = e
                            ClosurePair<'N>(c.Ancestor, child, c.Depth + 1))))
        // Retraction-safe LFP — `Recursive` uses `Distinct` on the
        // combined signal every iteration, so a retracted closure row
        // is dropped as soon as its integrated weight hits zero.
        this.Recursive(seed, bodyFn)

    /// **Counting** variant of `ClosureTable`. Mirrors the shape of
    /// `ClosureTable` but wraps `RecursiveCounting` instead of
    /// `Recursive`, so the output Z-set carries *derivation-count*
    /// multiplicities rather than `{0, 1}` set-membership weights. A
    /// closure pair `(a, d, k)` with weight `w` means: there are exactly
    /// `w` distinct length-`k` edge-walks from `a` to `d` under the
    /// currently integrated edge stream.
    ///
    /// **Preconditions & limitations** (see `RecursiveCounting` XML doc
    /// for the full story):
    ///   - The edge graph must be **acyclic**. Cycles induce
    ///     infinitely-many derivations and the combinator does not
    ///     converge — use `ClosureTable` for cyclic inputs.
    ///   - The body here (a single join into `edges`) is Z-linear, so
    ///     retractions on the edge stream flow through the series and
    ///     cancel the corresponding closure derivations by Z-set
    ///     subtraction: every closure pair's integrated weight equals
    ///     its surviving derivation count and reaches 0 once all its
    ///     derivations are retracted.
    ///
    /// **When to reach for this over `ClosureTable`.**
    ///   - Path-counting queries ("how many routes from A to B at depth
    ///     k?") read the multiplicity directly.
    ///   - Provenance-weight queries that need the derivation count as
    ///     a confidence/support metric.
    ///   - Retraction-safety *with* the semi-naïve-esque weight-flow
    ///     win, avoiding the `Distinct` clamp's O(|integrated|) scan per
    ///     iteration (option 4 in
    ///     `docs/research/retraction-safe-semi-naive.md`).
    ///
    /// If you want boolean set-of-tuples semantics over a potentially-
    /// cyclic graph, stay on `ClosureTable`.
    [<Extension>]
    static member CountingClosureTable<'N when 'N : comparison and 'N : not null>
        (this: Circuit,
         edges: Stream<ZSet<struct ('N * 'N)>>) : Stream<ZSet<ClosurePair<'N>>> =
        // Under `RecursiveCounting` each inner tick advances one
        // `body^i(seed)` layer, and the body reads `edges` on that
        // tick. Raw ZSet input ops drain their queue on the first
        // step, so without integration the edges would be visible only
        // at tick 0 and body would see `∅` from tick 1 onward — all
        // depth-≥2 closure rows would silently vanish. Integrating the
        // edge stream keeps the full edge set available at every tick,
        // and retractions subtract through `IntegrateZSet` cleanly so
        // the counting invariant survives edge deletions.
        let edgesInt = this.IntegrateZSet edges
        // Seed: every edge (p, c) becomes a depth-1 closure row with
        // weight matching the edge's input weight (so retraction deltas
        // reach the counting body intact). Map over the *delta* edge
        // stream so `RecursiveCounting`'s own seed-integrator picks up
        // the changes — feeding it the already-integrated edges would
        // double-integrate and accumulate endlessly.
        let seed =
            this.Map(
                edges,
                Func<_, _>(fun (pair: struct ('N * 'N)) ->
                    let struct (p, c) = pair
                    ClosurePair<'N>(p, c, 1)))
        // Body: extend known closure by one more edge hop. `Join` is
        // bilinear, so Z-linear in its first argument when the second
        // (the integrated edges) is held fixed over the inner fixpoint
        // iteration — matching the Z-linearity precondition of
        // `RecursiveCounting`.
        let bodyFn =
            Func<Stream<ZSet<ClosurePair<'N>>>, Stream<ZSet<ClosurePair<'N>>>>(
                fun current ->
                    this.Join(
                        current, edgesInt,
                        Func<_, _>(fun (c: ClosurePair<'N>) -> c.Descendant),
                        Func<_, _>(fun (e: struct ('N * 'N)) -> let struct (p, _) = e in p),
                        Func<_, _, _>(fun (c: ClosurePair<'N>) (e: struct ('N * 'N)) ->
                            let struct (_, child) = e
                            ClosurePair<'N>(c.Ancestor, child, c.Depth + 1))))
        this.RecursiveCounting(seed, bodyFn)

    /// Descendants of `root` — one entry per descendant with its depth.
    [<Extension>]
    static member DescendantsOf<'N when 'N : comparison and 'N : not null>
        (this: Circuit,
         closure: Stream<ZSet<ClosurePair<'N>>>,
         root: 'N) : Stream<ZSet<ClosurePair<'N>>> =
        this.Filter(closure, Func<_, _>(fun (p: ClosurePair<'N>) ->
            System.Collections.Generic.Comparer<'N>.Default.Compare(p.Ancestor, root) = 0))

    /// Ancestors of `leaf` — from immediate parent up to root.
    [<Extension>]
    static member AncestorsOf<'N when 'N : comparison and 'N : not null>
        (this: Circuit,
         closure: Stream<ZSet<ClosurePair<'N>>>,
         leaf: 'N) : Stream<ZSet<ClosurePair<'N>>> =
        this.Filter(closure, Func<_, _>(fun (p: ClosurePair<'N>) ->
            System.Collections.Generic.Comparer<'N>.Default.Compare(p.Descendant, leaf) = 0))
