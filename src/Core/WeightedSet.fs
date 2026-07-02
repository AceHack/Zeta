namespace Zeta.Core

open System.Collections.Generic
open Zeta.Core.Abstractions

/// **Semiring-generic sparse tensor — coordinate (`'K`) → weight (`'W` in an `ISemiring`) (Aaron 2026-06-07,
/// the tensor-algebra tie-in).** The generalization of `ZSet` over the *weight*: `ZSet` is the `IntegerRing`
/// instance (int64, perf-tuned hot path — kept SEPARATE and unchanged); the **soft tensor** is the
/// `IntervalRing` / `ProbabilitySemiring` instance (uncertainty / probability weights); a 0/1-weighted
/// instance is an **SDR** (Numenta — `support` = active set, `inner` = overlap). One sparse tensor, the
/// semiring picks the meaning.
///
/// Instance-passing semiring (the `ISemiring<'W>` is threaded through ops, like the existing `IntegerRing`
/// usage). Pure / immutable. **Canonical:** Zero-weight coordinates are pruned, so `add a (negate a) = empty`
/// — retraction-native, exactly like `ZSet`. GraphBLAS-shaped: ⊕ = `add`, ⊗ = `scale`, contraction = `inner`.
[<RequireQualifiedAccess>]
module WeightedSet =

    /// A sparse map of coordinate → weight. Structural equality (needs `'W : equality`); no ordering.
    /// Implements the language-neutral `ITensor` read contract (semiring-free surface: stored support).
    [<NoComparison>]
    type WeightedSet<'K, 'W when 'K: comparison and 'W: equality> =
        private
            { Entries: Map<'K, 'W> }

        interface ITensor<'K, 'W> with
            member this.StoredCount = int64 this.Entries.Count
            member this.IsSparse = true

            member this.StoredEntries =
                this.Entries |> Map.toSeq |> Seq.map (fun (k, v) -> KeyValuePair(k, v))

    /// The empty (all-Zero) sparse tensor.
    let empty<'K, 'W when 'K: comparison and 'W: equality> : WeightedSet<'K, 'W> = { Entries = Map.empty }

    let isEmpty (ws: WeightedSet<'K, 'W>) : bool = Map.isEmpty ws.Entries

    let count (ws: WeightedSet<'K, 'W>) : int = ws.Entries.Count

    /// Weight at a coordinate (semiring `Zero` if the coordinate is absent).
    let weight (sr: ISemiring<'W>) (k: 'K) (ws: WeightedSet<'K, 'W>) : 'W =
        match Map.tryFind k ws.Entries with
        | Some w -> w
        | None -> sr.Zero

    /// Set/prune one coordinate (a `Zero` weight is removed → canonical form).
    let private setW (sr: ISemiring<'W>) (k: 'K) (w: 'W) (m: Map<'K, 'W>) : Map<'K, 'W> =
        if w = sr.Zero then Map.remove k m else Map.add k w m

    /// Build from pairs, combining duplicate coordinates via ⊕ and pruning `Zero`.
    let ofSeq (sr: ISemiring<'W>) (pairs: ('K * 'W) seq) : WeightedSet<'K, 'W> =
        let m =
            pairs
            |> Seq.fold
                (fun acc (k, w) ->
                    let cur =
                        match Map.tryFind k acc with
                        | Some c -> c
                        | None -> sr.Zero

                    setW sr k (sr.Add(cur, w)) acc)
                Map.empty

        { Entries = m }

    let singleton (sr: ISemiring<'W>) (k: 'K) (w: 'W) : WeightedSet<'K, 'W> = ofSeq sr [ k, w ]

    /// ⊕ — union; shared coordinates combine via `Add`; `Zero` results are pruned (retraction-native).
    let add (sr: ISemiring<'W>) (a: WeightedSet<'K, 'W>) (b: WeightedSet<'K, 'W>) : WeightedSet<'K, 'W> =
        let m =
            b.Entries
            |> Map.fold
                (fun acc k w ->
                    let cur =
                        match Map.tryFind k acc with
                        | Some c -> c
                        | None -> sr.Zero

                    setW sr k (sr.Add(cur, w)) acc)
                a.Entries

        { Entries = m }

    /// Negate every weight (ring inverse — for retraction / subtraction).
    /// `IRing` since 081KWG9JQ9H: inverse-free semirings are rejected at compile time.
    let negate (sr: IRing<'W>) (ws: WeightedSet<'K, 'W>) : WeightedSet<'K, 'W> =
        { Entries = ws.Entries |> Map.map (fun _ w -> sr.Negate(w)) }

    /// `a − b` = `a ⊕ (−b)`. `IRing` since 081KWG9JQ9H.
    let subtract (sr: IRing<'W>) (a: WeightedSet<'K, 'W>) (b: WeightedSet<'K, 'W>) : WeightedSet<'K, 'W> =
        add sr a (negate sr b)

    /// Scale every weight by `w` on the left (⊗); `Zero` results pruned (`×Zero` annihilates).
    let scale (sr: ISemiring<'W>) (w: 'W) (ws: WeightedSet<'K, 'W>) : WeightedSet<'K, 'W> =
        let m = ws.Entries |> Map.fold (fun acc k wk -> setW sr k (sr.Mul(w, wk)) acc) Map.empty
        { Entries = m }

    /// Contraction / inner product over shared coordinates: `Σ_k a[k] ⊗ b[k]` (⊕-folded). Over a 0/1
    /// integer weighting this is the **SDR overlap count**; over a probability semiring, an expectation;
    /// over the integer ring, the Z-set dot product.
    let inner (sr: ISemiring<'W>) (a: WeightedSet<'K, 'W>) (b: WeightedSet<'K, 'W>) : 'W =
        a.Entries
        |> Map.fold
            (fun acc k wa ->
                match Map.tryFind k b.Entries with
                | Some wb -> sr.Add(acc, sr.Mul(wa, wb))
                | None -> acc)
            sr.Zero

    /// Map coordinates (collisions combine via ⊕, `Zero` pruned).
    let mapKeys (sr: ISemiring<'W>) (f: 'K -> 'K2) (ws: WeightedSet<'K, 'W>) : WeightedSet<'K2, 'W> =
        ws.Entries |> Map.toSeq |> Seq.map (fun (k, w) -> f k, w) |> ofSeq sr

    /// ⊕-fold a sequence (order-independent: `add` is commutative + associative).
    let sum (sr: ISemiring<'W>) (xs: WeightedSet<'K, 'W> seq) : WeightedSet<'K, 'W> =
        Seq.fold (add sr) empty xs

    /// The nonzero coordinates (the support / SDR active set), ordinal-ordered.
    let support (ws: WeightedSet<'K, 'W>) : 'K list = ws.Entries |> Map.toList |> List.map fst

    /// All `(coordinate, weight)` pairs, ordinal-ordered.
    let toSeq (ws: WeightedSet<'K, 'W>) : ('K * 'W) seq = Map.toSeq ws.Entries
