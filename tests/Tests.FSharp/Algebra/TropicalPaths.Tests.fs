module Zeta.Tests.Algebra.TropicalPathsTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// TropicalPaths — the NovelMath payoff: incremental shortest paths as
// tropical Z-set algebra. Load-bearing law: INCREMENTAL INSERT ≡ FRESH
// RECOMPUTE (min-monotone convergence), quantified over random graphs.
// ═══════════════════════════════════════════════════════════════════

let private ring = TropicalSemiring.Instance
let private dist v d = TropicalPaths.distanceTo v d

// ── ground truth on a known graph ───────────────────────────────────
//        1        4
//   A ─────→ B ─────→ D
//   │        ↑        ↑
//   │2       │1       │1
//   ↓        │        │
//   C ───────┘        │
//   └────────────────→ E ── (E→D cost 1); A→…→D best = A→C→B→D? A-C=2,C-B=1,B-D=4 = 7; A-B=1,B-D=4 = 5; A→C→E? no C→E edge... use explicit expectations below.

[<Fact>]
let ``singleSource computes exact shortest distances (hand-checked graph)`` () =
    let edges =
        TropicalPaths.ofEdges
            [ "A", "B", 1L; "A", "C", 2L; "C", "B", 1L; "B", "D", 4L; "C", "E", 7L; "E", "D", 1L ]
    match TropicalPaths.singleSource 10 "A" edges with
    | Error e -> failwith e
    | Ok d ->
        Assert.Equal(TropicalWeight 0L, dist "A" d)
        Assert.Equal(TropicalWeight 1L, dist "B" d)   // A→B
        Assert.Equal(TropicalWeight 2L, dist "C" d)   // A→C
        Assert.Equal(TropicalWeight 5L, dist "D" d)   // A→B→D beats A→C→E→D (2+7+1=10)
        Assert.Equal(TropicalWeight 9L, dist "E" d)   // A→C→E
        // unreachable = +∞ = ring.Zero: absence and unreachability coincide
        Assert.Equal(TropicalWeight.Infinity, dist "Z" d)

[<Fact>]
let ``parallel edges consolidate to the cheapest (Add = min, by the atom's own semantics)`` () =
    let edges = TropicalPaths.ofEdges [ "A", "B", 9L; "A", "B", 3L; "A", "B", 5L ]
    match TropicalPaths.singleSource 5 "A" edges with
    | Ok d -> Assert.Equal(TropicalWeight 3L, dist "B" d)
    | Error e -> failwith e

[<Fact>]
let ``incremental insert improves affected distances without a fresh run`` () =
    let edges0 = TropicalPaths.ofEdges [ "A", "B", 10L; "B", "C", 10L ]
    let d0 =
        match TropicalPaths.singleSource 5 "A" edges0 with
        | Ok d -> d
        | Error e -> failwith e
    Assert.Equal(TropicalWeight 20L, dist "C" d0)
    // a shortcut appears
    match TropicalPaths.insertEdges 10 [ "A", "C", 3L ] edges0 d0 with
    | Ok (_, d1) ->
        Assert.Equal(TropicalWeight 3L, dist "C" d1)
        Assert.Equal(TropicalWeight 10L, dist "B" d1)  // untouched region unchanged
    | Error e -> failwith e

[<Fact>]
let ``deletion is a REFOLD — the zerosumfree theorem operational`` () =
    // build with the shortcut, then "delete" it by refolding the survivors
    let d1 =
        match
            TropicalPaths.insertEdges 10 [ "A", "C", 3L ]
                (TropicalPaths.ofEdges [ "A", "B", 10L; "B", "C", 10L ])
                (ZSetW.singleton ring "A" TropicalWeight.One)
        with
        | Ok (_, d) -> d
        | Error e -> failwith e
    Assert.Equal(TropicalWeight 3L, dist "C" d1)
    match TropicalPaths.refold 10 "A" [ "A", "B", 10L; "B", "C", 10L ] with
    | Ok (_, d2) -> Assert.Equal(TropicalWeight 20L, dist "C" d2) // the min could not be un-min'ed; the fold could
    | Error e -> failwith e

[<Fact>]
let ``negative cycle reachable from source is DETECTED, not looped forever`` () =
    let edges = TropicalPaths.ofEdges [ "A", "B", 1L; "B", "C", -5L; "C", "B", 1L ]
    match TropicalPaths.singleSource 10 "A" edges with
    | Error msg -> Assert.Contains("negative cycle", msg)
    | Ok _ -> Assert.True(false, "expected negative-cycle detection")

// ── THE LAW: incremental ≡ from-scratch, over random graphs ─────────

type private GraphArb =
    static member Edges() =
        gen {
            let! n = Gen.choose (2, 7)                       // vertices 0..n-1
            let! m = Gen.choose (1, 14)
            let edge = gen {
                let! u = Gen.choose (0, n - 1)
                let! v = Gen.choose (0, n - 1)
                let! c = Gen.choose (0, 20)                  // non-negative: BF converges
                return u, v, int64 c
            }
            let! es = Gen.listOfLength m edge
            return es
        }
        |> Arb.fromGen

[<Property(Arbitrary = [| typeof<GraphArb> |], MaxTest = 200)>]
let ``LAW: incremental insert equals fresh recompute on random graphs`` (base': (int*int*int64) list) (added: (int*int*int64) list) =
    let rounds = 32
    let e0 = TropicalPaths.ofEdges base'
    match TropicalPaths.singleSource rounds 0 e0 with
    | Error _ -> true  // (unreachable with non-negative costs)
    | Ok d0 ->
        let incr = TropicalPaths.insertEdges rounds added e0 d0
        let fresh =
            TropicalPaths.singleSource rounds 0 (ZSetW.sum ring e0 (TropicalPaths.ofEdges added))
        match incr, fresh with
        | Ok (_, di), Ok df -> di = df
        | Error _, Error _ -> true
        | _ -> false

// ═══════════════════════════════════════════════════════════════════
// IKleeneAlgebra — tropical Kleene star + all-pairs via the matrix star
// (Lehmann 1977). The star branch is orthogonal to IStarRing's involution.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``tropical Kleene Star clamps to One for non-negative, diverges for negative`` () =
    let k = TropicalSemiring.Kleene
    Assert.Equal(TropicalWeight.One, k.Star(TropicalWeight 5L))   // 0: no self-repeat helps
    Assert.Equal(TropicalWeight.One, k.Star(TropicalWeight 0L))
    Assert.Equal(TropicalWeight System.Int64.MinValue, k.Star(TropicalWeight -1L)) // −∞ marker

[<Fact>]
let ``allPairs computes the matrix-star closure (hand-checked)`` () =
    let edges = TropicalPaths.ofEdges [ "A","B",1L; "B","C",2L; "A","C",5L; "C","A",4L ]
    match TropicalPaths.allPairs edges with
    | Error e -> failwith e
    | Ok aps ->
        let d u v = TropicalPaths.allPairsDistance u v aps
        Assert.Equal(TropicalWeight 0L, d "A" "A")   // reflexive
        Assert.Equal(TropicalWeight 1L, d "A" "B")
        Assert.Equal(TropicalWeight 3L, d "A" "C")   // A→B→C (1+2) beats A→C (5)
        Assert.Equal(TropicalWeight 6L, d "B" "A")   // B→C→A (2+4)
        Assert.Equal(TropicalWeight.Infinity, d "B" "Q") // absent = +∞

[<Fact>]
let ``allPairs detects a negative cycle via the Kleene star`` () =
    let edges = TropicalPaths.ofEdges [ "A","B",1L; "B","A",-3L; "B","C",2L ]
    match TropicalPaths.allPairs edges with
    | Error msg -> Assert.Contains("negative cycle", msg)
    | Ok _ -> Assert.True(false, "expected negative-cycle detection")

[<Property(Arbitrary = [| typeof<GraphArb> |], MaxTest = 150)>]
let ``LAW: allPairs row equals singleSource from that vertex (matrix star ≡ per-source BF)`` (es: (int*int*int64) list) =
    let edges = TropicalPaths.ofEdges es
    match TropicalPaths.allPairs edges with
    | Error _ -> true  // negative cycle — both paths would error; skip
    | Ok aps ->
        let ring = TropicalSemiring.Instance
        // vertices present
        let vs = System.Collections.Generic.HashSet<int>()
        for e in edges do let (u,v) = e.Key in vs.Add u |> ignore; vs.Add v |> ignore
        vs |> Seq.forall (fun src ->
            match TropicalPaths.singleSource 64 src edges with
            | Error _ -> true
            | Ok ss ->
                // every vertex's all-pairs (src,·) must match single-source-from-src
                vs |> Seq.forall (fun dst ->
                    TropicalPaths.allPairsDistance src dst aps = ZSetW.lookup ring dst ss))
