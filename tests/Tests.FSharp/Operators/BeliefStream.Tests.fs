module Zeta.Tests.BeliefStreamTests

open Xunit
open FsCheck
open FsCheck.Xunit
open System
open Zeta.Core
open Zeta.Bayesian

// ═══════════════════════════════════════════════════════════════════
// Gate T3 — Stream<Gaussian> satisfies DBSP D∘I = id and I∘D = id
//
// The DBSP stream model (Budiu et al.) defines three primitive operators
// over any abelian group (G, +, 0):
//   z⁻¹  — delay: stream[t-1], with initial value 0
//   D    — differentiate: stream[t] - stream[t-1]  (= 1 - z⁻¹)
//   I    — integrate:     running sum Σ stream[0..t]  (= (1-z⁻¹)⁻¹)
//
// The key identities are D∘I = id and I∘D = id, which hold for any
// abelian group. The C13 properties (OperatorAlgebra.Tests.fs) prove
// these for Stream<ZSet<int>>. Gate T3 proves them for Stream<Gaussian>.
//
// The Gaussian group is (Gaussian, +, Gaussian.One) in NATURAL PARAMETERS:
//   zero  = { PrecisionMean = 0.0; Precision = 0.0 }  (= Gaussian.One = uniform)
//   add   = natural-parameter addition
//   sub   = natural-parameter subtraction
//
// Significance: the belief stream of a Zeta agent is a well-typed DBSP stream.
// The operator identities hold on the belief stream, not just on ZSet<int>.
// This closes Gate T3 and connects the Tick algebra (C13) to the soft-mode
// invariant (SM-1 to SM-5): the temporal dimension of mutual empowerment is
// algebraically sound.
//
// Anchor: FROZEN-CORE §A #12 (S1), §A #13 (S2); Tick promotion gate T3;
//   OperatorAlgebra.Tests.fs (C13); SoftMode.Tests.fs (SM-1 to SM-5).
// ═══════════════════════════════════════════════════════════════════

// ── Gaussian group operations in natural parameters ──────────────────
// The Gaussian group operation IS natural-parameter addition, which is
// exposed as the ( * ) operator (product) and ( / ) operator (divide/subtract).
// There are no + / - operators on Gaussian — the group is (Gaussian, *, /, One).
let private gZero : Gaussian = Gaussian.One   // { PrecisionMean=0; Precision=0 }
let private gAdd  (a: Gaussian) (b: Gaussian) : Gaussian = a * b   // natural-param add
let private gSub  (a: Gaussian) (b: Gaussian) : Gaussian = a / b   // natural-param sub

// ── Helper: clamp a float to a finite range ──────────────────────────
let private clamp lo hi x = if Double.IsFinite x then max lo (min hi x) else 0.0

// ── Generator: a Gaussian delta (change in natural params) ───────────
// Deltas need not be proper (precision can be negative — it's a *change*).
let private mkDelta (nu: float) (tau: float) : Gaussian =
    { Gaussian.PrecisionMean = clamp -50.0 50.0 nu
      Gaussian.Precision     = clamp -5.0   5.0 tau }

// ── Helper: approximately equal Gaussians ────────────────────────────
let private gaussEq (a: Gaussian) (b: Gaussian) =
    abs (a.PrecisionMean - b.PrecisionMean) < 1e-10 &&
    abs (a.Precision     - b.Precision)     < 1e-10

// ── Helper: build a tick list from FsCheck raw input ─────────────────
let private mkTicks (raw: (float * float) list) =
    raw
    |> List.truncate 8
    |> List.choose (fun (nu, tau) ->
        if Double.IsFinite nu && Double.IsFinite tau
        then Some (mkDelta nu tau)
        else None)

// ═══════════════════════════════════════════════════════════════════
// T3-1: D∘I = id on Stream<Gaussian>
//   Differentiate(Integrate(delta_stream))[t] = delta_stream[t]
// ═══════════════════════════════════════════════════════════════════
[<Property>]
let ``T3-1: D∘I = id on Stream<Gaussian> (differentiate of integrate recovers each tick's delta)``
    (raw: (float * float) list) =
    let ticks = mkTicks raw
    if ticks.IsEmpty then true
    else
        let c = Circuit.create ()
        let input = c.ScalarInput<Gaussian>()
        let integrated    = c.Integrate(input.Stream, gZero, Func<_,_,_>(gAdd))
        let differentiated = c.Differentiate(integrated, gZero, Func<_,_,_>(gSub))
        let out = c.Output differentiated
        ticks
        |> List.forall (fun d ->
            input.Set d
            c.Step()
            gaussEq out.Current d)

// ═══════════════════════════════════════════════════════════════════
// T3-2: I∘D = id on Stream<Gaussian>
//   Integrate(Differentiate(belief_stream))[t] = belief_stream[t]
// ═══════════════════════════════════════════════════════════════════
[<Property>]
let ``T3-2: I∘D = id on Stream<Gaussian> (integrate of differentiate recovers each tick's running belief)``
    (raw: (float * float) list) =
    let ticks = mkTicks raw
    if ticks.IsEmpty then true
    else
        let c = Circuit.create ()
        let input = c.ScalarInput<Gaussian>()
        let differentiated = c.Differentiate(input.Stream, gZero, Func<_,_,_>(gSub))
        let integrated     = c.Integrate(differentiated, gZero, Func<_,_,_>(gAdd))
        let out = c.Output integrated
        ticks
        |> List.forall (fun d ->
            input.Set d
            c.Step()
            gaussEq out.Current d)

// ═══════════════════════════════════════════════════════════════════
// T3-3: z⁻¹ on Stream<Gaussian> emits the previous tick's value
//   delay(stream)[t] = stream[t-1], with gZero at t=0.
// ═══════════════════════════════════════════════════════════════════
[<Property>]
let ``T3-3: z⁻¹ (delay) on Stream<Gaussian> emits the previous tick's delta (gZero at t=0)``
    (raw: (float * float) list) =
    let ticks = mkTicks raw
    if ticks.IsEmpty then true
    else
        let c = Circuit.create ()
        let input = c.ScalarInput<Gaussian>()
        let delayed = c.Delay(input.Stream, gZero)
        let out = c.Output delayed
        let mutable prev = gZero
        ticks
        |> List.forall (fun d ->
            input.Set d
            c.Step()
            let ok = gaussEq out.Current prev
            prev <- d
            ok)

// ═══════════════════════════════════════════════════════════════════
// T3-4: Integrate of proper-Gaussian deltas yields a proper running belief
//   This is the key soft-mode × temporal integration claim:
//   if each delta has positive precision (evidence-only stream),
//   then the running integral (the belief) is also proper.
// ═══════════════════════════════════════════════════════════════════
[<Property>]
let ``T3-4: Integrate of proper-Gaussian deltas yields a proper running belief (soft-mode × temporal)``
    (raw: (float * float) list) =
    // Generate PROPER deltas: precision > 0
    let ticks =
        raw
        |> List.truncate 8
        |> List.choose (fun (nu, tau) ->
            if Double.IsFinite nu && Double.IsFinite tau then
                let tau' = abs tau % 2.0 + 0.01   // precision in [0.01, 2.01]
                let nu'  = clamp -10.0 10.0 nu
                Some { Gaussian.PrecisionMean = nu'; Gaussian.Precision = tau' }
            else None)
    if ticks.IsEmpty then true
    else
        // Start with a proper prior
        let prior = Gaussian.ofMeanVariance 0.0 1.0
        let c = Circuit.create ()
        let input = c.ScalarInput<Gaussian>()
        let integrated = c.Integrate(input.Stream, gZero, Func<_,_,_>(gAdd))
        let out = c.Output integrated
        ticks
        |> List.forall (fun d ->
            input.Set d
            c.Step()
            // The running sum of proper deltas + the prior is proper
            let belief = prior * out.Current
            Gaussian.isProper belief)

// ═══════════════════════════════════════════════════════════════════
// T3-5: D = 1 − z⁻¹ on Stream<Gaussian>
//   Differentiate(stream)[t] = stream[t] - stream[t-1]
// ═══════════════════════════════════════════════════════════════════
[<Property>]
let ``T3-5: D = 1 − z⁻¹ on Stream<Gaussian> (differentiate equals input minus delay)``
    (raw: (float * float) list) =
    let ticks = mkTicks raw
    if ticks.IsEmpty then true
    else
        let c = Circuit.create ()
        let input = c.ScalarInput<Gaussian>()
        let dOut  = c.Output(c.Differentiate(input.Stream, gZero, Func<_,_,_>(gSub)))
        let mutable prev = gZero
        ticks
        |> List.forall (fun d ->
            input.Set d
            c.Step()
            let expected = gSub d prev
            prev <- d
            gaussEq dOut.Current expected)
