namespace Zeta.E8Render

open System.Collections.Generic
open System.Numerics

/// **`H3Exact` — the F# ORACLE for the rank-3 geometry of the H3 orbit polytopes, in exact
/// `Z[phi]` arithmetic.**
///
/// This is a second construction, not a port. `src/Core.TypeScript/research/h3-rank3-geometry.ts`
/// is one oracle for the same mathematics; the two are judged against a committed
/// decimal-in-JSON golden vector (`tests/cross-verification/h3-rank3-geometry/`). Where they
/// disagree the disagreement is a finding — this repository already records that the language
/// oracles do **not** agree by default and that agreement is *achieved*, by a treaty, and then
/// locked (`.claude/rules/culture-invariant-by-default.md`).
///
/// **Where this construction deliberately differs from the TypeScript one**, so that agreement
/// is evidence rather than a coincidence of two copies of one program:
///
///   - **facets** — exhaustive supporting-plane search over every vertex triple here; argmax
///     over the 62 derived weight-orbit directions there.
///   - **`zSqrt`** — search `p` and solve the quadratic for `q` here; search `q` and solve for
///     `p` there.
///   - **facet cyclic order** — an exact half-plane + cross-product angular comparator here;
///     a gift-wrap by orientation sign there.
///   - **orbit closure** — a worklist stack here; breadth-first by rounds there.
///
/// Everything else is shared mathematics (the ring, the H3 Gram matrix, the vertex-sum
/// normal), so agreement there is worth what those four rows are worth and no more.
///
/// **The frame is the treaty.** `phi^2 = phi + 1`; H3's 30 roots have `|r|^2 = 4`; the
/// coordinates are `Z[phi]` and every reflection stays in the ring. Nothing here is a
/// projection: the geometry is rank 3 already, which is the entire point of the exercise.
///
/// **There is no floating point in this module.** Not one. The single irrational the shading
/// model admits appears as the integer `3` under a square root, reported by `normalRadical`,
/// and is never evaluated.
///
/// Anchors (Beacon), cited because they are used:
///   - **Pierre-Philippe Dechant**, *Rank-3 root systems induce root systems of rank 4 via a
///     new Clifford spinor construction*, J. Phys. Conf. Ser. 597 (2015) 012027; *The birth of
///     E8 out of the (Clifford) algebra of the icosahedron*, Proc. R. Soc. A 472 (2016).
///   - **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) — H3, the Wythoff
///     construction, and the f-vectors this module is compared against.
///   - **W. A. Wythoff** (1918) — the kaleidoscopic construction.
///   - **Ernst Steinitz** (1922) — the boundary complex of a convex 3-polytope is a 2-sphere,
///     which is why the surface has a side and 4_21's projected 2-skeleton does not.
[<RequireQualifiedAccess>]
module H3Exact =

    /// An element of `Z[phi]`: `A + B*phi`, with `phi^2 = phi + 1`.
    [<Struct; CustomEquality; NoComparison>]
    type Zphi =
        { A: BigInteger
          B: BigInteger }

        override this.Equals(other) =
            match other with
            | :? Zphi as z -> this.A = z.A && this.B = z.B
            | _ -> false

        override this.GetHashCode() = this.A.GetHashCode() ^^^ (this.B.GetHashCode() * 31)

    /// A vector over `Z[phi]`. Always length 3 here; rank 3 is the point.
    type VecZphi = Zphi[]

    let zOf (a: int) (b: int) : Zphi = { A = BigInteger(a); B = BigInteger(b) }

    /// The rational integer `n`.
    let zInt (n: int) : Zphi = zOf n 0

    /// `phi` itself.
    let phi: Zphi = zOf 0 1

    /// `1/phi = phi - 1`.
    let invPhi: Zphi = zOf -1 1

    let zAdd (x: Zphi) (y: Zphi) : Zphi = { A = x.A + y.A; B = x.B + y.B }
    let zSub (x: Zphi) (y: Zphi) : Zphi = { A = x.A - y.A; B = x.B - y.B }
    let zNegate (x: Zphi) : Zphi = { A = -x.A; B = -x.B }

    /// `(a + b phi)(c + d phi) = (ac + bd) + (ad + bc + bd) phi`, using `phi^2 = phi + 1`.
    let zMul (x: Zphi) (y: Zphi) : Zphi =
        { A = x.A * y.A + x.B * y.B
          B = x.A * y.B + x.B * y.A + x.B * y.B }

    let zIsZero (x: Zphi) = x.A.IsZero && x.B.IsZero

    /// The sign of `a + b phi`, decided by integers alone.
    ///
    /// With `p = 2a + b` and `q = b` the question is the sign of `p + q sqrt 5`. Same-sign `p`
    /// and `q` settle it; mixed signs settle it by `p^2` against `5 q^2`. There is no equality
    /// case in the mixed branch: `p^2 = 5 q^2` forces `p = q = 0`, which the first test already
    /// returned — that is the irrationality of `sqrt 5`, and a branch for it would be
    /// unreachable code wearing the shape of a case.
    let zSign (x: Zphi) : int =
        let p = BigInteger(2) * x.A + x.B
        let q = x.B

        if p.IsZero && q.IsZero then 0
        elif p.Sign >= 0 && q.Sign >= 0 then 1
        elif p.Sign <= 0 && q.Sign <= 0 then -1
        else
            let left = p * p
            let right = BigInteger(5) * q * q
            if p.Sign > 0 then (if left > right then 1 else -1)
            else (if right > left then 1 else -1)

    let zCompare (x: Zphi) (y: Zphi) : int = zSign (zSub x y)
    let zAbs (x: Zphi) : Zphi = if zSign x < 0 then zNegate x else x

    /// Exact inner product.
    let zDot (a: VecZphi) (b: VecZphi) : Zphi =
        let mutable s = zInt 0
        for i in 0 .. a.Length - 1 do
            s <- zAdd s (zMul a.[i] b.[i])
        s

    let zVecAdd (a: VecZphi) (b: VecZphi) : VecZphi = Array.init a.Length (fun i -> zAdd a.[i] b.[i])
    let zVecSub (a: VecZphi) (b: VecZphi) : VecZphi = Array.init a.Length (fun i -> zSub a.[i] b.[i])
    let zVecIsZero (a: VecZphi) = Array.forall zIsZero a

    /// The exact cross product — the object rank 8 does not have, and the second mechanism the
    /// vertex-sum normal is checked against.
    let zCross (a: VecZphi) (b: VecZphi) : VecZphi =
        [| zSub (zMul a.[1] b.[2]) (zMul a.[2] b.[1])
           zSub (zMul a.[2] b.[0]) (zMul a.[0] b.[2])
           zSub (zMul a.[0] b.[1]) (zMul a.[1] b.[0]) |]

    /// A total order on `Z[phi]^3`: lexicographic on the RAW integers, never on a rendered
    /// string. A string sort would depend on the runtime's collation, which is exactly the
    /// divergence the four oracles are known to have by default.
    let zVecCompare (a: VecZphi) (b: VecZphi) : int =
        let mutable result = 0
        let mutable i = 0

        while result = 0 && i < a.Length do
            if a.[i].A <> b.[i].A then result <- compare a.[i].A b.[i].A
            elif a.[i].B <> b.[i].B then result <- compare a.[i].B b.[i].B
            i <- i + 1

        result

    /// Canonical set key, from the raw integers.
    let zVecKey (a: VecZphi) : string =
        a |> Array.map (fun c -> sprintf "%O,%O" c.A c.B) |> String.concat "|"

    /// Exact halving; `None` when the element is not divisible by two in the ring.
    let zHalf (x: Zphi) : Zphi option =
        if x.A.IsEven && x.B.IsEven then Some { A = x.A / BigInteger(2); B = x.B / BigInteger(2) } else None

    // ── the roots ───────────────────────────────────────────────────────────

    /// `|r|^2` for every H3 root in these coordinates: the rational integer 4.
    let rootNormSquared: Zphi = zInt 4

    /// The 30 roots of H3 — the vertices of the icosidodecahedron in `Z[phi]`.
    ///
    /// Two families, exactly as E8's 240 split into 112 and 128:
    ///   - `(+-2, 0, 0)` and coordinate permutations                 -> 6
    ///   - `(+-1, +-1/phi, +-phi)` under EVEN (cyclic) permutations   -> 24
    ///
    /// The emission ORDER is part of the treaty: the axis family first, then the cyclic family
    /// in `sx, sy, sz` order with the three cyclic rotations emitted together.
    let roots () : VecZphi[] =
        let out = ResizeArray<VecZphi>()

        for axis in 0..2 do
            for s in [ 2; -2 ] do
                let v = Array.init 3 (fun _ -> zInt 0)
                v.[axis] <- zInt s
                out.Add v

        for sx in [ 1; -1 ] do
            for sy in [ 1; -1 ] do
                for sz in [ 1; -1 ] do
                    let a = if sx = 1 then zInt 1 else zNegate (zInt 1)
                    let b = if sy = 1 then invPhi else zNegate invPhi
                    let c = if sz = 1 then phi else zNegate phi
                    out.Add [| a; b; c |]
                    out.Add [| c; a; b |]
                    out.Add [| b; c; a |]

        out.ToArray()

    /// Reflect `x` in the hyperplane orthogonal to root `a`: `x - (<x,a>/2) a`, since
    /// `<a,a> = 4`. `None` when `<x,a>` is not divisible by two in the ring — surfaced, never
    /// skipped, because a silent skip truncates the orbit and reports a smaller polytope.
    let reflect (x: VecZphi) (a: VecZphi) : VecZphi option =
        match zHalf (zDot x a) with
        | None -> None
        | Some h -> Some(Array.init x.Length (fun i -> zSub x.[i] (zMul h a.[i])))

    /// What closing a seed under the H3 reflections produced.
    type OrbitResult =
        { Points: VecZphi[]
          NonIntegralReflections: int }

    /// Close a seed under every H3 reflection, exactly — a WORKLIST STACK, where the
    /// TypeScript oracle uses breadth-first rounds. Same fixed point, different traversal.
    let orbit (seed: VecZphi) : OrbitResult =
        let rs = roots ()
        let seen = Dictionary<string, VecZphi>()
        let stack = Stack<VecZphi>()
        seen.[zVecKey seed] <- seed
        stack.Push seed
        let mutable nonIntegral = 0

        while stack.Count > 0 do
            let x = stack.Pop()

            for a in rs do
                match reflect x a with
                | None -> nonIntegral <- nonIntegral + 1
                | Some r ->
                    let key = zVecKey r

                    if not (seen.ContainsKey key) then
                        seen.[key] <- r
                        stack.Push r

        let points = seen.Values |> Seq.toArray |> Array.sortWith zVecCompare
        { Points = points; NonIntegralReflections = nonIntegral }

    // ── the simple system and its weights ───────────────────────────────────

    /// `<a1, a2>` for the pair joined by the 5-branch: `4 cos 144deg = -2 phi`.
    let simpleInnerProductFive: Zphi = zOf 0 -2

    /// `<a2, a3>` for the pair joined by the 3-branch: `4 cos 120deg = -2`.
    let simpleInnerProductThree: Zphi = zOf -2 0

    /// A simple system for H3, found by its Gram matrix rather than written down.
    ///
    /// The Coxeter diagram `o --5-- o ----- o` fixes the three inner products exactly, so the
    /// diagram is the input and the coordinates are the output. Deterministic: roots are
    /// visited in `roots()` order and the first matching triple is returned.
    let simpleRoots () : VecZphi * VecZphi * VecZphi =
        let rs = roots ()
        let mutable found = None

        for a1 in rs do
            for a2 in rs do
                if found.IsNone && zCompare (zDot a1 a2) simpleInnerProductFive = 0 then
                    for a3 in rs do
                        if
                            found.IsNone
                            && zCompare (zDot a2 a3) simpleInnerProductThree = 0
                            && zIsZero (zDot a1 a3)
                        then
                            found <- Some(a1, a2, a3)

        match found with
        | Some t -> t
        | None -> failwith "no H3 simple system found — the root set does not have the H3 Gram matrix"

    /// The three fundamental weight directions, as cross products of the simple roots.
    ///
    /// `w_i` is orthogonal to the two simple roots other than `a_i`, which in rank 3 is exactly
    /// a cross product — computed, in the ring, with no linear solve and no normalisation.
    let fundamentalWeights () : VecZphi * VecZphi * VecZphi =
        let a1, a2, a3 = simpleRoots ()
        zCross a2 a3, zCross a3 a1, zCross a1 a2

    /// The four H3 orbit polytopes.
    type Solid =
        | Icosahedron
        | Dodecahedron
        | Icosidodecahedron
        | TruncatedIcosidodecahedron

    /// In the treaty's order.
    let solids = [ Icosahedron; Dodecahedron; Icosidodecahedron; TruncatedIcosidodecahedron ]

    /// The name each solid carries in the golden document.
    let solidName (s: Solid) =
        match s with
        | Icosahedron -> "icosahedron"
        | Dodecahedron -> "dodecahedron"
        | Icosidodecahedron -> "icosidodecahedron"
        | TruncatedIcosidodecahedron -> "truncatedIcosidodecahedron"

    /// The Wythoff seed for each solid: a fundamental weight, or their sum for the generic
    /// point. Which weight yields which solid is a consequence of the simple system the search
    /// returns, not an assertion — the orbit sizes are what the golden document locks.
    let seedOf (s: Solid) : VecZphi =
        let w1, w2, w3 = fundamentalWeights ()

        match s with
        | Dodecahedron -> w1
        | Icosidodecahedron -> w2
        | Icosahedron -> w3
        | TruncatedIcosidodecahedron -> zVecAdd (zVecAdd w1 w2) w3

    // ── facets ──────────────────────────────────────────────────────────────

    /// One facet: its vertex indices, the vertex SUM (rung 6's normal construction at rank 3),
    /// the cross-product plane normal, and `<n,n>`.
    type Facet =
        { Vertices: int[]
          Normal: VecZphi
          PlaneNormal: VecZphi
          NormalNormSquared: Zphi }

    let private facetOf (points: VecZphi[]) (vertices: int[]) : Facet =
        let mutable normal = [| zInt 0; zInt 0; zInt 0 |]

        for v in vertices do
            normal <- zVecAdd normal points.[v]

        let p0 = points.[vertices.[0]]
        let p1 = points.[vertices.[1]]
        let p2 = points.[vertices.[2]]

        { Vertices = vertices
          Normal = normal
          PlaneNormal = zCross (zVecSub p1 p0) (zVecSub p2 p0)
          NormalNormSquared = zDot normal normal }

    /// Facets by EXHAUSTIVE supporting-plane search — the independent construction.
    ///
    /// For every triple of vertices: the plane through them is kept iff every other vertex lies
    /// weakly on one side. No acceleration, no candidate set, no heuristic. `O(n^4)`, which is
    /// affordable at `n <= 120` and is the price of not sharing a mechanism with the
    /// TypeScript oracle's weight-orbit argmax.
    let facets (points: VecZphi[]) : Facet[] =
        let n = points.Length
        let seen = Dictionary<string, int[]>()

        for i in 0 .. n - 1 do
            for j in i + 1 .. n - 1 do
                for k in j + 1 .. n - 1 do
                    let normal = zCross (zVecSub points.[j] points.[i]) (zVecSub points.[k] points.[i])

                    if not (zVecIsZero normal) then
                        let offset = zDot normal points.[i]
                        let mutable side = 0
                        let mutable supporting = true
                        let on = ResizeArray<int>()
                        let mutable t = 0

                        while supporting && t < n do
                            let s = zCompare (zDot normal points.[t]) offset

                            if s = 0 then on.Add t
                            elif side = 0 then side <- s
                            elif side <> s then supporting <- false

                            t <- t + 1

                        if supporting then
                            let vertices = on.ToArray()
                            let key = vertices |> Array.map string |> String.concat ","

                            if not (seen.ContainsKey key) then
                                seen.[key] <- vertices

        seen.Values
        |> Seq.toArray
        |> Array.sortWith (fun a b ->
            let mutable r = 0
            let mutable i = 0

            while r = 0 && i < max a.Length b.Length do
                let x = if i < a.Length then a.[i] else -1
                let y = if i < b.Length then b.[i] else -1
                if x <> y then r <- compare x y
                i <- i + 1

            r)
        |> Array.map (facetOf points)

    /// The facet's vertices in convex cyclic order.
    ///
    /// An exact ANGULAR SORT about the facet normal, where the TypeScript oracle gift-wraps.
    /// The facet's vertex sum IS `k` times its centroid, so `k*v - n` is the in-plane offset of
    /// vertex `v` and stays in the ring. Vertices are ordered by half-plane relative to the
    /// first one, then by cross-product sign within a half-plane — no angles, no floats.
    ///
    /// Triangles are returned in ascending index order by BOTH oracles: any cyclic order gives
    /// the same three edges, but the fan triangulation's vertex order is locked, so the rule
    /// has to be shared rather than derived twice.
    let facetCycle (points: VecZphi[]) (facet: Facet) : int[] =
        let vs = facet.Vertices

        if vs.Length <= 3 then
            Array.copy vs
        else
            let k = zInt vs.Length
            let offset (v: int) : VecZphi =
                Array.init 3 (fun i -> zSub (zMul k points.[v].[i]) facet.Normal.[i])

            let reference = offset vs.[0]
            let n = facet.Normal

            // Half 0 is the angular range `[0, pi)` measured from the reference direction.
            let half (p: VecZphi) : int =
                let cross = zDot n (zCross reference p)
                let s = zSign cross
                if s > 0 then 0
                elif s < 0 then 1
                elif zSign (zDot reference p) > 0 then 0
                else 1

            vs
            |> Array.sortWith (fun a b ->
                let pa = offset a
                let pb = offset b
                let ha = half pa
                let hb = half pb

                if ha <> hb then compare ha hb
                else
                    let s = zSign (zDot n (zCross pa pb))
                    if s > 0 then -1
                    elif s < 0 then 1
                    else compare a b)

    /// An undirected edge, by ascending vertex index.
    type Edge = { From: int; To: int }

    /// Edges derived from the facet cycles.
    let edges (points: VecZphi[]) (fs: Facet[]) : Edge[] =
        let seen = HashSet<struct (int * int)>()
        let out = ResizeArray<Edge>()

        for facet in fs do
            let cycle = facetCycle points facet

            for i in 0 .. cycle.Length - 1 do
                let u = cycle.[i]
                let v = cycle.[(i + 1) % cycle.Length]
                let a = min u v
                let b = max u v

                if seen.Add(struct (a, b)) then out.Add { From = a; To = b }

        out.ToArray() |> Array.sortWith (fun x y -> if x.From <> y.From then compare x.From y.From else compare x.To y.To)

    /// Facets per edge: the number that decides whether the surface has a side.
    type Incidence = { Edges: int; Min: int; Max: int }

    let incidence (points: VecZphi[]) (fs: Facet[]) (es: Edge[]) : Incidence =
        let counts = Dictionary<struct (int * int), int>()

        for e in es do
            counts.[struct (e.From, e.To)] <- 0

        for facet in fs do
            let cycle = facetCycle points facet

            for i in 0 .. cycle.Length - 1 do
                let u = cycle.[i]
                let v = cycle.[(i + 1) % cycle.Length]
                let key = struct (min u v, max u v)
                counts.[key] <- (match counts.TryGetValue key with
                                 | true, c -> c + 1
                                 | _ -> 1)

        let values = counts.Values |> Seq.toArray

        { Edges = es.Length
          Min = (if values.Length = 0 then 0 else Array.min values)
          Max = (if values.Length = 0 then 0 else Array.max values) }

    /// Fan-triangulate every facet from its first cyclic vertex.
    let triangulate (points: VecZphi[]) (fs: Facet[]) : (int * int * int)[] =
        let out = ResizeArray<int * int * int>()

        for facet in fs do
            let cycle = facetCycle points facet

            for i in 1 .. cycle.Length - 2 do
                out.Add(cycle.[0], cycle.[i], cycle.[i + 1])

        out.ToArray()

    /// A derived solid and everything measured about it.
    type Polytope =
        { Solid: Solid
          Seed: VecZphi
          Points: VecZphi[]
          Facets: Facet[]
          Edges: Edge[]
          Incidence: Incidence
          FVector: int[]
          Euler: int
          FacetSizeCensus: (int * int)[]
          NonIntegralReflections: int }

    let polytope (s: Solid) : Polytope =
        let seed = seedOf s
        let o = orbit seed
        let fs = facets o.Points
        let es = edges o.Points fs

        let census =
            fs
            |> Array.countBy (fun f -> f.Vertices.Length)
            |> Array.sortBy fst

        { Solid = s
          Seed = seed
          Points = o.Points
          Facets = fs
          Edges = es
          Incidence = incidence o.Points fs es
          FVector = [| o.Points.Length; es.Length; fs.Length |]
          Euler = o.Points.Length - es.Length + fs.Length
          FacetSizeCensus = census
          NonIntegralReflections = o.NonIntegralReflections }

    // ── exact square roots and the radical of a norm ────────────────────────

    /// Floor of the integer square root of a non-negative `BigInteger`, by Newton.
    let bigintSqrtFloor (n: BigInteger) : BigInteger =
        if n < BigInteger(2) then
            n
        else
            let mutable x = n
            let mutable y = (x + BigInteger.One) / BigInteger(2)

            while y < x do
                x <- y
                y <- (x + n / x) / BigInteger(2)

            x

    let exactIntegerSqrt (n: BigInteger) : BigInteger option =
        if n.Sign < 0 then None
        else
            let r = bigintSqrtFloor n
            if r * r = n then Some r else None

    /// The square root of `x` in `Z[phi]`, or `None`.
    ///
    /// `(p + q phi)^2 = (p^2 + q^2) + (2pq + q^2) phi`. **This oracle searches `p` and solves
    /// the quadratic `q^2 + 2pq - b = 0` for `q`**, i.e. `q = -p +- sqrt(p^2 + b)`; the
    /// TypeScript oracle searches `q` and solves `p^2 = a - q^2`. Different derivations of the
    /// same finite search, which is the point.
    ///
    /// Both `s` and `-s` are roots, so the POSITIVE one is returned — under `zSign`, the real
    /// ordering, not the sign of a coefficient.
    let zSqrt (x: Zphi) : Zphi option =
        if x.A.Sign < 0 then
            None
        else
            let bound = bigintSqrtFloor x.A
            let mutable result = None
            let mutable p = -bound

            while result.IsNone && p <= bound do
                match exactIntegerSqrt (p * p + x.B) with
                | Some r ->
                    for q in (if r.IsZero then [ -p ] else [ -p + r; -p - r ]) do
                        if result.IsNone && p * p + q * q = x.A && BigInteger(2) * p * q + q * q = x.B then
                            let root = { A = p; B = q }
                            result <- Some(if zSign root < 0 then zNegate root else root)
                | None -> ()

                p <- p + BigInteger.One

            result

    /// `|n| = Coefficient * sqrt(Radicand)`, with `Radicand` a square-free rational integer.
    type Radical = { Radicand: int; Coefficient: Zphi }

    /// Square-free rational integers searched when factoring a norm. Small, and stated — a
    /// `None` means "not of the form `c^2 d` for `d` in THIS set", never "no algebraic form
    /// exists". Both oracles use the same list in the same order; it is part of the treaty.
    let radicandCandidates = [ 1; 2; 3; 5; 6; 7; 10; 11; 13; 14; 15 ]

    let divideByRationalInteger (x: Zphi) (d: int) : Zphi option =
        if d = 0 then
            None
        else
            let bd = BigInteger(d)
            if (x.A % bd).IsZero && (x.B % bd).IsZero then Some { A = x.A / bd; B = x.B / bd } else None

    /// Factor `normSquared` as `c^2 * d`, so `|n| = c sqrt d`.
    let normalRadical (normSquared: Zphi) : Radical option =
        radicandCandidates
        |> List.tryPick (fun d ->
            match divideByRationalInteger normSquared d with
            | None -> None
            | Some quotient ->
                match zSqrt quotient with
                | None -> None
                | Some c -> Some { Radicand = d; Coefficient = c })

    /// The square-free part of a positive integer.
    let squareFreePart (n: int) : int =
        let mutable rest = n
        let mutable out = 1
        let mutable p = 2

        while p * p <= rest do
            let mutable exponent = 0

            while rest % p = 0 do
                rest <- rest / p
                exponent <- exponent + 1

            if exponent % 2 = 1 then out <- out * p
            p <- p + 1

        out * rest

    /// The square-free integer under the single root the Lambert COSINE admits, or `None` when
    /// either norm failed to factor.
    let cosineRadicand (light: VecZphi) (normal: VecZphi) : int option =
        match normalRadical (zDot normal normal), normalRadical (zDot light light) with
        | Some n, Some l -> Some(squareFreePart (n.Radicand * l.Radicand))
        | _ -> None

    // ── exact shading ───────────────────────────────────────────────────────

    /// The Lambert numerator `<L, n>` — in `Z[phi]` for any light in `Z[phi]^3`, which is the
    /// whole of the brightness ordering and never touches a float.
    let lambertNumerator (light: VecZphi) (normal: VecZphi) : Zphi = zDot light normal

    /// How a light shades a facet list.
    type ShadingCensus =
        { SignedLevels: Zphi[]
          AbsoluteLevels: Zphi[]
          LitLevels: Zphi[]
          Census: (Zphi * int)[]
          TerminatorFacets: int }

    let shadeFacets (light: VecZphi) (fs: Facet[]) : ShadingCensus =
        let census =
            fs
            |> Array.map (fun f -> lambertNumerator light f.Normal)
            |> Array.countBy (fun v -> (v.A, v.B))
            |> Array.map (fun ((a, b), c) -> ({ A = a; B = b }, c))
            |> Array.sortWith (fun (x, _) (y, _) -> zCompare x y)

        let signed = census |> Array.map fst

        let absolute =
            signed
            |> Array.map zAbs
            |> Array.distinctBy (fun v -> (v.A, v.B))
            |> Array.sortWith zCompare

        { SignedLevels = signed
          AbsoluteLevels = absolute
          LitLevels = signed |> Array.filter (fun v -> zSign v > 0)
          Census = census
          TerminatorFacets =
            census
            |> Array.tryPick (fun (v, c) -> if zIsZero v then Some c else None)
            |> Option.defaultValue 0 }

    /// A light that is an H3 root — a choice of frame, not of content: the group is transitive
    /// on the 30 roots, so the intensity multiset is the same for every one of them.
    let rootLight (index: int) : VecZphi =
        let rs = roots ()
        rs.[index % rs.Length]

    /// A light that is INTEGRAL but not a root, with a RATIONAL norm: `|L|^2 = 49`, so `|L| = 7`
    /// and the light contributes no new irrational at all. A gauge choice, named as one; no
    /// meaning is read into `49` matching rung 7's level count.
    let integralLight: VecZphi = [| zInt 2; zInt 3; zInt 6 |]
