namespace Zeta.Core

open System.Collections.Generic

// ═══════════════════════════════════════════════════════════════════
//  KleeneClosure — the GENERIC matrix star over any IKleeneAlgebra.
//  "One algorithm, chosen by instance" (Lehmann 1977; Kozen 1994):
//   • over the tropical (min,+) Kleene algebra → all-pairs shortest paths
//   • over the boolean (∨,∧) Kleene algebra   → transitive closure
//   • over languages                          → regular expressions
//  Same closure code; the instance decides the meaning. `TropicalPaths`
//  keeps its own tuned version; this is the general statement + the
//  BooleanKleene instance (081KWG9JQ9H opened the Kleene branch, #9111
//  added tropical star + all-pairs — this generalises the algorithm).
// ═══════════════════════════════════════════════════════════════════

/// The boolean Kleene algebra `(∨, ∧)` — reachability / transitive-closure
/// weights. Idempotent addition ⇒ NO additive inverse (not `IRing`); its
/// Kleene star is `One` (true): a node reaches itself in zero steps.
[<Struct>]
type BooleanKleene =
    interface ISemiring<bool> with
        member _.Zero      = false          // no edge / unreachable
        member _.One       = true           // reflexive / trivially reachable
        member _.Add(a, b) = a || b         // ⊕ = ∨ (either derivation)
        member _.Mul(a, b) = a && b         // ⊗ = ∧ (both hops)
    interface IKleeneAlgebra<bool> with
        member _.Star(_)   = true           // One ∨ … = true (reflexive-transitive)

[<RequireQualifiedAccess>]
module BooleanKleene =
    /// Kleene-tier singleton.
    let Instance : IKleeneAlgebra<bool> = BooleanKleene()

[<RequireQualifiedAccess>]
module KleeneClosure =

    /// Lehmann's algorithm: the reflexive-transitive closure of the
    /// weighted adjacency matrix over ANY Kleene algebra `k`. Result maps
    /// `(u, v)` to the closure weight; `k.Zero` entries are absent.
    /// (Boxed `k` — the general/cold path; a hot instance would monomorphise
    /// the struct like `TropicalPaths` does.)
    let matrixStar
        (k: IKleeneAlgebra<'W>)
        (edges: ZSetW<'V * 'V, 'W>)
        : ZSetW<'V * 'V, 'W> =
        let vs = HashSet<'V>(HashIdentity.Structural)
        for e in edges do
            let (u, v) = e.Key
            vs.Add u |> ignore
            vs.Add v |> ignore
        let verts = List.ofSeq vs
        let d = Dictionary<'V * 'V, 'W>(HashIdentity.Structural)
        let get i j = match d.TryGetValue((i, j)) with | true, w -> w | _ -> k.Zero
        for e in edges do d.[e.Key] <- e.Weight
        // Lehmann pivot loop: star the pivot, then combine through it.
        for p in verts do
            let dpp = k.Star(get p p)
            d.[(p, p)] <- dpp
            for i in verts do
                if i <> p then
                    let dip = get i p
                    if dip <> k.Zero then
                        for j in verts do
                            let cand = k.Mul(dip, k.Mul(dpp, get p j))
                            let cur = get i j
                            let merged = k.Add(cur, cand)
                            if merged <> cur then d.[(i, j)] <- merged
        let pairs = seq { for kv in d do if kv.Value <> k.Zero then yield kv.Key, kv.Value }
        ZSetW.ofSeq k pairs

    /// Transitive (reflexive-transitive) closure of a directed edge set —
    /// the boolean matrix star. `reaches u v` ⇔ v is reachable from u.
    [<CompiledName "TransitiveClosure">]
    let transitiveClosure (edges: seq<'V * 'V>) : ZSetW<'V * 'V, bool> =
        let k = BooleanKleene.Instance
        matrixStar k (ZSetW.ofSeq k (edges |> Seq.map (fun e -> e, true)))

    /// Reachability query over a computed closure.
    [<CompiledName "Reaches">]
    let reaches (u: 'V) (v: 'V) (closure: ZSetW<'V * 'V, bool>) : bool =
        ZSetW.lookup BooleanKleene.Instance (u, v) closure
