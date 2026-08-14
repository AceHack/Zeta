namespace Zeta.Core

open System
open System.Globalization

/// **An element of `Z[zeta_16][1/sqrt2]` - the exact amplitude carrier (Lumen 2026-08-14).**
///
/// `value = (sum_{j=0..7} Coeffs[j] * zeta^j) / (sqrt2)^K`, with `zeta = zeta_16 = e^{i*pi/8}` and `K >= 0`.
///
/// **Why this ring and not another.** `Phi_16(x) = x^8 + 1`, so the power basis `1, zeta, ..., zeta^7`
/// has rank `phi(16) = 8` and reduction is *negacyclic* - `zeta^{8+m} = -zeta^m` - which makes
/// multiplication a length-8 signed convolution and nothing more. The ring contains, as sub-lattices:
///
///   - **`zeta_4 = i = zeta_16^4`** - the Gaussian integers `Z[i]`, which is the carrier
///     `src/Core.TLA/specs/QuorumPhaseCancellation.tla` already restricted itself to in order to be
///     checkable at all. `ofGaussian` is that bridge, and it is exact.
///   - **`zeta_8 = zeta_16^2`, hence `sqrt2 = zeta_8 + zeta_8^-1 = zeta^2 - zeta^6`** and therefore
///     `1/sqrt2`. With the denominator exponent that is **Clifford+T's ring `Z[1/sqrt2, i]`**
///     (Giles-Selinger 2013; Kliuchnikov-Maslov-Mosca 2013) - which is exactly what
///     `SoftChip8.forkOnInput`'s `sqrt 0.5` branch factor needs, and it is the only irrational
///     CHIP-8 actually produces.
///   - **16 distinct phases** - one root of unity per key of the 16-key `ActionGrammar` alphabet.
///
/// So **N = 16 is not a separate choice from N = 8 or N = 4; it contains both.** The "fall back to
/// N = 8" branch of the workitem is a *sub-lattice selection*, not a different implementation.
///
/// **Canonical form, and why it is what makes this byte-lockable.** `(u, K)` is reduced until
/// `sqrt2` does not divide `u` (and `K = 0` when `u = 0`). That representation is **unique**: if
/// `u/(sqrt2)^K = u'/(sqrt2)^K'` with both reduced and `K > K'`, then `sqrt2 | u`, a contradiction.
/// Unique + integral means equality is decidable, ordering is unnecessary, and the wire form is a
/// list of decimal integers. **`encode` is the text a four-oracle byte-lock would hash** - no
/// binary, per `no-binary-in-proof-lineage`.
///
/// **Divisibility by `sqrt2` is checked, never guessed.** `sqrt2^2 = 2`, so `u/sqrt2 = u*sqrt2/2`;
/// therefore `sqrt2 | u` **iff every coefficient of `u*sqrt2` is even**. That is the whole test.
///
/// **Honest scope (peel).**
///   - **`|z|^2` is NOT rational in general.** `z * conj z` lands in the real subfield
///     `Z[zeta + zeta^-1][1/2]` - e.g. `|1 + zeta|^2 = 2 + 2cos(pi/8)`. So `normSq` returns a `Cyc`
///     (exact, real) and there is no exact `bornProb` returning rationals. Compare intensities by
///     **exact cross-multiplication** (`intensity a * q = intensity b * p` for `p/q`), never by
///     dividing.
///   - **`toComplex` / `toFloat` are the one-way exit and carry no byte-lock.** They are named so,
///     and they are the only functions in this type's module that touch `float`.
///   - **Continuous-phase states are outside this ring on purpose.** `e^{i*phi}` for generic real
///     `phi` is transcendental; the `QuantumObservableTreaty.closedInterferometer` /
///     `WSet.MachZehnder` visibility sweeps stay on the float carrier and stay outside the treaty.
///     That is a boundary, not a gap.
///
/// **Anchors (Beacon).** Coste-Gannon 1994 and Ng-Schauenburg 2010 - the modular data of a modular
/// tensor category is cyclotomic, so restricting phases to `N`-th roots of unity is where this class
/// of data already lives rather than an approximation of it. Giles-Selinger 2013 and
/// Kliuchnikov-Maslov-Mosca 2013 - exact synthesis over `Z[1/sqrt2, i]` in denominator-exponent
/// form, which is the representation used here. *(CITED-not-page-checked; the denominator-exponent
/// form is the load-bearing one.)*
[<CustomEquality; NoComparison>]
type Cyc =
    { /// Coefficients `a0 .. a7` in the power basis `1, zeta, ..., zeta^7`. Always length 8.
      Coeffs: bigint[]
      /// Denominator exponent: the value is `(sum aj*zeta^j)/(sqrt2)^K`. Always `>= 0`, always reduced.
      K: int }

    override this.Equals(o: obj) =
        match o with
        | :? Cyc as other ->
            this.K = other.K
            && this.Coeffs.Length = other.Coeffs.Length
            && Array.forall2 (fun (a: bigint) (b: bigint) -> a = b) this.Coeffs other.Coeffs
        | _ -> false

    override this.GetHashCode() =
        let mutable h = 17 * (this.K + 1)

        for c in this.Coeffs do
            h <- h * 31 + c.GetHashCode()

        h

/// **The exact cyclotomic ring `Z[zeta_16][1/sqrt2]`.** See the `Cyc` type for what it is and why.
/// Every function here is exact integer arithmetic; the ones that produce `float` say so in the name.
[<RequireQualifiedAccess>]
module Cyc =

    /// `phi(16) = 8` - the Z-rank, and the length of every `Coeffs` array.
    [<Literal>]
    let Rank = 8

    /// `sqrt2 = zeta_8 + zeta_8^-1 = zeta_16^2 - zeta_16^6` as a ring element (exponent 0).
    let private sqrt2Ring: bigint[] = [| 0I; 0I; 1I; 0I; 0I; 0I; -1I; 0I |]

    /// Negacyclic product in `Z[x]/(x^8 + 1)`: `zeta^{8+m} = -zeta^m`. 64 bigint multiply-adds.
    let private mulRing (a: bigint[]) (b: bigint[]) : bigint[] =
        let c = Array.create Rank 0I

        for i in 0 .. Rank - 1 do
            if not a.[i].IsZero then
                for j in 0 .. Rank - 1 do
                    let k = i + j
                    let p = a.[i] * b.[j]

                    if k < Rank then
                        c.[k] <- c.[k] + p
                    else
                        c.[k - Rank] <- c.[k - Rank] - p

        c

    /// `u / sqrt2` when it is exact. `sqrt2^2 = 2`, so `u/sqrt2 = u*sqrt2/2` - divisible **iff**
    /// every coefficient of `u*sqrt2` is even. Checked, never assumed.
    let private tryDivSqrt2 (u: bigint[]) : bigint[] option =
        let v = mulRing u sqrt2Ring

        if Array.forall (fun (x: bigint) -> x.IsEven) v then
            Some(Array.map (fun (x: bigint) -> x / 2I) v)
        else
            None

    /// Reduce to the unique canonical form: `K = 0` when `u = 0`, otherwise `sqrt2` does not divide `u`.
    let private canon (u: bigint[]) (k: int) : Cyc =
        if Array.forall (fun (x: bigint) -> x.IsZero) u then
            { Coeffs = Array.create Rank 0I; K = 0 }
        else
            let mutable cur = u
            let mutable kk = k
            let mutable go = kk > 0

            while go do
                match tryDivSqrt2 cur with
                | Some d ->
                    cur <- d
                    kk <- kk - 1
                    go <- kk > 0
                | None -> go <- false

            { Coeffs = cur; K = kk }

    /// Build from raw coefficients and a denominator exponent, canonicalising. Rejects a wrong-rank
    /// array or a negative exponent rather than silently coercing - a wrong shape here is an
    /// exactness bug wearing a value.
    let create (coeffs: bigint[]) (k: int) : Cyc =
        if isNull (box coeffs) || coeffs.Length <> Rank then
            invalidArg
                "coeffs"
                (String.Format(CultureInfo.InvariantCulture, "Cyc needs exactly {0} coefficients", Rank))

        if k < 0 then
            invalidArg "k" "denominator exponent must be >= 0"

        canon (Array.copy coeffs) k

    /// `0`.
    let zero: Cyc = { Coeffs = Array.create Rank 0I; K = 0 }

    /// An integer of the ring.
    let ofBigInt (n: bigint) : Cyc =
        let c = Array.create Rank 0I
        c.[0] <- n
        canon c 0

    /// An integer of the ring.
    let ofInt (n: int) : Cyc = ofBigInt (bigint n)

    /// `1`.
    let one: Cyc = ofInt 1

    /// `zeta_16^j` for any integer `j` - reduced through `zeta^16 = 1` and `zeta^{8+m} = -zeta^m`.
    let zetaPow (j: int) : Cyc =
        let m = ((j % 16) + 16) % 16
        let c = Array.create Rank 0I

        if m < Rank then c.[m] <- 1I else c.[m - Rank] <- -1I

        { Coeffs = c; K = 0 }

    /// `i = zeta_4 = zeta_16^4`.
    let imag: Cyc = zetaPow 4

    /// `sqrt2 = zeta_16^2 - zeta_16^6`.
    let sqrt2: Cyc = { Coeffs = Array.copy sqrt2Ring; K = 0 }

    /// `1/sqrt2` - the branch factor `SoftChip8.forkOnInput` produces, exactly.
    let invSqrt2: Cyc =
        let c = Array.create Rank 0I
        c.[0] <- 1I
        { Coeffs = c; K = 1 }

    /// **The `Z[zeta_4]` bridge.** A Gaussian integer `re + im*i` as a `Cyc`, exactly - the carrier
    /// `QuorumPhaseCancellation.tla` restricts to. A TLC counterexample is a list of `<<re, im>>`
    /// pairs; mapping each through this makes it an executable F# value with no reinterpretation.
    let ofGaussian (re: bigint) (im: bigint) : Cyc =
        let c = Array.create Rank 0I
        c.[0] <- re
        c.[4] <- im
        canon c 0

    /// `is this exactly 0?` - the only test the exact fold ever needs, and it has no threshold.
    let isZero (a: Cyc) : bool = Array.forall (fun (x: bigint) -> x.IsZero) a.Coeffs

    /// Multiply by `(sqrt2)^n`. Note `sqrt2^n = 2^(n/2) * sqrt2^(n mod 2)`, so this is **one** shift
    /// plus at most **one** ring multiplication - not `n` of them. That matters: a quorum whose
    /// members carry a spread of denominator exponents aligns across that spread on every fold, and
    /// the naive loop makes the spread a multiplicative cost instead of an additive one.
    let private scaleBySqrt2 (u: bigint[]) (n: int) : bigint[] =
        if n <= 0 then
            u
        else
            let half = n / 2
            let scaled = if half = 0 then u else Array.map (fun (x: bigint) -> x <<< half) u
            if n % 2 = 1 then mulRing scaled sqrt2Ring else scaled

    /// Exact addition. Brings both to a common denominator exponent by multiplying the shallower one
    /// by `sqrt2` (a ring element, so this is exact), then adds componentwise.
    let add (a: Cyc) (b: Cyc) : Cyc =
        let k = max a.K b.K
        let ua = scaleBySqrt2 a.Coeffs (k - a.K)
        let ub = scaleBySqrt2 b.Coeffs (k - b.K)
        canon (Array.init Rank (fun i -> ua.[i] + ub.[i])) k

    /// Exact negation - the inverse that makes destructive interference an *exact zero*.
    let neg (a: Cyc) : Cyc =
        { Coeffs = Array.map (fun (x: bigint) -> -x) a.Coeffs
          K = a.K }

    /// Exact subtraction.
    let sub (a: Cyc) (b: Cyc) : Cyc = add a (neg b)

    /// Exact multiplication - negacyclic convolution, denominator exponents add.
    let mul (a: Cyc) (b: Cyc) : Cyc = canon (mulRing a.Coeffs b.Coeffs) (a.K + b.K)

    /// Complex conjugation: `zeta^j -> zeta^-j`, i.e. `zeta^j -> -zeta^{8-j}` for `j >= 1`. The
    /// denominator is real, so `K` is untouched.
    let conj (a: Cyc) : Cyc =
        let c = Array.create Rank 0I
        c.[0] <- a.Coeffs.[0]

        for j in 1 .. Rank - 1 do
            c.[Rank - j] <- c.[Rank - j] - a.Coeffs.[j]

        { Coeffs = c; K = a.K }

    /// **Born intensity `|z|^2 = z * conj z`, exactly.** Real, but *not* rational in general - it
    /// lives in the real subfield - so it stays a `Cyc`. Compare intensities by exact
    /// cross-multiplication; never divide.
    let normSq (a: Cyc) : Cyc = mul a (conj a)

    /// **Sum of a sequence, exactly, in ONE pass.** Measured cost matters here: folding pairwise
    /// with `add` re-aligns the accumulator against every member, so a quorum whose members carry a
    /// spread of denominator exponents pays that spread on every step. Aligning once to the maximum
    /// exponent and summing the coefficient vectors is the same value (addition is exactly
    /// associative in this ring, so the grouping is free) at a fraction of the work. `zero` is the
    /// unit. This is a cost fix only - `add` is unchanged and the two agree by construction.
    let sum (xs: Cyc seq) : Cyc =
        let arr = Seq.toArray xs

        if arr.Length = 0 then
            zero
        else
            let k = arr |> Array.map (fun a -> a.K) |> Array.max
            let acc = Array.create Rank 0I

            for a in arr do
                let u = scaleBySqrt2 a.Coeffs (k - a.K)

                for i in 0 .. Rank - 1 do
                    acc.[i] <- acc.[i] + u.[i]

            canon acc k

    // -- the one-way exit to floats. Nothing below here carries a byte-lock. --------------------

    /// **The one-way exit to a float complex number.** For display, for comparison against the float
    /// carrier, and for the Born readout - never for a decision inside the exact fold, and never
    /// byte-locked.
    let toComplex (a: Cyc) : Complex =
        let mutable re = 0.0
        let mutable im = 0.0

        for j in 0 .. Rank - 1 do
            if not a.Coeffs.[j].IsZero then
                let t = Math.PI * float j / 8.0
                let coeff = float a.Coeffs.[j]
                re <- re + coeff * cos t
                im <- im + coeff * sin t

        let d = Math.Pow(Math.Sqrt 2.0, float a.K)
        { Real = re / d; Imag = im / d }

    /// **The one-way exit for a real element** - the imaginary part is discarded, so this is only
    /// meaningful on the output of `normSq` and its sums.
    let toFloat (a: Cyc) : float = (toComplex a).Real

    // -- the byte-lock surface -----------------------------------------------------------------

    /// **The canonical wire form: `a0,a1,...,a7/sqrt2^K`,** decimal integers, `InvariantCulture`,
    /// no binary. Because the canonical form is unique, two values are equal **iff** their encodings
    /// are equal - which is what makes the amplitude layer byte-lockable across oracles for the
    /// first time. (An encoding, not a golden-vector treaty: minting a cross-oracle golden vector is
    /// a separate decision with its own consent path.)
    let encode (a: Cyc) : string =
        let coeffs =
            a.Coeffs
            |> Array.map (fun (x: bigint) -> x.ToString(CultureInfo.InvariantCulture))
            |> String.concat ","

        String.Format(CultureInfo.InvariantCulture, "{0}/sqrt2^{1}", coeffs, a.K)

    /// Largest coefficient magnitude in bits - the cost measurement the depth-1 argument predicts
    /// grows by `log2 m` over an `m`-member fold, not linearly in depth.
    let coefficientBits (a: Cyc) : int =
        a.Coeffs
        |> Array.fold
            (fun acc (x: bigint) ->
                let b =
                    if x.IsZero then
                        0
                    else
                        int ((System.Numerics.BigInteger.Abs x).GetBitLength())

                max acc b)
            0


/// **The interference fold over the exact carrier - the same fold, minus the epsilon (Lumen 2026-08-14).**
///
/// This is `AmplitudeEmu.mergeOf` with `Cyc` in place of `Complex` and **`Cyc.isZero` in place of
/// `magSq summed <= EPS`**. Nothing else changes: group by outcome, sum, drop what cancelled.
///
/// **What that one substitution buys, and it is not mainly byte-lock.** Conjecture **Z-EPS** was run
/// and HOLDS (`docs/research/2026-08-14-z-eps-run-the-threshold-drop-signals-routing-the-conjecture-and-the-witness-soraya.md`):
/// on the float carrier a **Bob-local, trace-preserving** operation moves Alice's marginal Born
/// probability from `9/34` to `0`. The emulator computes a theory that **signals**. "Tune EPS" is
/// dead as a class - the shift is scale-dependent and the theory is not, so for any `EPS > 0` there
/// is a ray where the shift is order 1. **Admissible fixes are carrier changes, and this is one.**
/// In an exact ring the only droppable value is an **exact zero**, and deleting an additive identity
/// cannot change a later sum, so associativity, scale-covariance and no-signalling all return -
/// **while destructive interference is fully preserved**, because the ring has inverses.
///
/// **The trap, named so nobody walks into it.** An exact carrier makes a model checker *sound* for
/// the quorum-fold properties and **blind to this one**: with nothing left to delete, the signalling
/// defect is invisible **by construction**. It is gone, not hidden - but that means **no test in
/// this module can be the Z-EPS regression test.** The float witness
/// (`tests/Tests.FSharp/Formal/AmplitudeEmuSignalling.Tests.fs`) is retained unchanged as a test
/// **of the float path**, which still exists for the continuous-phase sweeps; and the differential
/// test in `tests/Tests.FSharp/CyclotomicAmplitude.Tests.fs` holds *both* carriers in one assertion,
/// so deleting the float path breaks the pair loudly instead of quietly deleting the evidence that
/// this fix was necessary.
///
/// **Scope.** Carrier only. `QuorumAlgebra.join` / `interfere` are named apart and that is settled;
/// this module does not redesign them. `AmplitudeEmu`'s float path is not deleted - the
/// continuous-phase interferometer sweeps need it and are permanently outside the byte-lock treaty.
[<RequireQualifiedAccess>]
module CyclotomicAmplitude =

    /// A finite formal `Z[zeta_16][1/sqrt2]`-combination of outcomes - the exact counterpart of
    /// `QuorumAlgebra.Contribution<'F>` and of `AmplitudeEmu.Amp`.
    type Contribution<'F> = ('F * Cyc) list

    /// **The interference fold, exactly.** Group by outcome, sum, and drop **only exact zeros**.
    /// The `EPS` comparison has no counterpart here because there is no scale to compare against.
    let mergeOf (a: ('F * Cyc) list) : ('F * Cyc) list =
        a
        |> List.groupBy fst
        |> List.choose (fun (f, group) ->
            let summed = group |> List.map snd |> Cyc.sum
            if Cyc.isZero summed then None else Some(f, summed))

    /// Binary interference - the sum. Exactly associative, exactly commutative in value, unit `[]`.
    let interfere (a: Contribution<'F>) (b: Contribution<'F>) : Contribution<'F> = mergeOf (a @ b)

    /// n-ary interference. `[]` is the identity, so this is the monoid fold.
    let interfereAll (xs: Contribution<'F> list) : Contribution<'F> = xs |> List.concat |> mergeOf

    /// **Canonical form** - one entry per outcome, ordered by the outcome key. This is the form a
    /// byte-lock hashes, and unlike the float version it removes *all* variation, not merely the
    /// representational kind: there is no rounding left to survive it.
    let canonical (a: Contribution<'F>) : Contribution<'F> when 'F: comparison = mergeOf a |> List.sortBy fst

    /// **The exact `step`.** The fork returns **amplitude factors in the ring**, not probabilities -
    /// the float version takes `p` and multiplies by `sqrt p`, which is where an inexact square root
    /// would re-enter. `SoftChip8.forkOnInput`'s balanced branch is `Cyc.invSqrt2` on both arms,
    /// exactly.
    let step (fork: 'F -> ('F * Cyc) list) (a: Contribution<'F>) : Contribution<'F> =
        a
        |> List.collect (fun (f, z) -> fork f |> List.map (fun (f', w) -> f', Cyc.mul z w))
        |> mergeOf

    /// Multiply every amplitude by a ring element. States are **rays**, so this is physically the
    /// identity - and here it is exactly that, which is the property the float carrier lacks.
    let scale (w: Cyc) (a: Contribution<'F>) : Contribution<'F> =
        a |> List.map (fun (f, z) -> f, Cyc.mul w z) |> mergeOf

    /// **Total Born intensity `sum |z|^2`, exactly.** Real, and generally irrational - it lives in
    /// the real subfield, so it stays a `Cyc`.
    let intensityOf (a: Contribution<'F>) : Cyc =
        a |> List.map (fun (_, z) -> Cyc.normSq z) |> Cyc.sum

    /// The exact intensity carried by the outcomes a predicate selects - a marginal, before any
    /// division. Compare two marginals by cross-multiplication, never by dividing.
    let marginalIntensity (pick: 'F -> bool) (a: Contribution<'F>) : Cyc =
        a |> List.filter (fst >> pick) |> intensityOf

    /// Which outcomes exist at all. In the exact carrier an outcome leaves the support **iff** its
    /// amplitude summed to exactly zero - the property the float drop makes scale-dependent.
    let support (a: Contribution<'F>) : 'F list when 'F: comparison = mergeOf a |> List.map fst |> List.sort

    /// **The one-way exit to probabilities.** Floats, therefore **outside the byte-lock treaty** -
    /// the exact statement is `marginalIntensity`, compared by cross-multiplication.
    let bornProbFloat (a: Contribution<'F>) : ('F * float) list =
        let total = Cyc.toFloat (intensityOf a)

        if total = 0.0 then
            []
        else
            a |> List.map (fun (f, z) -> f, Cyc.toFloat (Cyc.normSq z) / total)

    /// **The bridge to the float carrier** - every `Cyc` evaluated to a `Complex`, so an exact state
    /// can be handed to `AmplitudeEmu` and the two carriers compared on the same input. One-way and
    /// lossy by construction; that is the point of the differential test.
    let toFloatState (a: Contribution<'F>) : ('F * Complex) list =
        a |> List.map (fun (f, z) -> f, Cyc.toComplex z)

    /// **The canonical wire form of a whole state**, given a key encoder. Text, decimal integers,
    /// `InvariantCulture`, ordinal-sorted by the encoded key - diffable and mergeable, per
    /// `no-binary-in-proof-lineage`.
    let encode (keyOf: 'F -> string) (a: Contribution<'F>) : string =
        mergeOf a
        |> List.map (fun (f, z) -> String.Format(CultureInfo.InvariantCulture, "{0}={1}", keyOf f, Cyc.encode z))
        |> List.sortWith (fun x y -> String.CompareOrdinal(x, y))
        |> String.concat ";"
