module Zeta.Bayesian.Tests.MessageTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Bayesian

// The message algebra (081KT2T2J0008QG0R000S7GHQ8 slice 2) — the inference kernel of the
// Zeta Infer.NET rewrite. These tests are the formal-proof obligations
// from the clean-room spec papers (KFL 2001 sum-product; Minka 2001 EP;
// Bishop PRML conjugacy): product is a commutative monoid (identity =
// uniform) and a group with divide (the EP cavity), the Gaussian product
// is precision-weighted, and the Beta conjugate product matches the
// existing BayesianAggregate.BetaBernoulli. "The compilers don't lie."

// ─── Gaussian: precision-weighted product, identity, cavity ───

[<Fact>]
let ``Gaussian uniform is the identity for product`` () =
    let g = Gaussian.ofMeanVariance 1.5 2.0
    let viaLeft = Gaussian.product Gaussian.uniform g
    let viaRight = Gaussian.product g Gaussian.uniform
    Gaussian.mean viaLeft |> should (equalWithin 1e-9) (Gaussian.mean g)
    Gaussian.variance viaRight |> should (equalWithin 1e-9) (Gaussian.variance g)

[<Fact>]
let ``Gaussian product is precision-weighted (KFL/Bishop)`` () =
    // N(0,1) · N(2,1): equal precision → mean = midpoint 1.0, variance halves to 0.5
    let p = Gaussian.product (Gaussian.ofMeanVariance 0.0 1.0) (Gaussian.ofMeanVariance 2.0 1.0)
    Gaussian.mean p |> should (equalWithin 1e-9) 1.0
    Gaussian.variance p |> should (equalWithin 1e-9) 0.5

[<Fact>]
let ``Gaussian divide inverts product (the EP cavity)`` () =
    let a = Gaussian.ofMeanVariance 1.0 2.0
    let b = Gaussian.ofMeanVariance -0.5 3.0
    let back = Gaussian.divide (Gaussian.product a b) b
    Gaussian.mean back |> should (equalWithin 1e-9) (Gaussian.mean a)
    Gaussian.variance back |> should (equalWithin 1e-9) (Gaussian.variance a)

[<Fact>]
let ``Gaussian product is commutative and associative`` () =
    let a = Gaussian.ofMeanVariance 0.0 1.0
    let b = Gaussian.ofMeanVariance 2.0 4.0
    let c = Gaussian.ofMeanVariance -1.0 0.5
    Gaussian.mean (Gaussian.product a b) |> should (equalWithin 1e-9) (Gaussian.mean (Gaussian.product b a))
    let left = Gaussian.product (Gaussian.product a b) c
    let right = Gaussian.product a (Gaussian.product b c)
    Gaussian.mean left |> should (equalWithin 1e-9) (Gaussian.mean right)
    Gaussian.variance left |> should (equalWithin 1e-9) (Gaussian.variance right)

// ─── Beta: conjugate-to-Bernoulli, grounded against BayesianAggregate ───

[<Fact>]
let ``Beta uniform Beta(1,1) is the identity for product`` () =
    let d = Beta.create 3.0 5.0
    let p = Beta.product Beta.uniform d
    p.Alpha |> should (equalWithin 1e-9) 3.0
    p.Beta |> should (equalWithin 1e-9) 5.0

[<Fact>]
let ``Beta product with likelihood is the conjugate posterior`` () =
    // prior Beta(2,3), observe 5 successes + 1 failure → Beta(7,4)
    let posterior = Beta.product (Beta.create 2.0 3.0) (Beta.likelihood 5.0 1.0)
    posterior.Alpha |> should (equalWithin 1e-9) 7.0
    posterior.Beta |> should (equalWithin 1e-9) 4.0

[<Fact>]
let ``Beta conjugate product matches BayesianAggregate.BetaBernoulli`` () =
    // the message-algebra posterior must equal the existing hand-rolled
    // conjugate update — the referee against existing substrate
    let bb = BetaBernoulli(2.0, 3.0)
    bb.Observe(5L, 1L)
    let posterior = Beta.product (Beta.create 2.0 3.0) (Beta.likelihood 5.0 1.0)
    posterior.Alpha |> should (equalWithin 1e-9) bb.Alpha
    posterior.Beta |> should (equalWithin 1e-9) bb.Beta
    Beta.mean posterior |> should (equalWithin 1e-9) bb.Mean

[<Fact>]
let ``Beta divide inverts product (the EP cavity)`` () =
    let a = Beta.create 4.0 7.0
    let b = Beta.create 2.0 3.0
    let back = Beta.divide (Beta.product a b) b
    back.Alpha |> should (equalWithin 1e-9) a.Alpha
    back.Beta |> should (equalWithin 1e-9) a.Beta

// ─── Bernoulli: discrete combine ───

[<Fact>]
let ``Bernoulli uniform 0.5 is the identity for product`` () =
    let b = Bernoulli.create 0.8
    (Bernoulli.product Bernoulli.uniform b).ProbTrue |> should (equalWithin 1e-9) 0.8

[<Fact>]
let ``Bernoulli product multiplies and renormalizes`` () =
    // 0.8 · 0.6 → 0.48 / (0.48 + 0.2·0.4=0.08) = 0.48/0.56
    let p = Bernoulli.product (Bernoulli.create 0.8) (Bernoulli.create 0.6)
    p.ProbTrue |> should (equalWithin 1e-9) (0.48 / 0.56)

[<Fact>]
let ``Bernoulli divide inverts product`` () =
    let a = Bernoulli.create 0.7
    let b = Bernoulli.create 0.4
    (Bernoulli.divide (Bernoulli.product a b) b).ProbTrue |> should (equalWithin 1e-9) a.ProbTrue

// ─── The IMessage dictionaries route to the same ops (generic BP/EP) ───

[<Fact>]
let ``IMessage algebra dictionaries agree with the direct ops`` () =
    let g = Gaussian.algebra
    let p = g.Product(Gaussian.ofMeanVariance 0.0 1.0, Gaussian.ofMeanVariance 2.0 1.0)
    Gaussian.mean p |> should (equalWithin 1e-9) 1.0
    let bt = Beta.algebra
    (bt.Product(Beta.create 2.0 3.0, Beta.likelihood 5.0 1.0)).Alpha |> should (equalWithin 1e-9) 7.0

// ─── Generic-math surface: One / ( * ) / ( / ) and family-agnostic BP ───

[<Fact>]
let ``generic-math operators equal the named ops`` () =
    // ( * ) = product, ( / ) = divide, One = uniform — across families
    Gaussian.mean (Gaussian.ofMeanVariance 0.0 1.0 * Gaussian.ofMeanVariance 2.0 1.0)
    |> should (equalWithin 1e-9) 1.0
    (Beta.create 2.0 3.0 * Beta.likelihood 5.0 1.0).Alpha |> should (equalWithin 1e-9) 7.0
    Gaussian.One |> should equal Gaussian.uniform
    Beta.One |> should equal Beta.uniform

[<Fact>]
let ``Message.marginal is family-agnostic (SRTP over generic-math One/( * ))`` () =
    // the SAME generic function combines Gaussian messages …
    let g = Message.marginal [ Gaussian.ofMeanVariance 0.0 1.0; Gaussian.ofMeanVariance 2.0 1.0 ]
    Gaussian.mean g |> should (equalWithin 1e-9) 1.0
    Gaussian.variance g |> should (equalWithin 1e-9) 0.5
    // … and Beta messages — prior · likelihood = conjugate posterior Beta(7,4)
    let b = Message.marginal [ Beta.create 2.0 3.0; Beta.likelihood 5.0 1.0 ]
    b.Alpha |> should (equalWithin 1e-9) 7.0
    b.Beta |> should (equalWithin 1e-9) 4.0
    // empty product = the identity (One)
    (Message.marginal (List.empty<Beta>)) |> should equal Beta.One

[<Fact>]
let ``Message.cavity divides the outgoing message out of the marginal`` () =
    let m1 = Gaussian.ofMeanVariance 1.0 2.0
    let m2 = Gaussian.ofMeanVariance -0.5 3.0
    let marginal = Message.marginal [ m1; m2 ]
    let cav = Message.cavity marginal m2   // remove m2 → should recover m1
    Gaussian.mean cav |> should (equalWithin 1e-9) (Gaussian.mean m1)
    Gaussian.variance cav |> should (equalWithin 1e-9) (Gaussian.variance m1)

// ─── Domain contract: constructors fail-fast; operators tolerate improper ───

[<Fact>]
let ``Gaussian.ofMeanVariance rejects non-positive or non-finite variance`` () =
    (fun () -> Gaussian.ofMeanVariance 0.0 0.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Gaussian.ofMeanVariance 0.0 -1.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Gaussian.ofMeanVariance nan 1.0 |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``Beta.create rejects non-positive shape parameters`` () =
    (fun () -> Beta.create 0.0 1.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Beta.create 1.0 -2.0 |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``Beta.likelihood rejects negative counts`` () =
    (fun () -> Beta.likelihood -1.0 0.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Beta.likelihood 0.0 infinity |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``Bernoulli.create rejects p outside the open interval (0,1)`` () =
    (fun () -> Bernoulli.create 0.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Bernoulli.create 1.0 |> ignore) |> should throw typeof<System.ArgumentException>
    (fun () -> Bernoulli.create 1.5 |> ignore) |> should throw typeof<System.ArgumentException>

[<Fact>]
let ``divide may yield an improper message and isProper detects it (EP cavity)`` () =
    // narrow ÷ wide → negative precision: improper, but NOT an error (Minka 2001)
    let narrow = Gaussian.ofMeanVariance 0.0 1.0    // τ = 1
    let wide = Gaussian.ofMeanVariance 0.0 2.0       // τ = 0.5
    let cav = Gaussian.divide wide narrow            // τ = 0.5 - 1 = -0.5 < 0
    Gaussian.isProper cav |> should equal false
    cav.Precision |> should (equalWithin 1e-9) -0.5  // well-defined, just improper

// ═══════════════════════════════════════════════════════════════════
// C1 (081KT2T2J0008QG0R000YZ3NMY P0) — Gaussian message product is a COMMUTATIVE GROUP over
// the proper-message domain. FsCheck half of the BP-16 cross-check; the
// Z3 twin (Formal/Z3.Laws.Tests.fs) proves the ideal-real algebra is an
// abelian group symbolically. THIS proves the float impl CONFORMS over
// the domain. Disagreement IS the finding — the tolerance below is NOT
// to be relaxed to hide a real divergence.
//
// Anchor: KFL 2001 (product = combine), Minka 2001 (divide = cavity),
// Wainwright-Jordan 2008 §3 (exp-family natural params form a free
// abelian group under +/-). Authored by Soraya (formal-verification-
// expert) per 081KT2T2J0008QG0R000YZ3NMY. uniform identity is `Gaussian.One`.
//
// Domain discipline: generate over the NATURAL parameters (precision
// τ>0, precision-mean ν) so every generated message is PROPER. Improper
// messages are EP cavities, not a group failure (Minka 2001).
// ═══════════════════════════════════════════════════════════════════

/// Build a PROPER Gaussian from two raw floats (FsCheck's NormalFloat
/// excludes NaN/inf), clamped to a well-conditioned band so a property
/// failure means a REAL algebraic divergence, not an engineered overflow
/// (overflow-at-the-edge is the separate Z3/C9 obligation). τ forced > 0
/// so every message is proper (Gaussian.isProper) — improper messages are
/// EP cavities, not a group failure (Minka 2001).
let private mkProper (nuRaw: float) (tauRaw: float) : Gaussian =
    let clamp lo hi x = max lo (min hi x)
    { PrecisionMean = clamp -1.0e6 1.0e6 nuRaw
      Precision = clamp 1.0e-6 1.0e6 (abs tauRaw) }

/// Natural-parameter equality within an absolute tolerance. Compared on
/// (ν, τ) directly — NOT mean/variance, because mean = ν/τ amplifies
/// error near τ≈0 and would hide a true natural-param divergence. DO NOT widen.
let private gEq (a: Gaussian) (b: Gaussian) : bool =
    let tol = 1e-7
    abs (a.PrecisionMean - b.PrecisionMean) <= tol
    && abs (a.Precision - b.Precision) <= tol

[<Property>]
let ``C1 Gaussian product is associative``
    (NormalFloat nuA) (NormalFloat tauA)
    (NormalFloat nuB) (NormalFloat tauB)
    (NormalFloat nuC) (NormalFloat tauC) =
    let a, b, c = mkProper nuA tauA, mkProper nuB tauB, mkProper nuC tauC
    gEq ((a * b) * c) (a * (b * c))

[<Property>]
let ``C1 Gaussian product is commutative``
    (NormalFloat nuA) (NormalFloat tauA) (NormalFloat nuB) (NormalFloat tauB) =
    let a, b = mkProper nuA tauA, mkProper nuB tauB
    gEq (a * b) (b * a)

[<Property>]
let ``C1 Gaussian One is the two-sided identity for product``
    (NormalFloat nuA) (NormalFloat tauA) =
    let a = mkProper nuA tauA
    gEq (Gaussian.One * a) a && gEq (a * Gaussian.One) a

[<Property>]
let ``C1 Gaussian divide is the right inverse of product (EP cavity round-trip)``
    (NormalFloat nuA) (NormalFloat tauA) (NormalFloat nuB) (NormalFloat tauB) =
    // (a * b) / b = a — the EP cavity recovers the message it removed.
    let a, b = mkProper nuA tauA, mkProper nuB tauB
    gEq ((a * b) / b) a

[<Property>]
let ``C1 Gaussian product of two proper messages stays proper (closure)``
    (NormalFloat nuA) (NormalFloat tauA) (NormalFloat nuB) (NormalFloat tauB) =
    // τ1>0 and τ2>0 ⇒ τ1+τ2>0. The half the PROPER domain satisfies;
    // the cavity (divide) deliberately can leave it — Minka 2001.
    let a, b = mkProper nuA tauA, mkProper nuB tauB
    Gaussian.isProper (a * b)

[<Property>]
let ``C1 Gaussian divide is the natural-parameter inverse element``
    (NormalFloat nuA) (NormalFloat tauA) (NormalFloat nuB) (NormalFloat tauB) =
    // a / b = a * (One / b) — divide IS multiply-by-inverse (group law in element form).
    let a, b = mkProper nuA tauA, mkProper nuB tauB
    let invB = Gaussian.One / b
    gEq (a / b) (a * invB)

// ═══════════════════════════════════════════════════════════════════
// C2 (081KT2T2J0008QG0R000YZ3NMY P0) — Beta message product is a COMMUTATIVE GROUP on the
// SHIFTED natural parameters (α−1, β−1): product = (α₁−1)+(α₂−1) ⇒
// α_prod = α₁+α₂−1, divide subtracts, identity = One = Beta(1,1) ⇒
// naturals (0,0). FsCheck half of the BP-16 cross-check; the Z3 twin
// (Formal/Z3.Laws.Tests.fs) proves the ideal-real shifted-natural
// algebra is an abelian group symbolically.
//
// Anchor: KFL 2001 (product = combine), Minka 2001 (divide = cavity),
// Bishop PRML ch.2 (Beta-Bernoulli conjugacy; α−1,β−1 are the exp-family
// naturals). Wainwright-Jordan 2008 §3.
//
// CLOSURE DIFFERS FROM C1: two ARBITRARY proper Betas are NOT closed
// under product (α=0.1, α'=0.1 ⇒ 0.1+0.1−1 = −0.8 < 0, improper). The
// meaningful closure is the CONJUGATE update: a proper prior × a
// LIKELIHOOD (Beta(1+s,1+f), so α≥1,β≥1 ⇒ naturals ≥ 0) stays proper.
// That is the law tested below — the honest Beta closure, not a false
// "product of two propers stays proper" claim.
// ═══════════════════════════════════════════════════════════════════

/// A PROPER Beta (α>0, β>0) built from two raw floats, clamped to a
/// well-conditioned band so a property failure is a REAL algebraic
/// divergence. NOTE: proper ≠ closed-under-product for Beta (see header).
let private mkProperBeta (aRaw: float) (bRaw: float) : Beta =
    let clamp lo hi x = max lo (min hi x)
    { Alpha = clamp 1.0e-6 1.0e6 (abs aRaw)
      Beta = clamp 1.0e-6 1.0e6 (abs bRaw) }

/// A LIKELIHOOD Beta = Beta(1+s, 1+f) with s,f ≥ 0, so α≥1 ∧ β≥1
/// (shifted-naturals ≥ 0). Product of a proper prior with this stays
/// proper — the conjugate-update closure.
let private mkLikelihoodBeta (sRaw: float) (fRaw: float) : Beta =
    let clampNonNeg hi x = max 0.0 (min hi (abs x))
    { Alpha = 1.0 + clampNonNeg 1.0e6 sRaw
      Beta = 1.0 + clampNonNeg 1.0e6 fRaw }

/// Beta equality on the (α, β) parameters directly within tolerance. DO NOT widen.
let private gEqBeta (a: Beta) (b: Beta) : bool =
    let tol = 1e-7
    abs (a.Alpha - b.Alpha) <= tol && abs (a.Beta - b.Beta) <= tol

[<Property>]
let ``C2 Beta product is associative``
    (NormalFloat aA) (NormalFloat bA) (NormalFloat aB) (NormalFloat bB) (NormalFloat aC) (NormalFloat bC) =
    let a, b, c = mkProperBeta aA bA, mkProperBeta aB bB, mkProperBeta aC bC
    gEqBeta ((a * b) * c) (a * (b * c))

[<Property>]
let ``C2 Beta product is commutative``
    (NormalFloat aA) (NormalFloat bA) (NormalFloat aB) (NormalFloat bB) =
    let a, b = mkProperBeta aA bA, mkProperBeta aB bB
    gEqBeta (a * b) (b * a)

[<Property>]
let ``C2 Beta One = Beta(1,1) is the two-sided identity for product``
    (NormalFloat aA) (NormalFloat bA) =
    let a = mkProperBeta aA bA
    gEqBeta (Beta.One * a) a && gEqBeta (a * Beta.One) a

[<Property>]
let ``C2 Beta divide is the right inverse of product (EP cavity round-trip)``
    (NormalFloat aA) (NormalFloat bA) (NormalFloat aB) (NormalFloat bB) =
    let a, b = mkProperBeta aA bA, mkProperBeta aB bB
    gEqBeta ((a * b) / b) a

[<Property>]
let ``C2 Beta divide is the shifted-natural inverse element``
    (NormalFloat aA) (NormalFloat bA) (NormalFloat aB) (NormalFloat bB) =
    let a, b = mkProperBeta aA bA, mkProperBeta aB bB
    let invB = Beta.One / b
    gEqBeta (a / b) (a * invB)

[<Property>]
let ``C2 Beta proper prior times a likelihood stays proper (conjugate closure)``
    (NormalFloat aPrior) (NormalFloat bPrior) (NormalFloat s) (NormalFloat f) =
    // proper prior (α>0,β>0) × likelihood Beta(1+s,1+f) (α≥1,β≥1) ⇒ proper.
    // This is the HONEST Beta closure — NOT "two arbitrary propers stay proper".
    let prior = mkProperBeta aPrior bPrior
    let like = mkLikelihoodBeta s f
    Beta.isProper (prior * like)

// ═══════════════════════════════════════════════════════════════════
// C3 (081KT2T2J0008QG0R000YZ3NMY P0) — Bernoulli message product is a COMMUTATIVE GROUP via
// LOG-ODDS addition: ℓ = log(p/(1−p)); product adds log-odds (the impl
// multiplies true/false masses + renormalizes, t/(t+f), which IS
// log-odds add), divide subtracts, identity = One = P(true)=0.5 ⇒ ℓ=0.
// FsCheck half of the BP-16 cross-check; the Z3 twin proves log-odds
// add is an abelian group symbolically.
//
// Anchor: KFL 2001 / Minka 2001 / exponential-family (log-odds is the
// Bernoulli natural parameter). Finite log-odds ⟺ p ∈ (0,1) (proper);
// p ∈ {0,1} is a hard factor, not a message. Generators stay strictly
// inside (0,1) via logistic of a bounded log-odds — both keeps the
// prob-space arithmetic well-conditioned AND models "proper".
//
// CLOSURE (unlike Beta) IS unconditional: log-odds add is closed on ℝ,
// and the logistic ℝ→(0,1) bijection carries that to p ∈ (0,1) — the
// impl's normalizer t+f is always positive for proper inputs.
// ═══════════════════════════════════════════════════════════════════

/// A PROPER Bernoulli (p strictly in (0,1)) built as the logistic of a
/// bounded log-odds (|ℓ| ≤ 8 ⇒ p ∈ ~(3e-4, 1−3e-4)) — keeps the
/// probability-space product/divide well-conditioned so a property
/// failure is a REAL divergence, not engineered saturation.
let private mkProperBern (lRaw: float) : Bernoulli =
    let clamp lo hi x = max lo (min hi x)
    let l = clamp -8.0 8.0 lRaw
    { ProbTrue = 1.0 / (1.0 + exp (-l)) }

/// Bernoulli equality on P(true) within tolerance. DO NOT widen.
let private gEqBern (a: Bernoulli) (b: Bernoulli) : bool =
    abs (a.ProbTrue - b.ProbTrue) <= 1e-7

[<Property>]
let ``C3 Bernoulli product is associative``
    (NormalFloat lA) (NormalFloat lB) (NormalFloat lC) =
    let a, b, c = mkProperBern lA, mkProperBern lB, mkProperBern lC
    gEqBern ((a * b) * c) (a * (b * c))

[<Property>]
let ``C3 Bernoulli product is commutative`` (NormalFloat lA) (NormalFloat lB) =
    let a, b = mkProperBern lA, mkProperBern lB
    gEqBern (a * b) (b * a)

[<Property>]
let ``C3 Bernoulli One = 0.5 is the two-sided identity for product`` (NormalFloat lA) =
    let a = mkProperBern lA
    gEqBern (Bernoulli.One * a) a && gEqBern (a * Bernoulli.One) a

[<Property>]
let ``C3 Bernoulli divide is the right inverse of product (EP cavity round-trip)``
    (NormalFloat lA) (NormalFloat lB) =
    let a, b = mkProperBern lA, mkProperBern lB
    gEqBern ((a * b) / b) a

[<Property>]
let ``C3 Bernoulli divide is the log-odds inverse element``
    (NormalFloat lA) (NormalFloat lB) =
    let a, b = mkProperBern lA, mkProperBern lB
    let invB = Bernoulli.One / b
    gEqBern (a / b) (a * invB)

[<Property>]
let ``C3 Bernoulli product of two proper messages stays proper (closure)``
    (NormalFloat lA) (NormalFloat lB) =
    // p ∈ (0,1) ∧ p' ∈ (0,1) ⇒ t,f > 0 ⇒ t/(t+f) ∈ (0,1). Unconditional
    // closure (log-odds add closed on ℝ; logistic bijection to (0,1)).
    let a, b = mkProperBern lA, mkProperBern lB
    Bernoulli.isProper (a * b)
// C6 (081KT2T2J0008QG0R000YZ3NMY P0) — convergence detection is NaN/divergence-SAFE. The BP
// fixpoint loop (FactorGraph.runToFixpoint) decides convergence with the
// residual test `not (distance x y <= tol)` — written that way (not
// `d > tol`) precisely so a NaN/∞ residual counts as MOVED: `NaN <= tol`
// is false in IEEE-754, so `not false` = moved ⇒ a divergent run can
// NEVER falsely report convergence. The per-family `distance` feeds that
// invariant by returning ∞ for any non-finite message.
//
// FsCheck half: the real-float `distance` returns 0 for identical (⇒
// converged) and +∞ for a non-finite message (⇒ moved), per family. The
// Z3 twin (Formal/Z3.Laws.Tests.fs) proves the boolean `not (d<=tol)`
// logic incl. the IEEE NaN/∞ cases (QF_FP) + the finite threshold (QF_LRA).
// ═══════════════════════════════════════════════════════════════════

let private tolC6 = 1e-9
/// The exact residual test from FactorGraph.runToFixpoint: NaN/∞ ⇒ moved.
let private movedC6 (d: float) : bool = not (d <= tolC6)

[<Property>]
let ``C6 Gaussian identical converges, non-finite residual moves (never false-converged)``
    (NormalFloat nu) (NormalFloat tau) =
    let g = mkProper nu tau
    let bad : Gaussian = { PrecisionMean = nan; Precision = 1.0 }
    not (movedC6 (Gaussian.distance g g))                        // identical ⇒ converged
    && System.Double.IsPositiveInfinity (Gaussian.distance g bad) // non-finite ⇒ ∞
    && movedC6 (Gaussian.distance g bad)                         // ∞ ⇒ moved

[<Property>]
let ``C6 Beta identical converges, non-finite residual moves``
    (NormalFloat aA) (NormalFloat bA) =
    let clamp lo hi x = max lo (min hi x)
    let d : Beta = { Alpha = clamp 1.0e-6 1.0e6 (abs aA); Beta = clamp 1.0e-6 1.0e6 (abs bA) }
    let bad : Beta = { Alpha = nan; Beta = 1.0 }
    not (movedC6 (Beta.distance d d))
    && System.Double.IsPositiveInfinity (Beta.distance d bad)
    && movedC6 (Beta.distance d bad)

[<Property>]
let ``C6 Bernoulli identical converges, non-finite residual moves``
    (NormalFloat l) =
    let p = 1.0 / (1.0 + exp (-(max -8.0 (min 8.0 l))))
    let b : Bernoulli = { ProbTrue = p }
    let bad : Bernoulli = { ProbTrue = nan }
    not (movedC6 (Bernoulli.distance b b))
    && System.Double.IsPositiveInfinity (Bernoulli.distance b bad)
    && movedC6 (Bernoulli.distance b bad)

// ═══════════════════════════════════════════════════════════════════
// C4 (081KT2T2J0008QG0R000YZ3NMY P1) — `Message.marginal` is the product-FOLD, generic over
// the family (Message.fs:308: `Seq.fold ( * ) GenericOne`). It is a
// MONOID HOMOMORPHISM from (list, @, []) to (message, *, One):
//   * identity on empty   — marginal [] = One
//   * singleton           — marginal [m] = m
//   * fold-homomorphism   — marginal (xs @ ys) = marginal xs * marginal ys
//   * order-independent    — marginal xs = marginal (rev xs)  (product is
//                            commutative — proven C1/C2/C3)
// The homomorphism + identity-on-empty are the C4 claims (KFL 2001 — the
// marginal is the product of all incoming messages). FsCheck per family;
// the laws hold by the C1/C2/C3 monoid structure regardless of properness,
// so no closure gating is needed (gEq* compares values within tolerance).
// Bernoulli lists are capped so the summed log-odds stays representable.
// ═══════════════════════════════════════════════════════════════════

// marginal [] = One bit-exactly (fold over the empty list returns the
// GenericOne seed), so we assert direct record equality against `One` over
// `List.empty<_>` — reading straight as the (list, @, []) source monoid's
// identity law (clearer failure than a boolean `gEq |> should be true`).

[<Fact>]
let ``C4 Gaussian marginal of the empty list is One (identity on empty)`` () =
    Message.marginal (List.empty<Gaussian>) |> should equal Gaussian.One

[<Fact>]
let ``C4 Beta marginal of the empty list is One (identity on empty)`` () =
    Message.marginal (List.empty<Beta>) |> should equal Beta.One

[<Fact>]
let ``C4 Bernoulli marginal of the empty list is One (identity on empty)`` () =
    Message.marginal (List.empty<Bernoulli>) |> should equal Bernoulli.One

[<Property>]
let ``C4 Gaussian marginal is a fold-homomorphism (concat = product) and order-independent``
    (raw: NormalFloat[]) =
    let ms =
        raw |> Array.truncate 8 |> Array.chunkBySize 2 |> Array.filter (fun c -> c.Length = 2)
            |> Array.map (fun c ->
                let (NormalFloat a) = c.[0]
                let (NormalFloat b) = c.[1]
                mkProper a b)
    let single = ms.Length = 0 || gEq (Message.marginal [ ms.[0] ]) ms.[0]
    let k = ms.Length / 2
    let xs, ys = Array.toList ms.[.. k - 1], Array.toList ms.[k ..]
    let homo = gEq (Message.marginal (xs @ ys)) (Gaussian.product (Message.marginal xs) (Message.marginal ys))
    let comm = gEq (Message.marginal ms) (Message.marginal (Array.rev ms))
    single && homo && comm

[<Property>]
let ``C4 Beta marginal is a fold-homomorphism (concat = product) and order-independent``
    (raw: NormalFloat[]) =
    let ms =
        raw |> Array.truncate 8 |> Array.chunkBySize 2 |> Array.filter (fun c -> c.Length = 2)
            |> Array.map (fun c ->
                let (NormalFloat a) = c.[0]
                let (NormalFloat b) = c.[1]
                mkProperBeta a b)
    let single = ms.Length = 0 || gEqBeta (Message.marginal [ ms.[0] ]) ms.[0]
    let k = ms.Length / 2
    let xs, ys = Array.toList ms.[.. k - 1], Array.toList ms.[k ..]
    let homo = gEqBeta (Message.marginal (xs @ ys)) (Beta.product (Message.marginal xs) (Message.marginal ys))
    let comm = gEqBeta (Message.marginal ms) (Message.marginal (Array.rev ms))
    single && homo && comm

[<Property>]
let ``C4 Bernoulli marginal is a fold-homomorphism (concat = product) and order-independent``
    (raw: NormalFloat[]) =
    // Exercise the >4 fold (production `marginal` has no cap). Bernoulli
    // product is in PROBABILITY space (t=∏p, f=∏(1−p), t/(t+f)), which
    // saturates toward p→0/1 as messages accumulate; per-message log-odds
    // are bounded to ±2 (p∈[0.12,0.88]) so an 8-message fold stays well
    // clear of saturation and two regroupings agree within tol.
    let mkBern (l: float) : Bernoulli =
        let lc = max -2.0 (min 2.0 l)
        { ProbTrue = 1.0 / (1.0 + exp (-lc)) }
    let ms = raw |> Array.truncate 8 |> Array.map (fun (NormalFloat l) -> mkBern l)
    let single = ms.Length = 0 || gEqBern (Message.marginal [ ms.[0] ]) ms.[0]
    let k = ms.Length / 2
    let xs, ys = Array.toList ms.[.. k - 1], Array.toList ms.[k ..]
    let homo = gEqBern (Message.marginal (xs @ ys)) (Bernoulli.product (Message.marginal xs) (Message.marginal ys))
    let comm = gEqBern (Message.marginal ms) (Message.marginal (Array.rev ms))
    single && homo && comm
