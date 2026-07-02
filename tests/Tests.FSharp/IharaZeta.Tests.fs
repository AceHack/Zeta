module Zeta.Tests.IharaZetaTests

// ζ OVER PRIME SHAPES — THE NONCOMMUTATIVE UPGRADE (shadow*). #9146 landed the
// COMMUTATIVE slice: the Euler product over knots-under-connected-sum, where
// factorization is commutative (Schubert). This is the routed noncommutative
// upgrade named in that doc: the **Ihara zeta of a graph**, whose "primes" are
// primitive closed geodesics — and geodesics compose NONCOMMUTATIVELY (path
// concatenation is not commutative), unlike connected sum.
//
// THE IDENTITY MADE EXECUTABLE. The Ihara zeta ζ(u) = Π_[p] (1 − u^ℓ(p))^(−1) over
// primitive closed geodesics [p] has two other faces, and their agreement IS the
// theorem:
//   • GEODESIC / EDGE side:  ζ(u) = exp(Σ_{k≥1} N_k u^k / k),  N_k = tr(W^k),
//     where W is the non-backtracking (Hashimoto) edge operator — N_k counts
//     closed backtrackless tailless walks of length k. Computed here as an EXACT
//     INTEGER series via the log-derivative recurrence  m·c_m = Σ_{k≤m} N_k c_{m−k}
//     (ζ has integer coefficients; the division is exact — asserted).
//   • BASS / VERTEX side:  ζ(u)^(−1) = (1 − u²)^(r−1) · det(I − A u + Q u²),
//     r = |E| − |V| + 1, A = adjacency, Q = (deg − 1) diagonal. The 2|E|-dim edge
//     determinant reduces to the |V|-dim vertex determinant (Bass 1992).
//
// The two sides are computed COMPLETELY DIFFERENTLY (one from traces of the edge
// operator, one from the vertex determinant), so their coefficient-by-coefficient
// agreement is a real cross-check: if W is wrong, they diverge. This is the
// noncommutative analog of #9146's Dirichlet = Euler agreement.
//
// Instance: K₄ (Terras's textbook Ihara example). Hand-checkable geodesic counts:
// no length-1/2 backtrackless closed walks (N₁=N₂=0); the shortest geodesics are
// the 4 triangles, each giving 3 starts × 2 directions ⇒ N₃ = 24.
//
// Anchors: Ihara 1966; Sunada (geometric reformulation); Hashimoto 1989 (the
// edge/Hashimoto operator); Bass 1992 (the determinant formula); Terras 2010,
// *Zeta Functions of Graphs*; Mazur / Morishita (arithmetic topology, knots↔primes);
// and #9146 (the commutative slice this upgrades). Euler 1737; Riemann 1859.

open global.Xunit

// ── integer power-series / polynomial helpers (exact) ──────────────────────

let private polyAdd (a: int64[]) (b: int64[]) : int64[] =
    let n = max a.Length b.Length
    Array.init n (fun i -> (if i < a.Length then a.[i] else 0L) + (if i < b.Length then b.[i] else 0L))

let private polyMul (a: int64[]) (b: int64[]) : int64[] =
    if a.Length = 0 || b.Length = 0 then [||]
    else
        let r = Array.zeroCreate (a.Length + b.Length - 1)
        for i in 0 .. a.Length - 1 do
            for j in 0 .. b.Length - 1 do
                r.[i + j] <- r.[i + j] + a.[i] * b.[j]
        r

/// Series inverse of `d` (d.[0] = 1) to degree `maxDeg`: c with d·c = 1.
let private seriesInverse (d: int64[]) (maxDeg: int) : int64[] =
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for j in 1 .. m do
            if j < d.Length then s <- s + d.[j] * c.[m - j]
        c.[m] <- -s // d.[0] = 1
    c

// ── the graph: K₄ (complete graph on 4 vertices) ───────────────────────────

let private nV = 4
/// Undirected edges of K₄.
let private edges = [ (0, 1); (0, 2); (0, 3); (1, 2); (1, 3); (2, 3) ]

/// Directed edges (both orientations of every undirected edge).
let private dedges =
    [| for (u, v) in edges do
         yield (u, v)
         yield (v, u) |]

/// The non-backtracking (Hashimoto) edge operator W: W[e][f] = 1 iff head(e) =
/// tail(f) and f is not the reversal of e (no backtracking).
let private W : int64[][] =
    let m = dedges.Length
    Array.init m (fun i ->
        Array.init m (fun j ->
            let (_, hi) = dedges.[i]
            let (tj, hj) = dedges.[j]
            let (ti, _) = dedges.[i]
            if hi = tj && not (tj = hi && hj = ti) then 1L else 0L))

let private matMul (a: int64[][]) (b: int64[][]) : int64[][] =
    let n = a.Length
    Array.init n (fun i ->
        Array.init n (fun j ->
            let mutable s = 0L
            for k in 0 .. n - 1 do s <- s + a.[i].[k] * b.[k].[j]
            s))

let private trace (a: int64[][]) : int64 =
    let mutable s = 0L
    for i in 0 .. a.Length - 1 do s <- s + a.[i].[i]
    s

/// N_k = tr(W^k) for k = 1..maxDeg.
let private geodesicCounts (maxDeg: int) : int64[] =
    let n = W.Length
    let counts = Array.zeroCreate (maxDeg + 1)
    let mutable Wk = Array.init n (fun i -> Array.init n (fun j -> if i = j then 1L else 0L)) // W^0 = I
    for k in 1 .. maxDeg do
        Wk <- matMul Wk W
        counts.[k] <- trace Wk
    counts

/// GEODESIC side: ζ = exp(Σ N_k u^k / k) as an EXACT integer series, via the
/// log-derivative recurrence m·c_m = Σ_{k≤m} N_k·c_{m−k}. Asserts exact division.
let private zetaGeodesic (maxDeg: int) : int64[] =
    let n = geodesicCounts maxDeg
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for k in 1 .. m do s <- s + n.[k] * c.[m - k]
        Assert.True(s % int64 m = 0L, sprintf "geodesic recurrence: %d not divisible by %d (W is wrong)" s m)
        c.[m] <- s / int64 m
    c

// ── BASS / vertex side ─────────────────────────────────────────────────────

let private degree (v: int) : int = edges |> List.filter (fun (a, b) -> a = v || b = v) |> List.length

/// Adjacency A (V×V, 0/1).
let private adjacency : int64[][] =
    Array.init nV (fun i ->
        Array.init nV (fun j ->
            if edges |> List.exists (fun (a, b) -> (a = i && b = j) || (a = j && b = i)) then 1L else 0L))

/// Each vertex-matrix entry of (I − A u + Q u²) is a small polynomial in u.
let private bassEntry (i: int) (j: int) : int64[] =
    let ii = if i = j then 1L else 0L               // I
    let a = -adjacency.[i].[j]                        // −A u
    let q = if i = j then int64 (degree i - 1) else 0L // +Q u²
    [| ii; a; q |]

/// det of a V×V matrix whose entries are integer polynomials, via Leibniz
/// expansion (V small). Returns the determinant polynomial.
let private polyDet (entry: int -> int -> int64[]) (n: int) : int64[] =
    // permutations of [0..n-1] with sign
    let rec perms (xs: int list) : (int list) list =
        match xs with
        | [] -> [ [] ]
        | _ -> xs |> List.collect (fun x -> perms (List.filter ((<>) x) xs) |> List.map (fun p -> x :: p))
    let sign (p: int list) =
        let arr = List.toArray p
        let mutable s = 1
        for i in 0 .. arr.Length - 1 do
            for j in i + 1 .. arr.Length - 1 do
                if arr.[i] > arr.[j] then s <- -s
        int64 s
    let mutable acc = [| 0L |]
    for p in perms [ 0 .. n - 1 ] do
        let mutable term = [| sign p |]
        p |> List.iteri (fun i pi -> term <- polyMul term (entry i pi))
        acc <- polyAdd acc term
    acc

/// BASS side: ζ = 1 / [ (1 − u²)^(r−1) · det(I − A u + Q u²) ].
let private zetaBass (maxDeg: int) : int64[] =
    let nE = List.length edges
    let r = nE - nV + 1
    let oneMinusU2 = [| 1L; 0L; -1L |]
    let mutable factor = [| 1L |]
    for _ in 1 .. (r - 1) do factor <- polyMul factor oneMinusU2
    let det = polyDet bassEntry nV
    let denom = polyMul factor det
    seriesInverse denom maxDeg

// ── the theorem ────────────────────────────────────────────────────────────

[<Fact>]
let ``THE IHARA ZETA OF K4: geodesic side (exp Σ tr(W^k)u^k/k) = Bass side ((1-u^2)^(r-1) det(I-Au+Qu^2))^(-1), coefficient by coefficient`` () =
    let maxDeg = 24
    let geo = zetaGeodesic maxDeg
    let bass = zetaBass maxDeg
    for m in 0 .. maxDeg do
        Assert.True(geo.[m] = bass.[m], sprintf "degree %d: geodesic says %d, Bass says %d" m geo.[m] bass.[m])
    // ζ starts 1 + 0u + 0u² + 8u³ + … (first geodesics are the length-3 triangles)
    Assert.Equal(1L, geo.[0])
    Assert.Equal(0L, geo.[1])
    Assert.Equal(0L, geo.[2])
    Assert.Equal(8L, geo.[3])

[<Fact>]
let ``geodesic counts are hand-checkable: N1=N2=0 (no short backtrackless loops), N3=24 (4 triangles x 3 starts x 2 directions)`` () =
    let n = geodesicCounts 3
    Assert.Equal(0L, n.[1])
    Assert.Equal(0L, n.[2])
    Assert.Equal(24L, n.[3])

[<Fact>]
let ``the non-backtracking condition is load-bearing: WITH backtracking the geodesic side breaks the Bass identity (the converse)`` () =
    // Build a "backtracking-allowed" edge operator W' (drop the f ≠ reverse(e)
    // guard) — this is the ordinary directed-edge adjacency, NOT the Hashimoto
    // operator. Its trace-series must NOT equal the Bass zeta: the Ihara identity
    // is exactly as strong as the non-backtracking restriction.
    let m = dedges.Length
    let wBack =
        Array.init m (fun i ->
            Array.init m (fun j ->
                let (_, hi) = dedges.[i]
                let (tj, _) = dedges.[j]
                if hi = tj then 1L else 0L))
    let maxDeg = 6
    // geodesic-style series from the WRONG (backtracking) operator
    let counts = Array.zeroCreate (maxDeg + 1)
    let mutable Wk = Array.init m (fun i -> Array.init m (fun j -> if i = j then 1L else 0L))
    for k in 1 .. maxDeg do
        Wk <- matMul Wk wBack
        counts.[k] <- trace Wk
    // with backtracking, N_2 > 0 (go out and back), unlike the true N_2 = 0
    Assert.True(counts.[2] > 0L, "backtracking operator should have length-2 closed walks")
    let bass = zetaBass maxDeg
    // the wrong operator's log-derivative coefficient at u² already disagrees
    // (true ζ has c₂ = 0; the backtracking series does not) — identity broken
    Assert.True(counts.[2] <> 0L && bass.[2] = 0L, "non-backtracking is load-bearing: backtracking breaks the identity at u^2")
