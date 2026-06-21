namespace Zeta.Core

/// # The hex core — the seed
///
/// The seed core (081KT2T2J0008QG0R003VK5GRX) is bounded by **six reservoir walls** (081KT2T2J0008QG0R0026MS6PV):
/// the *hexagonal-six*. Each wall is a two-word primitive pair; together
/// the 12 words are the 12 edges of the Cube-of-Space hexahedron and the
/// 6 walls are its 6 faces.
///
/// This module lands the **most-inevitable-first** slice of the seed
/// (081KT2T2J0008QG0R003VK5GRX — *"build up nouns from the most inevitable first … vectors
/// before trajectories"*): the six-wall enumeration (`Wall`) and the
/// atomic noun (`Vector`), built directly on the existing Cayley–Dickson
/// algebra (`Complex`) rather than re-implementing it. Later slices add
/// the seed computation-expression DSL over a reduced Bayesian model and
/// the `Trajectory` (a derived sequence of vectors).
///
/// ## Attribution (named attribution lives on 081KT2T2J0008QG0R0026MS6PV, the history surface)
///
///   - **Remember When** + **Pay Attention** — the seed pair
///   - **Which Way** + **How Much** — the vector pair (direction + magnitude)
///   - **Rainbow Table**, **Observe Emit** — the remaining two walls
///
/// ## Core math (081KT2T2J0008QG0R0019YVX8M, held don't-collapse)
///
/// The 6 walls rhyme with the **6 bivectors of spacetime algebra
/// Cl(1,3) = the 6 Lorentz generators (3 rotations + 3 boosts)** / the
/// SE(3) 6-DOF / the cube's 6 faces / Cayley–Dickson. The cross-domain
/// rhymes are refereed *adapters on this core interface* (081KT2T2J0008QG0R0019YVX8M), not a
/// totalizing claim — the structural "6" is the through-line, the
/// per-domain conformance stays a hypothesis to referee.

/// The six reservoir walls (081KT2T2J0008QG0R0026MS6PV) — the hex core enumeration. The seed
/// computation expression (a later slice) ranges over these (the
/// hexahedron's six faces). Listed as the canonical pairs: the seed
/// pair (`RememberWhen`, `PayAttention`), the vector pair (`WhichWay`,
/// `HowMuch`), then `RainbowTable` and `ObserveEmit`.
[<RequireQualifiedAccess>]
type Wall =
    | RememberWhen
    | PayAttention
    | WhichWay
    | HowMuch
    | RainbowTable
    | ObserveEmit

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Wall =

    /// All six walls in canonical order (the cube's six faces).
    let all : Wall list =
        [ Wall.RememberWhen
          Wall.PayAttention
          Wall.WhichWay
          Wall.HowMuch
          Wall.RainbowTable
          Wall.ObserveEmit ]

/// The atomic noun of the seed core (081KT2T2J0008QG0R003VK5GRX — *vectors before
/// trajectories*). A vector is two reservoir walls in polar form:
/// **Which Way** (direction, radians) and **How Much** (magnitude,
/// non-negative). It is the polar view of the existing Cayley–Dickson ℂ
/// (`Complex = Doubled<float>`): a vector *is* a complex number whose
/// argument is Which Way and whose modulus is How Much. A `Trajectory`
/// (a later slice) is a sequence of vectors — derived, not atomic.
type Vector =
    { /// Which Way — direction in radians.
      WhichWay: float
      /// How Much — magnitude (non-negative by construction).
      HowMuch: float }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Vector =

    /// The zero vector (no magnitude; direction conventionally 0).
    let zero : Vector = { WhichWay = 0.0; HowMuch = 0.0 }

    /// Construct a vector from direction (radians) and magnitude. A
    /// negative magnitude is normalized to a non-negative modulus with
    /// the direction flipped by π, so `HowMuch` is always a true modulus.
    let make (whichWay: float) (howMuch: float) : Vector =
        if howMuch < 0.0 then
            { WhichWay = whichWay + System.Math.PI
              HowMuch = -howMuch }
        else
            { WhichWay = whichWay
              HowMuch = howMuch }

    /// Cartesian projection onto the existing Cayley–Dickson ℂ
    /// (`Complex = Doubled<float>`): Real = How Much · cos Which Way,
    /// Imag = How Much · sin Which Way.
    let toComplex (v: Vector) : Complex =
        Doubled.make (v.HowMuch * cos v.WhichWay) (v.HowMuch * sin v.WhichWay)

    /// Polar reading of a Cayley–Dickson ℂ value: modulus → How Much,
    /// argument → Which Way. Inverse of `toComplex` for any vector with
    /// non-negative magnitude and direction in (-π, π].
    let ofComplex (c: Complex) : Vector =
        { WhichWay = atan2 c.Imag c.Real
          HowMuch = sqrt (c.Real * c.Real + c.Imag * c.Imag) }

    /// Vector addition computed *through* the existing ℂ algebra
    /// (`ImaginaryStack.complex`): project both vectors to ℂ, add in the
    /// algebra, read the sum back as a polar vector. The seed core
    /// composes the Cayley–Dickson substrate rather than re-deriving it.
    let add (a: Vector) (b: Vector) : Vector =
        ImaginaryStack.complex.Add(toComplex a, toComplex b) |> ofComplex
