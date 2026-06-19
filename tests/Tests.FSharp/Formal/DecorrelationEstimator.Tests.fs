module Zeta.Tests.Formal.DecorrelationEstimatorTests

open System
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// The measurable anti-mirror / no-hidden-shared-cause estimator
// (`src/Core/Decorrelation.fs`). ρ_owe = H(A|U,C) / H(A|C).
//
// Soraya routing: this is the channel-generic decorrelation signal
// (anti-mirror / G3b / oracle-independence / decorrelated-critic).
// FsCheck = the empirical/measurable half of the cross-check; the
// CHSH/Bell leg + Z3 estimator lemmas are the independent witnesses.
// Scoping: docs/research/2026-06-19-anti-mirror-rigorous-measurable-
//          decorrelation-cmi-own-entropy-scoping.md
// ═══════════════════════════════════════════════════════════════════

let private eps = 1e-9

/// Map arbitrary ints into a small alphabet so entropy is meaningful
/// (and ties are frequent) over FsCheck-generated samples.
let private sm n x = abs (x % n)

let private mk (xs: (int * int * int) list) : (int * int * int) list =
    xs |> List.map (fun (a, u, c) -> sm 4 a, sm 4 u, sm 3 c)

// ── Algebraic invariants (properties over arbitrary samples) ──────────

[<Property>]
let ``rho_owe is in [0, 1]`` (xs: (int * int * int) list) =
    let r = Decorrelation.ownEntropyFraction (mk xs)
    r >= -eps && r <= 1.0 + eps

[<Property>]
let ``mirror (A determined by U) gives rho_owe = 0`` (xs: (int * int * int) list) =
    // Force A := U: the agent's output is a deterministic function of the
    // other party. H(A|U,C) = 0, so ρ_owe must be 0.
    let mirrored = mk xs |> List.map (fun (_, u, c) -> u, u, c)
    Decorrelation.ownEntropyFraction mirrored <= eps

[<Property>]
let ``conditioning reduces entropy: H(A|U) <= H(A)`` (xs: (int * int * int) list) =
    let pairs = mk xs |> List.map (fun (a, u, _) -> a, u)
    Decorrelation.conditionalEntropy pairs <= Decorrelation.entropy (pairs |> List.map fst) + eps

[<Property>]
let ``mutual information is non-negative`` (xs: (int * int * int) list) =
    let pairs = mk xs |> List.map (fun (a, u, _) -> a, u)
    Decorrelation.mutualInformation pairs >= -eps

[<Property>]
let ``mutual information is symmetric`` (xs: (int * int * int) list) =
    let pairs = mk xs |> List.map (fun (a, u, _) -> a, u)
    let swapped = pairs |> List.map (fun (a, u) -> u, a)
    abs (Decorrelation.mutualInformation pairs - Decorrelation.mutualInformation swapped) < 1e-9

[<Property>]
let ``rho_owe is permutation-invariant`` (xs: (int * int * int) list) =
    let s = mk xs
    abs (Decorrelation.ownEntropyFraction s - Decorrelation.ownEntropyFraction (List.rev s)) < 1e-9

[<Property>]
let ``data-processing: coarsening the other variable cannot lower rho_owe`` (xs: (int * int * int) list) =
    // g(U) = U mod 2 is a function of U; by the data-processing inequality
    // I(A; g(U) | C) <= I(A; U | C), so own-entropy (and thus ρ_owe) cannot drop.
    let s = mk xs
    let coarse = s |> List.map (fun (a, u, c) -> a, u % 2, c)
    Decorrelation.ownEntropyFraction coarse >= Decorrelation.ownEntropyFraction s - eps

// ── Extremes & the stake-weighting guard (constructed facts) ──────────

[<Fact>]
let ``entropy: constant is 0, uniform-k is ln k`` () =
    Decorrelation.entropy [ 1; 1; 1; 1 ] |> should (equalWithin eps) 0.0
    Decorrelation.entropy [ 0; 1; 2; 3 ] |> should (equalWithin eps) (log 4.0)

[<Fact>]
let ``independent agent (uniform product grid) gives rho_owe = 1`` () =
    // Full A×U×C grid, each cell once ⇒ A ⫫ (U,C) exactly ⇒ ρ_owe = 1.
    let grid =
        [ for a in 0..2 do
              for u in 0..2 do
                  for c in 0..1 -> a, u, c ]
    Decorrelation.ownEntropyFraction grid |> should (equalWithin 1e-9) 1.0

[<Fact>]
let ``no-context mirror gives 0, independent gives 1`` () =
    let mirror = [ for u in 0..3 -> u, u ] // A = U
    Decorrelation.ownEntropyFraction2 mirror |> should (equalWithin eps) 0.0
    let indep =
        [ for a in 0..2 do
              for u in 0..2 -> a, u ] // uniform grid ⇒ A ⫫ U
    Decorrelation.ownEntropyFraction2 indep |> should (equalWithin 1e-9) 1.0

[<Fact>]
let ``stake-weighting guard: a sycophant who mirrors on what matters scores lower when stake-weighted`` () =
    // The sycophant disagrees freely on low-stake items but MIRRORS (A = U)
    // on high-stake items. Unweighted, the low-stake independence inflates
    // ρ_owe; stake-weighted, the high-stake mirroring dominates and the
    // score collapses — exactly the false-green this guard must catch.
    let highStakeMirror = [ (0, 0, 0); (1, 1, 0) ] // A = U on what matters
    let lowStakeIndep = [ (0, 0, 0); (0, 1, 0); (1, 0, 0); (1, 1, 0) ] // A ⫫ U on trivia

    let unweighted = Decorrelation.ownEntropyFraction (highStakeMirror @ lowStakeIndep)

    let weighted =
        Decorrelation.ownEntropyFractionWeighted (
            (highStakeMirror |> List.map (fun t -> 8.0, t))
            @ (lowStakeIndep |> List.map (fun t -> 1.0, t))
        )

    // The guard must pull the score down by a clear margin when the
    // consequential interactions are mirrored.
    weighted |> should be (lessThan (unweighted - 0.1))
    weighted |> should be (lessThan 0.6)
    unweighted |> should be (greaterThan 0.8)
