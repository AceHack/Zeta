namespace Zeta.E8Render

open System.Collections.Generic
open System.Numerics

/// **`E8Exact` — the F# ORACLE for the combinatorics of the Gosset polytope 4_21, in exact
/// integer arithmetic.**
///
/// This is not a port. `src/Core.TypeScript/research/clifford-e8-*.ts` is one oracle for the
/// same mathematics; this is a second one, and the two are judged against a committed
/// hex/decimal-in-JSON golden vector (`tests/cross-verification/clifford-e8-rendering/`).
/// Where they disagree, the disagreement is a finding — the repository already records that
/// the four language oracles do **not** agree by default and that agreement is *achieved*,
/// by a treaty, and then locked (`.claude/rules/culture-invariant-by-default.md`).
///
/// **The frame is the treaty.** Roots live in DOUBLED integer coordinates, so `|r|^2 = 8`:
///
///   - permutations of `(±2, ±2, 0^6)` — 112 of them
///   - `(±1)^8` with an EVEN number of minus signs — 128 of them
///
/// The in-tree `Zeta.Core.E8Lattice` uses a *different* integer frame (Construction A over
/// the [8,4] adinkra code, `|r|^2 = 4`). The two are isometric up to the scale factor
/// `sqrt 2` and a rotation, so every *combinatorial* invariant below must agree across both
/// frames while the coordinates themselves must not. `E8ExactTests` checks exactly that,
/// which is the strongest cross-check available: two independently constructed realisations
/// of the same root system, agreeing on structure and disagreeing on coordinates.
///
/// **Everything in this module is exact integer arithmetic.** No float appears; there is
/// nothing to round. The single irrational the shading model admits lives in `E8Shading`
/// and is named there.
///
/// Anchors (Beacon), cited because they are used:
///   - **Thorold Gosset** (1900) — the semiregular polytope 4_21.
///   - **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) — the f-vector this
///     module measures and the external figure the 60,480 is compared against.
///   - **Conway & Sloane**, *Sphere Packings, Lattices and Groups* — the E8 root system.
///   - **Pierre-Philippe Dechant**, *The E8 Geometry from a Clifford Perspective* (Adv. Appl.
///     Clifford Algebras 27, 2017) — the versor route `Zeta.Core.CliffordE8Roots` takes.
///   - **Coen Bron & Joep Kerbosch**, *Algorithm 457: finding all cliques of an undirected
///     graph* (CACM 16(9), 1973) — the clique enumeration `cliqueCounts` performs, in the
///     bitset-ordered form that emits each clique exactly once.
///   - **Erwin Bareiss**, *Sylvester's identity and multistep integer-preserving Gaussian
///     elimination* (Math. Comp. 22, 1968) — the fraction-free elimination `affineRank`
///     uses so that a rank is decided by integers rather than by a tolerance.
[<RequireQualifiedAccess>]
module E8Exact =

    /// Dimension of the ambient space the roots live in.
    [<Literal>]
    let AmbientDimension = 8

    /// `|r|^2` for every root, in the doubled integer frame.
    [<Literal>]
    let RootNormSquared = 8

    /// `<r, s>` for an EDGE of 4_21 — the integer test that defines the vertex graph.
    [<Literal>]
    let GossetEdgeInnerProduct = 4

    /// `|a + b + c|^2` for every 2-face: `3*8 + 6*4`.
    [<Literal>]
    let FaceNormalNormSquared = 48

    /// `|(b-a) ^ (c-a)|^2`, from the Lagrange identity `8*8 - 4*4`.
    [<Literal>]
    let FaceBivectorNormSquared = 48

    /// Incident 2-faces per edge: `3 * 60480 / 6720`. Not 2 — the surface has no inside.
    [<Literal>]
    let EdgeFaceIncidence = 27

    /// Integer Euclidean inner product. Exact by construction; there is no tolerance here.
    let dot (a: int[]) (b: int[]) : int =
        let mutable s = 0

        for k in 0 .. a.Length - 1 do
            s <- s + a.[k] * b.[k]

        s

    /// The 240 roots, built from the DEFINITION rather than by reflection closure.
    ///
    /// Emission order is part of the treaty: every face below is a triple of INDICES into
    /// this array, so a different order is a different golden vector even though it is the
    /// same polytope. The order is `(i, j)` ascending with signs `(+,+), (+,-), (-,+),
    /// (-,-)`, then the 128 all-odd-coordinate roots by ascending sign mask.
    let roots () : int[][] =
        let out = ResizeArray<int[]>(240)

        for i in 0 .. AmbientDimension - 1 do
            for j in i + 1 .. AmbientDimension - 1 do
                for si in [| 2; -2 |] do
                    for sj in [| 2; -2 |] do
                        let v = Array.zeroCreate<int> AmbientDimension
                        v.[i] <- si
                        v.[j] <- sj
                        out.Add v

        for mask in 0 .. 255 do
            if BitOperations.PopCount(uint32 mask) % 2 = 0 then
                out.Add(Array.init AmbientDimension (fun b -> if (mask >>> b) &&& 1 = 1 then -1 else 1))

        out.ToArray()

    // ── the root graph, as bitsets ──────────────────────────────────────────

    /// The 4_21 vertex graph, packed one adjacency row per vertex.
    type Adjacency =
        { /// `Size * Stride` words; bit `j` of row `i` is set iff `<r_i, r_j> = 4`.
          Words: uint32[]
          /// 32-bit words per row.
          Stride: int
          /// Vertices.
          Size: int }

    /// Build the adjacency bitset from the integer edge test. Nothing is tabulated.
    let adjacency (rs: int[][]) : Adjacency =
        let size = rs.Length
        let stride = (size + 31) >>> 5
        let words = Array.zeroCreate<uint32> (size * stride)

        for i in 0 .. size - 1 do
            for j in i + 1 .. size - 1 do
                if dot rs.[i] rs.[j] = GossetEdgeInnerProduct then
                    words.[i * stride + (j >>> 5)] <- words.[i * stride + (j >>> 5)] ||| (1u <<< (j &&& 31))
                    words.[j * stride + (i >>> 5)] <- words.[j * stride + (i >>> 5)] ||| (1u <<< (i &&& 31))

        { Words = words
          Stride = stride
          Size = size }

    /// The 6,720 edges as ascending index pairs, read straight off the adjacency bitset.
    let gossetEdges (adj: Adjacency) : struct (int * int)[] =
        let out = ResizeArray<struct (int * int)>(6720)

        for i in 0 .. adj.Size - 1 do
            for w in 0 .. adj.Stride - 1 do
                let mutable bits = adj.Words.[i * adj.Stride + w]

                while bits <> 0u do
                    let low = bits &&& (0u - bits)
                    let j = (w <<< 5) + BitOperations.TrailingZeroCount low
                    bits <- bits ^^^ low
                    if j > i then out.Add(struct (i, j))

        out.ToArray()

    /// Keep only the bits strictly ABOVE `v` within word `word`, so each clique is emitted
    /// once in ascending order.
    let private above (v: int) (word: int) (mask: uint32) : uint32 =
        let wv = v >>> 5

        if word < wv then 0u
        elif word > wv then mask
        else
            let bit = v &&& 31
            if bit = 31 then 0u else mask &&& (0xFFFFFFFFu <<< (bit + 1))

    /// Number of cliques of each size up to `maxSize`; index `k` holds the `k`-clique count.
    ///
    /// Every proper face of 4_21 below the facets is a simplex, so `cliqueCounts` at index
    /// `k` is `f_{k-1}`. Index `maxSize` coming out **zero** is what says the enumeration is
    /// complete rather than truncated — which is why callers ask for one more level than
    /// they need.
    let cliqueCounts (maxSize: int) (adj: Adjacency) : int[] =
        let stride = adj.Stride
        let words = adj.Words
        let counts = Array.zeroCreate<int> (maxSize + 1)
        counts.[0] <- 1
        if maxSize >= 1 then counts.[1] <- adj.Size
        let cand = Array.zeroCreate<uint32> ((maxSize + 2) * stride)

        let rec expand (depth: int) (held: int) =
            let bas = depth * stride

            for w in 0 .. stride - 1 do
                let mutable bits = cand.[bas + w]

                while bits <> 0u do
                    let low = bits &&& (0u - bits)
                    let v = (w <<< 5) + BitOperations.TrailingZeroCount low
                    bits <- bits ^^^ low
                    if held + 1 <= maxSize then counts.[held + 1] <- counts.[held + 1] + 1

                    if held + 1 < maxSize then
                        let next = (depth + 1) * stride
                        let mutable any = 0u

                        for k in 0 .. stride - 1 do
                            let m = above v k (cand.[bas + k] &&& words.[v * stride + k])
                            cand.[next + k] <- m
                            any <- any ||| m

                        if any <> 0u then expand (depth + 1) (held + 1)

        if maxSize >= 2 then
            for v in 0 .. adj.Size - 1 do
                let mutable any = 0u

                for k in 0 .. stride - 1 do
                    let m = above v k words.[v * stride + k]
                    cand.[k] <- m
                    any <- any ||| m

                if any <> 0u then expand 0 1

        counts

    /// Every clique of exactly `size` vertices, as ascending index arrays.
    let cliquesOfSize (size: int) (adj: Adjacency) : int[][] =
        if size <= 0 then
            Array.empty
        else

        let stride = adj.Stride
        let words = adj.Words
        let out = ResizeArray<int[]>()
        let held = Array.zeroCreate<int> size
        let cand = Array.zeroCreate<uint32> ((size + 2) * stride)

        let rec expand (depth: int) (count: int) =
            let bas = depth * stride

            for w in 0 .. stride - 1 do
                let mutable bits = cand.[bas + w]

                while bits <> 0u do
                    let low = bits &&& (0u - bits)
                    let v = (w <<< 5) + BitOperations.TrailingZeroCount low
                    bits <- bits ^^^ low
                    held.[count] <- v

                    if count + 1 = size then
                        out.Add(Array.copy held)
                    else
                        let next = (depth + 1) * stride
                        let mutable any = 0u

                        for k in 0 .. stride - 1 do
                            let m = above v k (cand.[bas + k] &&& words.[v * stride + k])
                            cand.[next + k] <- m
                            any <- any ||| m

                        if any <> 0u then expand (depth + 1) (count + 1)

        for v in 0 .. adj.Size - 1 do
            held.[0] <- v

            if size = 1 then
                out.Add(Array.copy held)
            else
                let mutable any = 0u

                for k in 0 .. stride - 1 do
                    let m = above v k words.[v * stride + k]
                    cand.[k] <- m
                    any <- any ||| m

                if any <> 0u then expand 0 1

        out.ToArray()

    /// A 2-face of 4_21: three root indices, ascending.
    [<Struct>]
    type Face =
        { A: int
          B: int
          C: int }

    /// The 60,480 triangles, enumerated **edge-first** rather than by clique recursion.
    ///
    /// A deliberately different mechanism from `cliquesOfSize 3`: walk each of the 6,720
    /// edges and intersect the two endpoints' adjacency rows, keeping only the common
    /// neighbours above both. Two routes to one number is the point — the sibling test
    /// asserts the two agree element-for-element, so a defect in either shows up as a
    /// disagreement rather than as a plausible wrong answer.
    let triangleFaces (adj: Adjacency) : Face[] =
        let stride = adj.Stride
        let words = adj.Words
        let out = ResizeArray<Face>(60480)

        for struct (i, j) in gossetEdges adj do
            for w in 0 .. stride - 1 do
                let mutable bits =
                    above j w (words.[i * stride + w] &&& words.[j * stride + w])

                while bits <> 0u do
                    let low = bits &&& (0u - bits)
                    let k = (w <<< 5) + BitOperations.TrailingZeroCount low
                    bits <- bits ^^^ low
                    out.Add { A = i; B = j; C = k }

        out.ToArray()

    // ── facets, by supporting hyperplane ────────────────────────────────────

    /// A supported face: the roots a hyperplane touches, the direction that found it, and
    /// the affine dimension of what it touched.
    type SupportedFace =
        { /// Root indices on the hyperplane, ascending.
          Vertices: int[]
          /// The integer direction whose maximum this face attains.
          Normal: int[]
          /// Affine rank. A facet of an 8-polytope has 7.
          Rank: int }

    /// The roots attaining `max <r, normal>` — the face that hyperplane supports.
    let maxFace (normal: int[]) (rs: int[][]) : int[] =
        let mutable best = System.Int32.MinValue

        for r in rs do
            let v = dot r normal
            if v > best then best <- v

        let out = ResizeArray<int>()

        for i in 0 .. rs.Length - 1 do
            if dot rs.[i] normal = best then out.Add i

        out.ToArray()

    /// Affine rank of a set of root indices, decided by **integers**, never by a tolerance.
    ///
    /// The TypeScript oracle runs floating-point Gaussian elimination with a `1e-9` pivot
    /// threshold. This one is fraction-free: rows are reduced by `pivot * row - factor *
    /// pivotRow` and divided through by their gcd, so a pivot is zero or it is not, and the
    /// rank is a theorem rather than a measurement. Rows are consumed incrementally and the
    /// scan stops at full rank, which bounds coefficient growth to the eight elimination
    /// steps the ambient dimension allows.
    let affineRank (indices: int[]) (rs: int[][]) : int =
        if indices.Length = 0 then
            -1
        else

        let baseRoot = rs.[indices.[0]]
        // Reduced pivot rows, at most one per column.
        let pivots = Array.zeroCreate<int64[]> AmbientDimension
        let pivotCol = Array.create AmbientDimension -1
        let mutable rank = 0
        let mutable idx = 1

        while idx < indices.Length && rank < AmbientDimension do
            let row = Array.init AmbientDimension (fun k -> int64 (rs.[indices.[idx]].[k] - baseRoot.[k]))
            // Reduce against every pivot already held.
            for p in 0 .. rank - 1 do
                let c = pivotCol.[p]
                let pv = pivots.[p].[c]
                let f = row.[c]

                if f <> 0L then
                    for k in 0 .. AmbientDimension - 1 do
                        row.[k] <- pv * row.[k] - f * pivots.[p].[k]

            // Divide out the row's gcd so the coefficients cannot run away.
            let mutable g = 0L

            for k in 0 .. AmbientDimension - 1 do
                let mutable a = abs row.[k]
                let mutable b = g

                while a <> 0L do
                    let t = b % a
                    b <- a
                    a <- t

                g <- b

            if g > 1L then
                for k in 0 .. AmbientDimension - 1 do
                    row.[k] <- row.[k] / g

            let mutable lead = -1
            let mutable k = 0

            while lead < 0 && k < AmbientDimension do
                if row.[k] <> 0L then lead <- k
                k <- k + 1

            if lead >= 0 then
                pivots.[rank] <- row
                pivotCol.[rank] <- lead
                rank <- rank + 1

            idx <- idx + 1

        rank

    /// Candidate facet directions from ORTHOGONAL root pairs: `r + s` where `<r, s> = 0`.
    let orthogonalPairDirections (rs: int[][]) : int[][] =
        let seen = Dictionary<string, int[]>()

        for i in 0 .. rs.Length - 1 do
            for j in i + 1 .. rs.Length - 1 do
                if dot rs.[i] rs.[j] = 0 then
                    let sum = Array.init AmbientDimension (fun k -> rs.[i].[k] + rs.[j].[k])
                    let key = System.String.Join(",", sum)
                    if not (seen.ContainsKey key) then seen.[key] <- sum

        seen.Values |> Seq.toArray

    /// Candidate facet directions from 8-CLIQUE centroids: the sum of a maximal clique.
    let cliqueCentroidDirections (adj: Adjacency) (rs: int[][]) : int[][] =
        let seen = Dictionary<string, int[]>()

        for clique in cliquesOfSize AmbientDimension adj do
            let sum = Array.zeroCreate<int> AmbientDimension

            for v in clique do
                for k in 0 .. AmbientDimension - 1 do
                    sum.[k] <- sum.[k] + rs.[v].[k]

            let key = System.String.Join(",", sum)
            if not (seen.ContainsKey key) then seen.[key] <- sum

        seen.Values |> Seq.toArray

    /// Every supported face the root system's own directions reach, with its affine rank.
    ///
    /// Three candidate families, and the FIRST is here to keep the rank filter honest: a
    /// single root's direction supports exactly one vertex, rank 0, so 240 candidates below
    /// must be rejected. Without them the filter would accept everything it ever saw, which
    /// is a check that cannot fail wearing a dimension test.
    let deriveFaceCandidates (adj: Adjacency) (rs: int[][]) : SupportedFace[] =
        let directions =
            Array.concat [ rs |> Array.map Array.copy
                           orthogonalPairDirections rs
                           cliqueCentroidDirections adj rs ]

        let seen = HashSet<string>()
        let out = ResizeArray<SupportedFace>()

        for normal in directions do
            let vertices = maxFace normal rs
            let key = System.String.Join(",", vertices)

            if seen.Add key then
                out.Add
                    { Vertices = vertices
                      Normal = normal
                      Rank = affineRank vertices rs }

        out.ToArray()

    /// The facets: the candidates of affine rank 7.
    let deriveFacets (adj: Adjacency) (rs: int[][]) : SupportedFace[] =
        deriveFaceCandidates adj rs
        |> Array.filter (fun f -> f.Rank = AmbientDimension - 1)

    /// Is every root on the closed side of this face's hyperplane?
    let isSupporting (facet: SupportedFace) (rs: int[][]) : bool =
        if facet.Vertices.Length = 0 then
            false
        else
            let level = dot rs.[facet.Vertices.[0]] facet.Normal
            rs |> Array.forall (fun r -> dot r facet.Normal <= level)

    /// The full f-vector `[f0 .. f7]` of 4_21.
    ///
    /// `f0..f6` are clique counts; `f7` is the derived facet count. Two mechanisms, and the
    /// alternating sum is what forces them to agree.
    let fVector (adj: Adjacency) (rs: int[][]) : int[] =
        let cliques = cliqueCounts AmbientDimension adj
        let lower = Array.init (AmbientDimension - 1) (fun k -> cliques.[k + 1])
        Array.append lower [| (deriveFacets adj rs).Length |]

    /// `sum_k (-1)^k f_k`. Exactly zero for a convex 8-polytope: the boundary is a 7-sphere
    /// and `chi(S^7) = 0`.
    let eulerAlternatingSum (f: int[]) : int =
        f |> Array.mapi (fun k x -> if k % 2 = 0 then x else -x) |> Array.sum

    /// Per-edge incident-2-face counts over a derived face set.
    let edgeFaceIncidence (faces: Face[]) : struct (int * int * int) =
        let counts = Dictionary<int, int>()

        let bump p q =
            let k = p * 1024 + q
            let mutable v = 0
            counts.[k] <- (if counts.TryGetValue(k, &v) then v else 0) + 1

        for f in faces do
            // `Face` is ascending by construction; the sibling test asserts that invariant
            // rather than defending it with a branch nothing could ever take.
            bump f.A f.B
            bump f.A f.C
            bump f.B f.C

        let mutable mn = System.Int32.MaxValue
        let mutable mx = 0

        for v in counts.Values do
            if v < mn then mn <- v
            if v > mx then mx <- v

        struct (counts.Count, mn, mx)
