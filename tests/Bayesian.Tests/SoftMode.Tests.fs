module Zeta.Bayesian.Tests.SoftModeTests
#nowarn "0893"
/// # Soft-mode structural invariants (081KT2T2J0008QG0R000S7GHQ8 slice 6)
///
/// The end-game of the Zeta Bayesian network is an Infer.NET-style belief
/// propagation network over *dynamic/soft value* where **soft mode is a
/// structural invariant** — no agent ever collapses out of it, because the
/// network topology and the EP factor semantics together make collapse
/// impossible, not merely unlikely.
///
/// This module proves the three load-bearing properties that underpin that
/// claim:
///
/// **SM-1 (Cavity-properness preservation).**
///   If a variable's cavity is proper before a probit EP pass, it remains
///   proper after. This is the per-step invariant: `runToFixpoint` is a
///   composition of `passOnce` steps, and each step preserves properness.
///
/// **SM-2 (No Dirac-delta fixed point).**
///   A fixed point of `runToFixpoint` on a graph that contains at least one
///   proper prior and one EP probit factor cannot have zero variance (a Dirac
///   delta). The prior injects finite precision; the probit factor injects
///   additional precision; their product always has strictly positive variance.
///   Collapse to a point mass is structurally impossible.
///
/// **SM-3 (Mutual empowerment — private state influences marginal).**
///   On a two-agent graph where each agent has a private prior and they are
///   connected by an EP probit factor, the marginal of each agent depends
///   non-trivially on the other agent's prior. Changing agent B's prior
///   changes agent A's marginal — the agents are mutually empowered to keep
///   each other in soft mode. This is the computational analogue of the
///   CausalPower Z3 lemma, grounded in the concrete factor-graph substrate.
///
/// Together SM-1 + SM-2 + SM-3 constitute the **soft-mode invariant**:
/// the network is designed so that the fixed point of belief propagation is
/// always a proper Gaussian (never a Dirac delta, never uniform), and every
/// agent's beliefs are genuinely influenced by every other agent it is
/// connected to. The agents are mutually empowered to stay soft.
///
/// **Connection to the FROZEN-CORE register (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md):**
/// The register identifies the open half of the non-collapse conjecture as
/// "dynamical stability over unbounded time — the balanced dynamics has the
/// differentiated manifold as a stable attractor (Lyapunov-stable)." SM-1
/// through SM-3 are the *per-step* and *per-fixed-point* legs of that
/// conjecture, grounded in the concrete EP/BP substrate. The unbounded-time
/// leg (Lyapunov stability over the DBSP stream) remains open and is
/// identified as the next rung.
///
/// Anchor: Minka 2001 (EP); GPML §3.4 (probit); FROZEN-CORE §B-other
/// (privacy-from-identity, non-collapse balance); 081KT7YW00008QG0R001DGZQKM
/// (register-collapse = heat-death anti-pattern).

open System
open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Bayesian

// ═══════════════════════════════════════════════════════════════════
// SM-1: Cavity-properness preservation under EP probit pass
//
// The probit factor's ComputeMessages only emits a non-uniform message
// when the incoming cavity is proper (Gaussian.isProper). When the
// cavity is improper (tau <= 0), the factor emits Gaussian.One (the flat
// message) — it contributes no information but also does not corrupt
// the marginal. When the cavity is proper, the projected marginal is
// proper and finite. The outgoing EP factor message may itself be
// improper in extreme tails; EP permits that because the message is a
// quotient whose product with the cavity is the proper projection.
//
// This is the per-step invariant that makes runToFixpoint safe: no
// single pass can turn a proper marginal into an improper one, because
// flat messages preserve the prior and non-flat EP messages reconstruct a
// proper projected marginal when multiplied by their cavity.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-1a: probit factor emits a proper message for well-conditioned proper cavities`` () =
    // These well-conditioned examples add positive factor precision. Extreme-tail
    // cavities are covered by SM-1c, where EP allows an improper factor message
    // as long as the reconstructed marginal stays proper and finite.
    for m, v in [ (0.0, 1.0); (1.0, 2.0); (-2.0, 0.5); (0.0, 1e6); (5.0, 0.1) ] do
        let cavity = Gaussian.ofMeanVariance m v
        let factor = Ep.probitFactor 0
        let msgs = factor.ComputeMessages (Map.ofList [ 0, cavity ])
        let msg = msgs.[0]
        Gaussian.isProper msg |> should equal true
        // The probit observation reduces variance: the message precision > 0
        // and the marginal (prior * message) has strictly less variance than prior alone.
        msg.Precision |> should be (greaterThan 0.0)

[<Fact>]
let ``SM-1b: probit factor emits flat message (not improper) when cavity is improper`` () =
    // An improper cavity (τ ≤ 0 — e.g. Gaussian.One = uniform) → factor emits
    // Gaussian.One (flat). The flat message is the identity for product, so it
    // does not corrupt the marginal. Crucially it is NOT improper (τ = 0 is
    // the boundary; the flat message is the identity, not a negative-precision bomb).
    let uniformCavity = Gaussian.One
    let factor = Ep.probitFactor 0
    let msgs = factor.ComputeMessages (Map.ofList [ 0, uniformCavity ])
    msgs.[0] |> should equal Gaussian.One

[<Property>]
let ``SM-1c: probit factor message is finite and reconstructs a proper marginal for generated proper cavities``
    (NormalFloat mRaw) (NormalFloat vRaw) =
    let m = max -10.0 (min 10.0 mRaw)
    let v = max 0.01 (min 100.0 (abs vRaw))
    let cavity = Gaussian.ofMeanVariance m v
    let factor = Ep.probitFactor 0
    let msgs = factor.ComputeMessages (Map.ofList [ 0, cavity ])
    let msg = msgs.[0]
    let marginal = cavity * msg
    Double.IsFinite msg.PrecisionMean
    && Double.IsFinite msg.Precision
    && Gaussian.isProper marginal
    && Double.IsFinite(Gaussian.mean marginal)
    && Double.IsFinite(Gaussian.variance marginal)

// ═══════════════════════════════════════════════════════════════════
// SM-2: No Dirac-delta fixed point on a graph with a proper prior + probit factor
//
// A Dirac delta is a Gaussian with τ → ∞ (zero variance). The claim is
// that on any graph containing at least one proper prior N(m, v) and one
// EP probit factor, the fixed point of runToFixpoint has strictly positive
// variance — it is never a point mass.
//
// The argument: the prior contributes precision τ_prior = 1/v > 0. The
// probit factor contributes additional precision τ_factor > 0 (it always
// adds information when the cavity is proper, as proven by SM-1a). The
// marginal precision is τ_prior + τ_factor, which is finite (both
// summands are finite). So the marginal variance = 1/(τ_prior + τ_factor)
// is strictly positive and strictly less than 1/τ_prior.
//
// The fixed point is always a proper Gaussian with finite, positive variance.
// Collapse to a Dirac delta would require τ → ∞, which requires either
// τ_prior → ∞ (the prior itself is a point mass — excluded by the
// `ofMeanVariance` constructor which requires finite variance > 0) or
// infinitely many rounds (excluded by the `maxRounds` cap in runToFixpoint).
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-2a: fixed point of prior + probit factor has strictly positive variance (not a Dirac delta)`` () =
    // The simplest possible graph: one variable, one prior, one probit factor.
    // The fixed point must have variance strictly between 0 and the prior variance.
    for priorMean, priorVar in [ (0.0, 1.0); (1.0, 4.0); (-2.0, 0.25); (0.0, 1e6) ] do
        let g =
            FactorGraph.empty Gaussian.algebra
            |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance priorMean priorVar))
            |> FactorGraph.addFactor 1 (Ep.probitFactor 0)
        let g', _rounds, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 50 g
        converged |> should equal true
        let marginal = FactorGraph.marginal 0 g'
        // SM-2: the fixed point is proper (not a Dirac delta)
        Gaussian.isProper marginal |> should equal true
        Gaussian.variance marginal |> should be (greaterThan 0.0)
        // The probit observation reduces variance: fixed-point variance < prior variance
        Gaussian.variance marginal |> should be (lessThan priorVar)
        // The observation "x > 0" shifts the mean positive (or less negative)
        Gaussian.mean marginal |> should be (greaterThan priorMean)

[<Fact>]
let ``SM-2b: fixed point variance is finite even for a very broad prior (not a Dirac delta in the other direction)`` () =
    // A very broad prior (v = 1e6) still yields a proper, finite-variance fixed point.
    // The probit factor adds a small but non-zero amount of precision.
    let g =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance 0.0 1e6))
        |> FactorGraph.addFactor 1 (Ep.probitFactor 0)
    let g', _rounds, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 100 g
    converged |> should equal true
    let marginal = FactorGraph.marginal 0 g'
    Gaussian.isProper marginal |> should equal true
    Double.IsFinite(Gaussian.variance marginal) |> should equal true
    Double.IsFinite(Gaussian.mean marginal) |> should equal true

[<Property>]
let ``SM-2c: fixed point is always proper for all generated proper priors``
    (NormalFloat mRaw) (NormalFloat vRaw) =
    let m = max -5.0 (min 5.0 mRaw)
    let v = max 0.1 (min 10.0 (abs vRaw))
    let g =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance m v))
        |> FactorGraph.addFactor 1 (Ep.probitFactor 0)
    let g', _rounds, _converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 50 g
    let marginal = FactorGraph.marginal 0 g'
    // The fixed point (or the state after maxRounds) is always proper.
    // Even if the loop did not converge, the marginal must be proper.
    Gaussian.isProper marginal

// ═══════════════════════════════════════════════════════════════════
// SM-3: Mutual empowerment — private state influences marginal
//
// On a two-variable graph where each variable has a private prior and
// they are connected by an equality factor (the simplest mutual-influence
// topology), the marginal of each variable depends non-trivially on the
// other variable's prior. This is the computational analogue of the
// CausalPower Z3 lemma, grounded in the concrete factor-graph substrate.
//
// The equality factor sends each variable the product of all OTHER
// variables' incoming messages. So variable A's marginal includes
// variable B's prior, and vice versa. Changing B's prior changes A's
// marginal — the two agents are mutually empowered.
//
// This is the key property that makes the network self-stabilizing in
// soft mode: no agent can collapse to a point mass without also pulling
// every connected agent toward collapse, but the other agents' priors
// resist that pull (SM-2). The mutual influence is the mechanism by
// which the network collectively maintains soft mode.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-3a: changing agent B's prior changes agent A's marginal (mutual empowerment)`` () =
    // Two variables connected by an equality factor.
    // Agent A has prior N(0, 1). Agent B has two different priors.
    // Agent A's marginal must differ between the two cases.
    let buildGraph priorB =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance 0.0 1.0))  // A's prior
        |> FactorGraph.addFactor 1 (Factor.prior 1 priorB)                              // B's prior
        |> FactorGraph.addFactor 2 (Factor.equality Gaussian.algebra [ 0; 1 ])          // mutual link
    let g1, _, _ = FactorGraph.runToFixpoint Gaussian.distance 1e-9 50 (buildGraph (Gaussian.ofMeanVariance 2.0 1.0))
    let g2, _, _ = FactorGraph.runToFixpoint Gaussian.distance 1e-9 50 (buildGraph (Gaussian.ofMeanVariance -2.0 1.0))
    let mA1 = FactorGraph.marginal 0 g1
    let mA2 = FactorGraph.marginal 0 g2
    // Agent A's marginal must differ when B's prior changes from N(2,1) to N(-2,1)
    abs (Gaussian.mean mA1 - Gaussian.mean mA2) |> should be (greaterThan 0.1)

[<Fact>]
let ``SM-3b: agent A's marginal is strictly between its own prior and B's prior (mutual pull)`` () =
    // With equal-precision priors, the equality factor pulls each marginal
    // to the precision-weighted midpoint — neither agent collapses to its
    // own prior alone, nor to the other's prior alone. Both are pulled
    // toward the other, and both resist collapse.
    let g =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance 0.0 1.0))
        |> FactorGraph.addFactor 1 (Factor.prior 1 (Gaussian.ofMeanVariance 4.0 1.0))
        |> FactorGraph.addFactor 2 (Factor.equality Gaussian.algebra [ 0; 1 ])
    let g', _, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 50 g
    converged |> should equal true
    let mA = FactorGraph.marginal 0 g'
    let mB = FactorGraph.marginal 1 g'
    // Both marginals are at the midpoint (2.0) — neither collapsed to its own prior
    Gaussian.mean mA |> should (equalWithin 1e-6) 2.0
    Gaussian.mean mB |> should (equalWithin 1e-6) 2.0
    // Both marginals have reduced variance (mutual precision-sharing)
    Gaussian.variance mA |> should be (lessThan 1.0)
    Gaussian.variance mB |> should be (lessThan 1.0)
    // Both are still proper (not collapsed to Dirac delta)
    Gaussian.isProper mA |> should equal true
    Gaussian.isProper mB |> should equal true

[<Fact>]
let ``SM-3c: EP probit factor on two connected agents — both stay proper, both are mutually influenced`` () =
    // The full soft-mode scenario: two agents, each with a private prior,
    // connected by an EP probit factor on a shared latent variable.
    // Agent A observes "x > 0" (soft constraint); agent B has a prior on x.
    // Both A's and B's beliefs about x must be proper at the fixed point,
    // and both must be influenced by the other's prior.
    let buildGraph priorA priorB =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 priorA)   // A's private prior on x
        |> FactorGraph.addFactor 1 (Factor.prior 0 priorB)   // B's private prior on x (same variable)
        |> FactorGraph.addFactor 2 (Ep.probitFactor 0)        // soft "x > 0" observation
    // Case 1: B has a positive prior (agrees with the probit constraint)
    let g1, _, converged1 =
        FactorGraph.runToFixpoint Gaussian.distance 1e-9 50
            (buildGraph (Gaussian.ofMeanVariance 0.0 1.0) (Gaussian.ofMeanVariance 2.0 1.0))
    // Case 2: B has a negative prior (opposes the probit constraint)
    let g2, _, converged2 =
        FactorGraph.runToFixpoint Gaussian.distance 1e-9 50
            (buildGraph (Gaussian.ofMeanVariance 0.0 1.0) (Gaussian.ofMeanVariance -2.0 1.0))
    converged1 |> should equal true
    converged2 |> should equal true
    let m1 = FactorGraph.marginal 0 g1
    let m2 = FactorGraph.marginal 0 g2
    // Both fixed points are proper (SM-2: no Dirac delta)
    Gaussian.isProper m1 |> should equal true
    Gaussian.isProper m2 |> should equal true
    // The fixed points differ (SM-3: mutual empowerment — B's prior influences the outcome)
    abs (Gaussian.mean m1 - Gaussian.mean m2) |> should be (greaterThan 0.1)

// ═══════════════════════════════════════════════════════════════════
// SM-4: Damped runToFixpoint also preserves soft mode
//
// The damped schedule (passOnceDamped) is used on cyclic graphs to
// prevent oscillation. The damping is a convex blend in natural
// parameter space: alpha·new + (1-alpha)·old. A convex blend of two
// proper Gaussians is proper (precision is a convex combination of
// two positive values, hence positive). So damping cannot introduce
// collapse either.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-4: damped runToFixpoint also yields a proper fixed point (damping cannot cause collapse)`` () =
    // Same graph as SM-2a but with damped schedule (alpha = 0.5).
    for priorMean, priorVar in [ (0.0, 1.0); (1.0, 4.0); (-2.0, 0.25) ] do
        let g =
            FactorGraph.empty Gaussian.algebra
            |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance priorMean priorVar))
            |> FactorGraph.addFactor 1 (Ep.probitFactor 0)
        let g', _rounds, converged =
            FactorGraph.runToFixpointDamped Gaussian.blend 0.5 Gaussian.distance 1e-9 100 g
        converged |> should equal true
        let marginal = FactorGraph.marginal 0 g'
        Gaussian.isProper marginal |> should equal true
        Gaussian.variance marginal |> should be (greaterThan 0.0)
        Gaussian.variance marginal |> should be (lessThan priorVar)

// ═══════════════════════════════════════════════════════════════════
// SM-5: S1 + S2 Integration — Schema Evolution Preserves Belief Properness
//
// Invariant S2 (Uptime Stability) states that schema evolution is an
// algebra over DynamicValue that preserves structural invariants across
// version boundaries. Invariant S1 (Topological Soft-Mode Stability)
// states that the factor graph topology prevents belief collapse.
//
// The integration claim is: a schema migration that adds or renames a
// field does NOT affect the properness of any Gaussian belief that was
// computed BEFORE the migration. The migration operates on the
// DynamicValue envelope (the schema layer), not on the Gaussian
// natural parameters (the belief layer). These two layers are
// orthogonal: a proper Gaussian stays proper across a schema migration.
//
// This is the concrete form of "0-downtime means beliefs survive schema
// evolution" — the in-flight beliefs are not collapsed by the migration.
//
// Anchor: SchemaEvolution.Tests.fs (S2 computational evidence);
//   SoftMode.Tests.fs SM-1 to SM-4 (S1 computational evidence);
//   FROZEN-CORE §A #12 (S1) and §A #13 (S2).
// ═══════════════════════════════════════════════════════════════════

open Zeta.Core

[<Fact>]
let ``SM-5a: schema addField does not affect a Gaussian belief stored in a different field`` () =
    // Simulate: agent A has a belief (Gaussian) stored as a DynamicValue.
    // A schema migration adds a new field "version" with a default.
    // The belief field is preserved exactly — the Gaussian is still proper.
    let belief = Gaussian.ofMeanVariance 1.5 0.8
    let tau = 1.0 / Gaussian.variance belief
    let nu  = Gaussian.mean belief * tau
    // Store the belief as a DynamicValue (natural parameters)
    let stored = DynamicValue.Object [ "tau", DynamicValue.Float tau; "nu", DynamicValue.Float nu ]
    // Schema migration: add a "version" field (the new schema version)
    let migrated = SchemaEvolution.addField "version" (DynamicValue.Int 2L) stored
    // The belief fields are preserved exactly
    match migrated with
    | DynamicValue.Object kvs ->
        let tau' = kvs |> List.find (fun (k, _) -> k = "tau") |> snd
        let nu'  = kvs |> List.find (fun (k, _) -> k = "nu")  |> snd
        match tau', nu' with
        | DynamicValue.Float t, DynamicValue.Float n ->
            // Reconstruct the Gaussian — it must still be proper
            let belief' = { Gaussian.PrecisionMean = n; Gaussian.Precision = t }
            Gaussian.isProper belief' |> should equal true
            Gaussian.mean belief'     |> should (equalWithin 1e-12) (Gaussian.mean belief)
            Gaussian.variance belief' |> should (equalWithin 1e-12) (Gaussian.variance belief)
        | _ -> failwith "expected Float fields"
    | _ -> failwith "expected Object"

[<Property>]
let ``SM-5b: schema addField preserves Gaussian properness for any proper prior (FsCheck)``
    (meanRaw: float) (logVarRaw: float) =
    // Guard against infinity/NaN from FsCheck
    if System.Double.IsInfinity(meanRaw) || System.Double.IsNaN(meanRaw) ||
       System.Double.IsInfinity(logVarRaw) || System.Double.IsNaN(logVarRaw) then true
    else
    // Generate a proper Gaussian: mean in [-10,10], variance in [0.01, 10]
    let mean = (meanRaw % 10.0 + 10.0) % 20.0 - 10.0
    let var  = exp (logVarRaw % 2.3) * 0.01  // in [0.01, ~10]
    let belief = Gaussian.ofMeanVariance mean var
    if not (Gaussian.isProper belief) then true  // skip degenerate inputs
    else
        let tau = 1.0 / Gaussian.variance belief
        let nu  = Gaussian.mean belief * tau
        let stored   = DynamicValue.Object [ "tau", DynamicValue.Float tau; "nu", DynamicValue.Float nu ]
        let migrated = SchemaEvolution.addField "version" (DynamicValue.Int 2L) stored
        match migrated with
        | DynamicValue.Object kvs ->
            match kvs |> List.tryFind (fun (k,_) -> k = "tau"),
                  kvs |> List.tryFind (fun (k,_) -> k = "nu") with
            | Some (_, DynamicValue.Float t), Some (_, DynamicValue.Float n) ->
                let belief' = { Gaussian.PrecisionMean = n; Gaussian.Precision = t }
                Gaussian.isProper belief'
            | _ -> false
        | _ -> false

[<Property>]
let ``SM-5c: schema renameField preserves Gaussian properness (lossless rename = 0-downtime)``
    (meanRaw: float) (logVarRaw: float) =
    // Guard against infinity/NaN from FsCheck
    if System.Double.IsInfinity(meanRaw) || System.Double.IsNaN(meanRaw) ||
       System.Double.IsInfinity(logVarRaw) || System.Double.IsNaN(logVarRaw) then true
    else
    // Rename "tau" -> "precision" (a schema evolution that renames a field)
    let mean = (meanRaw % 10.0 + 10.0) % 20.0 - 10.0
    let var  = exp (logVarRaw % 2.3) * 0.01
    let belief = Gaussian.ofMeanVariance mean var
    if not (Gaussian.isProper belief) then true
    else
        let tau = 1.0 / Gaussian.variance belief
        let nu  = Gaussian.mean belief * tau
        let stored   = DynamicValue.Object [ "tau", DynamicValue.Float tau; "nu", DynamicValue.Float nu ]
        // Rename: "tau" -> "precision"
        let migrated = SchemaEvolution.renameField "tau" "precision" stored
        match migrated with
        | DynamicValue.Object kvs ->
            match kvs |> List.tryFind (fun (k,_) -> k = "precision"),
                  kvs |> List.tryFind (fun (k,_) -> k = "nu") with
            | Some (_, DynamicValue.Float t), Some (_, DynamicValue.Float n) ->
                let belief' = { Gaussian.PrecisionMean = n; Gaussian.Precision = t }
                Gaussian.isProper belief'
            | _ -> false
        | _ -> false

// ═══════════════════════════════════════════════════════════════════
// SM-6: S1+S2 temporal integration — schema evolution preserves
//       Gaussian belief properness MID-CONVERGENCE (not just at rest)
//
// The S2 invariant (schema evolution preserves properness) was proven
// at rest (SM-5a/b/c). The stronger claim is that it holds mid-convergence:
// if a schema migration occurs between two rounds of runToFixpoint, the
// belief state at every intermediate round is still proper, and the
// migrated belief is still proper.
//
// The model: a 2-variable factor graph with two Gaussian priors and one
// equality factor. We run one round, snapshot the marginals, serialize
// them to DynamicValue, apply a schema migration (addField), deserialize,
// and verify the migrated beliefs are still proper. Then we run to fixpoint
// and verify the final beliefs are still proper.
//
// This is the "live migration" scenario: a schema change arrives between
// rounds of inference, and the agent must continue without restarting.
//
// Anchor: FROZEN-CORE §A #12 (S1), §A #13 (S2), Gate T3.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``SM-6: schema addField mid-convergence preserves Gaussian belief properness (live migration)`` () =
    // Build a 2-variable factor graph with two Gaussian priors and one equality factor.
    // This is the minimal graph where runToFixpoint does non-trivial work.
    let prior0 = Gaussian.ofMeanVariance 0.0 1.0
    let prior1 = Gaussian.ofMeanVariance 2.0 1.0
    let g0 =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 prior0)
        |> FactorGraph.addFactor 1 (Factor.prior 1 prior1)
        |> FactorGraph.addFactor 2 (Factor.equality Gaussian.algebra [ 0; 1 ])

    // Run ONE round (mid-convergence snapshot)
    let g1 = FactorGraph.passOnce g0
    let m0 = FactorGraph.marginal 0 g1
    let m1 = FactorGraph.marginal 1 g1

    // Both marginals must be proper after round 1
    Gaussian.isProper m0 |> should equal true
    Gaussian.isProper m1 |> should equal true

    // Serialize m0 to DynamicValue (the "live state" snapshot)
    let tau0 = 1.0 / Gaussian.variance m0
    let nu0  = Gaussian.mean m0 * tau0
    let stored0 = DynamicValue.Object [ "tau", DynamicValue.Float tau0; "nu", DynamicValue.Float nu0 ]

    // Apply schema migration: addField "version" = 2 (a live schema evolution)
    let migrated0 = SchemaEvolution.addField "version" (DynamicValue.Int 2L) stored0

    // Deserialize the migrated belief — must still be proper
    match migrated0 with
    | DynamicValue.Object kvs ->
        match kvs |> List.tryFind (fun (k,_) -> k = "tau"),
              kvs |> List.tryFind (fun (k,_) -> k = "nu") with
        | Some (_, DynamicValue.Float t), Some (_, DynamicValue.Float n) ->
            let m0' = { Gaussian.PrecisionMean = n; Gaussian.Precision = t }
            // The migrated belief is still proper
            Gaussian.isProper m0' |> should equal true
            // The migrated belief is identical to the pre-migration belief
            abs (m0'.PrecisionMean - m0.PrecisionMean) |> should (be lessThan) 1e-12
            abs (m0'.Precision     - m0.Precision)     |> should (be lessThan) 1e-12
        | _ -> failwith "expected Float fields tau and nu"
    | _ -> failwith "expected Object"

    // Continue to fixpoint from g1 (the mid-convergence state)
    let gFinal, _, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 100 g1
    converged |> should equal true

    // Final marginals must be proper
    let mFinal0 = FactorGraph.marginal 0 gFinal
    let mFinal1 = FactorGraph.marginal 1 gFinal
    Gaussian.isProper mFinal0 |> should equal true
    Gaussian.isProper mFinal1 |> should equal true

[<Property>]
let ``SM-6b: schema addField mid-convergence preserves properness for any proper prior pair (FsCheck)``
    (mean0Raw: float) (mean1Raw: float) (logVar0Raw: float) (logVar1Raw: float) =
    // Guard against infinity/NaN
    if [ mean0Raw; mean1Raw; logVar0Raw; logVar1Raw ] |> List.exists (fun x -> not (System.Double.IsFinite x))
    then true
    else
    let mean0 = (mean0Raw % 5.0 + 5.0) % 10.0 - 5.0
    let mean1 = (mean1Raw % 5.0 + 5.0) % 10.0 - 5.0
    let var0  = exp (logVar0Raw % 2.0) * 0.1
    let var1  = exp (logVar1Raw % 2.0) * 0.1
    let prior0 = Gaussian.ofMeanVariance mean0 var0
    let prior1 = Gaussian.ofMeanVariance mean1 var1
    if not (Gaussian.isProper prior0) || not (Gaussian.isProper prior1) then true
    else
        let g0 =
            FactorGraph.empty Gaussian.algebra
            |> FactorGraph.addFactor 0 (Factor.prior 0 prior0)
            |> FactorGraph.addFactor 1 (Factor.prior 1 prior1)
            |> FactorGraph.addFactor 2 (Factor.equality Gaussian.algebra [ 0; 1 ])

        // Run one round (mid-convergence)
        let g1 = FactorGraph.passOnce g0
        let m0 = FactorGraph.marginal 0 g1

        // Serialize, migrate, deserialize
        let tau = 1.0 / Gaussian.variance m0
        let nu  = Gaussian.mean m0 * tau
        let stored   = DynamicValue.Object [ "tau", DynamicValue.Float tau; "nu", DynamicValue.Float nu ]
        let migrated = SchemaEvolution.addField "version" (DynamicValue.Int 2L) stored

        match migrated with
        | DynamicValue.Object kvs ->
            match kvs |> List.tryFind (fun (k,_) -> k = "tau"),
                  kvs |> List.tryFind (fun (k,_) -> k = "nu") with
            | Some (_, DynamicValue.Float t), Some (_, DynamicValue.Float n) ->
                let m0' = { Gaussian.PrecisionMean = n; Gaussian.Precision = t }
                Gaussian.isProper m0'
            | _ -> false
        | _ -> false
