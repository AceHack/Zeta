namespace Zeta.Core.FSharp.TriBoolean

open System.Numerics
open Zeta.Core

/// Ball — **the METRIC register of the number that knows what it does not know** (workitem
/// 081KTWFYC9108QG0R003A031PB; Aaron: "something that knows what it does not know so it's not
/// just truncated"). A value carried as CENTER ± RADIUS over arbitrary-precision integers (the
/// bigint corner first — no float anywhere, DST-clean). The laws:
///
///   1. EXACT ⇔ radius 0 (`IsExact` is honest — an inexact value can never claim exactness).
///   2. CONTAINMENT: the true value never escapes the ball — every operation's output ball
///      contains every possible result of operating on points inside the input balls.
///   3. LOSSY OPS WIDEN, NEVER ROUND: precision shedding (`shed`) moves the center to a coarser
///      grid and grows the radius by EXACTLY the distance moved — loss is accounted, not hidden.
///   4. COMPARISONS RETURN Tri: T/F only when the balls are DISJOINT; overlap ⇒ Tri.N — a
///      predicate over uncertain values refuses to lie (the TriBoolean tie).
///
/// Registered behind UniversalNumber's port (`Ball.universal`): BitsUsed is the SIGNAL ABOVE THE
/// NOISE — bits of the center that stand taller than the radius (radius 0 ⇒ every bit; a radius
/// as tall as the center ⇒ zero meaningful bits). Distinct from SoftValue: this is a BOUND
/// (guaranteed containment), that is a BELIEF (calibrated confidence) — both registers stay.
///
/// Beacon: Moore, *Interval Analysis* (1966); Johansson, *Arb: ball arithmetic* (IEEE TC 2017);
/// Gustafson, unums/valids. Differential oracle vs MPFR/BigDecimal = the port's named next.
[<RequireQualifiedAccess>]
module Ball =

    type B =
        { Center: BigInteger
          /// Always ≥ 0 (constructors enforce; ops preserve).
          Radius: BigInteger }

    /// An exact ball — radius 0 (law 1's left side).
    let exact (c: BigInteger) : B = { Center = c; Radius = BigInteger.Zero }

    /// Construct with an explicit uncertainty. A negative radius is REFUSED, never absorbed.
    let create (c: BigInteger) (r: BigInteger) : Result<B, string> =
        if r.Sign < 0 then Error(sprintf "ball radius must be ≥ 0, got %O — uncertainty has no sign" r)
        else Ok { Center = c; Radius = r }

    let inline private absI (v: BigInteger) = BigInteger.Abs v

    /// Addition: centers add; radii add EXACTLY (Moore — no rounding exists at this carrier).
    let add (a: B) (b: B) : B =
        { Center = a.Center + b.Center; Radius = a.Radius + b.Radius }

    /// Negation/subtraction: the radius is unsigned uncertainty — it never shrinks by sign games.
    let neg (a: B) : B = { a with Center = -a.Center }
    let sub (a: B) (b: B) : B = add a (neg b)

    /// Multiplication: |a|·rb + |b|·ra + ra·rb (Moore's product bound) — EXACT in bigint, so the
    /// only widening here is the honest geometry of the product, never a representation loss.
    let mul (a: B) (b: B) : B =
        { Center = a.Center * b.Center
          Radius = absI a.Center * b.Radius + absI b.Center * a.Radius + a.Radius * b.Radius }

    /// PRECISION SHEDDING — the lossy op, and the law-3 exemplar: drop the low `bits` bits of the
    /// center (floor to the coarser grid) and WIDEN the radius by exactly the distance moved.
    /// The original ball stays inside the shed ball (containment); nothing is silently rounded.
    let shed (bits: int) (a: B) : B =
        if bits <= 0 then
            a
        else
            let grid = BigInteger.Pow(BigInteger(2), bits)
            let q = BigInteger.Divide(a.Center, grid) // truncates toward zero
            let floored = if a.Center.Sign < 0 && q * grid <> a.Center then q - BigInteger.One else q
            let newCenter = floored * grid
            let moved = a.Center - newCenter // ∈ [0, grid)
            { Center = newCenter; Radius = a.Radius + moved }

    /// Does the ball contain a point? (The containment law's probe.)
    let contains (p: BigInteger) (a: B) : bool = absI (p - a.Center) <= a.Radius

    /// `lt a b` — is a < b? T/F only when the balls are DISJOINT; any overlap (including a
    /// touching endpoint) is Tri.N: the data cannot support a verdict, so none is issued.
    let lt (a: B) (b: B) : Tri =
        if a.Center + a.Radius < b.Center - b.Radius then Tri.T
        elif a.Center - a.Radius > b.Center + b.Radius then Tri.F
        else Tri.N

    /// `eq a b` — certain equality needs BOTH balls exact and equal; disjoint balls are certainly
    /// unequal; everything else is held (Tri.N).
    let eq (a: B) (b: B) : Tri =
        if a.Radius.IsZero && b.Radius.IsZero then
            if a.Center = b.Center then Tri.T else Tri.F
        elif absI (a.Center - b.Center) > a.Radius + b.Radius then
            Tri.F
        else
            Tri.N

    /// The bits of the center that stand TALLER THAN the radius — the signal above the noise.
    let private bitLen (v: BigInteger) = if v.IsZero then 0 else int ((absI v).GetBitLength())

    /// The port adapter: Ball as a universal number. IsExact is law 1; BitsUsed is the honest
    /// resolution accounting the Resolution primitive reads (signal bits over noise bits).
    let universal: UniversalNumber.IUniversalNumber<B> =
        { new UniversalNumber.IUniversalNumber<B> with
            member _.Zero = exact BigInteger.Zero
            member _.One = exact BigInteger.One
            member _.Add a b = add a b
            member _.Mul a b = mul a b
            member _.BitsUsed v =
                if v.Radius.IsZero then bitLen v.Center
                else max 0 (bitLen v.Center - bitLen v.Radius)
            member _.IsExact v = v.Radius.IsZero }
