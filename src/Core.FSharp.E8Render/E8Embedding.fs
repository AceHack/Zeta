namespace Zeta.E8Render

/// **`E8Embedding` — the projection, and the FLOAT BOUNDARY it is.**
///
/// Everything in `E8Exact`, `E8Clifford` and `E8Shading` is exact integer arithmetic. This
/// module is where that stops, and it says so in its own name: the Coxeter-plane eigenbasis
/// is irrational at every coordinate, so the 3D positions a ray tracer needs are floats.
///
/// **What is byte-lockable here and what is not.** An eigenvector is defined up to sign, and
/// a Jacobi sweep may deliver either. Two independent implementations of this module will
/// therefore agree on every *rotation-invariant* quantity — the ring radii, the number of
/// concentric rings, the count in each — and are free to disagree on the sign of an axis.
/// So the golden vector locks the radii and the ring census, never the raw coordinates, and
/// the sibling test states that gauge explicitly instead of pretending the coordinates are
/// canonical. Locking a coordinate here would be locking an arbitrary choice, which is the
/// kind of expectation that goes red for no reason and then gets deleted.
///
/// **The falsifier this construction has to survive:** E8's Coxeter number is `h = 30`, and
/// the Coxeter-plane projection puts the 240 roots on **8 concentric rings of 30 points
/// each**. Get the plane wrong and the radii do not cluster and the counts are not 30.
///
/// Anchors (Beacon): **H. S. M. Coxeter**, *Regular Polytopes* (1973) — the Coxeter element,
/// its exponents and the Coxeter plane; **Bertram Kostant**, *The principal three-
/// dimensional subgroup and the Betti numbers of a complex simple Lie group* (Amer. J. Math.
/// 81, 1959) — the eigenvalue structure `2 cos(pi m / h)` this module MEASURES rather than
/// substitutes; **Carl Gustav Jacob Jacobi** (1846) — the cyclic rotation sweep.
[<RequireQualifiedAccess>]
module E8Embedding =

    /// The two-colouring of the E8 Dynkin diagram. The diagram is a tree, hence bipartite.
    let dynkinColouring: int[] = [| 0; 1; 1; 0; 1; 0; 1; 0 |]

    /// Bourbaki simple roots for E8, in the same doubled coordinates as `E8Exact.roots`.
    let simpleRoots () : int[][] =
        let e (k: int) (s: int) =
            let v = Array.zeroCreate<int> 8
            v.[k] <- s
            v

        let add (a: int[]) (b: int[]) = Array.init 8 (fun k -> a.[k] + b.[k])
        let scale (a: int[]) (s: int) = a |> Array.map (fun x -> x * s)
        // a1 = 1/2(e1 - e2 - ... - e7 + e8), doubled to stay integral.
        [| [| 1; -1; -1; -1; -1; -1; -1; 1 |]
           scale (add (e 0 1) (e 1 1)) 2
           scale (add (e 1 1) (e 0 -1)) 2
           scale (add (e 2 1) (e 1 -1)) 2
           scale (add (e 3 1) (e 2 -1)) 2
           scale (add (e 4 1) (e 3 -1)) 2
           scale (add (e 5 1) (e 4 -1)) 2
           scale (add (e 6 1) (e 5 -1)) 2 |]

    /// The Dynkin adjacency, DERIVED from the simple roots rather than declared.
    ///
    /// `A_ij = -(a_i, a_j) / 4` off the diagonal, which is the Cartan off-diagonal with its
    /// sign flipped. Deriving it means the geometry and the diagram have to agree; a wrong
    /// simple root shows up here rather than silently downstream.
    let dynkinAdjacency () : float[][] =
        let s = simpleRoots ()

        Array.init 8 (fun i ->
            Array.init 8 (fun j ->
                if i = j then
                    0.0
                else
                    -(float (E8Exact.dot s.[i] s.[j])) / 4.0))

    /// Cyclic Jacobi eigen-decomposition of a real symmetric matrix.
    ///
    /// Dependency-free and deterministic. Written out rather than pulled in so the whole
    /// rung stays inside the repository's own code, and so the eigenvalues are MEASURED
    /// rather than substituted from the closed form `2 cos(pi m / h)` — substituting them
    /// would make the exponent check a tautology.
    let symmetricEigen (input: float[][]) : struct (float[] * float[][]) =
        let n = input.Length
        let a = input |> Array.map Array.copy
        let v = Array.init n (fun i -> Array.init n (fun j -> if i = j then 1.0 else 0.0))
        let mutable sweep = 0
        let mutable converged = false

        while sweep < 100 && not converged do
            let mutable off = 0.0

            for i in 0 .. n - 1 do
                for j in i + 1 .. n - 1 do
                    off <- off + a.[i].[j] * a.[i].[j]

            if off < 1e-32 then
                converged <- true
            else
                for p in 0 .. n - 2 do
                    for q in p + 1 .. n - 1 do
                        let apq = a.[p].[q]

                        if abs apq >= 1e-300 then
                            let theta = (a.[q].[q] - a.[p].[p]) / (2.0 * apq)
                            let t = (if theta >= 0.0 then 1.0 else -1.0) / (abs theta + sqrt (theta * theta + 1.0))
                            let c = 1.0 / sqrt (t * t + 1.0)
                            let s = t * c
                            a.[p].[p] <- a.[p].[p] - t * apq
                            a.[q].[q] <- a.[q].[q] + t * apq
                            a.[p].[q] <- 0.0
                            a.[q].[p] <- 0.0

                            for k in 0 .. n - 1 do
                                if k <> p && k <> q then
                                    let akp = a.[k].[p]
                                    let akq = a.[k].[q]
                                    a.[k].[p] <- c * akp - s * akq
                                    a.[p].[k] <- a.[k].[p]
                                    a.[k].[q] <- s * akp + c * akq
                                    a.[q].[k] <- a.[k].[q]

                            for k in 0 .. n - 1 do
                                let vkp = v.[k].[p]
                                let vkq = v.[k].[q]
                                v.[k].[p] <- c * vkp - s * vkq
                                v.[k].[q] <- s * vkp + c * vkq

                sweep <- sweep + 1

        let values = Array.init n (fun i -> a.[i].[i])
        // Column i of `v` is the eigenvector for `values.[i]`; return them row-wise.
        let vectors = Array.init n (fun i -> Array.init n (fun k -> v.[k].[i]))
        struct (values, vectors)

    /// One eigenplane of the bipartite Coxeter element: an orthonormal `(e1, e2)` pair.
    type EigenLayer =
        { /// Rank in descending eigenvalue order; layer 0 is the Coxeter plane.
          Index: int
          /// The adjacency eigenvalue the plane belongs to.
          AdjacencyEigenvalue: float
          /// First orthonormal axis of the plane.
          E1: float[]
          /// Second orthonormal axis, Gram-Schmidt against the first.
          E2: float[] }

    /// The four eigenplanes with positive adjacency eigenvalue, descending. Layer 0 is the
    /// Coxeter plane.
    let eigenLayers () : EigenLayer[] =
        let struct (values, vectors) = symmetricEigen (dynkinAdjacency ())
        let simple = simpleRoots ()

        values
        |> Array.mapi (fun i value -> struct (value, i))
        |> Array.filter (fun (struct (value, _)) -> value > 1e-9)
        |> Array.sortByDescending (fun (struct (value, _)) -> value)
        |> Array.mapi (fun index (struct (value, i)) ->
            let weights = vectors.[i]
            let u = Array.zeroCreate<float> 8
            let w = Array.zeroCreate<float> 8

            simple
            |> Array.iteri (fun node root ->
                let target = if dynkinColouring.[node] = 0 then u else w

                for k in 0 .. 7 do
                    target.[k] <- target.[k] + weights.[node] * float root.[k])

            let un = sqrt (Array.fold2 (fun s x y -> s + x * y) 0.0 u u)
            let e1 = u |> Array.map (fun x -> x / un)
            let proj = Array.fold2 (fun s x y -> s + x * y) 0.0 w e1
            let w2 = Array.init 8 (fun k -> w.[k] - proj * e1.[k])
            let wn = sqrt (Array.fold2 (fun s x y -> s + x * y) 0.0 w2 w2)
            let e2 = w2 |> Array.map (fun x -> x / wn)

            { Index = index
              AdjacencyEigenvalue = value
              E1 = e1
              E2 = e2 })

    /// A point of the 3D embedding.
    [<Struct>]
    type Point3 = { X: float; Y: float; Z: float }

    /// The 3D embedding: `(x, y)` from the Coxeter plane and `z` from the next layer's first
    /// axis. Multi-layer tessellation over one root set, not a new asset.
    let embed3d (rs: int[][]) (layers: EigenLayer[]) : Point3[] =
        let l0 = layers.[0]
        let l1 = layers.[1]

        let d (r: int[]) (axis: float[]) =
            let mutable s = 0.0

            for k in 0 .. 7 do
                s <- s + float r.[k] * axis.[k]

            s

        rs
        |> Array.map (fun r ->
            { X = d r l0.E1
              Y = d r l0.E2
              Z = d r l1.E1 })

    /// The Coxeter-plane radii, rounded to `digits` and counted: the ring census that
    /// falsifies a wrong plane. Rotation-invariant, so two oracles must agree on it even
    /// though their eigenvector signs may differ.
    let coxeterRingCensus (digits: int) (rs: int[][]) (layers: EigenLayer[]) : (float * int)[] =
        let l0 = layers.[0]

        let d (r: int[]) (axis: float[]) =
            let mutable s = 0.0

            for k in 0 .. 7 do
                s <- s + float r.[k] * axis.[k]

            s

        let counts = System.Collections.Generic.Dictionary<float, int>()

        for r in rs do
            let x = d r l0.E1
            let y = d r l0.E2
            let radius = System.Math.Round(sqrt (x * x + y * y), digits)
            let mutable v = 0
            counts.[radius] <- (if counts.TryGetValue(radius, &v) then v else 0) + 1

        counts
        |> Seq.map (fun kv -> kv.Key, kv.Value)
        |> Seq.sortBy fst
        |> Seq.toArray
