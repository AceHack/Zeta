namespace Zeta.Core

open System.Globalization

/// **ConstructionATheta — the theta series of a Construction-A lattice, by two disjoint
/// algorithms, on machinery anchored against published answers BEFORE it is pointed at E8.**
///
/// Status: **metered** (`toy-is-free-metered-must-be-earned`). The falsifier is
/// `tests/Tests.FSharp/Formal/ConstructionAThetaE8.Tests.fs` plus the byte-lock
/// `src/Core/golden-vectors-construction-a-theta.json`.
///
/// ── WHAT THIS COMPUTES ──────────────────────────────────────────────────────────────────────
/// For a binary linear code `C ⊆ GF(2)^n`, Construction A (Conway–Sloane, *SPLAG* ch. 5) builds
/// the lattice `L_A(C) = { x ∈ Z^n : x mod 2 ∈ C }`. This module returns its **theta series**
/// — the count of lattice vectors by norm — as an exact `int64` array indexed by the **integer
/// squared length `x·x`**, with no division anywhere in the counting path.
///
/// The `1/√2` of the usual E8 presentation `Λ = L_A(C)/√2` is handled by **scaling the index,
/// never by dividing a coordinate**: the scaled norm is `(x·x)/2` and the `E_4` exponent is
/// `(x·x)/4`. `toShellCounts` performs that regrading and **throws** if any occupied index is
/// not `≡ 0 (mod 4)`. That throw is not defensive plumbing — it *is* the double-evenness of the
/// code, checked rather than assumed.
///
/// ── WHY IT IS GENERAL AND NOT SPECIALISED TO THE ADINKRA CODE ───────────────────────────────
/// `LatticeVoa.thetaByEnumeration` already counts this same lattice, but it is hardwired to
/// `AdinkraCode` and therefore **cannot be pointed at a lattice whose answer is already
/// published**. A counter that only ever agrees with the thing it is trying to confirm proves
/// nothing. Taking a code as a parameter is what lets the *same* counter be run first on
///
///   • `Z^n`  — `fullCode n` gives `L_A(GF(2)^n) = Z^n`, whose theta series is `θ₃(q)^n`; and
///   • `D₄`   — `evenWeightCode 4` gives `{x ∈ Z⁴ : Σxᵢ even} = D₄`, whose shell counts are
///              Jacobi's `r₄(m) = 8·Σ_{d|m, 4∤d} d`, an external theorem this repo does not own,
///
/// and only then on `AdinkraCode.allCodewords`. The anchors are computed from number theory,
/// not transcribed from this module's own output.
///
/// ── THE TWO DISJOINT ALGORITHMS (and what they buy) ─────────────────────────────────────────
///   • **Route E — enumeration.** `thetaByEnumeration` walks the lattice points directly, in a
///     depth-first descent with an exact norm budget. Bound: at coordinate `i` with remaining
///     budget `rem`, only `|v| ≤ isqrt rem` can appear, because every *later* coordinate
///     contributes a non-negative square. The pruning predicate is therefore **necessary**, so
///     the walk is exhaustive up to `maxNormSq` rather than a box that happens to contain most
///     of the points. Distinct codewords give disjoint residue classes mod 2, so no vector is
///     counted twice.
///   • **Route C — convolution.** `thetaByConvolution` never enumerates a lattice point. It
///     forms, per coordinate, the one-variable series `f_p(u) = Σ_{m ≡ p (2)} u^{m²}`, multiplies
///     the eight of them together per codeword, and sums over the code. Exact integer polynomial
///     arithmetic, no geometry, **no bound to get wrong**.
///
/// The value of the pair is precisely the bound: an under-enumerating Route E produces
/// plausible-but-low counts, and Route C — which has no enumeration bound at all — is what
/// catches that. `240` is exactly the kind of number that looks right when it is not.
///
/// ── SCOPE, so nothing is rounded up ─────────────────────────────────────────────────────────
/// This module counts vectors. That the resulting series for the in-tree code equals `E₄` is
/// evidence that Construction A over that code produced an even unimodular rank-8 lattice — of
/// which E8 is the unique one (Mordell 1938). It is not, by itself, a construction of E8, a
/// root system, or a Weyl group; those live in `E8Lattice` and `CliffordE8Roots`.
///
/// Anchors (Beacon): J. H. Conway & N. J. A. Sloane, *Sphere Packings, Lattices and Groups*
/// (Construction A, ch. 5; theta series and the D₄/Z^n tables, ch. 4); J.-P. Serre, *A Course in
/// Arithmetic* ch. VII (`E₄ = 1 + 240 Σ σ₃(n) qⁿ`, and that the weight-4 space is one
/// dimensional); C. G. J. Jacobi, four-square theorem (1834); L. J. Mordell, *The definite
/// quadratic forms in eight variables with determinant unity* (1938) — uniqueness of E8;
/// S. J. Gates Jr. et al. — the doubly-even self-dual code `AdinkraCode` pins.
[<RequireQualifiedAccess>]
module ConstructionATheta =

    /// Validate a code and return its length `n`. A malformed code is refused loudly rather than
    /// silently producing a lattice nobody asked for.
    let codeLength (code: int[] list) : int =
        match code with
        | [] -> invalidArg "code" "a binary code must contain at least the zero codeword"
        | first :: _ ->
            let n = first.Length

            if code |> List.exists (fun c -> c.Length <> n) then
                invalidArg "code" "all codewords must have the same length"

            if code |> List.exists (fun c -> c |> Array.exists (fun b -> b <> 0 && b <> 1)) then
                invalidArg "code" "codewords must be 0/1 vectors over GF(2)"

            let distinct = code |> List.map List.ofArray |> List.distinct |> List.length

            if distinct <> List.length code then
                invalidArg "code" "codewords must be distinct; a repeat would double-count a coset"

            n

    // ── Reference codes, so the counter can be aimed at known lattices ──────────────────────

    /// The whole space `GF(2)^n`. Construction A over it is `Z^n` itself (every residue allowed).
    let fullCode (n: int) : int[] list =
        if n < 0 || n > 16 then
            invalidArg "n" "fullCode is defined for 0 ≤ n ≤ 16"
        else
            [ for m in 0 .. (1 <<< n) - 1 -> Array.init n (fun i -> (m >>> i) &&& 1) ]

    /// The `[n, n-1]` even-weight code. Construction A over it is `{x ∈ Z^n : Σxᵢ even}` — the
    /// checkerboard lattice `D_n`, which for `n = 4` is `D₄`.
    let evenWeightCode (n: int) : int[] list =
        fullCode n |> List.filter (fun c -> Array.sum c % 2 = 0)

    // ── Route E: direct enumeration ─────────────────────────────────────────────────────────

    /// **Route E.** The theta series of `L_A(code)` by exhaustive depth-first enumeration,
    /// indexed by the integer squared length `x·x`, out to `maxNormSq` inclusive.
    ///
    /// Every `x ∈ L_A(C)` is written `x ≡ c (mod 2)` for exactly one codeword `c`, so the walk
    /// ranges `c` over the code and, per coordinate, over the integers of the parity `c.[i]`
    /// demands. The bound `|v| ≤ isqrt rem` is *necessary* (all later coordinates contribute
    /// non-negative squares), so nothing inside the ball is missed and nothing outside is added.
    let thetaByEnumeration (code: int[] list) (maxNormSq: int) : int64[] =
        if maxNormSq < 0 then
            invalidArg "maxNormSq" "maxNormSq must be non-negative"
        else
            let n = codeLength code
            let theta = Array.zeroCreate<int64> (maxNormSq + 1)

            let rec walk (c: int[]) (i: int) (rem: int) =
                if i = n then
                    let normSq = maxNormSq - rem
                    theta.[normSq] <- theta.[normSq] + 1L
                else
                    let s = LatticeVoa.isqrt rem
                    let mutable v = -s
                    // Step onto the parity the codeword demands, then stride by 2.
                    if (((v - c.[i]) % 2) + 2) % 2 <> 0 then
                        v <- v + 1

                    while v <= s do
                        walk c (i + 1) (rem - v * v)
                        v <- v + 2

            for c in code do
                walk c 0 maxNormSq

            theta

    // ── Route C: generating functions, no lattice point ever materialised ───────────────────

    /// The one-coordinate factor `f_p(u) = Σ_{m ≡ p (mod 2)} u^(m²)`, truncated at `maxNormSq`.
    /// `f₀` is the even-coordinate series, `f₁` the odd one.
    let coordinateFactor (parity: int) (maxNormSq: int) : int64[] =
        if parity <> 0 && parity <> 1 then
            invalidArg "parity" "parity must be 0 or 1"
        elif maxNormSq < 0 then
            invalidArg "maxNormSq" "maxNormSq must be non-negative"
        else
            let f = Array.zeroCreate<int64> (maxNormSq + 1)
            let s = LatticeVoa.isqrt maxNormSq

            for m in -s .. s do
                if (((m - parity) % 2) + 2) % 2 = 0 then
                    f.[m * m] <- f.[m * m] + 1L

            f

    /// **Route C.** The same theta series as `thetaByEnumeration`, built as
    /// `Σ_{c ∈ C} Π_i f_{c_i}` — exact integer polynomial arithmetic over the code, with no
    /// lattice point enumerated and therefore no enumeration bound to get wrong. Truncated
    /// multiplication is exact below the truncation degree because every exponent is `≥ 0`.
    let thetaByConvolution (code: int[] list) (maxNormSq: int) : int64[] =
        if maxNormSq < 0 then
            invalidArg "maxNormSq" "maxNormSq must be non-negative"
        else
            let n = codeLength code
            let f0 = coordinateFactor 0 maxNormSq
            let f1 = coordinateFactor 1 maxNormSq
            let mutable acc = Array.zeroCreate<int64> (maxNormSq + 1)

            for c in code do
                let mutable prod = Array.zeroCreate<int64> (maxNormSq + 1)
                prod.[0] <- 1L

                for i in 0 .. n - 1 do
                    prod <- LatticeVoa.mulTrunc maxNormSq prod (if c.[i] = 1 then f1 else f0)

                acc <- Array.map2 (+) acc prod

            acc

    // ── External anchors: answers this repo does not own ────────────────────────────────────

    /// `θ₃(q)^n` — the number of ways to write `m` as an ordered sum of `n` signed squares, by
    /// convolving the single-square series with itself `n` times. The published theta series of
    /// `Z^n`, computed here rather than transcribed.
    let sumOfSquaresCounts (n: int) (maxNormSq: int) : int64[] =
        if n < 0 then
            invalidArg "n" "n must be non-negative"
        elif maxNormSq < 0 then
            invalidArg "maxNormSq" "maxNormSq must be non-negative"
        else
            let squares = Array.zeroCreate<int64> (maxNormSq + 1)
            let s = LatticeVoa.isqrt maxNormSq

            for m in -s .. s do
                squares.[m * m] <- squares.[m * m] + 1L

            let mutable acc = Array.zeroCreate<int64> (maxNormSq + 1)
            acc.[0] <- 1L

            for _ in 1 .. n do
                acc <- LatticeVoa.mulTrunc maxNormSq acc squares

            acc

    /// **Jacobi's four-square theorem (1834):** `r₄(m) = 8 · Σ_{d | m, 4 ∤ d} d` for `m ≥ 1`,
    /// and `r₄(0) = 1`. An external closed form, evaluated from divisors — nothing about it is
    /// derived from any lattice count in this repo.
    let jacobiR4 (m: int) : int64 =
        if m < 0 then
            invalidArg "m" "m must be non-negative"
        elif m = 0 then
            1L
        else
            let mutable acc = 0L

            for d in 1 .. m do
                if m % d = 0 && d % 4 <> 0 then
                    acc <- acc + int64 d

            8L * acc

    /// The `n`-th coefficient of the Eisenstein series `E₄ = 1 + 240 Σ_{n≥1} σ₃(n) qⁿ`
    /// (Serre, *A Course in Arithmetic* ch. VII). `σ₃` is summed from divisors by
    /// `LatticeVoa.sigma3` — computed, never a transcribed sequence.
    let eisensteinE4Coefficient (n: int) : int64 =
        if n < 0 then
            invalidArg "n" "n must be non-negative"
        elif n = 0 then
            1L
        else
            240L * LatticeVoa.sigma3 n

    // ── Regrading: the √2 handled by scaling the index, never by dividing a coordinate ──────

    /// Regrade a raw `x·x`-indexed theta series onto the `E₄` exponent grid `(x·x)/4`, which is
    /// the grading of `L_A(C)/√2` in which the minimal vectors of E8 sit at exponent 1.
    ///
    /// **Throws if any occupied index is not `≡ 0 (mod 4)`.** That condition is exactly double-
    /// evenness of the code (`x·x ≡ wt(x mod 2) (mod 4)` once the even coordinates' contributions
    /// are accounted), so a non-doubly-even generator makes this function fail loudly instead of
    /// silently truncating a shell into the wrong bucket.
    let toShellCounts (theta: int64[]) : int64[] =
        for k in 0 .. theta.Length - 1 do
            if k % 4 <> 0 && theta.[k] <> 0L then
                invalidOp (
                    System.String.Format(
                        CultureInfo.InvariantCulture,
                        "Construction-A lattice has {0} vector(s) of squared length {1}, which is not ≡ 0 (mod 4); the code is not doubly-even, so the /√2 rescaling does not land on an even lattice.",
                        theta.[k],
                        k
                    )
                )

        Array.init ((theta.Length - 1) / 4 + 1) (fun n -> theta.[4 * n])

    /// Lower-case, zero-padded 16-digit big-endian hex — the `no-binary-in-proof-lineage`
    /// encoding for the byte-locked vectors (hex-in-JSON: diffable, replayable, auditable).
    let toHex (v: int64) : string =
        v.ToString("x16", CultureInfo.InvariantCulture)
