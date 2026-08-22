namespace Zeta.Core

/// **IharaZeta — the zeta function of a finite graph, in exact integer arithmetic.**
///
/// A zeta function is an **Euler product that enumerates irreducibles**. Riemann's runs over the
/// primes (`ζ(s) = Π_p (1 − p^(−s))^(−1)`); Dedekind's over prime ideals; **Ihara's runs over the
/// primitive closed geodesics of a graph** — equivalence classes `[P]` of closed, *backtrackless*,
/// *tailless* walks that are not a power of a shorter one:
///
/// ```
///     ζ_G(u) = Π_[P] (1 − u^ℓ(P))^(−1)
/// ```
///
/// Three faces, and their agreement is the theorem:
///
/// | face | formula | computed here by |
/// |---|---|---|
/// | Euler product | `Π_[P] (1 − u^ℓ(P))^(−1)` | `primeCounts` (Möbius inversion of `N_k`) |
/// | geodesic / edge | `ζ(u) = exp(Σ_k N_k u^k / k)`, `N_k = tr(W^k)` | `geodesicCountsFromHashimoto` |
/// | Bass / vertex | `ζ(u)^(−1) = (1 − u²)^(r−1) · det(I − Au + Qu²)` | `inverseZeta` |
///
/// `A` = adjacency, `Q = D − I` (degree minus identity), `r = |E| − |V| + 1` the circuit rank, and
/// `W` the `2|E| × 2|E|` **Hashimoto** non-backtracking edge operator. The edge and vertex faces are
/// computed by *completely different* routes — traces of a `2|E|`-dimensional operator versus a
/// `|V|`-dimensional determinant — so their coefficient-by-coefficient agreement is a genuine
/// cross-check rather than a program agreeing with itself.
/// `tests/Tests.FSharp/Formal/AdinkraIharaZeta.Tests.fs` runs exactly that disagreement test.
/// The non-backtracking restriction is shown load-bearing by the existing negative-control
/// that drops the `f ≠ reverse(e)` guard and watches `N₂` leave 0.
///
/// **Everything here is exact.** Polynomials are `bigint` coefficient arrays; the `|V| × |V|`
/// polynomial determinant is obtained by evaluating at `2|V| + 1` integer points with a fraction-free
/// **Bareiss** elimination and interpolating with **Newton forward differences** (every division
/// asserted exact). No floating point is used anywhere in this module, so the Ramanujan verdict
/// carries no error bound to defend — it is an integer comparison.
///
/// **Prior art / anchors.** Ihara (1966), *On discrete subgroups of the two by two projective linear
/// group over p-adic fields* — the original zeta, for p-adic groups; Serre and **Sunada** recast it
/// for graphs. **Hashimoto (1989)** — the edge operator. **Bass (1992)**, *The Ihara–Selberg zeta
/// function of a tree lattice* — the determinant formula that reduces `2|E|` to `|V|`.
/// **Terras (2010)**, *Zeta Functions of Graphs: A Stroll through the Garden* — the standard modern
/// reference and the source of the `K₄` and `K_{3,3}` worked examples used as external anchors.
/// **Lubotzky–Phillips–Sarnak (1988)** — Ramanujan graphs. **Alon–Boppana** — the matching lower
/// bound that makes "Ramanujan" the optimal-expander notion rather than an arbitrary threshold.
///
/// Scope note (`toy-is-free-metered-must-be-earned`): this module is **metered** — its falsifier is
/// `tests/Tests.FSharp/Formal/AdinkraIharaZeta.Tests.fs`, which pins `K₄` against the closed form
/// published by Terras (outside this repo), pins `K_{3,3}` against its independent spectral form,
/// reproduces the hand-checked counts of the older test-local implementation in
/// `tests/Tests.FSharp/IharaZeta.Tests.fs` (deliberately left in place as an independent oracle),
/// and cross-checks the Bass and Hashimoto routes against each other on every graph it touches.
/// Author-reported mutation-red counts are not claimed; the suite cites the load-bearing
/// negative controls it actually contains.
[<RequireQualifiedAccess>]
module IharaZeta =

    // ── Exact integer polynomials ────────────────────────────────────────────────────────────────
    // Representation: `bigint[]` with index = power of `u`; `[| 1; 0; -1 |]` is `1 − u²`.

    /// Drop trailing zero coefficients (the zero polynomial normalises to `[| 0 |]`).
    let polyTrim (a: bigint[]) : bigint[] =
        let mutable n = a.Length
        while n > 1 && a.[n - 1].IsZero do
            n <- n - 1
        Array.sub a 0 n

    /// Coefficient-wise sum of two integer polynomials.
    let polyAdd (a: bigint[]) (b: bigint[]) : bigint[] =
        let n = max a.Length b.Length
        Array.init n (fun i ->
            (if i < a.Length then a.[i] else bigint 0) + (if i < b.Length then b.[i] else bigint 0))
        |> polyTrim

    /// Product of two integer polynomials (schoolbook; the degrees here are small).
    let polyMul (a: bigint[]) (b: bigint[]) : bigint[] =
        if a.Length = 0 || b.Length = 0 then
            [| bigint 0 |]
        else
            let r = Array.create (a.Length + b.Length - 1) (bigint 0)
            for i in 0 .. a.Length - 1 do
                for j in 0 .. b.Length - 1 do
                    r.[i + j] <- r.[i + j] + a.[i] * b.[j]
            polyTrim r

    /// `p^n` for `n ≥ 0` (`p^0 = 1`).
    let polyPow (p: bigint[]) (n: int) : bigint[] =
        let mutable acc = [| bigint 1 |]
        for _ in 1 .. n do
            acc <- polyMul acc p
        acc

    /// Evaluate an integer polynomial at an integer point (Horner).
    let polyEval (p: bigint[]) (t: bigint) : bigint =
        let mutable acc = bigint 0
        for i in p.Length - 1 .. -1 .. 0 do
            acc <- acc * t + p.[i]
        acc

    /// Structural equality of two integer polynomials up to trailing zeros.
    let polyEqual (a: bigint[]) (b: bigint[]) : bool =
        let a' = polyTrim a
        let b' = polyTrim b
        a'.Length = b'.Length && Array.forall2 (=) a' b'

    /// Exact division `p / d` when `d` divides `p` in `ℤ[u]`; `None` otherwise (leading coefficient
    /// of `d` must divide through at every step).
    let polyDivideExact (p: bigint[]) (d: bigint[]) : bigint[] option =
        let p = polyTrim p
        let d = polyTrim d
        if d.Length = 1 && d.[0].IsZero then None
        elif p.Length < d.Length then (if p.Length = 1 && p.[0].IsZero then Some [| bigint 0 |] else None)
        else
            let rem = Array.copy p
            let qDeg = p.Length - d.Length
            let q = Array.create (qDeg + 1) (bigint 0)
            let lead = d.[d.Length - 1]
            let mutable ok = true
            for k in qDeg .. -1 .. 0 do
                if ok then
                    let num = rem.[k + d.Length - 1]
                    if not (bigint.Remainder(num, lead)).IsZero then
                        ok <- false
                    else
                        let c = bigint.Divide(num, lead)
                        q.[k] <- c
                        for j in 0 .. d.Length - 1 do
                            rem.[k + j] <- rem.[k + j] - c * d.[j]
            if ok && rem |> Array.forall (fun c -> c.IsZero) then Some(polyTrim q) else None

    // ── Exact linear algebra over ℤ ──────────────────────────────────────────────────────────────

    /// Determinant of an integer matrix by **Bareiss** fraction-free Gaussian elimination — every
    /// intermediate is an integer (it is a minor of the original), so this is exact with no
    /// rational arithmetic and no growth beyond the true minors.
    ///
    /// Anchor: Bareiss (1968), *Sylvester's identity and multistep integer-preserving Gaussian
    /// elimination*.
    let integerDeterminant (matrix: bigint[][]) : bigint =
        let n = matrix.Length
        if n = 0 then bigint 1
        else
            let a = matrix |> Array.map Array.copy
            let mutable prev = bigint 1
            let mutable sign = bigint 1
            let mutable singular = false
            for i in 0 .. n - 2 do
                if not singular then
                    if a.[i].[i].IsZero then
                        let mutable pivot = -1
                        for r in i + 1 .. n - 1 do
                            if pivot < 0 && not a.[r].[i].IsZero then pivot <- r
                        if pivot < 0 then singular <- true
                        else
                            let tmp = a.[i]
                            a.[i] <- a.[pivot]
                            a.[pivot] <- tmp
                            sign <- -sign
                    if not singular then
                        for r in i + 1 .. n - 1 do
                            for c in i + 1 .. n - 1 do
                                a.[r].[c] <- bigint.Divide(a.[r].[c] * a.[i].[i] - a.[r].[i] * a.[i].[c], prev)
                        prev <- a.[i].[i]
            if singular then bigint 0 else sign * a.[n - 1].[n - 1]

    /// Recover the unique degree-`≤ d` integer polynomial from its values at `u = 0, 1, …, d`, by
    /// **Newton forward differences**. `Δ^j f(0) / j!` is an integer for every integer-valued
    /// polynomial, so the recurrence never leaves `ℤ`; the exactness of each division is checked and
    /// a violation raises (it would mean the sample values do not come from an integer polynomial).
    let interpolateAtNaturals (values: bigint[]) : bigint[] =
        let d = values.Length - 1
        // Divided differences at the unit-spaced nodes 0..d: level j is Δ^j f / j!.
        let coeffs = Array.create (d + 1) (bigint 0)
        let mutable cur = Array.copy values
        for j in 0 .. d do
            coeffs.[j] <- cur.[0]
            if cur.Length > 1 then
                let next = Array.create (cur.Length - 1) (bigint 0)
                let divisor = bigint (j + 1)
                for i in 0 .. cur.Length - 2 do
                    let delta = cur.[i + 1] - cur.[i]
                    if not (bigint.Remainder(delta, divisor)).IsZero then
                        invalidOp "interpolateAtNaturals: sample values are not those of an integer polynomial"
                    next.[i] <- bigint.Divide(delta, divisor)
                cur <- next
        // Expand Σ_j coeffs[j] · Π_{m<j} (u − m).
        let mutable poly = [| bigint 0 |]
        let mutable basis = [| bigint 1 |]
        for j in 0 .. d do
            poly <- polyAdd poly (polyMul [| coeffs.[j] |] basis)
            basis <- polyMul basis [| bigint (-j); bigint 1 |]
        polyTrim poly

    // ── Graph primitives ─────────────────────────────────────────────────────────────────────────

    /// Vertex count of a square 0/1 adjacency matrix.
    let nodeCount (adjacency: int[][]) : int = adjacency.Length

    /// Degree of vertex `v`.
    let degree (adjacency: int[][]) (v: int) : int = Array.sum adjacency.[v]

    /// Undirected edge count `|E|` (half the sum of degrees; loop-free graphs only).
    let edgeCount (adjacency: int[][]) : int =
        (adjacency |> Array.sumBy Array.sum) / 2

    /// Circuit rank (first Betti number) `r = |E| − |V| + 1`. For a connected graph this is the rank
    /// of the fundamental group — the number of independent cycles. Bass writes `(1 − u²)^{r−1}`;
    /// the collapsed closed form after `det` contributes one more `(1 − u²)` is `(1 − u²)^r`.
    /// For the `[8,4]` adinkra, `r = 64 − 16 + 1 = 49`. Do not call 49 `r−1`, or 48 `r`.
    let circuitRank (adjacency: int[][]) : int =
        edgeCount adjacency - nodeCount adjacency + 1

    /// `Some k` when every vertex has degree `k`; `None` otherwise.
    let regularDegree (adjacency: int[][]) : int option =
        let n = nodeCount adjacency
        if n = 0 then None
        else
            let d0 = degree adjacency 0
            if [ 0 .. n - 1 ] |> List.forall (fun v -> degree adjacency v = d0) then Some d0 else None

    /// `true` iff the graph is bipartite (2-colourable), by BFS from every component root.
    let isBipartite (adjacency: int[][]) : bool =
        let n = nodeCount adjacency
        let colour = Array.create n -1
        let mutable ok = true
        for start in 0 .. n - 1 do
            if ok && colour.[start] < 0 then
                colour.[start] <- 0
                let queue = System.Collections.Generic.Queue<int>()
                queue.Enqueue start
                while queue.Count > 0 do
                    let v = queue.Dequeue()
                    for w in 0 .. n - 1 do
                        if adjacency.[v].[w] <> 0 then
                            if colour.[w] < 0 then
                                colour.[w] <- 1 - colour.[v]
                                queue.Enqueue w
                            elif colour.[w] = colour.[v] then
                                ok <- false
        ok

    /// `true` iff the graph is connected (or empty).
    let isConnected (adjacency: int[][]) : bool =
        let n = nodeCount adjacency
        if n = 0 then true
        else
            let seen = Array.create n false
            seen.[0] <- true
            let queue = System.Collections.Generic.Queue<int>()
            queue.Enqueue 0
            let mutable count = 1
            while queue.Count > 0 do
                let v = queue.Dequeue()
                for w in 0 .. n - 1 do
                    if adjacency.[v].[w] <> 0 && not seen.[w] then
                        seen.[w] <- true
                        count <- count + 1
                        queue.Enqueue w
            count = n

    // ── The Bass / vertex face ───────────────────────────────────────────────────────────────────

    /// `det(I − Au + Qu²)` as an exact integer polynomial of degree `2|V|`, where `Q = D − I`.
    ///
    /// Computed by evaluating the integer matrix `I − At + Qt²` at `t = 0 … 2|V|` (Bareiss
    /// determinant, exact) and interpolating. This is `O(|V|⁴)` bigint operations and needs no
    /// symbolic polynomial matrix algebra.
    let bassPolynomial (adjacency: int[][]) : bigint[] =
        let n = nodeCount adjacency
        let deg = 2 * n
        let sample (t: int) =
            let tb = bigint t
            let m =
                Array.init n (fun i ->
                    Array.init n (fun j ->
                        let identity = if i = j then bigint 1 else bigint 0
                        let q = if i = j then bigint (degree adjacency i - 1) else bigint 0
                        identity - bigint adjacency.[i].[j] * tb + q * tb * tb))
            integerDeterminant m
        interpolateAtNaturals (Array.init (deg + 1) sample)

    /// `ζ_G(u)^(−1) = (1 − u²)^(r−1) · det(I − Au + Qu²)` — **Bass's determinant formula** (1992).
    /// An exact integer polynomial of degree `2|E|`.
    let inverseZeta (adjacency: int[][]) : bigint[] =
        let r = circuitRank adjacency
        polyMul (polyPow [| bigint 1; bigint 0; bigint -1 |] (r - 1)) (bassPolynomial adjacency)

    // ── The geodesic / edge face ─────────────────────────────────────────────────────────────────

    /// The directed edges (tail, head) of the graph, in row-major order.
    let directedEdges (adjacency: int[][]) : (int * int)[] =
        let n = nodeCount adjacency
        [| for i in 0 .. n - 1 do
             for j in 0 .. n - 1 do
                 if adjacency.[i].[j] <> 0 then yield (i, j) |]

    /// The **Hashimoto** non-backtracking edge operator `W` on the `2|E|` directed edges:
    /// `W[e][f] = 1` iff `head(e) = tail(f)` and `f ≠ reverse(e)`. Its traces count closed
    /// backtrackless tailless walks. (Simple graphs only — with parallel edges "not the reverse"
    /// must be decided by edge identity, not by endpoints.)
    let hashimoto (adjacency: int[][]) : int64[][] =
        let de = directedEdges adjacency
        let m = de.Length
        Array.init m (fun a ->
            Array.init m (fun b ->
                let (ta, ha) = de.[a]
                let (tb, hb) = de.[b]
                if ha = tb && not (hb = ta) then 1L else 0L))

    /// `N_k = tr(W^k)` for `k = 1 … maxK` — the number of closed backtrackless tailless walks of
    /// length `k`, counted with base point and direction. This is the **edge-side** route, entirely
    /// independent of `bassPolynomial`.
    let geodesicCountsFromHashimoto (adjacency: int[][]) (maxK: int) : bigint[] =
        let w = hashimoto adjacency
        let m = w.Length
        let counts = Array.create maxK (bigint 0)
        // Track W^k by repeated multiplication; entries stay well inside int64 for the sizes here
        // (bounded by maxDegree^k), and the trace is the only quantity exported.
        let mutable acc = Array.init m (fun i -> Array.init m (fun j -> if i = j then 1L else 0L))
        for k in 1 .. maxK do
            let next = Array.init m (fun _ -> Array.zeroCreate<int64> m)
            for i in 0 .. m - 1 do
                for t in 0 .. m - 1 do
                    let v = acc.[i].[t]
                    if v <> 0L then
                        let row = w.[t]
                        for j in 0 .. m - 1 do
                            if row.[j] <> 0L then next.[i].[j] <- next.[i].[j] + v * row.[j]
            acc <- next
            let mutable tr = bigint 0
            for i in 0 .. m - 1 do
                tr <- tr + bigint acc.[i].[i]
            counts.[k - 1] <- tr
        counts

    /// `N_k` read off the Bass polynomial instead: `u · d/du log ζ(u) = Σ_k N_k u^k`, i.e.
    /// `Σ_k N_k u^k = −u · D'(u) / D(u)` with `D = ζ^(−1)`. Exact integer power series (`D(0) = 1`).
    /// This is the **vertex-side** route to the same `N_k`; comparing it with
    /// `geodesicCountsFromHashimoto` is the cross-check.
    let geodesicCountsFromZeta (inverse: bigint[]) (maxK: int) : bigint[] =
        // numerator = −u D'(u), denominator = D(u); long-divide as power series.
        let d = inverse
        let num = Array.init (maxK + 1) (fun k -> if k = 0 || k >= d.Length then bigint 0 else -(bigint k) * d.[k])
        let result = Array.create (maxK + 1) (bigint 0)
        for k in 0 .. maxK do
            let mutable acc = num.[k]
            for j in 1 .. k do
                if j < d.Length then acc <- acc - d.[j] * result.[k - j]
            // d.[0] = 1 for a Bass polynomial, so no division is needed.
            result.[k] <- acc
        Array.sub result 1 maxK

    /// Möbius function `μ(n)`.
    let private mobius (n: int) : int =
        let mutable m = n
        let mutable sign = 1
        let mutable p = 2
        while p * p <= m do
            if m % p = 0 then
                m <- m / p
                if m % p = 0 then
                    sign <- 0
                    m <- 1
                else sign <- -sign
            p <- p + 1
        if sign = 0 then 0
        elif m > 1 then -sign
        else sign

    /// The **Euler-product face**: `π(k)`, the number of primitive closed geodesics (prime classes
    /// `[P]`) of length `k`, by Möbius inversion of `N_k = Σ_{d | k} d · π(d)`:
    /// `π(k) = (1/k) Σ_{d | k} μ(k/d) · N_d`. Input is `N_1 … N_maxK`.
    let primeCounts (geodesicCounts: bigint[]) : bigint[] =
        let maxK = geodesicCounts.Length
        Array.init maxK (fun idx ->
            let k = idx + 1
            let mutable acc = bigint 0
            for d in 1 .. k do
                if k % d = 0 then acc <- acc + bigint (mobius (k / d)) * geodesicCounts.[d - 1]
            if not (bigint.Remainder(acc, bigint k)).IsZero then
                invalidOp (sprintf "primeCounts: Möbius inversion did not divide at k=%d" k)
            bigint.Divide(acc, bigint k))

    // ── Spectrum and the Riemann Hypothesis for graphs ───────────────────────────────────────────

    /// The characteristic polynomial `det(xI − A)` as an exact integer polynomial (monic, degree
    /// `|V|`), by the same evaluate-and-interpolate route as `bassPolynomial`.
    let characteristicPolynomial (adjacency: int[][]) : bigint[] =
        let n = nodeCount adjacency
        let sample (t: int) =
            let tb = bigint t
            let m =
                Array.init n (fun i ->
                    Array.init n (fun j ->
                        (if i = j then tb else bigint 0) - bigint adjacency.[i].[j]))
            integerDeterminant m
        interpolateAtNaturals (Array.init (n + 1) sample)

    /// Positive divisors of `|n|` by trial division, or `None` when `|n|` is too large to enumerate
    /// cheaply (the caller then reports an indeterminate spectrum rather than guessing).
    let private divisorsOf (n: bigint) : bigint list option =
        let a = abs n
        if a.IsZero || a > bigint 100000000L then None
        else
            let mutable acc = []
            let mutable d = bigint 1
            while d * d <= a do
                if (bigint.Remainder(a, d)).IsZero then
                    acc <- d :: acc
                    let other = bigint.Divide(a, d)
                    if other <> d then acc <- other :: acc
                d <- d + bigint 1
            Some acc

    /// The full integer spectrum of a polynomial as `(root, multiplicity)` pairs, or `None` when it
    /// does **not** split into linear factors over `ℤ`. Refusing rather than approximating is the
    /// point: an approximate spectrum would put a floating-point error bound underneath every
    /// downstream claim.
    let integerRoots (p: bigint[]) : (bigint * int) list option =
        let mutable poly = polyTrim p
        if poly.Length = 1 then (if poly.[0].IsZero then None else Some [])
        else
            let mutable found = []
            // Strip the u^m factor first (root 0), so the constant term below is non-zero.
            let mutable zeroMult = 0
            while poly.Length > 1 && poly.[0].IsZero do
                poly <- polyTrim (Array.sub poly 1 (poly.Length - 1))
                zeroMult <- zeroMult + 1
            if zeroMult > 0 then found <- [ (bigint 0, zeroMult) ]
            let mutable failed = false
            let mutable progress = true
            while not failed && progress && poly.Length > 1 do
                progress <- false
                match divisorsOf poly.[0] with
                | None -> failed <- true
                | Some divs ->
                    let candidates = divs |> List.collect (fun d -> [ d; -d ])
                    match candidates |> List.tryFind (fun c -> (polyEval poly c).IsZero) with
                    | None -> failed <- true
                    | Some root ->
                        let mutable mult = 0
                        let mutable keep = true
                        while keep do
                            match polyDivideExact poly [| -root; bigint 1 |] with
                            | Some q when q.Length >= 1 ->
                                poly <- q
                                mult <- mult + 1
                                keep <- poly.Length > 1 && (polyEval poly root).IsZero
                            | _ -> keep <- false
                        found <- (root, mult) :: found
                        progress <- true
            if failed || poly.Length > 1 then None
            else Some(found |> List.filter (fun (_, m) -> m > 0) |> List.sortBy fst)

    /// The verdict of the **Riemann Hypothesis for graphs**.
    ///
    /// For a connected `(q+1)`-regular graph the poles of `ζ_G` come from the quadratics
    /// `1 − λu + qu²`, one per adjacency eigenvalue `λ`, plus the `u = ±1` poles carried by the
    /// `(1 − u²)^(r−1)` factor. The product of a quadratic's two roots is `1/q`, so **both roots have
    /// modulus `q^(−1/2)` exactly when the discriminant is non-positive**, i.e. when `λ² ≤ 4q`. The
    /// graph therefore satisfies the RH — all non-trivial poles on the critical circle `|u| = q^(−1/2)`
    /// — iff every non-trivial eigenvalue obeys `|λ| ≤ 2√q`, which is the definition of a
    /// **Ramanujan graph** (Lubotzky–Phillips–Sarnak 1988; optimal by Alon–Boppana).
    ///
    /// The trivial eigenvalues are `λ = q+1` (Perron) and, for a bipartite graph, `λ = −(q+1)`.
    /// The test performed is the exact integer comparison `λ² ≤ 4q` — no square roots, no floats.
    type Verdict =
        /// The graph is Ramanujan. Carries `q`, and `max λ²` over the non-trivial spectrum.
        | Ramanujan of q: int * maxNonTrivialLambdaSquared: bigint
        /// Some non-trivial eigenvalue exceeds `2√q`; carries the offending `λ`.
        | NotRamanujan of q: int * violatingLambda: bigint
        /// The graph is not regular, so `ζ` has no single `q` and the notion does not apply.
        | NotRegular
        /// The characteristic polynomial does not split over `ℤ`; refused rather than approximated.
        | SpectrumNotIntegral

    /// Decide the graph RH / Ramanujan property exactly. See `Verdict`.
    let ramanujanVerdict (adjacency: int[][]) : Verdict =
        match regularDegree adjacency with
        | None -> NotRegular
        | Some k ->
            let q = k - 1
            match integerRoots (characteristicPolynomial adjacency) with
            | None -> SpectrumNotIntegral
            | Some spectrum ->
                let bip = isBipartite adjacency
                // Peel off ONE copy of the Perron eigenvalue (and one of its negative, if bipartite);
                // any further copies are genuine non-trivial eigenvalues (a disconnected graph).
                let mutable trivialPos = 1
                let mutable trivialNeg = if bip then 1 else 0
                let nonTrivial =
                    [ for (lambda, mult) in spectrum do
                        let mutable m = mult
                        if lambda = bigint k && trivialPos > 0 then
                            m <- m - trivialPos
                            trivialPos <- 0
                        if lambda = bigint (-k) && trivialNeg > 0 then
                            m <- m - trivialNeg
                            trivialNeg <- 0
                        if m > 0 then yield (lambda, m) ]
                let bound = bigint (4 * q)
                match nonTrivial |> List.tryFind (fun (lambda, _) -> lambda * lambda > bound) with
                | Some(lambda, _) -> NotRamanujan(q, lambda)
                | None ->
                    let worst =
                        nonTrivial
                        |> List.fold (fun acc (lambda, _) -> max acc (lambda * lambda)) (bigint 0)
                    Ramanujan(q, worst)
