namespace Zeta.Core

open System.Globalization

/// **LatticeVoa — the GRADED DIMENSIONS of the lattice vertex operator algebra V_L, integer-only.**
/// Status: **metered** (`toy-is-free-metered-must-be-earned`) — the graded dimensions carry a
/// falsifier that fails when they are wrong: two mutually independent derivation routes plus a
/// published external reference, byte-locked in `src/Core/golden-vectors-lattice-voa.json`.
/// Nothing else in this module is metered, and nothing outside the graded dimensions is claimed.
///
/// ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────
/// For an even positive-definite lattice L of rank r, the Frenkel–Kac / FLM functor produces a
/// vertex operator algebra V_L whose graded character is theta_L(q) / eta(q)^r. Stripping the
/// q^(-r/24) prefactor of eta leaves an integer power series whose n-th coefficient is
/// dim (V_L)_n. This module computes exactly that integer sequence for L = the in-tree E8 lattice
/// (`E8Lattice` — Construction A over `AdinkraCode.generator`), and nothing else.
///
/// ── WHAT THIS IS **NOT** ────────────────────────────────────────────────────────────────────
/// This module does **not** implement vertex operators, the VOA axioms (locality, the Jacobi
/// identity, the Virasoro action), the Frenkel–Kac isomorphism, the affine E8 action, or anything
/// about the Monster. It computes a **sequence of integers**. The sequence is a *necessary*
/// consequence of the VOA existing; computing it is not evidence that we built one, and it must
/// never be cited as such.
///
/// Quantifier-domain note (`anchor-to-human-prior-art`, checked-not-cited): Frenkel–Kac quantifies
/// over **even positive-definite lattices**, which `E8Lattice.fs` proves in-tree, so that anchor is
/// licensed here. **Zhu's modular-invariance theorem quantifies over C2-cofinite VOAs — we have no
/// VOA**, so modularity is NOT a property of this code and is not claimed by it.
///
/// ── THE TWO ROUTES (the falsifier) ──────────────────────────────────────────────────────────
/// One computation is a computation; two independent computations that agree are a check.
///   • **Route L (lattice/geometric).** `thetaByEnumeration` counts the lattice points of
///     Construction A over `AdinkraCode.generator` by norm — no number theory used — and
///     multiplies by `etaPowMinus8Geometric`, which builds the 8-colour partition series by
///     repeated geometric-series convolution.
///   • **Route M (modular/number-theoretic).** `eisensteinE4` builds the same numerator from
///     divisor sums (240 * sigma_3(n)) — no lattice touched — and multiplies by
///     `etaPowMinus8Pentagonal`, which builds the same denominator from Euler's pentagonal number
///     theorem followed by series inversion.
///
/// **Honest limit on the word "independent."** The two routes' *numerators* are genuinely disjoint
/// (point counting vs. divisor sums, sharing no input). The two routes' *denominators* are the same
/// mathematical object computed by disjoint algorithms — algorithmic independence, not
/// derivational. The third check (`convolutionCube`) is independent of both: OEIS records that this
/// series cubed is the j-function's coefficient sequence (A000521), so cubing our result and
/// comparing to published j coefficients tests the whole product against an external datum that
/// neither route consumed.
///
/// All arithmetic is `int64` — **no floats anywhere in the graded-dimension path**. These are exact
/// integers; a float would make the byte-lock silently meaningless.
///
/// Anchors (Beacon): I. Frenkel and V. Kac, *Basic representations of affine Lie algebras and dual
/// resonance models*, Invent. Math. 62 (1980); Frenkel–Lepowsky–Meurman, *Vertex Operator Algebras
/// and the Monster* (1988); Conway–Sloane, *SPLAG* ch. 4–5 (Construction A, theta series of E8);
/// Euler's pentagonal number theorem; OEIS **A007245** ("McKay–Thompson series of class 3C for the
/// Monster group"; formula line: expand E_2(z)/Delta(z)^(1/3), i.e. E_4/eta^8) and **A000521** (j).
[<RequireQualifiedAccess>]
module LatticeVoa =

    /// The rank of the lattice this module is specialised to (E8 — the in-tree `E8Lattice`).
    let rank : int = 8

    /// Integer square root by ascent — no `sqrt`, no floats (`isqrt x` is the largest r with r*r ≤ x).
    let isqrt (x: int) : int =
        if x < 0 then
            invalidArg "x" "isqrt is undefined for negative input"
        else
            let mutable r = 0
            while (r + 1) * (r + 1) <= x do
                r <- r + 1
            r

    /// Product of two integer power series, truncated after degree `n` (exact `int64` arithmetic).
    let mulTrunc (n: int) (a: int64[]) (b: int64[]) : int64[] =
        let out = Array.zeroCreate<int64> (n + 1)
        for i in 0 .. min n (a.Length - 1) do
            if a.[i] <> 0L then
                for j in 0 .. min (n - i) (b.Length - 1) do
                    out.[i + j] <- out.[i + j] + a.[i] * b.[j]
        out

    /// Reciprocal of an integer power series whose constant term is 1, truncated after degree `n`.
    /// Standard recurrence `b_0 = 1`, `b_m = - sum_(i=1..m) a_i * b_(m-i)`.
    let reciprocal (n: int) (a: int64[]) : int64[] =
        if a.Length = 0 || a.[0] <> 1L then
            invalidArg "a" "reciprocal requires a power series with constant term 1"
        else
            let b = Array.zeroCreate<int64> (n + 1)
            b.[0] <- 1L
            for m in 1 .. n do
                let mutable acc = 0L
                for i in 1 .. m do
                    let ai = if i < a.Length then a.[i] else 0L
                    acc <- acc + ai * b.[m - i]
                b.[m] <- -acc
            b

    // ── Route L: the lattice numerator ──────────────────────────────────────────────────────

    /// **Route L numerator.** The theta series of the in-tree lattice, by explicit enumeration of
    /// lattice points — counting, not number theory.
    ///
    /// `L_A(C) = { x in Z^8 : x mod 2 in C }` for `C = AdinkraCode.allCodewords`. Every member is
    /// written `x = c + 2y` for a codeword `c`, so membership holds **by construction** and the walk
    /// is a depth-first descent over the coordinates with a norm budget.
    ///
    /// The returned array is indexed by `m = (x.x)/4`, which is the E8-normalised half-norm
    /// (the rescaled form is `(x.y)/2`, under which the 240 minimal vectors have norm 2). The
    /// division by 4 is checked exact at every leaf — that check **is** the code's double-evenness
    /// (`x.x = wt(x mod 2) mod 4`), so a non-doubly-even generator makes this function throw rather
    /// than silently truncate.
    let thetaByEnumeration (n: int) : int64[] =
        if n < 0 then
            invalidArg "n" "n must be non-negative"
        else
            let dim = AdinkraCode.length
            let budget = 4 * n
            let theta = Array.zeroCreate<int64> (n + 1)
            let codewords = AdinkraCode.allCodewords

            let rec walk (c: int[]) (i: int) (rem: int) =
                if i = dim then
                    let normSq = budget - rem

                    if normSq % 4 <> 0 then
                        invalidOp (
                            System.String.Format(
                                CultureInfo.InvariantCulture,
                                "Construction-A vector of norm^2 {0} is not doubly-even; the generator is not a doubly-even code.",
                                normSq
                            )
                        )
                    else
                        let m = normSq / 4
                        theta.[m] <- theta.[m] + 1L
                else
                    // v ranges over the integers of the same parity as c.[i] with v*v ≤ rem.
                    let s = isqrt rem
                    let mutable v = -s

                    if (((v - c.[i]) % 2) + 2) % 2 <> 0 then
                        v <- v + 1

                    while v <= s do
                        walk c (i + 1) (rem - v * v)
                        v <- v + 2

            for c in codewords do
                walk c 0 budget

            theta

    /// **Route L denominator.** `prod_(k≥1) (1 - q^k)^(-8)` by repeated geometric-series
    /// convolution: multiplying by `1/(1 - q^k)` is the in-place prefix recurrence
    /// `a_i += a_(i-k)`, applied 8 times per `k` (one per colour). Counts partitions into parts of
    /// 8 colours.
    let etaPowMinus8Geometric (n: int) : int64[] =
        if n < 0 then
            invalidArg "n" "n must be non-negative"
        else
            let a = Array.zeroCreate<int64> (n + 1)
            a.[0] <- 1L
            for k in 1 .. n do
                for _ in 1 .. rank do
                    for i in k .. n do
                        a.[i] <- a.[i] + a.[i - k]
            a

    // ── Route M: the modular numerator ──────────────────────────────────────────────────────

    /// `sigma_3(m)` — the sum of the cubes of the divisors of `m` (exact integer).
    let sigma3 (m: int) : int64 =
        if m < 1 then
            invalidArg "m" "sigma3 is defined for m ≥ 1"
        else
            let mutable acc = 0L
            for d in 1 .. m do
                if m % d = 0 then
                    acc <- acc + int64 d * int64 d * int64 d
            acc

    /// **Route M numerator.** The Eisenstein series `E_4 = 1 + 240 * sum_(m≥1) sigma_3(m) q^m` —
    /// built from divisor sums alone. No lattice, no codeword, no point count is read.
    let eisensteinE4 (n: int) : int64[] =
        if n < 0 then
            invalidArg "n" "n must be non-negative"
        else
            Array.init (n + 1) (fun m -> if m = 0 then 1L else 240L * sigma3 m)

    /// `prod_(k≥1) (1 - q^k)` by **Euler's pentagonal number theorem**: the coefficients vanish
    /// except at the generalised pentagonal numbers `k(3k∓1)/2`, where they are `(-1)^k`.
    let eulerProduct (n: int) : int64[] =
        if n < 0 then
            invalidArg "n" "n must be non-negative"
        else
            let p = Array.zeroCreate<int64> (n + 1)
            p.[0] <- 1L
            let mutable k = 1
            let mutable go = true

            while go do
                let g1 = k * (3 * k - 1) / 2
                let g2 = k * (3 * k + 1) / 2

                if g1 > n && g2 > n then
                    go <- false
                else
                    let s = if k % 2 = 1 then -1L else 1L
                    if g1 <= n then p.[g1] <- p.[g1] + s
                    if g2 <= n then p.[g2] <- p.[g2] + s
                    k <- k + 1

            p

    /// **Route M denominator.** The same `prod (1 - q^k)^(-8)` as `etaPowMinus8Geometric`, by a
    /// disjoint algorithm: pentagonal expansion, three squarings to reach the 8th power, then
    /// series inversion. Agreement with the geometric route is an algorithmic cross-check.
    let etaPowMinus8Pentagonal (n: int) : int64[] =
        let p = eulerProduct n
        let p2 = mulTrunc n p p
        let p4 = mulTrunc n p2 p2
        let p8 = mulTrunc n p4 p4
        reciprocal n p8

    // ── The graded dimensions, both ways ────────────────────────────────────────────────────

    /// `dim (V_L)_n` for `n = 0 .. n`, by **route L** (lattice enumeration * geometric partitions).
    let gradedDimensionsLattice (n: int) : int64[] =
        mulTrunc n (thetaByEnumeration n) (etaPowMinus8Geometric n)

    /// `dim (V_L)_n` for `n = 0 .. n`, by **route M** (Eisenstein divisor sums * pentagonal inverse).
    let gradedDimensionsEisenstein (n: int) : int64[] =
        mulTrunc n (eisensteinE4 n) (etaPowMinus8Pentagonal n)

    /// The convolution cube of a series — the third, externally-anchored check. OEIS records that
    /// A007245 cubed is A000521, the coefficient sequence of the modular function j; neither route
    /// above consumes any j datum, so this compares the whole product against an outside number.
    let convolutionCube (n: int) (a: int64[]) : int64[] =
        mulTrunc n (mulTrunc n a a) a

    // ── Byte-lock encoding (text, never binary) ─────────────────────────────────────────────

    /// Lower-case, zero-padded 16-digit big-endian hex for one graded dimension — the
    /// `no-binary-in-proof-lineage` encoding (hex-in-JSON: diffable, DST-replayable, auditable).
    let toHex (v: int64) : string =
        v.ToString("x16", CultureInfo.InvariantCulture)

    /// Inverse of `toHex`, for replaying a committed vector.
    let ofHex (s: string) : int64 =
        System.Int64.Parse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture)
