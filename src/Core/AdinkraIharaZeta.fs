namespace Zeta.Core

/// **AdinkraIharaZeta — Ihara zeta of the graph of the `[8,4]` adinkra.**
///
/// A zeta function is an Euler product that **enumerates irreducibles**: Riemann's over primes,
/// Dedekind's over prime ideals, **Ihara's over the primitive closed geodesics of a graph**. An
/// adinkra *is* a graph, so Ihara is a finite, computable zeta of that graph for the concrete
/// generator pinned in `AdinkraCode`. Ihara is *a* zeta, not *the* zeta of the factory.
///
/// ── **The graph, derived (not drawn)** ───────────────────────────────────────────────────────────
///
/// Per Doran–Faux–Gates–Hübsch–Iga–Landweber, an `N`-supercharge adinkra is the `N`-cube `GF(2)^N`
/// quotiented by a doubly-even code `C`. Vertices are the cosets `GF(2)^8 / C`, indexed here by the
/// **syndrome** `s(v) = G·v` that `AdinkraCode.syndrome` already computes; the colour-`I` edge joins
/// a coset to the coset of `v + e_I`. So the adjacency is generated *entirely* from
/// `AdinkraCode.generator` — the connection set is the eight syndromes of the eight weight-1 vectors,
/// i.e. the eight **columns** of the generator matrix.
///
/// The result is a fact about that generator rather than an assumption about the picture:
///
/// > **The columns of `[I₄ | A]` for the extended Hamming code are exactly the eight odd-weight
/// > vectors of `GF(2)^4`** — the four weight-1 columns of `I₄`, and the four weight-3 columns of `A`.
/// > Adding an odd-weight vector flips parity, and the eight odd vectors are *all* of them, so every
/// > even-parity coset is joined to **every** odd-parity coset, once each.
///
/// **The underlying graph of the `[8,4]` extended Hamming adinkra is `K_{8,8}`** — the complete
/// bipartite graph on 8 + 8 vertices. 16 nodes, 8-regular, 64 edges, circuit rank
/// `r = 64 − 16 + 1 = 49`. The bipartition
/// is the physics one: 8 bosons and 8 fermions, each boson joined to each fermion by exactly one of
/// the 8 supercharge colours. `bipartitionIsCodeParity` proves the split is the coset-parity map, and
/// `isCompleteBipartite` proves completeness — both from the derived adjacency, not asserted.
///
/// ── **The zeta function** ────────────────────────────────────────────────────────────────────────
///
/// With `q + 1 = 8` (so `q = 7`) and spectrum `{8, −8, 0^14}`, Bass's formula collapses to a closed
/// form that `AdinkraIharaZeta.Tests` verifies coefficient-by-coefficient against the general
/// machinery in `IharaZeta`:
///
/// ```
///     ζ(u)^(−1) = (1 − u²)^49 · (1 − 49u²) · (1 + 7u²)^14
/// ```
///
/// a degree-128 integer polynomial (`2|E| = 128`, as Bass requires). Its **poles**:
///
/// | pole | multiplicity | modulus | class |
/// |---|---|---|---|
/// | `u = ±1` | 49 each | 1 | trivial — closed-form `(1−u²)^r` with `r = 49` (Bass writes `(1−u²)^{r−1}`; det adds one more `(1−u²)`) |
/// | `u = ±1/7` | 1 each | `1/q` | trivial (Perron `λ = 8` and its bipartite mirror `λ = −8`) |
/// | `u = ±i/√7` | **14 each** | **`q^(−1/2)`** | **non-trivial — and exactly on the critical circle** |
///
/// ── **The Ramanujan verdict: YES** ───────────────────────────────────────────────────────────────
///
/// The 14 non-trivial eigenvalues are all `λ = 0`, and `0² = 0 ≤ 28 = 4q`, so every non-trivial pole
/// has `|u| = q^(−1/2)` exactly. The adinkra satisfies the **Riemann Hypothesis for graphs** and is a
/// **Ramanujan graph** (Lubotzky–Phillips–Sarnak 1988). The check is an integer comparison on an
/// exactly-computed integer characteristic polynomial — there is no floating point anywhere in the
/// derivation, so there is no error bound for the verdict to survive.
///
/// Honest deflation of that verdict: `K_{n,n}` is Ramanujan for *every* `n` (non-trivial spectrum is
/// `{0}`), so this is a property of complete-bipartiteness, not a discovery about supersymmetry. What
/// the computation genuinely establishes is the **identification** — the underlying graph of *this*
/// code's adinkra is `K_{8,8}` — and that identification is what makes the zeta closed-form and the
/// verdict exact.
///
/// ── **The Euler product: what the "primes" are** ─────────────────────────────────────────────────
///
/// The irreducibles this Euler product enumerates are the **primitive closed geodesics** — closed
/// backtrackless tailless walks, up to rotation, that are not a power of a shorter walk. The counts
/// close in exactly:
///
/// ```
///     N_k = 0 for odd k          (K_{8,8} is bipartite)
///     N_2m = 98 + 2·49^m + 28·(−7)^m
///     π(4) = 1568   π(6) = 37632   π(8) = 1448832   (π(1) = π(2) = π(3) = 0)
/// ```
///
/// `π(4) = 1568` is hand-checkable and is the strongest single anchor here: `K_{8,8}` has
/// `C(8,2)² = 784` four-cycles, each giving two orientations, and `784 × 2 = 1568`.
///
/// ── **What this does NOT establish** (`toy-is-free-metered-must-be-earned`) ──────────────────────
///
/// Having *a* zeta function is cheap — every finite graph has one, and this module's machinery would
/// produce a polynomial for a graph drawn at random. The load-bearing claim would be that this Euler
/// product enumerates the irreducibles **of the unfolding**, and this computation is **silent** on
/// that. The geodesics counted here are closed walks in the *quotient topology* of the code; nothing
/// computed connects them to the adinkra's dashing, height assignment, or `Q_I` action, which is where
/// the supersymmetry content lives. Two graphs with the same topology and different dashings are
/// different adinkras and have the *same* Ihara zeta — so this zeta provably cannot see the part that
/// matters. Recorded as a **coincidence-register** result under `numerology-vs-number-theory`: the
/// identification `K_{8,8}` and the counts are structure; "this is the zeta of the unfolding" is not
/// claimed, and would need a different (edge-coloured or dashing-sensitive) zeta to even state.
///
/// Full derivation, poles, prime counts, the negative result, and where a zeta that COULD see the
/// unfolding would have to live (Terras's edge/multivariable zeta; a dashing-twisted Artin–Ihara
/// L-function):
/// `docs/research/2026-08-18-ihara-zeta-of-the-8-4-adinkra-graph-is-k88-ramanujan-deflated-silent-on-unfolding.md`.
///
/// Anchors: Ihara 1966; Hashimoto 1989; Bass 1992; Terras 2010, *Zeta Functions of Graphs*;
/// Lubotzky–Phillips–Sarnak 1988; Doran–Faux–Gates–Hübsch–Iga–Landweber 2008 (arXiv:0806.0051).
[<RequireQualifiedAccess>]
module AdinkraIharaZeta =

    /// Pack a `GF(2)^k` syndrome (bit `i` = coordinate `i`) into an integer coset label in
    /// `0 … 2^(n−k) − 1`. The coset of `v` is exactly `AdinkraCode.syndrome v`, because the code is
    /// self-dual and therefore its own parity-check matrix.
    let cosetOf (v: int[]) : int =
        AdinkraCode.syndrome v
        |> Array.mapi (fun i b -> b <<< i)
        |> Array.fold (|||) 0

    /// The connection set: the coset of each weight-1 vector `e_I`, one per supercharge colour.
    /// Equivalently, the eight **columns** of the generator matrix read as elements of `GF(2)^4`.
    let connectionSet : int[] =
        Array.init AdinkraCode.length (fun j ->
            let v = Array.zeroCreate AdinkraCode.length
            v.[j] <- 1
            cosetOf v)

    /// Vertex count of the adinkra: `2^(N − k) = 16` cosets.
    let nodes = AdinkraCode.adinkraNodes

    /// The adinkra adjacency matrix, generated from `AdinkraCode.generator` via `connectionSet`.
    /// `A.[x].[y] = 1` iff `y = x ⊕ s` for some colour syndrome `s`. Because the code has minimum
    /// distance 4 ≥ 3 the eight syndromes are distinct and non-zero, so this is a simple 8-regular
    /// graph with no loops and no parallel edges.
    let adjacency : int[][] =
        let a = Array.init nodes (fun _ -> Array.zeroCreate<int> nodes)
        for x in 0 .. nodes - 1 do
            for s in connectionSet do
                a.[x].[x ^^^ s] <- 1
        a

    /// Parity of a coset label's Hamming weight — the bipartition class (boson vs fermion).
    let cosetParity (x: int) : int =
        let mutable acc = 0
        let mutable v = x
        while v <> 0 do
            acc <- acc ^^^ (v &&& 1)
            v <- v >>> 1
        acc

    /// **The identification, machine-checked**: the derived adjacency is exactly `K_{8,8}` with the
    /// bipartition given by coset parity — `A.[x].[y] = 1` iff `parity x ≠ parity y`.
    let isCompleteBipartiteOnCosetParity : bool =
        Seq.allPairs (seq { 0 .. nodes - 1 }) (seq { 0 .. nodes - 1 })
        |> Seq.forall (fun (x, y) ->
            let expected = if cosetParity x <> cosetParity y then 1 else 0
            adjacency.[x].[y] = expected)

    /// Undirected edge count `|E| = 64`.
    let edges = IharaZeta.edgeCount adjacency

    /// Circuit rank `r = |E| − |V| + 1 = 49` — the closed-form `(1 − u²)` exponent.
    /// Bass writes `(1 − u²)^{r−1}`; `inverseZetaClosedForm` uses `r`, not `r−1`.
    let circuitRank = IharaZeta.circuitRank adjacency

    /// `q = valence − 1 = 7`. The critical circle for the graph RH is `|u| = q^(−1/2) = 1/√7`.
    let q = AdinkraCode.adinkraValence - 1

    /// `ζ(u)^(−1)` for the adinkra, computed by Bass's determinant formula through the general
    /// `IharaZeta` machinery. Exact integer polynomial of degree `2|E| = 128`.
    let inverseZeta : bigint[] = IharaZeta.inverseZeta adjacency

    /// The same polynomial written in its **closed factored form**
    /// `(1 − u²)^49 · (1 − 49u²) · (1 + 7u²)^14`, expanded. Equality with `inverseZeta` is asserted by
    /// the tests; the two are computed by genuinely different routes (a 16×16 integer determinant
    /// versus a product of three known factors).
    let inverseZetaClosedForm : bigint[] =
        let oneMinusU2 = [| bigint 1; bigint 0; bigint -1 |]
        let perron = [| bigint 1; bigint 0; bigint -49 |]
        let critical = [| bigint 1; bigint 0; bigint 7 |]
        IharaZeta.polyMul
            (IharaZeta.polyMul (IharaZeta.polyPow oneMinusU2 (circuitRank)) perron)
            (IharaZeta.polyPow critical 14)

    /// Closed form for the geodesic counts: `N_k = 0` for odd `k`, and
    /// `N_2m = 98 + 2·49^m + 28·(−7)^m`. Derived from `u·d/du log ζ` on the factored form; verified
    /// against `IharaZeta.geodesicCountsFromHashimoto` by the tests.
    let geodesicCountClosedForm (k: int) : bigint =
        if k % 2 = 1 then bigint 0
        else
            let m = k / 2
            let pow (b: bigint) (e: int) =
                let mutable acc = bigint 1
                for _ in 1 .. e do acc <- acc * b
                acc
            bigint 98 + bigint 2 * pow (bigint 49) m + bigint 28 * pow (bigint -7) m

    /// The Ramanujan / graph-RH verdict for the adinkra. Exact — no floating point is involved.
    let verdict : IharaZeta.Verdict = IharaZeta.ramanujanVerdict adjacency
