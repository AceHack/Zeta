module Zeta.Tests.Formal.CoordRiskSpectralCrossVerifyTests

open Xunit
open FsCheck.Xunit

// ═══════════════════════════════════════════════════════════════════
// BP-16 (empirical) for Aurora round (c): CoordRisk graph-evolution — Cult-Cartel Topology
// (standardization §2.4 / Test 4.3). Soraya's routing: FsCheck over networkx-style graphs (NOT
// TLA+ — eigenvalues are not a state-transition system; the TLA+-hammer guard fired here).
//
// CoordRisk watches two spectral quantities of the gossip graph:
//   ρ(A_t)   = adjacency spectral radius      — hub concentration (Cult): spikes when nodes mimic 1 hub.
//   λ₂(L_t)  = Laplacian Fiedler value         — algebraic connectivity (Cartel): drops toward 0 when
//              (algebraic connectivity)          the graph fragments into exclusive pockets.
//
// This is a self-contained symmetric **Jacobi eigensolver** (no external linear-algebra dependency —
// only-the-irreducible-is-primitive: generate the spectrum, don't import a class). The closed-form
// witnesses (K_n Laplacian spectrum, star ρ = √(n−1)) validate BOTH the eigensolver and the spectral
// facts CoordRisk rests on. Faithful to §4.3 Test A (fragmentation ⇒ λ₂→0) + Test B (hub ⇒ ρ spikes).
// Triage: a counterexample ⇒ the spectral facts under CoordRisk's `Δρ`/`−Δλ₂` terms don't hold.
// ═══════════════════════════════════════════════════════════════════

// ── Symmetric Jacobi eigenvalue algorithm (cyclic rotations). Returns eigenvalues ASCENDING.
//    For a symmetric A, repeatedly applies Jᵀ A J rotations zeroing the largest off-diagonals
//    until the off-diagonal mass is negligible; the diagonal then holds the eigenvalues. ──
let private eigenvaluesSym (a0: float[,]) : float[] =
    let n = Array2D.length1 a0
    let a = Array2D.copy a0

    let offSq () =
        let mutable s = 0.0
        for p in 0 .. n - 1 do
            for q in p + 1 .. n - 1 do
                s <- s + a.[p, q] * a.[p, q]
        s

    let mutable sweeps = 0

    while offSq () > 1e-20 && sweeps < 100 do
        for p in 0 .. n - 2 do
            for q in p + 1 .. n - 1 do
                if abs a.[p, q] > 1e-300 then
                    let app = a.[p, p]
                    let aqq = a.[q, q]
                    let apq = a.[p, q]
                    // Tangent of the rotation that zeroes (p,q) (Golub & Van Loan §8.4).
                    let theta = (aqq - app) / (2.0 * apq)
                    let sign = if theta >= 0.0 then 1.0 else -1.0
                    let t = sign / (abs theta + sqrt (theta * theta + 1.0))
                    let c = 1.0 / sqrt (t * t + 1.0)
                    let s = t * c
                    // Right-multiply by J (rotate columns p, q).
                    for k in 0 .. n - 1 do
                        let akp = a.[k, p]
                        let akq = a.[k, q]
                        a.[k, p] <- c * akp - s * akq
                        a.[k, q] <- s * akp + c * akq
                    // Left-multiply by Jᵀ (rotate rows p, q).
                    for k in 0 .. n - 1 do
                        let apk = a.[p, k]
                        let aqk = a.[q, k]
                        a.[p, k] <- c * apk - s * aqk
                        a.[q, k] <- s * apk + c * aqk

        sweeps <- sweeps + 1

    [| for i in 0 .. n - 1 -> a.[i, i] |] |> Array.sort

// ── Graph builders: symmetric 0/1 adjacency matrices, zero diagonal. ──
let private adj (n: int) (edge: int -> int -> bool) : float[,] =
    Array2D.init n n (fun i j -> if i <> j && edge i j then 1.0 else 0.0)

let private complete n = adj n (fun _ _ -> true)
let private star n = adj n (fun i j -> i = 0 || j = 0) // node 0 = hub
let private cycle n = adj n (fun i j -> (i + 1) % n = j || (j + 1) % n = i)
let private path n = adj n (fun i j -> i + 1 = j || j + 1 = i)

// Two disjoint complete graphs of size k (2k nodes), NO edges between ⇒ DISCONNECTED.
let private twoCliques k =
    adj (2 * k) (fun i j -> (i < k && j < k) || (i >= k && j >= k))

// Same, plus a single bridge edge (k-1)—(k) reconnecting the two cliques.
let private twoCliquesBridged k =
    adj (2 * k) (fun i j ->
        (i < k && j < k)
        || (i >= k && j >= k)
        || (i = k - 1 && j = k)
        || (i = k && j = k - 1))

// ── Spectral quantities. ──
let private laplacian (a: float[,]) : float[,] =
    let n = Array2D.length1 a
    let deg i = Array.sum [| for j in 0 .. n - 1 -> a.[i, j] |]
    Array2D.init n n (fun i j -> if i = j then deg i else -a.[i, j])

let private fiedler (a: float[,]) : float =
    (eigenvaluesSym (laplacian a)).[1] // second-smallest Laplacian eigenvalue = algebraic connectivity

let private spectralRadius (a: float[,]) : float =
    eigenvaluesSym a |> Array.map abs |> Array.max

let private maxDegree (a: float[,]) : float =
    let n = Array2D.length1 a
    [| for i in 0 .. n - 1 -> Array.sum [| for j in 0 .. n - 1 -> a.[i, j] |] |] |> Array.max

let private tol = 1e-6

// ═══ Closed-form witnesses — validate the eigensolver AND the spectral facts. ═══

[<Fact>]
let ``eigensolver validated: K_n Laplacian spectrum is {0, n×(n-1)} so λ₂(K_n) = n`` () =
    // Complete graph K_n: Laplacian eigenvalues are 0 (once) and n (n-1 times). λ₂ = n.
    for n in [ 4; 5; 8; 12 ] do
        Assert.True(abs (fiedler (complete n) - float n) < tol, $"λ₂(K_{n}) should be {n}")

[<Fact>]
let ``eigensolver validated: adjacency spectral radius ρ(K_n) = n-1`` () =
    for n in [ 4; 5; 8; 12 ] do
        Assert.True(abs (spectralRadius (complete n) - float (n - 1)) < tol, $"ρ(K_{n}) should be {n - 1}")

[<Fact>]
let ``eigensolver validated: star ρ = √(n-1) (the hub's adjacency spectral radius)`` () =
    // Star S_n (1 hub + (n-1) leaves): adjacency spectral radius = √(n-1).
    for n in [ 5; 10; 17; 50 ] do
        Assert.True(abs (spectralRadius (star n) - sqrt (float (n - 1))) < tol, $"ρ(star {n}) should be √{n - 1}")

// ═══ Test A (Cartel / fragmentation): λ₂ collapses toward 0. ═══

[<Fact>]
let ``§4.3-A cartel: a graph fragmented into ≥2 components has λ₂ = 0 (algebraic connectivity collapse)`` () =
    // Two exclusive gossip pockets with no cross-talk ⇒ disconnected ⇒ λ₂ = 0 exactly.
    let frag = fiedler (twoCliques 10) // 20 nodes, two exclusive cliques (the §4.3 "20 nodes")
    Assert.True(abs frag < tol, $"fragmented λ₂ should be ~0, got {frag}")

[<Fact>]
let ``§4.3-A detection signal: reconnecting the cartel with one bridge lifts λ₂ off 0 (−Δλ₂ fires)`` () =
    // CoordRisk's η₂·Z(−Δλ₂) term: λ₂ DROPPING signals fragmentation. The bridged graph is connected
    // (λ₂ > 0); removing the bridge drops it to 0 — a detectable Δλ₂.
    let bridged = fiedler (twoCliquesBridged 10)
    let frag = fiedler (twoCliques 10)
    Assert.True(bridged > tol, $"bridged (connected) λ₂ should be > 0, got {bridged}")
    Assert.True(bridged > frag, "reconnecting must raise λ₂ above the fragmented value")

// ═══ Test B (Cult / hub): ρ spikes. ═══

[<Fact>]
let ``§4.3-B cult: a hub graph's ρ spikes above a sparse non-hub graph and grows with the hub`` () =
    // Star (hub) ρ = √(n-1) surges with leaf count; a cycle (no hub) stays ρ = 2 regardless of n.
    let hub80 = spectralRadius (star 81) // 1 hub mimicked by 80 nodes (the §4.3 "80 nodes")
    let cycle80 = spectralRadius (cycle 81)
    Assert.True(hub80 > cycle80, $"hub ρ ({hub80}) must exceed non-hub cycle ρ ({cycle80})")
    Assert.True(spectralRadius (star 81) > spectralRadius (star 21), "more leaves ⇒ larger ρ (hub surge)")

// ═══ FsCheck properties — the spectral facts hold across sizes. ═══

let private sizeOf (n: int) = 3 + (abs n % 12) // 3..14

[<Property>]
let ``Fiedler value is non-negative (Laplacian is PSD) for every graph size`` (ni: int) =
    let n = sizeOf ni
    // λ₂ ≥ 0 for cycle, complete, path, two-cliques — algebraic connectivity is never negative.
    [ cycle n; complete n; path n; twoCliques n ]
    |> List.forall (fun g -> fiedler g > -tol)

[<Property>]
let ``Fiedler's theorem: a connected graph has λ₂ > 0, a fragmented one has λ₂ = 0`` (ni: int) =
    let n = sizeOf ni
    fiedler (cycle n) > tol // cycle is always connected
    && fiedler (path n) > tol // path is always connected
    && fiedler (twoCliques n) < tol // two exclusive cliques are disconnected

[<Property>]
let ``Perron–Frobenius: adjacency spectral radius is bounded by the maximum degree`` (ni: int) =
    let n = sizeOf ni
    [ cycle n; complete n; path n; star n ]
    |> List.forall (fun g -> spectralRadius g <= maxDegree g + tol)

[<Property>]
let ``hub surge is monotone: a larger star has a strictly larger adjacency spectral radius`` (ni: int) =
    let n = sizeOf ni
    spectralRadius (star (n + 1)) > spectralRadius (star n) // ρ = √n vs √(n-1)
