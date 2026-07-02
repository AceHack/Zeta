module Zeta.Tests.BraidCatalogIharaTests

// ζ OVER THE BRAIDED CATALOG — the Ihara slice on the catalog's OWN generators
// (shadow*). #9148 proved the Ihara identity on a textbook graph (K₄). This lands
// it on the braided catalog itself: the three catalog generators — crossing, plait-
// move, braid (#9146's cartridge family) — are the THREE PARALLEL EDGES of a
// two-vertex multigraph. Its non-backtracking closed geodesics are exactly the
// **braided words** in the three generators (alternating, no immediate undo), so
// the Ihara zeta counts braided cycles over the catalog's own alphabet.
//
// THE THEOREM, self-verified two independent ways (share no code):
//   • GEODESIC side:  ζ = exp(Σ tr(W^k) u^k/k), W = non-backtracking edge operator;
//     recovered as an exact integer series (log-derivative recurrence).
//   • BASS side:      ζ^(−1) = (1−u²)^(|E|−|V|) det(I − A u + Q u²), A = adjacency
//     with edge multiplicity 3, Q = (deg−1) = 2. Here det is a plain 2×2.
// They must agree coefficient-by-coefficient — same discipline as #9148.
//
// CLOSED FORM (a third, external check): det(I−Au+Qu²) = (1−u²)(1−4u²), so
//   ζ^(−1) = (1−u²)·(1−u²)(1−4u²) = (1−u²)²(1−4u²),  ζ = 1/((1−u²)²(1−4u²)).
// The pole at u = 1/2 is the q = deg−1 = 2 growth of a 3-regular tree quotient —
// the braided words proliferate like 2^length, as they should.
//
// Anchors: Ihara 1966; Hashimoto 1989; Bass 1992; Terras 2010; Artin (braid group,
// the generators σᵢ); #9146 (the catalog's crossing/plait/braid weights) and #9148
// (the Ihara identity). Weighted (crossing=1, plait=3, braid=6 edge LENGTHS) is the
// Bartholdi/edge-length upgrade — routed in the ζ-name-audition RESUME, not here.

open global.Xunit

// ── integer power-series helpers (exact) ──────────────────────────────────
let private polyMul (a: int64[]) (b: int64[]) : int64[] =
    let r = Array.zeroCreate (a.Length + b.Length - 1)
    for i in 0 .. a.Length - 1 do
        for j in 0 .. b.Length - 1 do
            r.[i + j] <- r.[i + j] + a.[i] * b.[j]
    r

let private seriesInverse (d: int64[]) (maxDeg: int) : int64[] =
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for j in 1 .. m do
            if j < d.Length then s <- s + d.[j] * c.[m - j]
        c.[m] <- -s
    c

// ── the catalog multigraph: 2 vertices, 3 parallel edges (the generators) ──
// Directed edges: e0,e1,e2 (0→1) and their reverses r0,r1,r2 (1→0), indices 0..5
// with reverse(i) = i+3 mod 6.
let private nDirected = 6
let private tail (i: int) = if i < 3 then 0 else 1
let private head (i: int) = if i < 3 then 1 else 0
let private rev (i: int) = (i + 3) % 6

/// Non-backtracking (Hashimoto) operator: W[i][j] = 1 iff head(i)=tail(j) and
/// j ≠ reverse(i) — a braided step (no immediate undo of a generator).
let private W : int64[][] =
    Array.init nDirected (fun i ->
        Array.init nDirected (fun j ->
            if head i = tail j && j <> rev i then 1L else 0L))

let private matMul (a: int64[][]) (b: int64[][]) : int64[][] =
    let n = a.Length
    Array.init n (fun i -> Array.init n (fun j ->
        let mutable s = 0L
        for k in 0 .. n - 1 do s <- s + a.[i].[k] * b.[k].[j]
        s))

let private trace (a: int64[][]) = Array.init a.Length (fun i -> a.[i].[i]) |> Array.sum

let private geodesicCounts (maxDeg: int) : int64[] =
    let n = W.Length
    let counts = Array.zeroCreate (maxDeg + 1)
    let mutable Wk = Array.init n (fun i -> Array.init n (fun j -> if i = j then 1L else 0L))
    for k in 1 .. maxDeg do
        Wk <- matMul Wk W
        counts.[k] <- trace Wk
    counts

/// GEODESIC side: ζ = exp(Σ N_k u^k/k) as an exact integer series.
let private zetaGeodesic (maxDeg: int) : int64[] =
    let n = geodesicCounts maxDeg
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for k in 1 .. m do s <- s + n.[k] * c.[m - k]
        Assert.True(s % int64 m = 0L, sprintf "geodesic recurrence: %d not divisible by %d (W wrong)" s m)
        c.[m] <- s / int64 m
    c

/// BASS side: 2 vertices, adjacency multiplicity 3, Q = 2, |E|−|V| = 3−2 = 1.
/// det(I − A u + Q u²) for the 2×2 [[1+2u², −3u],[−3u, 1+2u²]] directly.
let private zetaBass (maxDeg: int) : int64[] =
    let diag = [| 1L; 0L; 2L |]        // 1 + 2u²
    let off = [| 0L; -3L |]            // −3u
    let det = polyMul diag diag |> fun d -> // (1+2u²)² − (−3u)(−3u)
                let sq = polyMul off off
                Array.init (max d.Length sq.Length) (fun i ->
                    (if i < d.Length then d.[i] else 0L) - (if i < sq.Length then sq.[i] else 0L))
    let oneMinusU2 = [| 1L; 0L; -1L |] // (1−u²)^(|E|−|V|) = (1−u²)^1
    seriesInverse (polyMul oneMinusU2 det) maxDeg

/// The closed form ζ = 1/((1−u²)²(1−4u²)) — a third, external check.
let private zetaClosedForm (maxDeg: int) : int64[] =
    let a = [| 1L; 0L; -1L |]          // (1−u²)
    let b = [| 1L; 0L; -4L |]          // (1−4u²)
    seriesInverse (polyMul (polyMul a a) b) maxDeg

// ── the theorem ────────────────────────────────────────────────────────────

[<Fact>]
let ``THE IHARA ZETA OVER THE BRAIDED CATALOG (3 generators = 3 parallel edges): geodesic side = Bass side, coefficient by coefficient`` () =
    let maxDeg = 24
    let geo = zetaGeodesic maxDeg
    let bass = zetaBass maxDeg
    for m in 0 .. maxDeg do
        Assert.True(geo.[m] = bass.[m], sprintf "degree %d: geodesic %d, Bass %d" m geo.[m] bass.[m])

[<Fact>]
let ``matches the closed form ζ = 1/((1-u^2)^2 (1-4u^2)) — the braided words proliferate like 2^length`` () =
    let maxDeg = 24
    let geo = zetaGeodesic maxDeg
    let closed = zetaClosedForm maxDeg
    for m in 0 .. maxDeg do
        Assert.True(geo.[m] = closed.[m], sprintf "degree %d: geodesic %d, closed-form %d" m geo.[m] closed.[m])
    Assert.Equal(1L, geo.[0])
    Assert.Equal(0L, geo.[1])   // no braided cycle of length 1 (would be a self-undo)
    Assert.Equal(6L, geo.[2])   // (1−u²)^(−2)(1−4u²)^(−1): u² coeff = 2 + 4 = 6

[<Fact>]
let ``no length-1 geodesic (a generator cannot immediately undo itself), but length-2 braided cycles exist`` () =
    let n = geodesicCounts 2
    Assert.Equal(0L, n.[1])         // W has zero diagonal — no length-1 closed walk
    Assert.True(n.[2] > 0L, "braided length-2 cycles (generator i then generator j≠i and back) exist")
