namespace Zeta.Core

open System.Numerics

/// Universal Number — our PORT (hexagonal architecture: ports & adapters, Cockburn). One interface,
/// many backends behind it (Aaron 2026-06-10: "this is just us hexagonaling our interfaces ... we
/// should have an interface we can pull prior art in behind, all the same interface").
///
/// The port carries the value ops PLUS resolution accounting (`BitsUsed`/`IsExact`) — the bit-budget
/// the `Resolution` primitive reads (physics-of-floats). Adapters plug in:
///   • `bigint` (this file — first concrete adapter; arbitrary-precision INTEGER, always exact)
///   • IEEE float/double, the TriBoolean middle-out Float (arbitrary-precision FLOAT / BigFloat)
///   • prior art (MPFR / GMP / BigDecimal / posit) — and prior art doubles as the TEST ORACLE:
///     differential-test OUR backends' ACCURACY against MPFR/BigDecimal, and benchmark their SPEED
///     against IEEE/MPFR (Aaron: "use prior art to test the speed and accuracy of our own").
///
/// Pure interface, no classes (the interfaces-free / classes-earned meta-rule). The port ops are TOTAL
/// (exact backends); the Result-typed decline-don't-coerce discipline stays at the DynamicValue edge,
/// and the coercing INumberBase override is opt-in (never default) — see universal/number.md.
[<RequireQualifiedAccess>]
module UniversalNumber =

    /// The port. 'T = the carrier number (bigint, float, TriBoolean.Float, ...).
    type IUniversalNumber<'T> =
        abstract Zero: 'T
        abstract One: 'T
        abstract Add: 'T -> 'T -> 'T
        abstract Mul: 'T -> 'T -> 'T
        /// Significant bits currently carrying information (the resolution accounting input).
        abstract BitsUsed: 'T -> int
        /// True if the value is represented exactly (no ULP / precision loss). Integers: always true.
        abstract IsExact: 'T -> bool

    /// The BigInteger adapter — first concrete backend (arbitrary-precision integer; the bigint corner
    /// of the universal number, the integer analog of our BigFloat). Always exact; resolution = bit
    /// length. .NET `BigInteger` is itself `INumberBase`, so this adapter bridges it to our port.
    let bigInt: IUniversalNumber<BigInteger> =
        { new IUniversalNumber<BigInteger> with
            member _.Zero = BigInteger.Zero
            member _.One = BigInteger.One
            member _.Add a b = a + b
            member _.Mul a b = a * b
            member _.BitsUsed v =
                if v.IsZero then 0 else int (BigInteger.Abs(v).GetBitLength())
            member _.IsExact _ = true }
