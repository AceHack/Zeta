module Zeta.Tests.BraidCatalogWeightedZetaTests

// ζ OVER THE BRAIDED CATALOG — WEIGHTED (edge-length) slice (shadow*). #9153 gave the
// Ihara zeta over the catalog's 3 generators as 3 parallel edges, all length 1. This
// adds the CARTRIDGE WEIGHTS from #9146 as edge LENGTHS: crossing = 1, plait-move = 3,
// braid = 6. A geodesic's length is now the SUM of its generators' weights, so
//     ζ(u) = Π_[primitive geodesics] (1 − u^{ℓ(p)})^(−1),   ℓ(p) = Σ weights,
// unifying #9146's commutative weights with #9153's noncommutative geodesics. This is
// the edge-length (Bartholdi-flavoured) Ihara zeta of the catalog.
//
// Self-verified two GENUINELY DIFFERENT ways:
//   • WEIGHTED-EDGE side: ζ = 1/det(I − M(u)), M the 6×6 non-backtracking edge
//     operator whose entry carries u^{length(target generator)} — a 6×6 determinant
//     over polynomials.
//   • SUBDIVIDED side: realize each length-L generator as L unit edges in series
//     (plait = 3 edges through 2 intermediate vertices, braid = 6 through 5), then
//     the STANDARD unit-length Ihara: ζ = exp(Σ tr(W_sub^k) u^k/k) via the
//     log-derivative recurrence over the 9-vertex / 20-directed-edge subdivided graph.
// Different matrices, different sizes — agreement is a real cross-check.
//
// Texture: the shortest closed geodesic is crossing-out + plait-back = length 1+3 = 4
// (you cannot return on the crossing you just took — non-backtracking), so ζ begins
// 1 + … u⁴; the weights show up as the first geodesic length.
//
// Anchors: Ihara 1966; Hashimoto 1989; Bass 1992; L. Bartholdi 1999 (the 2-variable /
// edge-length zeta); Terras 2010; #9146 (weights), #9153 (the catalog graph).

open global.Xunit

let private polyMul (a: int64[]) (b: int64[]) : int64[] =
    let r = Array.zeroCreate (a.Length + b.Length - 1)
    for i in 0 .. a.Length - 1 do
        for j in 0 .. b.Length - 1 do
            r.[i + j] <- r.[i + j] + a.[i] * b.[j]
    r

let private polyAdd (a: int64[]) (b: int64[]) : int64[] =
    let n = max a.Length b.Length
    Array.init n (fun i -> (if i < a.Length then a.[i] else 0L) + (if i < b.Length then b.[i] else 0L))

let private seriesInverse (d: int64[]) (maxDeg: int) : int64[] =
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for j in 1 .. m do
            if j < d.Length then s <- s + d.[j] * c.[m - j]
        c.[m] <- -s
    c

let private weights = [| 1; 3; 6 |]   // crossing, plait, braid  (#9146 cartridge constants)

// ── WEIGHTED-EDGE side: 6 directed edges, entry carries u^{length(target)} ──
// edges 0,1,2 = generators 0→1 ; 3,4,5 = reverses 1→0 ; rev(i) = (i+3) mod 6.
let private tail6 i = if i < 3 then 0 else 1
let private head6 i = if i < 3 then 1 else 0
let private rev6 i = (i + 3) % 6
let private len6 i = weights.[i % 3]

/// det of a polynomial matrix by Leibniz (n small).
let private polyDet (entry: int -> int -> int64[]) (n: int) : int64[] =
    let rec perms xs =
        match xs with
        | [] -> [ [] ]
        | _ -> xs |> List.collect (fun x -> perms (List.filter ((<>) x) xs) |> List.map (fun p -> x :: p))
    let sign p =
        let a = List.toArray p
        let mutable s = 1
        for i in 0 .. a.Length - 1 do
            for j in i + 1 .. a.Length - 1 do
                if a.[i] > a.[j] then s <- -s
        int64 s
    let mutable acc = [| 0L |]
    for p in perms [ 0 .. n - 1 ] do
        let mutable term = [| sign p |]
        p |> List.iteri (fun i pi -> term <- polyMul term (entry i pi))
        acc <- polyAdd acc term
    acc

let private zetaWeightedEdge (maxDeg: int) : int64[] =
    // (I − M)[i][j] : 1 − M when i=j (M diagonal is 0 here), else −M[i][j];
    // M[i][j] = u^{len(j)} if head(i)=tail(j) and j≠rev(i).
    let uPow (L: int) = Array.init (L + 1) (fun k -> if k = L then 1L else 0L)
    let entry i j =
        let m = if head6 i = tail6 j && j <> rev6 i then uPow (len6 j) else [| 0L |]
        if i = j then polyAdd [| 1L |] (Array.map (fun x -> -x) m)
        else Array.map (fun x -> -x) m
    seriesInverse (polyDet entry 6) maxDeg

// ── SUBDIVIDED side: length-L edge → L unit edges; standard unit-length Ihara ──
// vertices: 0,1 endpoints; 2,3 plait; 4,5,6,7,8 braid.
let private subdividedEdges : (int * int)[] =
    [| (0, 1)                                  // crossing (len 1)
       (0, 2); (2, 3); (3, 1)                  // plait (len 3)
       (0, 4); (4, 5); (5, 6); (6, 7); (7, 8); (8, 1) |]  // braid (len 6)

/// directed edges of the subdivided graph
let private dsub : (int * int)[] =
    [| for (u, v) in subdividedEdges do
         yield (u, v)
         yield (v, u) |]

let private revSub (i: int) : int =
    let (u, v) = dsub.[i]
    Array.findIndex (fun (a, b) -> a = v && b = u) dsub

let private Wsub : int64[][] =
    let n = dsub.Length
    Array.init n (fun i ->
        Array.init n (fun j ->
            let (_, hi) = dsub.[i]
            let (tj, _) = dsub.[j]
            if hi = tj && j <> revSub i then 1L else 0L))

let private matMul (a: int64[][]) (b: int64[][]) =
    let n = a.Length
    Array.init n (fun i -> Array.init n (fun j ->
        let mutable s = 0L in (for k in 0 .. n - 1 do s <- s + a.[i].[k] * b.[k].[j]); s))
let private trace (a: int64[][]) = Array.init a.Length (fun i -> a.[i].[i]) |> Array.sum

let private zetaSubdivided (maxDeg: int) : int64[] =
    let n = Wsub.Length
    let counts = Array.zeroCreate (maxDeg + 1)
    let mutable Wk = Array.init n (fun i -> Array.init n (fun j -> if i = j then 1L else 0L))
    for k in 1 .. maxDeg do
        Wk <- matMul Wk Wsub
        counts.[k] <- trace Wk
    let c = Array.zeroCreate (maxDeg + 1)
    c.[0] <- 1L
    for m in 1 .. maxDeg do
        let mutable s = 0L
        for k in 1 .. m do s <- s + counts.[k] * c.[m - k]
        Assert.True(s % int64 m = 0L, sprintf "subdivided recurrence: %d not divisible by %d" s m)
        c.[m] <- s / int64 m
    c

// ── the theorem ────────────────────────────────────────────────────────────

[<Fact>]
let ``WEIGHTED CATALOG ζ: weighted-edge determinant = subdivided-graph Ihara, coefficient by coefficient`` () =
    let maxDeg = 24
    let byEdge = zetaWeightedEdge maxDeg
    let bySub = zetaSubdivided maxDeg
    for m in 0 .. maxDeg do
        Assert.True(byEdge.[m] = bySub.[m], sprintf "degree %d: weighted-edge %d, subdivided %d" m byEdge.[m] bySub.[m])

[<Fact>]
let ``the weights show up as the first geodesic length: shortest closed geodesic = crossing + plait = 1 + 3 = 4`` () =
    let z = zetaWeightedEdge 8
    Assert.Equal(1L, z.[0])
    for d in 1 .. 3 do
        Assert.Equal(0L, z.[d])       // no closed geodesic shorter than crossing(1)+plait(3)
    Assert.True(z.[4] > 0L, "a length-4 geodesic (crossing out, plait back) exists")
