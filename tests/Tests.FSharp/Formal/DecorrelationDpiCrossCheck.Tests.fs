module Zeta.Tests.Formal.DecorrelationDpiCrossCheckTests

open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Math-team handoff ROW 3 — the FsCheck CROSS-CHECK leg for the
// anti-mirror ρ_owe estimator (`src/Core/Decorrelation.fs`).
//
//   ρ_owe = H(A|U,C) / H(A|C)   (own-entropy fraction; nats)
//
// This is the EMPIRICAL FLOOR that cross-checks the math team's Lean 4
// DPI / soundness theorem — it is EVIDENCE, never the lemma. The Lean
// proof and the Z3 estimator lemmas are the independent witnesses; this
// file is the buildable property leg.
//
// Handoff: docs/handoffs/2026-06-19-otto-to-math-team-nft-ntp-anti-
//          mirror-societal-dora-formalization.md (row 3)
// Scoping: docs/research/2026-06-19-anti-mirror-rigorous-measurable-
//          decorrelation-cmi-own-entropy-scoping.md
//
// NET-NEW only. DecorrelationEstimator.Tests.fs already covers:
//   bounded [0,1] · no-context mirror→0 · product-grid own→1 ·
//   conditioning reduces entropy · MI ≥0 / symmetric · permutation-
//   invariance · DPI-coarsen-U (coarsening U cannot LOWER ρ_owe) ·
//   stake-weighting guard.
// The properties below are the DPI DUAL (refine-U cannot RAISE ρ_owe),
// the WITH-CONTEXT soundness endpoints, and the estimator's
// replication/stake determinism contract — none covered there.
//
// EMPIRICALLY PRE-VERIFIED against the real estimator (0 violations
// over thousands of random draws) before being asserted as properties;
// no property here was weakened to force green.
// ═══════════════════════════════════════════════════════════════════

let private eps = 1e-9

/// Map arbitrary ints into a small alphabet so the plug-in entropy is
/// meaningful (ties frequent) over FsCheck-generated samples.
let private sm n x = abs (x % n)

let private mk (xs: (int * int * int) list) : (int * int * int) list =
    xs |> List.map (fun (a, u, c) -> sm 4 a, sm 4 u, sm 3 c)

// ── 2. Data-processing inequality — the load-bearing leg ──────────────
//
// DPI direction asserted: REFINING the shared-cause / other-party
// variable U (giving U strictly MORE resolving power) cannot INCREASE
// ρ_owe. This is the exact dual of the existing test (coarsening U
// cannot LOWER ρ_owe). Construction: U ↦ (U, A) hands U full knowledge
// of A, so H(A | (U,A), C) = 0 and the numerator can only fall — by DPI
// I(A; U' | C) ≥ I(A; U | C) ⇒ H(A|U',C) ≤ H(A|U,C) ⇒ ρ_owe' ≤ ρ_owe.
// More-information-in-the-shared-cause ⇒ less own-entropy. This is the
// monotonicity the Lean DPI soundness theorem must agree with.
[<Property>]
let ``DPI: refining U (more shared-cause info) cannot raise rho_owe`` (xs: (int * int * int) list) =
    let s = mk xs
    let refined = s |> List.map (fun (a, u, c) -> a, (u, a), c)
    Decorrelation.ownEntropyFraction refined <= Decorrelation.ownEntropyFraction s + eps

// ── 3. Soundness endpoints WITH context present ───────────────────────
//
// The existing mirror→0 / own→1 endpoints exercise the no-context case
// (A=U) and a context-agnostic product grid. These add the WITH-CONTEXT
// anchors the Lean theorem's H(·|C) form must match.

/// MIRROR through the JOINT shared cause: A is a deterministic, NON-
/// constant function of (U,C). Then H(A|U,C)=0 ⇒ ρ_owe=0 even with a
/// nontrivial context C. (Degenerate-constant guard also returns 0, so
/// this holds regardless of whether the constructed A happens constant.)
[<Property>]
let ``soundness: A determined by (U,C) drives rho_owe to 0`` (xs: (int * int * int) list) =
    let s = mk xs
    let mirror = s |> List.map (fun (_, u, c) -> (u + c) % 4, u, c)
    Decorrelation.ownEntropyFraction mirror <= eps

/// FULLY-OWN with context present: a complete A×U product within each
/// context cell ⇒ A ⫫ U | C ⇒ H(A|U,C) = H(A|C) ⇒ ρ_owe = 1. This is
/// the upper-anchor the theorem must agree with when C is non-trivial.
[<Fact>]
let ``soundness: A independent of U given C (with context) gives rho_owe = 1`` () =
    let ownWithContext =
        [ for c in 0..1 do
              for a in 0..2 do
                  for u in 0..2 -> a, u, c ]
    Decorrelation.ownEntropyFraction ownWithContext
    |> should (equalWithin 1e-9) 1.0

// ── 4. Determinism / scale contract of the estimator ──────────────────

/// Replication invariance: duplicating every sample (uniform stakes)
/// leaves ρ_owe unchanged — the plug-in distribution is identical, so
/// the estimator depends only on the empirical law, not the count. This
/// is the determinism contract the DST replay relies on.
[<Property>]
let ``determinism: replicating samples leaves rho_owe unchanged`` (xs: (int * int * int) list) =
    let s = mk xs
    abs (Decorrelation.ownEntropyFraction (s @ s) - Decorrelation.ownEntropyFraction s) < 1e-9

/// Uniform-stake equivalence: a single positive stake applied to every
/// sample equals the unweighted ρ_owe (weights normalize away). NormalFloat
/// keeps the stake a finite real; abs+0.1 forces it strictly positive.
[<Property>]
let ``determinism: a uniform positive stake equals the unweighted rho_owe`` (xs: (int * int * int) list) (w: NormalFloat) =
    let s = mk xs
    let stake = abs w.Get + 0.1
    let unweighted = Decorrelation.ownEntropyFraction s
    let weighted = Decorrelation.ownEntropyFractionWeighted (s |> List.map (fun t -> stake, t))
    abs (unweighted - weighted) < 1e-9
