module Zeta.Tests.Formal.SocietalDoraSvgTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Slice 1 of the Zeta demo UX/UI: SocietalDora.Metrics → pure SVG
// (no script, integer coords, deterministic = byte-lockable). Verified
// F# substrate; no Q#. docs/research/2026-06-19-zeta-demo-ux-ui-…
// ═══════════════════════════════════════════════════════════════════

let private c s o : SocietalDora.Coupled = { Self = s; Other = o }

let private indep =
    [ for a in 0..2 do
          for u in 0..2 -> (a, u, 0) ] // ρ_owe = 1

[<Fact>]
let ``render is well-formed, scriptless, and deterministic`` () =
    let edges = [ SocietalDora.edgeHealth "a->b" indep [ c 1.0 1.0; c 2.0 1.0 ] ]
    let m = SocietalDora.compute 0.5 edges
    let svg = SocietalDoraSvg.render m
    svg.Contains "<svg" |> should equal true
    svg.Contains "</svg>" |> should equal true
    svg.Contains "<script" |> should equal false // declarative only — no live state
    // deterministic ⇒ byte-lockable (same metrics, same bytes)
    SocietalDoraSvg.render m |> should equal svg

[<Fact>]
let ``a fully-empowering, non-mirror graph renders full empowerment and zero capture bars`` () =
    let edges =
        [ SocietalDora.edgeHealth "aaron->girl" indep [ c 1.0 1.0; c 1.0 2.0 ]
          SocietalDora.edgeHealth "girl->audience" indep [ c 1.0 1.0; c 2.0 1.0 ] ]
    let m = SocietalDora.compute 0.5 edges // EmpowermentFrequency 1.0, CaptureRate 0.0, MirrorRate 0.0
    let svg = SocietalDoraSvg.render m
    // EmpowermentFrequency = 1.0 ⇒ the percent label 100 is shown (unambiguous; the track is always 300px)
    svg.Contains ">100<" |> should equal true
    // all four gauge labels present
    svg.Contains "EmpowermentFrequency" |> should equal true
    svg.Contains "CaptureRate" |> should equal true
    svg.Contains "MirrorRate" |> should equal true
    svg.Contains "QpgWeightedEmpowerment" |> should equal true

[<Fact>]
let ``empty graph renders all-zero bars (no false health on the dashboard)`` () =
    let svg = SocietalDoraSvg.render (SocietalDora.compute 0.5 [])
    svg.Contains "<svg" |> should equal true
    // every gauge reads 0% (unambiguous percent label); none reads 100%
    svg.Contains ">0<" |> should equal true
    svg.Contains ">100<" |> should equal false
