module Zeta.Tests.Formal.AdinkraIharaZetaTests

// **Ihara zeta of the [8,4] adinkra graph — computed, with falsifiers.**
//
// A zeta function is an Euler product enumerating irreducibles. Ihara's runs over the primitive
// closed geodesics of a graph, and an adinkra IS a graph — so Ihara is a finite, computable zeta
// of that graph for the concrete [8,4] extended Hamming generator pinned in `AdinkraCode`.
// The GRAPH is K_{8,8}; the zeta is the Bass polynomial. Ihara is not THE factory zeta.
//
// The falsifier structure, in order of how much it would hurt to lose:
//
//  1. **EXTERNAL ANCHOR.** `K₄`'s Ihara zeta has a published closed form (Terras 2010, *Zeta
//     Functions of Graphs*, the standard worked example; also the Ihara-zeta literature generally):
//         ζ(u)^(−1) = (1 − u²)² (1 − u)(1 − 2u)(1 + u + 2u²)³
//     The general `IharaZeta` machinery must reproduce it coefficient-for-coefficient. Without this
//     the implementation would only agree with itself.
//  2. **IN-TREE PRIOR-ART ANCHOR.** `tests/Tests.FSharp/IharaZeta.Tests.fs` (which computes K₄ by
//     independent, test-local code) pins N₁ = N₂ = 0, N₃ = 24, and ζ = 1 + 8u³ + …. The promoted
//     `src/Core` machinery must agree with the older implementation it replaces.
//  3. **TWO-ROUTE CROSS-CHECK ON THE ADINKRA ITSELF.** The Bass side is a 16×16 integer determinant;
//     the Hashimoto side is the trace of powers of a 128×128 non-backtracking edge operator. They
//     share no code. Agreement on N₁…N₈ is the real check on the adinkra result.
//  4. **NEGATIVE CONTROLS.** The non-backtracking restriction is shown load-bearing (dropping it
//     breaks the identity), and `NotRamanujan` / `NotRegular` are shown reachable — a verdict type
//     that can only return one value is not a verdict.
//
// Everything is exact `bigint` arithmetic; no floating point appears anywhere in the pipeline, so
// the Ramanujan verdict is an integer comparison with no error bound to defend.
//
// Anchors: Ihara 1966; Hashimoto 1989; Bass 1992; Terras 2010; Lubotzky–Phillips–Sarnak 1988;
// Doran–Faux–Gates–Hübsch–Iga–Landweber 2008 (arXiv:0806.0051).

open global.Xunit
open Zeta.Core

let private bi (n: int) = bigint n

let private oneMinusU2 = [| bi 1; bi 0; bi -1 |]

/// Adjacency of the complete graph on `n` vertices.
let private completeGraph (n: int) : int[][] =
    Array.init n (fun i -> Array.init n (fun j -> if i = j then 0 else 1))

/// Adjacency of the complete bipartite graph `K_{a,b}` (parts `0..a-1` and `a..a+b-1`).
let private completeBipartite (a: int) (b: int) : int[][] =
    Array.init (a + b) (fun i -> Array.init (a + b) (fun j -> if (i < a) <> (j < a) then 1 else 0))

// ── 1. EXTERNAL ANCHOR: K₄, the published closed form ───────────────────────────────────────────

[<Fact>]
let ``EXTERNAL ANCHOR (Terras): the Ihara zeta of K4 is (1-u^2)^2 (1-u)(1-2u)(1+u+2u^2)^3`` () =
    let published =
        IharaZeta.polyMul
            (IharaZeta.polyMul
                (IharaZeta.polyPow oneMinusU2 2)
                (IharaZeta.polyMul [| bi 1; bi -1 |] [| bi 1; bi -2 |]))
            (IharaZeta.polyPow [| bi 1; bi 1; bi 2 |] 3)
    let computed = IharaZeta.inverseZeta (completeGraph 4)
    Assert.True(
        IharaZeta.polyEqual published computed,
        sprintf
            "K4 zeta disagrees with the published closed form.\n published: %A\n computed:  %A"
            published
            computed)
    // Bass's degree law: deg ζ^(−1) = 2|E|.
    Assert.Equal(2 * IharaZeta.edgeCount (completeGraph 4), (IharaZeta.polyTrim computed).Length - 1)

[<Fact>]
let ``EXTERNAL ANCHOR: K_{3,3} zeta equals its spectral closed form (1-u^2)^4 (1-4u^2) (1+2u^2)^4`` () =
    // K_{3,3} is 3-regular (q = 2) with adjacency spectrum {3, −3, 0⁴}; Bass then gives
    //   (1 − u²)^(r−1) · (1 − 3u + 2u²)(1 + 3u + 2u²)(1 + 2u²)⁴,  r = 9 − 6 + 1 = 4,
    // which collapses to the form below. Independent of the determinant route used by the code.
    let expected =
        IharaZeta.polyMul
            (IharaZeta.polyMul (IharaZeta.polyPow oneMinusU2 4) [| bi 1; bi 0; bi -4 |])
            (IharaZeta.polyPow [| bi 1; bi 0; bi 2 |] 4)
    let computed = IharaZeta.inverseZeta (completeBipartite 3 3)
    Assert.True(IharaZeta.polyEqual expected computed, "K_{3,3} zeta disagrees with its spectral closed form")

// ── 2. IN-TREE PRIOR-ART ANCHOR: agree with tests/Tests.FSharp/IharaZeta.Tests.fs on K₄ ─────────

[<Fact>]
let ``PRIOR-ART ANCHOR: the promoted machinery reproduces the older K4 test's hand-checked counts (N1=N2=0, N3=24)`` () =
    let k4 = completeGraph 4
    let counts = IharaZeta.geodesicCountsFromHashimoto k4 4
    Assert.Equal(bi 0, counts.[0])
    Assert.Equal(bi 0, counts.[1])
    // 4 triangles × 3 base points × 2 directions.
    Assert.Equal(bi 24, counts.[2])
    // …and the prime count is the 4 triangles × 2 directions = 8, matching ζ = 1 + 8u³ + …
    Assert.Equal(bi 8, (IharaZeta.primeCounts counts).[2])

[<Fact>]
let ``the Bass route and the Hashimoto route agree on K4 (the two sides of the Ihara identity)`` () =
    let k4 = completeGraph 4
    let fromEdges = IharaZeta.geodesicCountsFromHashimoto k4 10
    let fromVertices = IharaZeta.geodesicCountsFromZeta (IharaZeta.inverseZeta k4) 10
    for k in 0 .. 9 do
        Assert.True(
            fromEdges.[k] = fromVertices.[k],
            sprintf "K4 N_%d: Hashimoto says %A, Bass says %A" (k + 1) fromEdges.[k] fromVertices.[k])

// ── 3. THE ADINKRA: the graph is derived from AdinkraCode, not drawn ────────────────────────────

[<Fact>]
let ``the adinkra graph is DERIVED from AdinkraCode: the connection set is the generator's columns, which are the 8 odd-weight vectors of GF(2)^4`` () =
    // Each colour's connection element is the syndrome of e_I — i.e. column I of the generator.
    for j in 0 .. AdinkraCode.length - 1 do
        let column = AdinkraCode.generator |> Array.mapi (fun i row -> row.[j] <<< i) |> Array.fold (|||) 0
        Assert.Equal(column, AdinkraIharaZeta.connectionSet.[j])
    // Eight distinct, non-zero, and all of odd Hamming weight — which is ALL 8 odd vectors of GF(2)⁴.
    Assert.Equal(8, AdinkraIharaZeta.connectionSet |> Array.distinct |> Array.length)
    Assert.DoesNotContain(0, AdinkraIharaZeta.connectionSet)
    let odd = [| for x in 0 .. 15 do if AdinkraIharaZeta.cosetParity x = 1 then yield x |]
    Assert.Equal<int[]>(Array.sort odd, Array.sort AdinkraIharaZeta.connectionSet)

[<Fact>]
let ``THE IDENTIFICATION: the adinkra of the [8,4] extended Hamming code is K_{8,8} - 16 nodes, 8-regular, 64 edges, circuit rank 49`` () =
    Assert.True(AdinkraIharaZeta.isCompleteBipartiteOnCosetParity, "derived adjacency is not complete bipartite on coset parity")
    Assert.Equal(16, AdinkraIharaZeta.nodes)
    Assert.Equal(64, AdinkraIharaZeta.edges)
    Assert.Equal(49, AdinkraIharaZeta.circuitRank)
    Assert.True(IharaZeta.regularDegree AdinkraIharaZeta.adjacency = Some 8, "adinkra must be 8-regular")
    Assert.True(IharaZeta.isConnected AdinkraIharaZeta.adjacency, "adinkra must be connected")
    Assert.True(IharaZeta.isBipartite AdinkraIharaZeta.adjacency, "adinkra must be bipartite (bosons | fermions)")

[<Fact>]
let ``INDEPENDENT CONSTRUCTION: the code-derived adjacency has the same zeta as a hand-built K_{8,8}`` () =
    // Two constructions that share no code: quotient-of-the-code versus "join every left to every
    // right". If the coset derivation were wrong, these would differ.
    let handBuilt = IharaZeta.inverseZeta (completeBipartite 8 8)
    Assert.True(IharaZeta.polyEqual handBuilt AdinkraIharaZeta.inverseZeta, "derived adinkra zeta ≠ hand-built K_{8,8} zeta")

// ── 4. THE POLYNOMIAL ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``THE ZETA: zeta(u)^(-1) = (1-u^2)^49 (1-49u^2) (1+7u^2)^14, a degree-128 integer polynomial`` () =
    Assert.True(
        IharaZeta.polyEqual AdinkraIharaZeta.inverseZetaClosedForm AdinkraIharaZeta.inverseZeta,
        "the 16x16 Bass determinant disagrees with the closed factored form")
    // deg ζ^(−1) = 2|E| = 128 (Bass).
    Assert.Equal(128, (IharaZeta.polyTrim AdinkraIharaZeta.inverseZeta).Length - 1)
    // ζ^(−1)(0) = 1, and every odd coefficient vanishes (the graph is bipartite).
    Assert.Equal(bi 1, AdinkraIharaZeta.inverseZeta.[0])
    for k in 0 .. 127 do
        if k % 2 = 1 then
            Assert.True(AdinkraIharaZeta.inverseZeta.[k].IsZero, sprintf "odd coefficient %d should vanish" k)

[<Fact>]
let ``THE SPECTRUM: the adinkra's characteristic polynomial is exactly x^14 (x-8)(x+8) - so the poles are u = +-1, +-1/7, and +-i/sqrt 7`` () =
    let charPoly = IharaZeta.characteristicPolynomial AdinkraIharaZeta.adjacency
    let expected =
        IharaZeta.polyMul
            (IharaZeta.polyPow [| bi 0; bi 1 |] 14)
            (IharaZeta.polyMul [| bi -8; bi 1 |] [| bi 8; bi 1 |])
    Assert.True(IharaZeta.polyEqual expected charPoly, sprintf "characteristic polynomial is %A" charPoly)
    match IharaZeta.integerRoots charPoly with
    | Some spectrum ->
        Assert.Equal<(bigint * int) list>([ (bi -8, 1); (bi 0, 14); (bi 8, 1) ], spectrum)
    | None -> Assert.Fail "the adinkra spectrum must split over the integers"

// ── 5. THE RAMANUJAN VERDICT ────────────────────────────────────────────────────────────────────

[<Fact>]
let ``THE VERDICT: the adinkra IS Ramanujan - every non-trivial eigenvalue is 0, and 0 <= 4q = 28, so every non-trivial pole sits exactly on |u| = q^(-1/2)`` () =
    match AdinkraIharaZeta.verdict with
    | IharaZeta.Verdict.Ramanujan(q, worst) ->
        Assert.Equal(7, q)
        // The non-trivial spectrum is {0^14}: the critical-circle condition λ² ≤ 4q holds with room.
        Assert.Equal(bi 0, worst)
        Assert.True(worst <= bi (4 * q), "non-trivial λ² must not exceed 4q")
    | other -> Assert.Fail(sprintf "expected Ramanujan, got %A" other)

[<Fact>]
let ``NEGATIVE CONTROL: the verdict can say NO - two disjoint copies of K4 are 3-regular but not Ramanujan (a second eigenvalue 3 > 2 sqrt 2)`` () =
    let twoK4 =
        Array.init 8 (fun i ->
            Array.init 8 (fun j -> if i / 4 = j / 4 && i <> j then 1 else 0))
    match IharaZeta.ramanujanVerdict twoK4 with
    | IharaZeta.Verdict.NotRamanujan(q, lambda) ->
        Assert.Equal(2, q)
        Assert.Equal(bi 3, lambda)
    | other -> Assert.Fail(sprintf "expected NotRamanujan, got %A" other)

[<Fact>]
let ``NEGATIVE CONTROL: a non-regular graph gets NotRegular, not a fabricated q`` () =
    // Path on 3 vertices: degrees 1, 2, 1.
    let path = [| [| 0; 1; 0 |]; [| 1; 0; 1 |]; [| 0; 1; 0 |] |]
    Assert.Equal(IharaZeta.Verdict.NotRegular, IharaZeta.ramanujanVerdict path)

// ── 6. THE EULER PRODUCT: what the "primes" are ─────────────────────────────────────────────────

[<Fact>]
let ``TWO-ROUTE CROSS-CHECK on the adinkra: 128x128 Hashimoto traces = 16x16 Bass determinant, N_1..N_8`` () =
    let fromEdges = IharaZeta.geodesicCountsFromHashimoto AdinkraIharaZeta.adjacency 8
    let fromVertices = IharaZeta.geodesicCountsFromZeta AdinkraIharaZeta.inverseZeta 8
    for k in 0 .. 7 do
        Assert.True(
            fromEdges.[k] = fromVertices.[k],
            sprintf "adinkra N_%d: Hashimoto says %A, Bass says %A" (k + 1) fromEdges.[k] fromVertices.[k])
        Assert.True(
            fromEdges.[k] = AdinkraIharaZeta.geodesicCountClosedForm (k + 1),
            sprintf "adinkra N_%d disagrees with the closed form 98 + 2·49^m + 28·(−7)^m" (k + 1))

[<Fact>]
let ``THE PRIMES: geodesic counts are 0 at odd lengths, and pi(4) = 1568 is hand-checkable as C(8,2)^2 four-cycles x 2 orientations`` () =
    let counts = IharaZeta.geodesicCountsFromHashimoto AdinkraIharaZeta.adjacency 8
    let primes = IharaZeta.primeCounts counts
    // Odd lengths: none — K_{8,8} is bipartite.
    for k in [ 1; 3; 5; 7 ] do
        Assert.Equal(bi 0, counts.[k - 1])
        Assert.Equal(bi 0, primes.[k - 1])
    // Length 2: a length-2 closed walk must backtrack, so there are none.
    Assert.Equal(bi 0, counts.[1])
    // Length 4: the four-cycles. Choose 2 of the 8 left vertices and 2 of the 8 right vertices.
    let fourCycles = (8 * 7 / 2) * (8 * 7 / 2)
    Assert.Equal(784, fourCycles)
    Assert.Equal(bi (fourCycles * 2), primes.[3])
    Assert.Equal(bi 1568, primes.[3])
    // …and the higher prime counts, exactly.
    Assert.Equal(bi 37632, primes.[5])
    Assert.Equal(bi 1448832, primes.[7])

[<Fact>]
let ``NEGATIVE CONTROL: non-backtracking is load-bearing - the plain directed-edge operator breaks the identity at u^2`` () =
    // Drop the "f ≠ reverse(e)" guard: this is the directed-edge adjacency, NOT Hashimoto.
    let de = IharaZeta.directedEdges AdinkraIharaZeta.adjacency
    let m = de.Length
    let backtracking =
        Array.init m (fun a ->
            Array.init m (fun b ->
                let (_, ha) = de.[a]
                let (tb, _) = de.[b]
                if ha = tb then 1L else 0L))
    // tr(W'²) counts out-and-back walks, so it is strictly positive…
    let mutable tr2 = 0L
    for i in 0 .. m - 1 do
        for j in 0 .. m - 1 do
            tr2 <- tr2 + backtracking.[i].[j] * backtracking.[j].[i]
    Assert.True(tr2 > 0L, "the backtracking operator must have length-2 closed walks")
    // …while the true N₂, from both correct routes, is 0. The identity is exactly as strong as the
    // non-backtracking restriction. This is the CI check that the `f ≠ reverse(e)` guard is
    // load-bearing — not an author-reported suite-red count.
    let trueN2 = (IharaZeta.geodesicCountsFromZeta AdinkraIharaZeta.inverseZeta 2).[1]
    Assert.Equal(bi 0, trueN2)

// ── 7. THE HONEST CAVEAT, MADE MECHANICAL ───────────────────────────────────────────────────────

[<Fact>]
let ``THE CAVEAT, PROVEN: the Ihara zeta cannot see the adinkra's dashing or heights - it is a function of the TOPOLOGY alone`` () =
    // The supersymmetry content of an adinkra lives in the edge dashing (the signs of the Q_I) and
    // the height assignment (bosons vs fermions and their engineering dimensions). The Ihara zeta is
    // built from the adjacency matrix and nothing else, so any two adinkras with the same underlying
    // graph — different dashings, different heights, genuinely different supermultiplets — have the
    // SAME zeta. Demonstrated by relabelling the vertices: an arbitrary permutation of the node
    // labels is a different presentation of the same topology, and the zeta is unmoved.
    //
    // This is the mechanical form of the caveat in the module docstring: this computation is about
    // the QUOTIENT GRAPH, and is SILENT on whether the Euler product enumerates irreducibles of the
    // unfolding. A dashing-sensitive zeta would need a different (signed / edge-coloured) operator.
    let n = AdinkraIharaZeta.nodes
    // A fixed, deterministic non-identity permutation (no ambient entropy).
    let perm = Array.init n (fun i -> (5 * i + 3) % n)
    Assert.Equal(n, perm |> Array.distinct |> Array.length)
    let relabelled =
        Array.init n (fun i -> Array.init n (fun j -> AdinkraIharaZeta.adjacency.[perm.[i]].[perm.[j]]))
    Assert.True(
        IharaZeta.polyEqual (IharaZeta.inverseZeta relabelled) AdinkraIharaZeta.inverseZeta,
        "the Ihara zeta must be a graph invariant")
    // The invariant is not vacuous, though: a genuinely different 16-node adinkra topology — the
    // plain 4-cube of `AdinkraViz` (N = 4, 4-regular, 32 edges) — has a different zeta. So the zeta
    // DOES separate topologies; it just cannot see anything finer than topology.
    let hypercube4 =
        Array.init 16 (fun i ->
            Array.init 16 (fun j ->
                let x = i ^^^ j
                if x <> 0 && (x &&& (x - 1)) = 0 then 1 else 0))
    Assert.True(IharaZeta.regularDegree hypercube4 = Some 4, "the 4-cube must be 4-regular")
    Assert.False(
        IharaZeta.polyEqual (IharaZeta.inverseZeta hypercube4) AdinkraIharaZeta.inverseZeta,
        "the 4-cube and the [8,4]-code adinkra must have different zetas")
