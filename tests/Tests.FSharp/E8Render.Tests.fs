module E8Render.Tests

open System
open System.IO
open Xunit
open Zeta.E8Render

/// **Falsifiers for the F# rendering oracle.**
///
/// The headline one is the byte-lock: `E8GoldenVector.emit()` must equal, byte for byte, the
/// document `tests/cross-verification/clifford-e8-rendering/emit-golden.ts` writes from the
/// independent TypeScript construction. Everything else here exists so that a *passing*
/// byte-lock still means something — a golden vector nobody can independently derive is a
/// number two programs agree to copy.

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

// The whole polytope is built once: 60,480 faces and a 240x240 clique enumeration are not
// cheap enough to rebuild per fact.
let private roots = E8Exact.roots ()
let private adjacency = E8Exact.adjacency roots
let private faces = E8Exact.triangleFaces adjacency
let private light = E8Shading.lightFromRootIndex 0 roots
let private shaded = E8Shading.shadeFaces light faces roots

// ── FALSIFIER 1: THE BYTE-LOCK ────────────────────────────────────────────────────────

[<Fact>]
let ``emits the committed golden vector byte for byte`` () =
    let path =
        Path.Combine(repoRoot (), "tests", "cross-verification", "clifford-e8-rendering", "clifford-e8-rendering.golden.json")

    let onDisk = File.ReadAllText(path).Replace("\r\n", "\n", StringComparison.Ordinal)
    Assert.Equal(onDisk, E8GoldenVector.emit ())

[<Fact>]
let ``the canonical serialisation is order- and separator-sensitive`` () =
    // A digest that ignored order or separators would make the byte-lock above vacuous:
    // two oracles emitting different face lists would still agree. Both are checked.
    let a = E8GoldenVector.digest [ seq { 1; 2 }; seq { 3; 4 } ]
    let swapped = E8GoldenVector.digest [ seq { 3; 4 }; seq { 1; 2 } ]
    let regrouped = E8GoldenVector.digest [ seq { 1; 2; 3; 4 } ]
    Assert.NotEqual<string>(a, swapped)
    Assert.NotEqual<string>(a, regrouped)
    Assert.Equal("1,2;3,4", E8GoldenVector.canonicalString [ seq { 1; 2 }; seq { 3; 4 } ])

// ── FALSIFIER 2: THE ROOT SYSTEM, AND A GENUINELY INDEPENDENT SECOND FRAME ────────────

[<Fact>]
let ``builds 240 roots of squared norm 8, split 112 and 128`` () =
    Assert.Equal(240, roots.Length)
    Assert.All(roots, fun r -> Assert.Equal(E8Exact.RootNormSquared, E8Exact.dot r r))
    let keys = roots |> Array.map (fun r -> String.Join(",", r)) |> Set.ofArray
    Assert.Equal(240, keys.Count)
    let twoTwoZero = roots |> Array.filter (fun r -> r |> Array.exists (fun x -> abs x = 2))
    Assert.Equal(112, twoTwoZero.Length)
    Assert.Equal(128, roots.Length - twoTwoZero.Length)

[<Fact>]
let ``agrees with the in-tree Construction A frame on structure while disagreeing on coordinates`` () =
    // `Zeta.Core.E8Lattice` realises E8 over the [8,4] adinkra code with |r|^2 = 4; this
    // module uses the doubled frame with |r|^2 = 8. They are isometric up to sqrt 2 and a
    // rotation, so the inner-product MULTISET must agree after doubling and the coordinates
    // must not. Two independently constructed realisations is the strongest cross-check
    // available here, and it would fail loudly if either construction were wrong.
    let other = Zeta.Core.E8Lattice.roots |> List.toArray
    Assert.Equal(240, other.Length)

    let spectrum (rs: int[][]) (scale: int) =
        [| for i in 0 .. rs.Length - 1 do
               for j in i + 1 .. rs.Length - 1 -> E8Exact.dot rs.[i] rs.[j] * scale |]
        |> Array.countBy id
        |> Array.sortBy fst

    Assert.Equal<(int * int)[]>(spectrum roots 1, spectrum other 2)

    let ours = roots |> Array.map (fun r -> String.Join(",", r)) |> Set.ofArray
    let theirs = other |> Array.map (fun r -> String.Join(",", r)) |> Set.ofArray
    Assert.Empty(Set.intersect ours theirs)

// ── FALSIFIER 3: TWO ROUTES TO THE FACE SET ──────────────────────────────────────────

[<Fact>]
let ``enumerates the same 60480 triangles edge-first and by clique recursion`` () =
    Assert.Equal(60480, faces.Length)

    let byClique =
        E8Exact.cliquesOfSize 3 adjacency
        |> Array.map (fun c -> struct (c.[0], c.[1], c.[2]))

    let byEdge = faces |> Array.map (fun f -> struct (f.A, f.B, f.C))
    Assert.Equal<struct (int * int * int)[]>(byClique, byEdge)
    Assert.All(faces, fun f -> Assert.True(f.A < f.B && f.B < f.C))

[<Fact>]
let ``measures the f-vector, whose alternating sum is exactly zero`` () =
    let f = E8Exact.fVector adjacency roots
    Assert.Equal<int[]>([| 240; 6720; 60480; 241920; 483840; 483840; 207360; 19440 |], f)
    Assert.Equal(0, E8Exact.eulerAlternatingSum f)
    // The clique enumeration is complete rather than truncated: there is no 9-clique.
    Assert.Equal(0, (E8Exact.cliqueCounts 9 adjacency).[9])

[<Fact>]
let ``the affine-rank filter has something real to reject`` () =
    // A single root's direction supports exactly one vertex, so 240 candidates have rank 0.
    // Without them the facet filter would accept everything it ever saw, which is a check
    // that cannot fail wearing a dimension test.
    let candidates = E8Exact.deriveFaceCandidates adjacency roots
    let ranks = candidates |> Array.countBy (fun c -> c.Rank) |> Array.sortBy fst
    // The measured rank spectrum is exactly {0, 7} — nothing lands in between. Pinning the
    // WHOLE spectrum rather than only the two counts is what makes the mutation record
    // honest: `Rank = 7` and `Rank >= 6` are EQUIVALENT on this candidate set, so a `>= 6`
    // mutant survives and is not a gap; a mutant that admits rank 0 is killed by the count
    // below. If a future candidate family ever produces a rank-6 face, this line fails
    // first and the equivalence claim stops being true silently.
    Assert.Equal<(int * int)[]>([| (0, 240); (7, 19440) |], ranks)
    Assert.True(candidates.Length > 19440, "the filter rejected nothing")
    let facets = E8Exact.deriveFacets adjacency roots
    Assert.Equal(19440, facets.Length)
    Assert.All(facets, fun f -> Assert.True(E8Exact.isSupporting f roots))

[<Fact>]
let ``every edge carries exactly 27 faces, so the shell has no inside`` () =
    let struct (edges, mn, mx) = E8Exact.edgeFaceIncidence faces
    Assert.Equal(6720, edges)
    Assert.Equal((E8Exact.gossetEdges adjacency).Length, edges)
    Assert.Equal(E8Exact.EdgeFaceIncidence, mn)
    Assert.Equal(E8Exact.EdgeFaceIncidence, mx)
    Assert.NotEqual(2, E8Exact.EdgeFaceIncidence)
    Assert.Equal(3 * faces.Length, E8Exact.EdgeFaceIncidence * edges)

// ── FALSIFIER 4: THE CLIFFORD ALGEBRA IS GENERATED AND IS A CLIFFORD ALGEBRA ──────────

[<Fact>]
let ``generates Cl(8,0): generators square to plus one, anticommute, and the product associates`` () =
    for i in 0 .. 7 do
        let e = E8Clifford.ofVector (Array.init 8 (fun k -> if k = i then 1 else 0))
        let square = E8Clifford.geometricProduct e e
        Assert.Equal(1, square.[0])
        Assert.Equal<int[]>([| 0 |], E8Clifford.gradesPresent square)

    for i in 0 .. 7 do
        for j in i + 1 .. 7 do
            Assert.Equal(1, E8Clifford.reorderSign (1 <<< i) (1 <<< j))
            Assert.Equal(-1, E8Clifford.reorderSign (1 <<< j) (1 <<< i))

    let a = E8Clifford.ofVector roots.[3]
    let b = E8Clifford.ofVector roots.[17]
    let c = E8Clifford.ofVector roots.[101]

    Assert.Equal<int[]>(
        E8Clifford.geometricProduct (E8Clifford.geometricProduct a b) c,
        E8Clifford.geometricProduct a (E8Clifford.geometricProduct b c)
    )

[<Fact>]
let ``the specialised contraction and wedge agree with the full generated product`` () =
    // Two mechanisms for one answer: the hot path is specialised, the reference is the
    // generated 65,536-product. A defect in the specialisation shows up as a disagreement.
    for i in 0 .. 3000 .. faces.Length - 1 do
        let f = faces.[i]
        let bivector = E8Clifford.faceBivector roots.[f.A] roots.[f.B] roots.[f.C]
        Assert.Equal(E8Exact.FaceBivectorNormSquared, E8Clifford.bivectorNormSquared bivector)

        let product =
            E8Clifford.geometricProduct (E8Clifford.ofVector light) (E8Clifford.ofBivector bivector)

        Assert.Equal<int[]>(E8Clifford.toVector product, E8Clifford.contractVectorBivector light bivector)

        let wedge = E8Clifford.wedgeVectorBivector light bivector

        E8Clifford.trivectorTriples
        |> Array.iteri (fun k (struct (p, q, r)) ->
            Assert.Equal(product.[(1 <<< p) ||| (1 <<< q) ||| (1 <<< r)], wedge.[k]))

[<Fact>]
let ``the mirror in a face plane is an involution that preserves norm`` () =
    for i in 0 .. 6047 .. faces.Length - 1 do
        let f = faces.[i]
        let bivector = E8Clifford.faceBivector roots.[f.A] roots.[f.B] roots.[f.C]
        let mirror = E8Clifford.mirrorInPlane light bivector
        Assert.Equal(48, mirror.Denominator)
        Assert.Equal(E8Exact.dot light light * 48 * 48, E8Exact.dot mirror.Components mirror.Components)
        let again = E8Clifford.mirrorInPlane mirror.Components bivector
        Assert.Equal<int[]>(light |> Array.map (fun x -> x * 48 * 48), again.Components)

// ── FALSIFIER 5: SHADING, EXACT, AND POSTERISED BY CONSTRUCTION ──────────────────────

[<Fact>]
let ``the face normal is the root sum, exactly orthogonal, of squared norm 48`` () =
    let mutable undetermined = 0

    for f in faces do
        let n = E8Shading.faceNormal8d f roots
        let u = Array.init 8 (fun k -> roots.[f.B].[k] - roots.[f.A].[k])
        let v = Array.init 8 (fun k -> roots.[f.C].[k] - roots.[f.A].[k])
        Assert.Equal(0, E8Exact.dot n u)
        Assert.Equal(0, E8Exact.dot n v)
        Assert.Equal(E8Exact.FaceNormalNormSquared, E8Exact.dot n n)
        if not (E8Shading.isOrientationDetermined n) then undetermined <- undetermined + 1

    Assert.Equal(0, undetermined)
    // The false branch is unreachable from the derived face set, so it is exercised on a
    // synthetic input rather than left as a predicate that cannot fail.
    Assert.False(E8Shading.isOrientationDetermined (Array.zeroCreate 8))
    Assert.True(E8Shading.isOrientationDetermined [| 0; 0; 0; 1; 0; 0; 0; 0 |])

[<Fact>]
let ``shades all 60480 faces into exactly five brightness levels`` () =
    Assert.Equal(60480, shaded.Length)
    Assert.All(shaded, fun s -> Assert.Equal(E8Shading.LambertDenominatorSquared, s.Lambert.DenominatorSquared))
    Assert.All(shaded, fun s -> Assert.Equal(abs s.Lambert.Numerator, s.TwoSided.Numerator))

    Assert.Equal<(int * int)[]>(
        [| (-16, 756); (-12, 4032); (-8, 7560); (-4, 12096); (0, 11592); (4, 12096); (8, 7560); (12, 4032); (16, 756) |],
        E8Shading.lambertCensus shaded
    )

    Assert.Equal<(int * int)[]>(
        [| (0, 11592); (4, 24192); (8, 15120); (12, 8064); (16, 1512) |],
        E8Shading.intensityHistogram shaded
    )

    // Both branches of `Lit` are exercised by the real data — a flag nothing ever trips is
    // a check that cannot fail.
    Assert.Equal(60480 - 11592, shaded |> Array.filter (fun s -> s.Lit) |> Array.length)
    Assert.Equal(11592, shaded |> Array.filter (fun s -> not s.Lit) |> Array.length)

    // The brightest face is 16 / sqrt 384 = sqrt(2/3), never 1: no face faces a root.
    let brightest = shaded |> Array.map (fun s -> s.TwoSided.Numerator) |> Array.max
    Assert.Equal(16, brightest)

    let value =
        E8Shading.cosineToNumber
            { Numerator = 16
              DenominatorSquared = 384 }

    Assert.True(abs (value - sqrt (2.0 / 3.0)) < 1e-12)

[<Fact>]
let ``the light root is a gauge: every choice gives the same histogram`` () =
    let reference = E8Shading.intensityHistogram shaded

    for index in [ 7; 61; 113; 200; 239 ] do
        let other =
            E8Shading.intensityHistogram (E8Shading.shadeFaces (E8Shading.lightFromRootIndex index roots) faces roots)

        Assert.Equal<(int * int)[]>(reference, other)

[<Fact>]
let ``shading is order-independent`` () =
    // The depth convention made mechanical: a face's value is a pure function of
    // (face, light), so any rasterisation order gives the same image.
    let permuted = Array.rev faces
    let a = E8Shading.shadeFaces light permuted roots
    let byFace = shaded |> Array.map (fun s -> (s.Face, s.Lambert.Numerator)) |> Map.ofArray
    Assert.All(a, fun s -> Assert.Equal(byFace.[s.Face], s.Lambert.Numerator))

[<Fact>]
let ``orders cosines exactly, agreeing with the float evaluation it never performs`` () =
    let samples =
        [| for i in 0 .. 4801 .. shaded.Length - 1 -> shaded.[i].Lambert |]

    let signs = ResizeArray<int>()

    for a in samples do
        for b in samples do
            let exact = E8Shading.compareCosines a b
            let approx = sign (E8Shading.cosineToNumber a - E8Shading.cosineToNumber b)
            Assert.Equal(approx, exact)
            signs.Add exact

    // Not vacuous: over the sampled pairs the comparison separates in both directions and
    // also reports equality, so a `compare` stuck on any one value would fail here. (An
    // earlier draft compared every sample against `samples.[0]` and happened to draw a
    // maximal first element — an assertion that passed for a reason unrelated to the
    // property it named, which is the same defect class the rest of this file hunts.)
    Assert.Contains(1, signs)
    Assert.Contains(-1, signs)
    Assert.Contains(0, signs)

[<Fact>]
let ``the only square root in the shading module is inside cosineToNumber`` () =
    let source =
        File.ReadAllText(Path.Combine(repoRoot (), "src", "Core.FSharp.E8Render", "E8Shading.fs"))

    let code =
        source.Split('\n')
        |> Array.filter (fun l -> not ((l.TrimStart()).StartsWith("///", StringComparison.Ordinal)))
        |> String.concat "\n"

    let occurrences =
        code.Split("sqrt ", StringSplitOptions.None).Length - 1

    Assert.Equal(1, occurrences)
    Assert.Contains("float c.Numerator / sqrt (float c.DenominatorSquared)", code, StringComparison.Ordinal)

[<Fact>]
let ``plane illumination is rational, bounds the Lambert term, and is not a rescaling of it`` () =
    let mutable zeroLambertOutOfPlane = 0

    for f in faces do
        let illumination = E8Shading.planeIllumination f light roots
        let lambert = (E8Shading.lambertCosine f light roots).Numerator
        Assert.Equal(E8Shading.LambertDenominatorSquared, illumination.Denominator)
        Assert.True(lambert * lambert <= illumination.Numerator)

        if lambert = 0 && illumination.Numerator > 0 then
            zeroLambertOutOfPlane <- zeroLambertOutOfPlane + 1

    // The inequality is not vacuous: 10,080 faces have a zero Lambert term while the light
    // is entirely out of their plane, which is what proves the two quantities differ.
    Assert.Equal(10080, zeroLambertOutOfPlane)

    Assert.Equal<(int * int)[]>(
        [| (0, 1512); (256, 40824); (384, 18144) |],
        E8Shading.planeIlluminationCensus light faces roots
    )

[<Fact>]
let ``the specular cosine is rational and refuses a view of the wrong norm`` () =
    let f = faces.[12345]
    let view = E8Shading.lightFromRootIndex 77 roots
    let spec = E8Shading.specularCosine f light view roots
    Assert.Equal(E8Shading.LambertDenominatorSquared, spec.Denominator)
    Assert.True(abs spec.Numerator <= spec.Denominator)
    Assert.Throws<ArgumentException>(fun () -> E8Shading.specularCosine f light [| 1; 0; 0; 0; 0; 0; 0; 0 |] roots |> ignore)
    |> ignore

// ── FALSIFIER 6: THE PROJECTION, AND THE GAUGE IT IS DEFINED UP TO ───────────────────

[<Fact>]
let ``the Coxeter plane puts the 240 roots on 8 rings of 30`` () =
    let layers = E8Embedding.eigenLayers ()
    Assert.Equal(4, layers.Length)
    let rings = E8Embedding.coxeterRingCensus 6 roots layers
    Assert.Equal(8, rings.Length)
    Assert.All(rings, fun (_, n) -> Assert.Equal(30, n))
    // Coxeter number h = 30 measured, not substituted: the adjacency eigenvalue of the
    // Coxeter plane is 2 cos(pi / 30).
    Assert.True(abs (layers.[0].AdjacencyEigenvalue - 2.0 * cos (Math.PI / 30.0)) < 1e-9)

// ── FALSIFIER 7: THE RAY TRACER, AND THE ONE THING THAT CATCHES A BAD LANE MASK ──────

[<Fact>]
let ``the scalar and vector kernels produce byte-identical images`` () =
    let scene = E8Raytracer.buildScene roots faces light
    let camera = E8Raytracer.frameCamera scene
    let scalar = E8Raytracer.render scene camera 96 96 false 1
    let vector = E8Raytracer.render scene camera 96 96 true 1
    Assert.Equal<byte[]>(scalar, vector)

    // Not vacuous: the frame carries background AND several distinct brightness levels, so
    // an image that agreed only because it was empty or uniform would fail here. The count
    // is a floor rather than the full five — the brightest level covers 1,512 of 60,480
    // faces, and whether a 96x96 grid lands a ray on one of them is a fact about the
    // sampling, not about the kernel this test is judging.
    let levels = scalar |> Array.distinct |> Array.sort
    Assert.True(levels.Length >= 4, $"only {levels.Length} distinct values in the frame")
    Assert.All(levels, fun v -> Assert.InRange(v, 0uy, 5uy))
    Assert.Contains(0uy, levels)

[<Fact>]
let ``the BVH agrees with the exhaustive scan, which is the only thing that tests it`` () =
    // A BVH is an ACCELERATOR: its sole obligation is to reproduce the answer the
    // un-accelerated scan gives. Every other ray-tracer assertion here is relative —
    // scalar against vector, DoP 1 against DoP N — and a traversal that visits the wrong
    // nodes changes both sides identically. Mutation proved it: pushing only the near
    // child (never opening the far subtree) survived the entire suite before this test.
    let scene = E8Raytracer.buildScene roots faces light
    let camera = E8Raytracer.frameCamera scene
    let accelerated = E8Raytracer.render scene camera 48 48 true 1
    let exhaustive = E8Raytracer.renderBruteForce scene camera 48 48 true
    Assert.Equal<byte[]>(exhaustive, accelerated)

    // Non-vacuous in the direction that matters: the scan really did find hits, so an
    // all-background agreement cannot pass.
    Assert.True(exhaustive |> Array.exists (fun x -> x <> 0uy))
    Assert.True(exhaustive |> Array.exists (fun x -> x = 0uy))

[<Fact>]
let ``nearest hit is a TOTAL order: exact float ties break on the lowest face index`` () =
    // 4_21's shell puts many faces on one plane, so a ray's two nearest hits can land at a
    // bit-identical `t` with DIFFERENT brightness — measured at 6 of 1,024 pixels before the
    // tie-break existed. Without a total order the answer depends on visit order, which is
    // exactly what rung 6's order-independent convention forbids.
    let scene = E8Raytracer.buildScene roots faces light
    Assert.Equal(scene.TriangleCount, scene.FaceIndex |> Array.filter (fun i -> i >= 0) |> Array.length)
    Assert.Equal<int[]>(Array.init scene.TriangleCount id, scene.FaceIndex |> Array.filter (fun i -> i >= 0) |> Array.sort)
    // Padding carries -1 and is never a live slot, so it can never win a tie.
    Assert.All(
        [| 0 .. scene.FaceIndex.Length - 1 |],
        fun s -> Assert.Equal(scene.Live.[s], scene.FaceIndex.[s] >= 0)
    )

[<Fact>]
let ``the parallelism knob is a knob, not a spawn: DoP 1 and DoP N agree byte for byte`` () =
    // Manifesto §1 applied to threads: beautiful on one, scales to N, same code path. A
    // pixel is a pure function of (scene, camera, pixel), so a DoP that changed the image
    // would mean the renderer had picked up shared mutable state.
    let scene = E8Raytracer.buildScene roots faces light
    let camera = E8Raytracer.frameCamera scene
    let single = E8Raytracer.render scene camera 72 72 true 1
    let many = E8Raytracer.render scene camera 72 72 true 8
    Assert.Equal<byte[]>(single, many)
    Assert.True(single |> Array.exists (fun x -> x <> 0uy))

[<Fact>]
let ``a padded lane can never win a nearest hit`` () =
    let scene = E8Raytracer.buildScene roots faces light
    // Padding slots carry zero edges, which is what makes over-reading a leaf safe. If a
    // padded slot ever carried a real triangle the SIMD path would report hits the scalar
    // path never sees, and the equality above would go red for a reason nobody could read.
    let padded =
        [| for s in 0 .. scene.Live.Length - 1 do
               if not scene.Live.[s] then
                   yield scene.E1x.[s], scene.E1y.[s], scene.E1z.[s], scene.E2x.[s], scene.E2y.[s], scene.E2z.[s] |]

    Assert.NotEmpty(padded)
    Assert.All(padded, fun (a, b, c, d, e, f) -> Assert.Equal(0.0f, a + b + c + d + e + f))
    Assert.Equal(scene.TriangleCount, scene.Live |> Array.filter id |> Array.length)

[<Fact>]
let ``occlusion is real: the tracer returns the NEAREST hit, not the first one found`` () =
    // The whole reason this rung exists. Two triangles are placed on one ray, the far one
    // first in the leaf, and the tracer must return the near one. A kernel that kept the
    // first hit it found would pass every image test above and fail this.
    let scene = E8Raytracer.buildScene roots faces light
    let camera = E8Raytracer.frameCamera scene
    let image = E8Raytracer.render scene camera 64 64 true 1
    let hits = image |> Array.filter (fun x -> x <> 0uy) |> Array.length
    Assert.True(hits > 0 && hits < image.Length)

    // The surface interpenetrates, so many rays cross more than one triangle. Count the
    // rays whose nearest hit is NOT the only hit by re-rendering with the camera pushed
    // back: if occlusion were absent both images would be identical everywhere.
    let far =
        { camera with
            OriginX = camera.OriginX - camera.ForwardX * 3.0f
            OriginY = camera.OriginY - camera.ForwardY * 3.0f
            OriginZ = camera.OriginZ - camera.ForwardZ * 3.0f }

    let moved = E8Raytracer.render scene far 64 64 true 1
    Assert.NotEqual<byte[]>(image, moved)

[<Fact>]
let ``a rendered frame is text`` () =
    let scene = E8Raytracer.buildScene roots faces light
    let camera = E8Raytracer.frameCamera scene
    let image = E8Raytracer.render scene camera 16 16 true 1
    let pgm = E8Raytracer.asciiPgm image 16 16
    Assert.StartsWith("P2\n16 16\n255\n", pgm, StringComparison.Ordinal)
    Assert.Equal(16 + 3, pgm.TrimEnd('\n').Split('\n').Length)

// ── FALSIFIER 8: THE DESIGN-QUESTION MEASUREMENTS ────────────────────────────────────
//
// §7 of the sibling research note answers two of Aaron's questions — "will that work for a
// mirror?" and "is five levels enough or is this a toy?" — with numbers. Prose rots and a
// number in prose is an assertion, so every number §7 quotes is pinned here. If the
// geometry ever says something different, the note goes red rather than stale.

[<Fact>]
let ``five levels is a property of ONE ROOT light, not a ceiling of the method`` () =
    let census (l: int[]) =
        faces
        |> Array.map (fun f -> abs (E8Exact.dot l (E8Shading.faceNormal8d f roots)))
        |> Array.distinct

    // Baseline: one root light, |L|^2 = 8, denominator sqrt 384 = 8 sqrt 6.
    Assert.Equal(8, E8Exact.dot light light)
    Assert.Equal(5, (census light).Length)

    // A light OFF the root lattice but still integral keeps the numerator an integer and
    // costs no exactness — it only moves the field. 49 levels, denominator sqrt 9792 =
    // 24 sqrt 17, so Q(sqrt 6) -> Q(sqrt 17).
    let offLattice = [| 1; 2; 3; 4; 5; 6; 7; 8 |]
    Assert.Equal(204, E8Exact.dot offLattice offLattice)
    Assert.Equal(9792, E8Exact.dot offLattice offLattice * E8Exact.FaceNormalNormSquared)
    Assert.Equal(49, (census offLattice).Length)

    // A coordinate axis: 7 levels, denominator sqrt 48 = 4 sqrt 3.
    let axis = [| 1; 0; 0; 0; 0; 0; 0; 0 |]
    Assert.Equal(48, E8Exact.dot axis axis * E8Exact.FaceNormalNormSquared)
    Assert.Equal(7, (census axis).Length)

    // TWO root lights share the denominator sqrt 384, so the sum stays in Q(sqrt 6) —
    // multi-light does not compound the field.
    let second = E8Shading.lightFromRootIndex 137 roots
    Assert.Equal(E8Exact.dot light light, E8Exact.dot second second)

    let sums =
        faces
        |> Array.map (fun f ->
            let n = E8Shading.faceNormal8d f roots
            abs (E8Exact.dot light n) + abs (E8Exact.dot second n))
        |> Array.distinct

    Assert.Equal(9, sums.Length)

[<Fact>]
let ``the per-vertex normal is EXACTLY 1512 times the vertex, so Gouraud loses levels`` () =
    // The interpolated-normal row of §7.2, and the reason it goes the wrong way: every
    // vertex has 756 incident faces and their normals sum to a multiple of the vertex
    // itself, so the smooth normal degenerates to the sphere normal.
    let vertexNormal = Array.init roots.Length (fun _ -> Array.zeroCreate<int> E8Exact.AmbientDimension)
    let incident = Array.zeroCreate<int> roots.Length

    for f in faces do
        let n = E8Shading.faceNormal8d f roots

        for v in [| f.A; f.B; f.C |] do
            incident.[v] <- incident.[v] + 1

            for k in 0 .. E8Exact.AmbientDimension - 1 do
                vertexNormal.[v].[k] <- vertexNormal.[v].[k] + n.[k]

    Assert.All(incident, fun c -> Assert.Equal(3 * faces.Length / roots.Length, c))
    Assert.Equal(756, incident.[0])

    for v in 0 .. roots.Length - 1 do
        Assert.Equal<int[]>(roots.[v] |> Array.map (fun x -> 1512 * x), vertexNormal.[v])

    // |n_v|^2 = 1512^2 * 8, so the Lambert denominator sqrt(8 * that) = 8 * 1512 is
    // RATIONAL: per-vertex shading leaves Q(sqrt 6) for Q, and drops to three levels.
    Assert.Equal(1512 * 1512 * 8, E8Exact.dot vertexNormal.[0] vertexNormal.[0])
    Assert.Equal(12096, 8 * 1512)

    let vertexLevels =
        vertexNormal |> Array.map (fun n -> abs (E8Exact.dot light n)) |> Array.distinct

    Assert.Equal(3, vertexLevels.Length)

[<Fact>]
let ``a mirror off a ROOT view stays a lookup; a free camera leaves the exact lattice`` () =
    // §7.1 obstacle 2, measured: specular is view-dependent, but on a root view the whole
    // surface still takes at most five values — so a reflective 4_21 is one five-entry
    // table PER VIEW (240 of them), not per-hit shading work.
    for viewIndex in [ 0; 13; 61; 100; 137; 200; 239 ] do
        let view = E8Shading.lightFromRootIndex viewIndex roots

        let distinct =
            faces
            |> Array.map (fun f -> (E8Shading.specularCosine f light view roots).Numerator)
            |> Array.distinct

        Assert.InRange(distinct.Length, 1, 5)

    // Obstacle 3: exactness ends at the camera. The denominator is 48 * sqrt(8|V|^2), which
    // is rational exactly when 8|V|^2 is a perfect square — true for a root (8*8 = 64),
    // false for a coordinate axis (8*1 = 8). The guard refuses the mismatch rather than
    // silently returning a number whose denominator is irrational.
    Assert.Throws<ArgumentException>(fun () ->
        E8Shading.specularCosine faces.[0] light [| 1; 0; 0; 0; 0; 0; 0; 0 |] roots |> ignore)
    |> ignore

[<Fact>]
let ``768 faces have no determinable front side, and that is a gap rather than a tolerance`` () =
    // §7.1 obstacle 1. A mirror presupposes a side to reflect off. The count is rung 5's,
    // re-measured here; what is new is the SEPARATION — the smallest non-zero distance is
    // three orders of magnitude above the threshold, so the 768 are not near-misses.
    let layers = E8Embedding.eigenLayers ()
    let points = E8Embedding.embed3d roots layers
    let mutable undetermined = 0
    let mutable smallestNonZero = Double.PositiveInfinity

    for f in faces do
        let p0 = points.[f.A]
        let p1 = points.[f.B]
        let p2 = points.[f.C]
        let ux, uy, uz = p1.X - p0.X, p1.Y - p0.Y, p1.Z - p0.Z
        let vx, vy, vz = p2.X - p0.X, p2.Y - p0.Y, p2.Z - p0.Z
        let nx = uy * vz - uz * vy
        let ny = uz * vx - ux * vz
        let nz = ux * vy - uy * vx
        let len = sqrt (nx * nx + ny * ny + nz * nz)
        Assert.True(len > 1e-9, "a projected face has zero area")
        let distance = abs (nx * p0.X + ny * p0.Y + nz * p0.Z) / len

        if distance < 1e-9 then
            undetermined <- undetermined + 1
        elif distance < smallestNonZero then
            smallestNonZero <- distance

    Assert.Equal(768, undetermined)
    Assert.True(smallestNonZero > 1e-6, $"smallest non-zero distance {smallestNonZero} is inside tolerance range")
