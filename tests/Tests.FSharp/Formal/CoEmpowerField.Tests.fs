module Zeta.Tests.Formal.CoEmpowerFieldTests

open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// CoEmpowerField (`src/Core/CoEmpowerField.fs`): a deterministic (DST)
// society-emergence toy where identities shift by NON-COERCIVE influence
// gated on CO-EMPOWERMENT — NOT attack/combat. Grounded in our NCI
// keystone math (Diversity): non-coercion preserves diversity (blossom);
// coercion (majority-copy) collapses it to monoculture.
// Scoping: docs/research/2026-06-19-nca-territorial-sim-… (reframed);
//          memory/reference_sakana_nca_… (the metaphor we rejected).
// ═══════════════════════════════════════════════════════════════════

[<Property>]
let ``seed + run is deterministic (DST) — same args, same field`` (seed: int) =
    let a = CoEmpowerField.seedField 8 8 4 seed |> CoEmpowerField.run 1 4
    let b = CoEmpowerField.seedField 8 8 4 seed |> CoEmpowerField.run 1 4
    a.Identity = b.Identity

[<Fact>]
let ``the NCI keystone in-sim: non-coercive co-empowerment BLOSSOMS, coercion COLLAPSES`` () =
    let f0 = CoEmpowerField.seedField 14 14 4 42 // a diverse seeded society

    // Non-coercive co-empowerment (consent-gated influence).
    let blossomed = CoEmpowerField.run 1 8 f0 |> CoEmpowerField.health

    // Coercion (majority-copy) — the anti-pattern (Diversity.coerciveStep on the field).
    let collapsed =
        List.fold (fun acc _ -> CoEmpowerField.coerce acc) f0 [ 1..12 ] |> CoEmpowerField.health

    // Non-coercion keeps the society blossoming: multiple identities survive, entropy stays positive.
    blossomed.Diversity |> should be (greaterThanOrEqualTo 2)
    blossomed.Blossom |> should be (greaterThan 0.0)
    // Coercion collapses flourishing strictly more than co-empowerment does (the keystone, made visible).
    collapsed.Blossom |> should be (lessThan blossomed.Blossom)

[<Fact>]
let ``co-empowerment favors a diverse border over a monoculture interior`` () =
    // Interior: all four neighbors are identity 1 → support 4, optionSpace 1 → coEmpowerment 1.
    let interior =
        { CoEmpowerField.Width = 3
          CoEmpowerField.Height = 3
          CoEmpowerField.Identity = [| 1; 1; 1; 1; 1; 1; 1; 1; 1 |] }
    CoEmpowerField.coEmpowerment interior 1 1 1 |> should equal 1

    // Border: center surrounded by 1,1,2,2 → adopting 1: support 2, optionSpace 2 → coEmpowerment 2 (> interior).
    let border =
        { CoEmpowerField.Width = 3
          CoEmpowerField.Height = 3
          CoEmpowerField.Identity = [| 0; 1; 0; 1; 1; 2; 0; 2; 0 |] }
    CoEmpowerField.coEmpowerment border 1 1 1 |> should equal 2

[<Fact>]
let ``Blossom is Diversity.entropy of the identity population`` () =
    let f =
        { CoEmpowerField.Width = 2
          CoEmpowerField.Height = 2
          CoEmpowerField.Identity = [| 1; 1; 1; 1 |] }
    (CoEmpowerField.health f).Blossom |> should (equalWithin 1e-9) 0.0 // monoculture → 0
    let diverse =
        { CoEmpowerField.Width = 2
          CoEmpowerField.Height = 2
          CoEmpowerField.Identity = [| 1; 2; 3; 4 |] }
    (CoEmpowerField.health diverse).Blossom |> should be (greaterThan 0.0)

[<Fact>]
let ``renderField is pure, scriptless SVG`` () =
    let svg = CoEmpowerField.renderField 10 (CoEmpowerField.seedField 6 6 3 7)
    svg.Contains "<svg" |> should equal true
    svg.Contains "<rect" |> should equal true
    svg.Contains "</svg>" |> should equal true
    svg.Contains "<script" |> should equal false
