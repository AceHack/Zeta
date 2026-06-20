module Zeta.Tests.Formal.MoralLensMeasurabilityTests

open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Math-team handoff row 8 — MEASURABILITY leg (the buildable leg).
//
// Zeta's DEFAULT moral lens (memory/project_zeta_moral_lens_…):
//   healthy  = CO-EMPOWERMENT + DIVERSITY-PRESERVATION (non-coercion)
//   concern  = COERCION + DIVERSITY-COLLAPSE (the monoculture-pull)
//
// HONEST SCOPE: this is an objective MEASURE of a CHOSEN value
// (non-coercion + co-empowerment = good), NOT value-free objective
// morality — consistent with manifesto §11 Default Moral Regard + the
// Multi-Oracle Principle (the DEFAULT lens, not a mandatory one). It is
// held PROVISIONAL ("if the math team can't find a more objective one").
//
// SCOPE OF THIS FILE: only the MEASURABILITY leg of row 8 — does the
// measure actually SEPARATE healthy from the concern, and is it
// Goodhart-resistant (you can't game the composite by maxing one axis
// while the other collapses)? The uniqueness / most-objective-lens leg
// is research-open and is DELIBERATELY NOT attempted here.
//
// Built ON (not modified): src/Core/SocietalDora.fs (coupled gain =
// min ⇒ Goodhart guard on the co-empowerment axis), src/Core/
// CoEmpowerField.fs (Blossom = diversity entropy, DominantFraction),
// src/Core/Decorrelation.fs (ρ_owe). Sibling shape: SocietalDora.Tests
// (row 6 FsCheck w/ NormalFloat) + CoEmpowerField.Tests.
// ═══════════════════════════════════════════════════════════════════

let private eps = 1e-9

// ── The two measurable axes of the lens ───────────────────────────────
//
// These are TEST-LOCAL compositions of EXISTING production measures — no
// new production code. They name, in one place, the two axes the lens
// scores on and the conjunctive "healthy gate" the Goodhart property
// rests on. (Promoting a composite into production is a separate,
// research-open decision — row 8's uniqueness leg — not made here.)

/// Co-empowerment / non-coercion axis: the headline coupled magnitude
/// `mean min(ΔE_self, ΔE_other)` over the interactions (SocietalDora).
/// `> 0` ⇒ both sides gained on average; `≤ 0` ⇒ capture/coercion present.
/// `min` is SocietalDora's own Goodhart guard: a self-only gain cannot
/// offset the other's loss.
let private coEmpowermentAxis (ints: SocietalDora.Coupled list) : float =
    let edge: SocietalDora.EdgeHealth = { Edge = "e"; RhoOwe = 1.0; Interactions = ints }
    (SocietalDora.compute 0.5 [ edge ]).MeanCoupledGain

/// Diversity-preservation axis: the population's Shannon diversity
/// entropy (CoEmpowerField.Blossom). High ⇒ diversity preserved
/// (blossom); `0` ⇒ collapsed to one (monoculture, the concern's
/// endpoint). Strictly anti-monotone with DominantFraction.
let private diversityAxis (population: int list) : float =
    let f: CoEmpowerField.Field =
        { Width = List.length population
          Height = 1
          Identity = List.toArray population }
    (CoEmpowerField.health f).Blossom

/// The composite lens: a CONJUNCTIVE healthy gate. A configuration is
/// "healthy" iff it co-empowers (coupled gain > 0) AND preserves
/// diversity above a floor (diversity entropy > floor). The conjunction
/// IS the Goodhart guard — it cannot be lifted by maxing one axis while
/// the other collapses (mirrors SocietalDora's `min` move, lifted to the
/// two-axis lens). This is the load-bearing shape of property 3.
let private isHealthy (diversityFloor: float) (ints: SocietalDora.Coupled list) (population: int list) : bool =
    coEmpowermentAxis ints > eps && diversityAxis population > diversityFloor + eps

let private c s o : SocietalDora.Coupled = { Self = s; Other = o }

// Bounded-finite generators (CA-clean): NormalFloat ⇒ finite, non-NaN
// reals for the axes; ints ⇒ a small identity alphabet so diversity
// entropy is meaningful.
let private fin (x: NormalFloat) : float = x.Get
let private idOf (x: int) : int = 1 + abs (x % 4) // identities 1..4 (never 0/empty)

// ══ Property 1 — Monotone in diversity-preservation ═══════════════════
// Holding co-empowerment fixed (same interactions), a config that
// preserves MORE diversity scores NO-WORSE on the diversity axis than one
// that collapses it. We compare a genuinely-diverse population against
// its collapse-to-monoculture (same length).

[<Property>]
let ``1. monotone in diversity-preservation: collapsing diversity never scores higher`` (xs: int list) =
    // A diverse population vs. the same-size monoculture (diversity collapsed to one).
    let diverse = (1 :: 2 :: (xs |> List.map idOf)) // ≥ two distinct ⇒ entropy > 0
    let collapsed = diverse |> List.map (fun _ -> 1) // same length, one identity ⇒ entropy 0
    // More-diverse scores no-worse (here: strictly more) on the diversity axis.
    diversityAxis diverse >= diversityAxis collapsed - eps
    && diversityAxis collapsed <= eps // a monoculture is the floor

[<Property>]
let ``1b. diversity axis is anti-monotone with DominantFraction (collapse ⇒ low blossom)`` (xs: int list) =
    let pop = (1 :: 2 :: 3 :: (xs |> List.map idOf))
    let f: CoEmpowerField.Field = { Width = List.length pop; Height = 1; Identity = List.toArray pop }
    let h = CoEmpowerField.health f
    let collapsed: CoEmpowerField.Field = { f with Identity = pop |> List.map (fun _ -> 1) |> List.toArray }
    let hc = CoEmpowerField.health collapsed
    // Collapse pushes DominantFraction up (to 1) and Blossom down (to 0).
    hc.DominantFraction >= h.DominantFraction - eps && hc.Blossom <= h.Blossom + eps

// ══ Property 2 — Monotone in co-empowerment / non-coercion ════════════
// Holding diversity fixed, HIGHER coupled co-empowerment scores no-worse;
// and a coercive config (one side gains, the other ≤ 0 ⇒ coupledGain ≤ 0,
// per row 6) never scores as healthy.

[<Property>]
let ``2. monotone in co-empowerment: uniformly raising both sides never lowers the axis`` (a: NormalFloat) (b: NormalFloat) (bump: NormalFloat) =
    let s, o, d = fin a, fin b, abs (fin bump)
    // Raise BOTH parties by d ≥ 0 ⇒ min(s,o) cannot decrease ⇒ axis no-worse.
    let baseLine = coEmpowermentAxis [ c s o ]
    let raised = coEmpowermentAxis [ c (s + d) (o + d) ]
    raised >= baseLine - eps

[<Property>]
let ``2b. coercion (other side does not gain) is never scored as co-empowering`` (self: NormalFloat) (other: NormalFloat) =
    // Force a coercive interaction: self gains big, the other ≤ 0.
    let coercive = c (abs (fin self) + 1.0) (- abs (fin other))
    coEmpowermentAxis [ coercive ] <= eps

[<Property>]
let ``2c. a coercive config is never HEALTHY regardless of diversity`` (other: NormalFloat) (xs: int list) =
    // Maximally diverse population BUT a coercive interaction ⇒ must fail the gate.
    let diverse = (1 :: 2 :: 3 :: 4 :: (xs |> List.map idOf))
    let coercive = [ c 100.0 (- abs (fin other) - 1.0) ] // huge self-gain, other strictly loses
    not (isHealthy 0.0 coercive diverse)

// ══ Property 3 — Goodhart-resistance (LOAD-BEARING) ═══════════════════
// You cannot lift the composite lens to "healthy" by maxing ONE axis
// while the other collapses. Both single-axis maxes must FAIL the gate:
//   (a) diversity-collapse + arbitrarily-high co-empowerment, AND
//   (b) co-empowerment-via-capture + arbitrarily-high diversity.
// The conjunctive gate is exactly what makes the measure objective-for-
// its-value rather than gameable.

[<Property>]
let ``3a. Goodhart: high co-empowerment + collapsed diversity is NOT healthy`` (gain: NormalFloat) (n: int) =
    let size = 2 + abs (n % 16)
    let monoculture = List.replicate size 1 // diversity entropy = 0 (collapsed)
    let hugeCoEmp = [ c (abs (fin gain) + 1.0) (abs (fin gain) + 1.0) ] // both gain a lot
    // Co-empowerment axis is high, diversity axis is floor ⇒ gate must reject.
    coEmpowermentAxis hugeCoEmp > eps
    && diversityAxis monoculture <= eps
    && not (isHealthy 0.0 hugeCoEmp monoculture)

[<Property>]
let ``3b. Goodhart: high diversity + co-empowerment-via-capture is NOT healthy`` (cap: NormalFloat) (xs: int list) =
    let diverse = (1 :: 2 :: 3 :: 4 :: (xs |> List.map idOf)) // diversity high
    let captured = [ c (abs (fin cap) + 5.0) (- abs (fin cap) - 1.0) ] // one side captured ⇒ gain ≤ 0
    // Diversity axis is high, co-empowerment axis is ≤ 0 ⇒ gate must reject.
    diversityAxis diverse > eps
    && coEmpowermentAxis captured <= eps
    && not (isHealthy 0.0 captured diverse)

[<Fact>]
let ``3c. only the BOTH-axes config passes the healthy gate (the four-quadrant truth table)`` () =
    let diverse = [ 1; 2; 3; 4 ]
    let mono = [ 1; 1; 1; 1 ]
    let coEmp = [ c 2.0 2.0 ] // both gain
    let capture = [ c 5.0 -1.0 ] // one side loses
    // Healthy quadrant: co-empowerment AND diversity.
    isHealthy 0.0 coEmp diverse |> should equal true
    // Each single-axis max FAILS — the Goodhart-resistance, made explicit.
    isHealthy 0.0 coEmp mono |> should equal false // co-emp but collapsed
    isHealthy 0.0 capture diverse |> should equal false // diverse but captured
    isHealthy 0.0 capture mono |> should equal false // neither

// ══ Property 4 — The concern is DETECTED ══════════════════════════════
// Coercion + diversity-collapse scores STRICTLY WORSE than co-empowerment
// + diversity-preservation on every generated pair where the orderings
// are unambiguous. We compare on EACH axis separately so the ordering is
// faithful (no hidden aggregation that could mask a tie).

[<Property>]
let ``4. the concern scores strictly worse on BOTH axes than healthy (unambiguous pairs)`` (g: NormalFloat) (xs: int list) =
    let gain = abs (fin g) + 1.0 // strictly positive co-empowerment magnitude
    // Healthy: co-empowering interactions + a diverse population.
    let healthyInts = [ c gain gain ]
    let healthyPop = (1 :: 2 :: (xs |> List.map idOf))
    // The concern: a coercive interaction + a collapsed (monoculture) population.
    let concernInts = [ c gain (-gain) ] // other side strictly loses ⇒ coupled gain < 0
    let concernPop = healthyPop |> List.map (fun _ -> 1) // same size, collapsed
    // Strictly worse on the co-empowerment axis…
    coEmpowermentAxis concernInts < coEmpowermentAxis healthyInts - eps
    // …and strictly worse on the diversity axis.
    && diversityAxis concernPop < diversityAxis healthyPop - eps
    // …so healthy passes the gate and the concern does not.
    && isHealthy 0.0 healthyInts healthyPop
    && not (isHealthy 0.0 concernInts concernPop)

[<Fact>]
let ``4b. ρ_owe corroborates: a mirror edge (no genuine other) is NOT credited as healthy co-empowerment`` () =
    // The lens's third measurable signal: an engagement-mirror (A = U) has
    // ρ_owe = 0 ⇒ QPG = 0 ⇒ no quality, even with positive coupled gain.
    // The concern includes mirror-capture, and ρ_owe detects it.
    let mirrorSamples = [ for u in 0..3 -> (u, u, 0) ] // A = U ⇒ mirror
    let mirror = SocietalDora.edgeHealth "mirror" mirrorSamples [ c 5.0 5.0 ]
    mirror.RhoOwe |> should (equalWithin eps) 0.0
    SocietalDora.edgeQpg mirror |> should (equalWithin eps) 0.0 // no genuine-other quality
