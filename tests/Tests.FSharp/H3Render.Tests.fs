module H3Render.Tests

open System
open System.IO
open System.Numerics
open Xunit
open Zeta.E8Render

/// **Falsifiers for the F# rank-3 oracle.**
///
/// The headline one is the byte-lock: `H3GoldenVector.emit()` must equal, byte for byte, the
/// document `tests/cross-verification/h3-rank3-geometry/emit-golden.ts` writes from the
/// independent TypeScript construction. Everything else exists so that a *passing* byte-lock
/// still means something — a golden vector nobody can independently derive is a number two
/// programs agree to copy.
///
/// The question these tests exist to answer is the one the graphics/physics roadmap named as
/// gating Phase 0: **does exact shading survive the descent from E8 to H3?** The answer is
/// measured, per facet type, by `the Lambert cosine over triangular facets closes over
/// Q(phi, sqrt 3)` and by its NEGATIVE sibling for pentagons and decagons.

let private tryFindRepoRoot (startPath: string) =
    if String.IsNullOrWhiteSpace startPath then
        None
    else
        try
            let mutable dir = DirectoryInfo(startPath)

            while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
                dir <- dir.Parent

            if isNull dir then None else Some dir.FullName
        with
        | :? ArgumentException
        | :? NotSupportedException
        | :? PathTooLongException -> None

let private repoRoot () =
    [ Environment.GetEnvironmentVariable("ZETA_REPO_ROOT")
      Environment.GetEnvironmentVariable("GITHUB_WORKSPACE")
      AppContext.BaseDirectory
      Directory.GetCurrentDirectory() ]
    |> List.tryPick tryFindRepoRoot
    |> Option.defaultWith (fun () -> failwith "Could not locate repo root (Zeta.sln).")

/// Coxeter's f-vectors — the EXTERNAL figures the derivation is compared against. A
/// construction compared only to itself proves that it is self-consistent and nothing else.
let private coxeterFVectors =
    dict
        [ H3Exact.Icosahedron, [| 12; 30; 20 |]
          H3Exact.Dodecahedron, [| 20; 30; 12 |]
          H3Exact.Icosidodecahedron, [| 30; 60; 32 |]
          H3Exact.TruncatedIcosidodecahedron, [| 120; 180; 62 |] ]

// ── FALSIFIER 1: THE BYTE-LOCK ────────────────────────────────────────────────────────

[<Fact>]
let ``emits the committed golden vector byte for byte`` () =
    let path =
        Path.Combine(repoRoot (), "tests", "cross-verification", "h3-rank3-geometry", "h3-rank3-geometry.golden.json")

    let onDisk = File.ReadAllText(path).Replace("\r\n", "\n", StringComparison.Ordinal)
    Assert.Equal(onDisk, H3GoldenVector.emit ())

[<Fact>]
let ``the canonical serialisation is order- and separator-sensitive`` () =
    // A digest that ignored order or separators would make the byte-lock above vacuous: two
    // oracles emitting different vertex lists would still agree.
    let one = seq { BigInteger(1); BigInteger(2) }
    let two = seq { BigInteger(3); BigInteger(4) }
    let a = H3GoldenVector.digest [ one; two ]
    let swapped = H3GoldenVector.digest [ two; one ]
    let regrouped = H3GoldenVector.digest [ Seq.append one two ]
    Assert.NotEqual<string>(a, swapped)
    Assert.NotEqual<string>(a, regrouped)
    Assert.Equal("1,2;3,4", H3GoldenVector.canonicalString [ one; two ])

// ── FALSIFIER 2: THE RING, AND THAT REFLECTIONS NEVER LEAVE IT ────────────────────────

[<Fact>]
let ``every H3 root has squared norm exactly 4, with no phi component`` () =
    let roots = H3Exact.roots ()
    Assert.Equal(30, roots.Length)

    for r in roots do
        Assert.Equal(H3Exact.rootNormSquared, H3Exact.zDot r r)

[<Fact>]
let ``no reflection leaves Z[phi] on any of the four solids`` () =
    for s in H3Exact.solids do
        Assert.Equal(0, (H3Exact.polytope s).NonIntegralReflections)

[<Fact>]
let ``a seed off the integral lattice REPORTS its failed reflections rather than truncating`` () =
    // The defect this guards: a silent skip closes a smaller orbit and reports a different
    // polytope as though it were the whole one.
    let offLattice = [| H3Exact.zInt 1; H3Exact.zInt 0; H3Exact.zInt 0 |]
    let result = H3Exact.orbit offLattice
    Assert.True(result.NonIntegralReflections > 0)
    Assert.True(result.Points.Length < 12)

// ── FALSIFIER 3: THE COMBINATORICS, AGAINST COXETER ───────────────────────────────────

[<Fact>]
let ``every solid reproduces Coxeter's f-vector and has Euler characteristic 2`` () =
    for s in H3Exact.solids do
        let p = H3Exact.polytope s
        Assert.Equal<int[]>(coxeterFVectors.[s], p.FVector)
        Assert.Equal(2, p.Euler)

[<Fact>]
let ``EVERY edge carries exactly two facets — the surface has a side, unlike 4_21's 27`` () =
    for s in H3Exact.solids do
        let p = H3Exact.polytope s
        Assert.Equal(2, p.Incidence.Min)
        Assert.Equal(2, p.Incidence.Max)

[<Fact>]
let ``the incidence counter CAN report something other than two`` () =
    // Without this the assertion above is satisfied by a counter that returns 2 unconditionally.
    let p = H3Exact.polytope H3Exact.Icosahedron
    let holed = p.Facets.[1..]
    let incidence = H3Exact.incidence p.Points holed p.Edges
    Assert.Equal(1, incidence.Min)
    Assert.Equal(2, incidence.Max)

// ── FALSIFIER 4: THE VERTEX-SUM NORMAL, TWO MECHANISMS ────────────────────────────────

[<Fact>]
let ``the vertex sum is orthogonal to every facet edge and parallel to the cross-product normal`` () =
    for s in H3Exact.solids do
        let p = H3Exact.polytope s

        for facet in p.Facets do
            let baseVertex = p.Points.[facet.Vertices.[0]]

            for v in facet.Vertices.[1..] do
                Assert.True(H3Exact.zIsZero (H3Exact.zDot facet.Normal (H3Exact.zVecSub p.Points.[v] baseVertex)))

            Assert.True(H3Exact.zVecIsZero (H3Exact.zCross facet.Normal facet.PlaneNormal))
            Assert.False(H3Exact.zVecIsZero facet.Normal)

// ── FALSIFIER 5: THE LIGHT — the question the roadmap named as gating Phase 0 ──────────

[<Fact>]
let ``the icosahedron's normal norm is 12 + 12 phi and its radical is (2 phi) sqrt 3`` () =
    let p = H3Exact.polytope H3Exact.Icosahedron
    let n2 = p.Facets.[0].NormalNormSquared
    Assert.Equal(H3Exact.zOf 12 12, n2)

    match H3Exact.normalRadical n2 with
    | Some r ->
        Assert.Equal(3, r.Radicand)
        Assert.Equal(H3Exact.zOf 0 2, r.Coefficient)
    | None -> failwith "the icosahedron's normal norm did not factor"

[<Fact>]
let ``the Lambert cosine over TRIANGULAR facets closes over Q(phi, sqrt 3) — one named irrational`` () =
    for s in [ H3Exact.Icosahedron; H3Exact.Icosidodecahedron ] do
        let p = H3Exact.polytope s

        for facet in p.Facets |> Array.filter (fun f -> f.Vertices.Length = 3) do
            for light in [ H3Exact.rootLight 0; H3Exact.integralLight ] do
                Assert.Equal(Some 3, H3Exact.cosineRadicand light facet.Normal)

[<Fact>]
let ``the NEGATIVE result is stated: pentagonal normals have no single rational radical`` () =
    let p = H3Exact.polytope H3Exact.Dodecahedron
    Assert.Equal(H3Exact.zOf 60 80, p.Facets.[0].NormalNormSquared)
    Assert.Equal(None, H3Exact.normalRadical p.Facets.[0].NormalNormSquared)
    Assert.Equal(None, H3Exact.cosineRadicand (H3Exact.rootLight 0) p.Facets.[0].Normal)

[<Fact>]
let ``the light gauge is discharged: all 30 roots give the same intensity multiset`` () =
    let p = H3Exact.polytope H3Exact.Icosahedron

    let signature (light: H3Exact.VecZphi) =
        p.Facets
        |> Array.map (fun f -> H3Exact.zAbs (H3Exact.lambertNumerator light f.Normal))
        |> Array.sortWith H3Exact.zCompare
        |> Array.map (fun v -> sprintf "%O,%O" v.A v.B)
        |> String.concat "|"

    let reference = signature (H3Exact.rootLight 0)

    for i in 1..29 do
        Assert.Equal<string>(reference, signature (H3Exact.rootLight i))

[<Fact>]
let ``a NON-root integral light saturates: one exact level per facet, at no cost in exactness`` () =
    for s in H3Exact.solids do
        let p = H3Exact.polytope s
        let census = H3Exact.shadeFacets H3Exact.integralLight p.Facets
        Assert.Equal(p.Facets.Length, census.SignedLevels.Length)
        Assert.Equal(0, census.TerminatorFacets)

[<Fact>]
let ``the integral light has a RATIONAL norm, which is why it costs no exactness`` () =
    Assert.Equal(H3Exact.zOf 49 0, H3Exact.zDot H3Exact.integralLight H3Exact.integralLight)

    match H3Exact.normalRadical (H3Exact.zOf 49 0) with
    | Some r ->
        Assert.Equal(1, r.Radicand)
        Assert.Equal(H3Exact.zOf 7 0, r.Coefficient)
    | None -> failwith "49 did not factor as a perfect square"

// ── FALSIFIER 6: THE EXACT ORDERING AND ITS SQUARE ROOTS ──────────────────────────────

[<Fact>]
let ``zSign has no equality case in the mixed branch — p^2 = 5q^2 forces p = q = 0`` () =
    let mutable hits = 0

    for p in -200 .. 200 do
        for q in -200 .. 200 do
            if p * p = 5 * q * q then
                Assert.Equal(0, p)
                Assert.Equal(0, q)
                hits <- hits + 1

    Assert.Equal(1, hits)

[<Fact>]
let ``zSqrt round-trips squares, refuses non-squares, and returns the POSITIVE root`` () =
    for a in -4 .. 4 do
        for b in -4 .. 4 do
            let s = H3Exact.zOf a b
            let square = H3Exact.zMul s s

            match H3Exact.zSqrt square with
            | Some r ->
                Assert.Equal(square, H3Exact.zMul r r)
                Assert.True(H3Exact.zSign r >= 0)
            | None -> failwith (sprintf "zSqrt refused a genuine square %O + %O phi" square.A square.B)

    // The refusal is the falsifier: a zSqrt that returned something for everything would pass
    // every round-trip above and be useless. Note `5` is EXCLUDED — it is `(2 phi - 1)^2` and
    // IS a square in this ring, which is also why a radicand of 5 never survives.
    for x in [ H3Exact.zOf 2 0; H3Exact.zOf 3 0; H3Exact.zOf 6 0; H3Exact.zOf 60 80 ] do
        Assert.Equal(None, H3Exact.zSqrt x)

    Assert.Equal(Some(H3Exact.zOf -1 2), H3Exact.zSqrt (H3Exact.zOf 5 0))

// ── FALSIFIER 7: THE SIMPLE SYSTEM IS DERIVED, NOT AUTHORED ───────────────────────────

[<Fact>]
let ``the simple roots reproduce the H3 Coxeter diagram and generate all 30 roots`` () =
    let a1, a2, a3 = H3Exact.simpleRoots ()
    Assert.Equal(0, H3Exact.zCompare (H3Exact.zDot a1 a2) H3Exact.simpleInnerProductFive)
    Assert.Equal(0, H3Exact.zCompare (H3Exact.zDot a2 a3) H3Exact.simpleInnerProductThree)
    Assert.True(H3Exact.zIsZero (H3Exact.zDot a1 a3))

    // Generation is the property that makes them SIMPLE, and it shares nothing with the
    // Gram-matrix search that found them.
    let simple = [| a1; a2; a3 |]
    let seen = System.Collections.Generic.Dictionary<string, H3Exact.VecZphi>()
    let stack = System.Collections.Generic.Stack<H3Exact.VecZphi>()

    for a in simple do
        seen.[H3Exact.zVecKey a] <- a
        stack.Push a

    while stack.Count > 0 do
        let x = stack.Pop()

        for a in simple do
            match H3Exact.reflect x a with
            | Some r ->
                let key = H3Exact.zVecKey r

                if not (seen.ContainsKey key) then
                    seen.[key] <- r
                    stack.Push r
            | None -> ()

    Assert.Equal(30, seen.Count)

[<Fact>]
let ``each fundamental weight is orthogonal to the other two simple roots and to neither of its own`` () =
    let simple = H3Exact.simpleRoots ()
    let w1, w2, w3 = H3Exact.fundamentalWeights ()
    let a1, a2, a3 = simple
    let weights = [| w1; w2; w3 |]
    let roots = [| a1; a2; a3 |]

    for i in 0..2 do
        for j in 0..2 do
            let value = H3Exact.zDot weights.[i] roots.[j]

            if i = j then Assert.False(H3Exact.zIsZero value)
            else Assert.True(H3Exact.zIsZero value)
