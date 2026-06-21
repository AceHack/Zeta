namespace Zeta.Bayesian

/// # The message algebra — the inference kernel (081KT2T2J0008QG0R000S7GHQ8 slice 2)
///
/// The Zeta Infer.NET rewrite (081KT2T2J0008QG0R000S7GHQ8) runs **message passing** over a
/// factor graph: variables and factors exchange *messages*, and the
/// marginals are the products of incoming messages. This module is the
/// kernel those later slices (factor graph → sum-product BP → EP) stack
/// on: the **message algebra**.
///
/// The load-bearing fact (exponential families): a message is an
/// unnormalized exponential-family density carried in **natural
/// parameters**, and the density *product* is **natural-parameter
/// addition**. So:
///
///   - **`product`** (combine two messages) = add natural parameters —
///     the sum-product / BP combine (Kschischang–Frey–Loeliger 2001).
///   - **`divide`** (form the EP *cavity* — remove one message) =
///     subtract natural parameters (Minka 2001).
///   - **`uniform`** (the flat message) = zero natural parameters — the
///     identity for `product`.
///
/// `product` is therefore a commutative monoid (identity `uniform`) and,
/// with `divide`, a commutative group. Each message family exposes that
/// group through the **generic-math** surface (F# SRTP idiom: `static
/// member One` = uniform, `( * )` = product, `( / )` = divide; the C#
/// `IMultiplicativeIdentity` / `IMultiplyOperators` / `IDivisionOperators`
/// twins carry the same meaning per-language). That makes the BP
/// marginal-combine and EP cavity **family-agnostic** — `Message.marginal`
/// works for Gaussian, Beta, Bernoulli, and any future message family
/// uniformly (the ⊗ at message scope; marginalization, the ⊕ /
/// moment-match projection, arrives with EP in a later slice).
///
/// **Domain contract.** The *constructors* (`ofMeanVariance`, `create`,
/// `likelihood`) fail-fast (`invalidArg`) on out-of-domain input
/// (non-finite, non-positive variance/shape, `p ∉ (0,1)`) — a proper
/// message in, always. The *operators* (`( * )`, `( / )`) are pure and
/// deliberately **tolerate improper messages**: the EP cavity (`divide`)
/// routinely yields improper results (negative precision, shape ≤ 0) —
/// that is Minka 2001, not an error. Check `isProper` to *detect*
/// improperness; never forbid it in the operators (that would break EP).
/// In-domain inputs keep the operators finite (no NaN / divide-by-zero).
///
/// Spec source = published papers with formal proofs (clean-room):
/// KFL 2001 (sum-product), Minka 2001 (EP), Bishop PRML ch.2/10
/// (exponential families + conjugacy). The conjugate closed-forms here
/// are cross-checked against `Zeta.Bayesian.BayesianAggregate`.

/// An exponential-family message algebra as a dictionary value
/// (cf. `Zeta.Core.IStarRing`): `Product` combines (= add natural
/// parameters), `Divide` forms the EP cavity (= subtract), `Uniform` is
/// the identity. The generic-math static members on each family are the
/// SRTP twin of this; this interface is the *runtime-polymorphic* form
/// for a heterogeneous factor graph.
type IMessage<'M> =
    abstract Uniform : 'M
    abstract Product : 'M * 'M -> 'M
    abstract Divide : 'M * 'M -> 'M

/// A Gaussian message in **natural parameters**: precision `τ = 1/σ²`
/// and precision-mean `ν = μ·τ`. Product adds `(ν, τ)` — the canonical
/// precision-weighted EP message product; the uniform message is `τ = 0`
/// (infinite variance). Mean `= ν/τ`, Variance `= 1/τ`.
type Gaussian =
    { /// precision-mean ν = μ·τ
      PrecisionMean: float
      /// precision τ = 1/σ²
      Precision: float }

    /// Generic-math multiplicative identity (`System.Numerics`-shaped;
    /// C# `IMultiplicativeIdentity` twin). The flat message — uniform is
    /// the identity for message product (`τ = 0`, infinite variance).
    static member One : Gaussian = { PrecisionMean = 0.0; Precision = 0.0 }

    /// Message product = add natural parameters (the BP combine; C#
    /// `IMultiplyOperators` twin). Two Gaussians multiply to a Gaussian
    /// with precision `τ₁+τ₂` and precision-weighted mean.
    static member ( * ) (a: Gaussian, b: Gaussian) : Gaussian =
        { PrecisionMean = a.PrecisionMean + b.PrecisionMean
          Precision = a.Precision + b.Precision }

    /// EP cavity = subtract natural parameters (C# `IDivisionOperators`
    /// twin). Inverse of `( * )` in the right operand (Minka 2001).
    static member ( / ) (a: Gaussian, b: Gaussian) : Gaussian =
        { PrecisionMean = a.PrecisionMean - b.PrecisionMean
          Precision = a.Precision - b.Precision }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Gaussian =

    /// The flat (uniform) Gaussian message — `Gaussian.One`.
    let uniform : Gaussian = Gaussian.One

    /// A Gaussian from its mean and variance. Fail-fast: `variance` must
    /// be finite and strictly positive (a proper moment-form Gaussian);
    /// `mean` must be finite. (Improper Gaussians — `τ ≤ 0` — arise only
    /// from the EP cavity `divide`, never from this constructor.)
    let ofMeanVariance (mean: float) (variance: float) : Gaussian =
        if not (System.Double.IsFinite mean) then
            invalidArg (nameof mean) "mean must be finite"
        if not (System.Double.IsFinite variance) || variance <= 0.0 then
            invalidArg (nameof variance) "variance must be finite and > 0"
        let tau = 1.0 / variance
        { PrecisionMean = mean * tau; Precision = tau }

    /// Posterior mean μ = ν/τ.
    let mean (g: Gaussian) : float = g.PrecisionMean / g.Precision

    /// Variance σ² = 1/τ.
    let variance (g: Gaussian) : float = 1.0 / g.Precision

    /// A message is *proper* (normalizes to a finite distribution) iff
    /// its precision is positive. EP cavities can be improper.
    let isProper (g: Gaussian) : bool = g.Precision > 0.0

    /// Combine two Gaussian messages (= `a * b`).
    let product (a: Gaussian) (b: Gaussian) : Gaussian = a * b

    /// The EP cavity (= `a / b`).
    let divide (a: Gaussian) (b: Gaussian) : Gaussian = a / b

    /// Distance between two Gaussian messages — max abs difference of the
    /// natural parameters (ν, τ). Used for BP convergence detection. A
    /// non-finite parameter (overflow to ∞/NaN) returns `infinity` so it
    /// always counts as "moved" — `max` would otherwise mask a NaN and
    /// let a divergent run falsely report convergence.
    /// Damped blend in NATURAL parameters: alpha·new + (1−alpha)·old on (precision,
    /// precisionMean) — the standard EP/BP damping step (convex in the exponential family's
    /// natural space, so a damped message is always a valid Gaussian message).
    let blend (alpha: float) (newMsg: Gaussian) (oldMsg: Gaussian) : Gaussian =
        { Precision = alpha * newMsg.Precision + (1.0 - alpha) * oldMsg.Precision
          PrecisionMean = alpha * newMsg.PrecisionMean + (1.0 - alpha) * oldMsg.PrecisionMean }

    let distance (a: Gaussian) (b: Gaussian) : float =
        if not (System.Double.IsFinite a.PrecisionMean && System.Double.IsFinite a.Precision
                && System.Double.IsFinite b.PrecisionMean && System.Double.IsFinite b.Precision) then
            infinity
        else
            max (abs (a.PrecisionMean - b.PrecisionMean)) (abs (a.Precision - b.Precision))

    /// The runtime-polymorphic message algebra dictionary.
    let algebra : IMessage<Gaussian> =
        { new IMessage<Gaussian> with
            member _.Uniform = Gaussian.One
            member _.Product(a, b) = a * b
            member _.Divide(a, b) = a / b }

/// A Beta message (shape parameters `Alpha`, `Beta`) — conjugate to
/// Bernoulli. The natural parameters are `(α-1, β-1)`, so the density
/// product adds them: `α_prod = α₁+α₂-1`. The uniform message is
/// `Beta(1,1)` (flat). Mean `= α/(α+β)`.
type Beta =
    { /// shape parameter α
      Alpha: float
      /// shape parameter β
      Beta: float }

    /// Generic-math multiplicative identity (C# `IMultiplicativeIdentity`
    /// twin). The flat message `Beta(1,1)` = natural parameters `(0,0)`.
    static member One : Beta = { Alpha = 1.0; Beta = 1.0 }

    /// Message product = add natural parameters `(α-1)+(α'-1)` ⇒
    /// `α_prod = α+α'-1` (C# `IMultiplyOperators` twin).
    static member ( * ) (a: Beta, b: Beta) : Beta =
        { Alpha = a.Alpha + b.Alpha - 1.0
          Beta = a.Beta + b.Beta - 1.0 }

    /// EP cavity = subtract natural parameters (C# `IDivisionOperators`
    /// twin). Inverse of `( * )`.
    static member ( / ) (a: Beta, b: Beta) : Beta =
        { Alpha = a.Alpha - b.Alpha + 1.0
          Beta = a.Beta - b.Beta + 1.0 }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Beta =

    /// The flat (uniform) Beta message `Beta(1,1)` — `Beta.One`.
    let uniform : Beta = Beta.One

    /// A Beta from explicit shape parameters. Fail-fast: both must be
    /// finite and strictly positive (a proper Beta). (Improper Betas —
    /// shape ≤ 0 — arise only from the EP cavity `divide`, never here.)
    let create (alpha: float) (beta: float) : Beta =
        if not (System.Double.IsFinite alpha) || alpha <= 0.0 then
            invalidArg (nameof alpha) "alpha must be finite and > 0"
        if not (System.Double.IsFinite beta) || beta <= 0.0 then
            invalidArg (nameof beta) "beta must be finite and > 0"
        { Alpha = alpha; Beta = beta }

    /// Posterior mean α/(α+β).
    let mean (d: Beta) : float = d.Alpha / (d.Alpha + d.Beta)

    /// Variance αβ / ((α+β)²(α+β+1)).
    let variance (d: Beta) : float =
        let s = d.Alpha + d.Beta
        d.Alpha * d.Beta / (s * s * (s + 1.0))

    /// Proper iff both shape parameters are positive.
    let isProper (d: Beta) : bool = d.Alpha > 0.0 && d.Beta > 0.0

    /// The Bernoulli **likelihood message** for `successes` and
    /// `failures`: `Beta(1+s, 1+f)`. `product prior (likelihood s f)`
    /// is the conjugate posterior `Beta(α+s, β+f)` — i.e. exactly
    /// `BayesianAggregate.BetaBernoulli(α,β).Observe(s,f)`.
    let likelihood (successes: float) (failures: float) : Beta =
        if not (System.Double.IsFinite successes) || successes < 0.0 then
            invalidArg (nameof successes) "successes must be finite and >= 0 (fractional soft-counts allowed)"
        if not (System.Double.IsFinite failures) || failures < 0.0 then
            invalidArg (nameof failures) "failures must be finite and >= 0 (fractional soft-counts allowed)"
        { Alpha = 1.0 + successes; Beta = 1.0 + failures }

    /// Combine two Beta messages (= `a * b`).
    let product (a: Beta) (b: Beta) : Beta = a * b

    /// The EP cavity (= `a / b`).
    let divide (a: Beta) (b: Beta) : Beta = a / b

    /// Distance between two Beta messages — max abs difference of the
    /// shape parameters (α, β). Used for BP convergence detection. A
    /// non-finite parameter (overflow to ∞/NaN) returns `infinity` so it
    /// always counts as "moved" (no false convergence on a divergent run).
    let distance (a: Beta) (b: Beta) : float =
        if not (System.Double.IsFinite a.Alpha && System.Double.IsFinite a.Beta
                && System.Double.IsFinite b.Alpha && System.Double.IsFinite b.Beta) then
            infinity
        else
            max (abs (a.Alpha - b.Alpha)) (abs (a.Beta - b.Beta))

    /// The runtime-polymorphic message algebra dictionary.
    let algebra : IMessage<Beta> =
        { new IMessage<Beta> with
            member _.Uniform = Beta.One
            member _.Product(a, b) = a * b
            member _.Divide(a, b) = a / b }

/// A Bernoulli message carried as `ProbTrue = P(x = true)`. Product
/// multiplies the true/false masses and renormalizes (= adding
/// log-odds); uniform = `0.5`.
type Bernoulli =
    { /// P(x = true)
      ProbTrue: float }

    /// Generic-math multiplicative identity (C# `IMultiplicativeIdentity`
    /// twin). The flat message P(true) = 0.5.
    static member One : Bernoulli = { ProbTrue = 0.5 }

    /// Message product: multiply true/false masses, renormalize
    /// (= add log-odds; C# `IMultiplyOperators` twin).
    static member ( * ) (a: Bernoulli, b: Bernoulli) : Bernoulli =
        let t = a.ProbTrue * b.ProbTrue
        let f = (1.0 - a.ProbTrue) * (1.0 - b.ProbTrue)
        { ProbTrue = t / (t + f) }

    /// EP cavity: divide true/false masses, renormalize (subtract
    /// log-odds; C# `IDivisionOperators` twin). Inverse of `( * )`.
    static member ( / ) (a: Bernoulli, b: Bernoulli) : Bernoulli =
        let t = a.ProbTrue / b.ProbTrue
        let f = (1.0 - a.ProbTrue) / (1.0 - b.ProbTrue)
        { ProbTrue = t / (t + f) }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Bernoulli =

    /// The flat (uniform) Bernoulli message P(true) = 0.5 — `Bernoulli.One`.
    let uniform : Bernoulli = Bernoulli.One

    /// A Bernoulli from P(true). Fail-fast: `probTrue` must be finite and
    /// strictly between 0 and 1 — a proper exponential-family Bernoulli
    /// message has *finite* log-odds, so `p ∈ {0, 1}` (a hard certainty)
    /// is not a message (it's a factor). In-`(0,1)` inputs keep `product`
    /// and `divide` finite (the normalizer is always positive).
    let create (probTrue: float) : Bernoulli =
        if not (System.Double.IsFinite probTrue) || probTrue <= 0.0 || probTrue >= 1.0 then
            invalidArg (nameof probTrue) "probTrue must be finite and strictly between 0 and 1"
        { ProbTrue = probTrue }

    /// Proper iff P(true) is strictly inside (0, 1) — finite log-odds.
    let isProper (b: Bernoulli) : bool = b.ProbTrue > 0.0 && b.ProbTrue < 1.0

    /// Combine two Bernoulli messages (= `a * b`).
    let product (a: Bernoulli) (b: Bernoulli) : Bernoulli = a * b

    /// The EP cavity (= `a / b`).
    let divide (a: Bernoulli) (b: Bernoulli) : Bernoulli = a / b

    /// Distance between two Bernoulli messages — abs difference of
    /// P(true). Used for BP convergence detection. A non-finite P(true)
    /// returns `infinity` so it always counts as "moved" (no false
    /// convergence on a divergent run).
    let distance (a: Bernoulli) (b: Bernoulli) : float =
        if not (System.Double.IsFinite a.ProbTrue && System.Double.IsFinite b.ProbTrue) then
            infinity
        else
            abs (a.ProbTrue - b.ProbTrue)

    /// The runtime-polymorphic message algebra dictionary.
    let algebra : IMessage<Bernoulli> =
        { new IMessage<Bernoulli> with
            member _.Uniform = Bernoulli.One
            member _.Product(a, b) = a * b
            member _.Divide(a, b) = a / b }

/// Family-agnostic message-passing primitives over any exp-family
/// message type with generic-math `One` / `( * )` / `( / )` (F# SRTP;
/// C# `IMultiplicativeIdentity` / `IMultiplyOperators` /
/// `IDivisionOperators` twins). The same `marginal` / `cavity` work for
/// Gaussian, Beta, Bernoulli, and any future message family — the payoff
/// of making the message algebra an inumerics thing.
[<RequireQualifiedAccess>]
module Message =

    /// The marginal at a variable = the **product of all incoming
    /// messages** (the BP combine). Generic over the message family via
    /// generic-math `One` / `( * )`.
    let inline marginal (messages: ^M seq) : ^M =
        Seq.fold (fun acc m -> acc * m) LanguagePrimitives.GenericOne messages

    /// The EP **cavity** = the marginal divided by the variable's own
    /// outgoing message (`marginal / outgoing`). Generic over the family
    /// via generic-math `( / )`.
    let inline cavity (marginalMessage: ^M) (outgoing: ^M) : ^M =
        marginalMessage / outgoing
