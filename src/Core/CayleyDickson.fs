namespace Zeta.Core

/// Cayley–Dickson doubling — the structural primitive underlying the
/// "imaginary stack" design captured in the B-0623 trajectory. Given any
/// algebra `A` with addition, negation,
/// multiplication, and conjugation, the doubled algebra `Doubled<'A>`
/// consists of pairs `(a, b)` with
///
///     (a, b) + (c, d) = (a + c, b + d)
///     (a, b) · (c, d) = (a · c − d̄ · b, d · a + b · c̄)
///     conj (a, b)    = (conj a, −b)
///
/// Applied iteratively:
///
///     ℝ → ℂ        — Real → Complex; loses total ordering
///     ℂ → ℍ        — Complex → Quaternion; loses commutativity
///     ℍ → 𝕆        — Quaternion → Octonion; loses associativity
///     𝕆 → 𝕊        — Octonion → Sedenion; loses alternativity + division algebra
///
/// This is the substrate B-0623 names as the carrier of the "imaginary
/// direction" in the cognitive boot sequence; Adinkras (B-0623 follow-up
/// PRs) decorate this structure with colored-edge ECC information. The
/// doubling primitive is the load-bearing object; specific levels
/// (Complex, Quaternion, Octonion) are derived type aliases.
///
/// Implementation note: operations on `'A` are supplied via the
/// `IAlgebra<'A>` dictionary rather than F# statically-resolved type
/// parameters. The dictionary form makes the lift `IAlgebra<'A> →
/// IAlgebra<Doubled<'A>>` directly expressible (the structural fact
/// that motivates this module). SRTPs would require duplicated
/// per-arity inline functions and lose the explicit "I doubled the
/// algebra" surface that's the entire point.
type Doubled<'A> = { Real: 'A; Imag: 'A }

/// Algebra operations required for Cayley–Dickson doubling. A type
/// `'A` qualifies as a (suitably-structured) algebra by providing
/// zero, addition, negation, multiplication, and conjugation. The
/// conjugation operation is the involutive antihomomorphism that
/// makes the doubling well-defined — for ℝ it's the identity; for ℂ
/// it's the standard complex conjugate; for ℍ and beyond it's defined
/// recursively by the doubling formula above.
type IAlgebra<'A> =
    abstract Zero : 'A
    abstract Add : 'A * 'A -> 'A
    abstract Negate : 'A -> 'A
    abstract Mul : 'A * 'A -> 'A
    abstract Conj : 'A -> 'A

[<RequireQualifiedAccess>]
module Doubled =

    /// Construct a doubled element from its real and imaginary parts.
    let make (real: 'A) (imag: 'A) : Doubled<'A> = { Real = real; Imag = imag }

    /// Lift an algebra on `'A` to an algebra on `Doubled<'A>`.
    /// This IS the Cayley–Dickson construction; everything else
    /// in this module is bookkeeping.
    let algebra (inner: IAlgebra<'A>) : IAlgebra<Doubled<'A>> =
        { new IAlgebra<Doubled<'A>> with
            member _.Zero =
                { Real = inner.Zero; Imag = inner.Zero }

            member _.Add(x, y) =
                { Real = inner.Add(x.Real, y.Real)
                  Imag = inner.Add(x.Imag, y.Imag) }

            member _.Negate x =
                { Real = inner.Negate x.Real
                  Imag = inner.Negate x.Imag }

            // (a, b) · (c, d) = (a·c − d̄·b, d·a + b·c̄)
            member _.Mul(x, y) =
                let realPart =
                    inner.Add(
                        inner.Mul(x.Real, y.Real),
                        inner.Negate(inner.Mul(inner.Conj y.Imag, x.Imag))
                    )
                let imagPart =
                    inner.Add(
                        inner.Mul(y.Imag, x.Real),
                        inner.Mul(x.Imag, inner.Conj y.Real)
                    )
                { Real = realPart; Imag = imagPart }

            // conj (a, b) = (conj a, −b)
            member _.Conj x =
                { Real = inner.Conj x.Real
                  Imag = inner.Negate x.Imag } }


/// Base case of the imaginary stack: real numbers as a degenerate
/// algebra over themselves. Conjugation is the identity because ℝ
/// has no imaginary part. Using `float` rather than an exact rational
/// type intentionally — the stack is about structural properties of
/// the doubling, not numerical precision; exact-arithmetic variants
/// can be derived later by providing an `IAlgebra<Rational>` instead.
[<RequireQualifiedAccess>]
module Real =

    let algebra : IAlgebra<float> =
        { new IAlgebra<float> with
            member _.Zero = 0.0
            member _.Add(x, y) = x + y
            member _.Negate x = -x
            member _.Mul(x, y) = x * y
            // ℝ-conjugation is identity (no imaginary part to flip).
            member _.Conj x = x }


/// Type aliases for the first few levels of the imaginary stack.
/// `Complex` = ℝ doubled once; `Quaternion` = ℂ doubled; `Octonion` =
/// ℍ doubled; `Sedenion` = 𝕆 doubled. The naming makes the imaginary
/// stack's stratification readable at the type level, matching the
/// trajectory requirement that category-theory structure remain visible
/// in public type shapes.
type Complex = Doubled<float>
type Quaternion = Doubled<Complex>
type Octonion = Doubled<Quaternion>
type Sedenion = Doubled<Octonion>


/// Pre-computed algebra instances at each level of the imaginary
/// stack. Constructing these once and reusing them is correct because
/// `IAlgebra<'A>` carries no state — it's a pure dictionary of
/// operations. The instances are the structural fact "ℝ → ℂ → ℍ → 𝕆
/// is the imaginary stack" made concrete.
[<RequireQualifiedAccess>]
module ImaginaryStack =

    let complex : IAlgebra<Complex> = Doubled.algebra Real.algebra
    let quaternion : IAlgebra<Quaternion> = Doubled.algebra complex
    let octonion : IAlgebra<Octonion> = Doubled.algebra quaternion
    let sedenion : IAlgebra<Sedenion> = Doubled.algebra octonion
